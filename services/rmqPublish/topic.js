/**
 * Publish event to RabbitMQ.
 *
 * @module services/rmqPublish/topic
 */

const PLGWorksBase = require('@plgworks/base');

const rootPrefix = '../..',
  validator = require(rootPrefix + '/lib/validator/init'),
  localEmitter = require(rootPrefix + '/services/localEmitter'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  apiErrorConfig = require(rootPrefix + '/config/apiErrorConfig'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  paramErrorConfig = require(rootPrefix + '/config/paramErrorConfig'),
  coreConstant = require(rootPrefix + '/config/coreConstant');

const InstanceComposer = PLGWorksBase.InstanceComposer;

require(rootPrefix + '/lib/rabbitmq/connection');

const errorConfig = {
  param_error_config: paramErrorConfig,
  api_error_config: apiErrorConfig
};

/**
 * Constructor to publish RMQ event
 *
 * @constructor
 */
class RmqPublishByTopic {
  constructor() {}

  /**
   * Publish to rabbitMQ and local emitter also.
   *
   * @param {object} params - event parameters
   * @param {array} params.topics - on which topic messages
   * @param {object} params.message -
   * @param {string} params.message.kind - kind of the message
   * @param {object} params.message.payload - Payload to identify message and extra info.
   *
   * @return {Promise<result>}
   */
  async perform(params) {
    const oThis = this;

    // Validations.
    const r = await validator.light(params);
    if (r.isFailure()) {
      logger.error(r);
      return Promise.resolve(r);
    }

    let validatedParams = r.data,
      topics = validatedParams['topics'],
      msgString = JSON.stringify(validatedParams),
      publishAfter = params['publishAfter'];

    let publishedInRmq = 0;

    // Publish local events.
    topics.forEach(function(key) {
      localEmitter.emitObj.emit(key, msgString);
    });

    if (oThis.ic().configStrategy.rabbitmq.enableRabbitmq == '1') {
      let rabbitMqConnection = oThis.ic().getInstanceFor(coreConstant.icNameSpace, 'rabbitmqConnection');

      // Publish RMQ events.
      const conn = await rabbitMqConnection.get();

      if (conn) {
        publishedInRmq = 1;
        let r = await oThis.publishNow(conn, topics, msgString, publishAfter);
        if (r.isFailure()) {
          return Promise.resolve(r);
        }

        if (publishAfter) {
          r = await oThis.publishDelayed(conn, topics, msgString, publishAfter);
          if (r.isFailure()) {
            return Promise.resolve(r);
          }
        }
      } else {
        let errorParams = {
          internal_error_identifier: 's_rp_t_1',
          api_error_identifier: 'no_rmq_connection',
          error_config: errorConfig,
          debug_options: {}
        };
        return Promise.resolve(responseHelper.error(errorParams));
      }
    }

    return Promise.resolve(responseHelper.successWithData({ publishedToRmq: publishedInRmq }));
  }

  async publishNow(conn, topics, msgString, publishAfter) {
    const oThis = this;

    return new Promise(function(onResolve, onReject) {
      conn.createChannel(function(err, ch) {
        if (err) {
          let errorParams = {
            internal_error_identifier: 's_rp_t_2',
            api_error_identifier: 'cannot_create_channel',
            error_config: errorConfig,
            debug_options: { err: err }
          };
          logger.error(err.message);
          return onResolve(responseHelper.error(errorParams));
        }

        ch.assertExchange(oThis.exchangeName, 'topic', { durable: true });

        if (!publishAfter) {
          for (let index = 0; index < topics.length; index++) {
            let currTopic = topics[index];
            ch.publish(oThis.exchangeName, currTopic, new Buffer(msgString), { persistent: true });
          }
        }
        ch.close();

        return onResolve(responseHelper.successWithData({}));
      });
    });
  }

  get exchangeName() {
    return 'topic_events';
  }

  async publishDelayed(conn, topics, msgString, publishAfter) {
    const oThis = this;

    return new Promise(function(onResolve, onReject) {
      conn.createChannel(function(err, ch) {
        if (err) {
          let errorParams = {
            internal_error_identifier: 's_rp_t_3',
            api_error_identifier: 'cannot_create_channel',
            error_config: errorConfig,
            debug_options: { err: err }
          };
          logger.error(err.message);
          return onResolve(responseHelper.error(errorParams));
        }

        ch.assertExchange(oThis.delayedExchangeName, 'topic', { durable: true });

        for (let index = 0; index < topics.length; index++) {
          let currTopic = topics[index],
            delayedQueueName = `${oThis.delayedExchangeName}_${currTopic}_queue_${publishAfter}`;

          ch.assertQueue(
            delayedQueueName,
            {
              exclusive: false,
              durable: true,
              arguments: {
                'x-dead-letter-exchange': oThis.exchangeName,
                'x-dead-letter-routing-key': currTopic,
                'x-message-ttl': publishAfter,
                'x-expires': publishAfter * 10
              }
            },
            function(error2, q) {
              if (error2) {
                throw error2;
              }
              console.log(' [*] Waiting for messages in %s. To exit press CTRL+C', q.queue);
              ch.bindQueue(q.queue, oThis.delayedExchangeName, q.queue);

              ch.publish(oThis.delayedExchangeName, q.queue, new Buffer(msgString), { persistent: true });
              console.log(' [x] Sent to DLX "', oThis.delayedExchangeName, '" with routing key', currTopic);

              ch.close();
            }
          );
        }

        return onResolve(responseHelper.successWithData({}));
      });
    });
  }

  get delayedExchangeName() {
    return 'delayed_topic_events';
  }
}

InstanceComposer.registerAsObject(RmqPublishByTopic, coreConstant.icNameSpace, 'RmqPublishByTopic', true);

module.exports = {};
