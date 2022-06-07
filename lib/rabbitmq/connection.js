/**
 * Pseudo Singleton Object (in the context of a config strategy) to manage and establish RabbitMq connections
 *
 * @module lib/rabbitmq/connection
 */

const PLGWorksBase = require('@plgworks/base');

const rootPrefix = '../..',
  amqp = require('amqplib/callback_api'),
  rabbitmqHelper = require(rootPrefix + '/lib/rabbitmq/helper'),
  localEvents = require(rootPrefix + '/services/localEmitter'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  coreConstant = require(rootPrefix + '/config/coreConstant');

const InstanceComposer = PLGWorksBase.InstanceComposer;

const rmqIdToConnectionMap = {},
  rmqIdToInProcessRequestsMap = {};

let lastAttemptTimeMS = null,
  d = 0;

class RabbitmqConnection {
  /**
   *
   * @param {object} configStrategy - config strategy
   * @param {object} instanceComposer - Instance Composer object
   *
   * @param configStrategy
   * @param instanceComposer
   * @constructor
   */
  constructor(configStrategy, instanceComposer) {
    const oThis = this;

    oThis.rmqId = rabbitmqHelper.getRmqId(configStrategy);
    oThis.instanceKey = rabbitmqHelper.getInstanceKey(configStrategy);
    oThis.rmqHost = rabbitmqHelper.getConfigRmqHost(configStrategy);
    oThis.configRmqClusterNodes = rabbitmqHelper.getConfigRmqClusterNodes(configStrategy);

    // Wait in seconds for connection to establish.
    oThis.getConnectionTimeout = configStrategy.rabbitmq.connectionTimeoutSec;
    oThis.switchHostAfterTime = configStrategy.rabbitmq.switchHostAfterSec || 30;
  }

  /**
   * Get the established connection and return. If connection is not present set new connection in required mode.
   *
   * @return {Promise}
   */
  get() {
    const oThis = this;

    if (oThis.ic().configStrategy.rabbitmq.enableRabbitmq != '1') {
      return Promise.resolve(null);
    } else if (rmqIdToConnectionMap[oThis.rmqId]) {
      // If connection is present in map, return the same connection.
      return Promise.resolve(rmqIdToConnectionMap[oThis.rmqId]);
    } else {
      let promiseContext = {
          promiseObj: null,
          resolve: null,
          reject: null
        },
        promiseObj = new Promise(function(resolve, reject) {
          promiseContext.resolve = resolve;
          promiseContext.reject = reject;
        });

      promiseContext.promiseObj = promiseObj;

      //Timeout is part of instancekey. Higher timeout connection attempt should not block lower timeout connection attempts.
      //Two different instanceKey can have same rmqId. This will happen when only connection timeout parameter is different.
      rmqIdToInProcessRequestsMap[oThis.instanceKey] = rmqIdToInProcessRequestsMap[oThis.instanceKey] || [];

      if (rmqIdToInProcessRequestsMap[oThis.instanceKey].length === 0) {
        // if this is the first request, initiate connection creation
        rmqIdToInProcessRequestsMap[oThis.instanceKey].push(promiseContext);

        oThis
          .set()
          .then(
            function(conn) {
              oThis.resolveAll(conn);
            },
            function(err) {
              oThis.rejectAll(err);
            }
          )
          .catch(function(err) {
            oThis.rejectAll('unhandled error in lib/rabbitmq/connection.js while calling set. error:', err);
          });
      } else {
        // else push into the list of in process request and wait for connection to be made by the head of the array
        rmqIdToInProcessRequestsMap[oThis.instanceKey].push(promiseContext);
      }

      return promiseObj;
    }
  }

  /**
   * Resolve all the in process requests
   *
   * @param {object} conn - connection object
   */
  resolveAll(conn) {
    const oThis = this;

    while (rmqIdToInProcessRequestsMap[oThis.instanceKey][0]) {
      let promiseContext = rmqIdToInProcessRequestsMap[oThis.instanceKey].shift();

      let resolve = promiseContext.resolve;
      resolve(conn);
    }
  }

  /**
   * Reject all the in process requests
   *
   * @param {string} reason - error string to reject with
   */
  rejectAll(reason) {
    const oThis = this;

    while (rmqIdToInProcessRequestsMap[oThis.instanceKey][0]) {
      let promiseContext = rmqIdToInProcessRequestsMap[oThis.instanceKey].shift();

      let reject = promiseContext.reject;
      reject(reason);
    }
  }

  /**
   * Establishing new connection to RabbitMq.
   *
   * @returns {Promise}
   */
  set() {
    // Declare variables.
    const oThis = this,
      retryIntervalInMs = 1000;

    let connectionAttempts = 0,
      timedOutReason = null,
      connectionTimeout = null,
      rmqId = oThis.rmqId;

    if (oThis.ic().configStrategy.rabbitmq.enableRabbitmq != '1') {
      return Promise.resolve(null);
    }

    return new Promise(function(onResolve, onReject) {
      let connectRmqInstance = function() {
        if (!lastAttemptTimeMS) {
          lastAttemptTimeMS = Date.now();
        }

        if (rmqIdToConnectionMap[rmqId]) {
          return onResolve(rmqIdToConnectionMap[rmqId]);
        } else if (timedOutReason) {
          return onReject(new Error(timedOutReason));
        }

        logger.log('Connection will attempted on: ', oThis.ic().configStrategy.rabbitmq.host);
        amqp.connect(
          rabbitmqHelper.connectionString(oThis.ic().configStrategy),
          { timeout: rabbitmqHelper.socketConnectionTimeout },
          function(err, conn) {
            if (err || !conn) {
              rmqIdToConnectionMap[rmqId] = null;
              logger.error('Error from rmq connection attempt : ' + err);
              connectionAttempts++;
              logger.info('Trying connect after(ms) ', retryIntervalInMs);
              setTimeout(function() {
                if (connectionAttempts >= rabbitmqHelper.maxConnectionAttempts) {
                  logger.error('Maximum retry attempts for connection reached');
                  timedOutReason = 'Maximum retry connects failed for rmqId:' + rmqId;
                  process.emit('connectionTimedOut', { failedHost: oThis.rmqHost });
                }
                switchConnectionParams();
                connectRmqInstance();
              }, retryIntervalInMs); //Retry every 1 second
            } else {
              conn.once('error', function(err) {
                logger.error('[AMQP] conn error', err.message);

                if (err.message !== 'Connection closing') {
                  logger.error('[AMQP] conn error in closing');
                }
                delete rmqIdToConnectionMap[rmqId];

                // NOTE: Don't reconnect here, because all error will also trigger 'close' event.
                // localEvents.emitObj.emit('rmq_fail', err);
                // connectRmqInstance();
              });

              conn.once('close', function(c_msg) {
                logger.info('[AMQP] reconnecting', c_msg);
                delete rmqIdToConnectionMap[rmqId];
                localEvents.emitObj.emit('rmq_fail', c_msg);
                connectRmqInstance();
              });

              logger.info('RMQ Connection Established..');
              //Connections should be saved under rmqId. So that one connection of one rmqId is assured.
              rmqIdToConnectionMap[rmqId] = conn;
              timedOutReason = null;

              if (connectionTimeout) {
                clearTimeout(connectionTimeout);
              }

              lastAttemptTimeMS = null;
              connectionAttempts = 0; //ConnectionAttempt reset here. So that at next failure, connectionAttempts counter starts from 0.
              return onResolve(conn);
            }
          }
        );
      };

      let switchConnectionParams = function() {
        //variable d is used to ensure locking
        if (
          ++d == 1 &&
          oThis.switchHostAfterTime &&
          lastAttemptTimeMS &&
          (Date.now() - lastAttemptTimeMS) / 1000 > oThis.switchHostAfterTime
        ) {
          lastAttemptTimeMS = Date.now();
          if (!rmqIdToConnectionMap[rmqId] && oThis.configRmqClusterNodes.length > 1) {
            logger.error('SwitchHostAfterTime Connection not established for rmqId:' + rmqId, connectionAttempts);
            timedOutReason = null;
            let configStrategy = oThis.ic().configStrategy;
            for (let i = 0; i < oThis.configRmqClusterNodes.length; i++) {
              let newHost = oThis.configRmqClusterNodes[i];
              if (newHost != oThis.rmqHost) {
                logger.step(
                  'Will try to establish connection on Host ' + newHost + ' - rmqId:' + rmqId,
                  connectionAttempts
                );
                Object.assign(configStrategy.rabbitmq, { host: newHost });
                rmqId = rabbitmqHelper.getRmqId(configStrategy);
                process.emit('switchConnectionHost', { newHost: newHost, failedHost: oThis.rmqHost });
                oThis.rmqHost = newHost;
                break;
              }
            }
          }
          d = 0;
        } else {
          d--;
        }
      };

      /**
       * Function to set connection timeout. Specifically used to quit attempting any more connections.
       */
      let setConnectionTimeout = function() {
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
        }
        if (oThis.getConnectionTimeout) {
          logger.info('Connection Timeout :', oThis.getConnectionTimeout);
          connectionTimeout = setTimeout(function() {
            if (!rmqIdToConnectionMap[rmqId]) {
              logger.error('Connection timed out for rmqId:' + rmqId);
              timedOutReason = 'Connection timed out for rmqId:' + rmqId;
              process.emit('connectionTimedOut', { failedHost: oThis.rmqHost });
            }
          }, oThis.getConnectionTimeout * 1000);
        }
      };

      setConnectionTimeout();
      connectRmqInstance();
    });
  }
}

InstanceComposer.registerAsObject(RabbitmqConnection, coreConstant.icNameSpace, 'rabbitmqConnection', true);

module.exports = {};
