/**
 * Listening to RabbitMq channels to receive published message.
 *
 * @module services/rmqSubscribe/Base
 */

const Base = require('@truesparrow/base');
const { v4: uuidV4 } = require('uuid');

const rootPrefix = '../..',
  rabbitmqHelper = require(rootPrefix + '/lib/rabbitmq/helper'),
  localEmitter = require(rootPrefix + '/services/localEmitter'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  coreConstant = require(rootPrefix + '/config/coreConstant');

const InstanceComposer = Base.InstanceComposer;

require(rootPrefix + '/lib/rabbitmq/connection');

/**
 * Constructor to subscribe RMQ event
 *
 * @constructor
 */
class SubscribeEventBase {
  constructor() {}

  /**
   * Subscribe to rabbitMq topics to receive messages.
   *
   * @param {array} topics - list of topics to receive messages.
   * @param {object} options -
   * @param {string} [options.queue] - RMQ queue name.
   *    - Name of the queue on which you want to receive all your subscribed events.
   *    These queues and events, published in them, have TTL of 6 days.
   *    If queue name is not passed, a queue with unique name is created and is deleted when subscriber gets disconnected.
   * @param {function} readCallback - function to run on message arrived on the channel.
   * @param {function} subscribeCallback - function to return consumerTag.
   *
   */
  async rabbit(topics, options, readCallback, subscribeCallback) {
    const oThis = this;

    if (oThis.ic().configStrategy.rabbitmq.enableRabbitmq != '1') {
      logger.error('There is no rmq support. Error. ');
      process.emit('rmq_error', 'There is no rmq support.');
      return;
    }

    let rabbitMqConnection = oThis.ic().getInstanceFor(coreConstant.icNameSpace, 'rabbitmqConnection');

    options.prefetch = options.prefetch || 1;
    options.noAck = options.ackRequired !== 1;

    const conn = await rabbitMqConnection.get();

    if (!conn) {
      logger.error('Not able to establish rabbitMQ connection for now. Please try after sometime.');
      process.emit('rmq_error', 'Not able to establish rabbitMQ connection for now. Please try after sometime.');
      return;
    }

    conn.createChannel(function(err, ch) {
      const consumerTag = uuidV4();

      if (err) {
        logger.error('channel could  be not created: Error: ', err);
        process.emit('rmq_error', 'channel could  be not created: Error:' + err);
        return;
      }

      ch.once('error', function(err) {
        logger.error('[AMQP] Channel error', err);
        process.emit('rmq_error', '[AMQP] Channel error: Error:' + err);
      });
      ch.once('close', function() {
        logger.error('[AMQP] Channel Closed');
      });

      const ex = options.exchangeName;

      // Call only if subscribeCallback is passed.
      subscribeCallback && subscribeCallback(consumerTag);

      ch.assertExchange(ex, options.exchangeType, { durable: true });

      const assertQueueCallback = function(err, q) {
        if (err) {
          logger.error('subscriber could not assert queue: ' + err);
          process.emit('rmq_error', 'subscriber could not assert queue:' + err);
          return;
        }

        logger.info(' [*] Waiting for logs. To exit press CTRL+C', q.queue);

        oThis.getQueueBindingKeys(topics).forEach(function(key) {
          ch.bindQueue(q.queue, ex, key);
        });

        ch.prefetch(options.prefetch);

        const startConsumption = function() {
          ch.consume(
            q.queue,
            function(msg) {
              const msgContent = msg.content.toString();
              if (options.noAck) {
                readCallback(msgContent);
              } else {
                let successCallback = function() {
                  logger.debug('done with ack');
                  ch.ack(msg);
                };
                let rejectCallback = function() {
                  logger.debug('requeue message');
                  ch.nack(msg);
                };
                readCallback(msgContent).then(successCallback, rejectCallback);
              }
            },
            { noAck: options.noAck, consumerTag: consumerTag }
          );
        };
        // If queue should start consuming as well.
        if (!options.onlyAssert) {
          startConsumption();

          process.on('CANCEL_CONSUME', function(ct) {
            if (ct === consumerTag) {
              logger.info('Received CANCEL_CONSUME, cancelling consumption of', ct);
              ch.cancel(consumerTag);
            }
          });
          process.on('RESUME_CONSUME', function(ct) {
            if (ct === consumerTag) {
              logger.info('Received RESUME_CONSUME, Resuming consumption of', ct);
              startConsumption();
            }
          });
        } else {
          logger.info('Closing the channel as only assert queue was required.');
          ch.close();
        }
      };

      if (options['queue']) {
        ch.assertQueue(
          options['queue'],
          {
            autoDelete: false,
            durable: true,
            arguments: {
              'x-expires': rabbitmqHelper.dedicatedQueueTtl,
              'x-message-ttl': rabbitmqHelper.dedicatedQueueMsgTtl
            }
          },
          assertQueueCallback
        );
      } else {
        ch.assertQueue('', { exclusive: true }, assertQueueCallback);
      }
    });

    localEmitter.emitObj.once('rmq_fail', function(err) {
      logger.error('RMQ Failed event received. Error: ', err);
      setTimeout(function() {
        logger.info('trying consume again......'); //Following catch will specifically catch connection timeout error. Thus will emit proper event
        oThis.rabbit(topics, options, readCallback, subscribeCallback).catch(function(err) {
          logger.error('Error in subscription. ', err);
          process.emit('rmq_error', 'Error in subscription:' + err);
        });
      }, 2000);
    });
  }

  /**
   * Subscribe local emitters by topics to receive messages.
   * Note: messages could be received only on the same object(thus, same process) where the message was emitted.
   *
   * @param {array} topics - list of topics to receive messages.
   * @param {function} readCallback - function to run on message arrived on the channel.
   *
   */
  local(topics, readCallback) {
    if (topics.length === 0) {
      logger.error('Invalid parameters Error: topics are mandatory');
      return;
    }

    topics.forEach(function(key) {
      localEmitter.emitObj.on(key, readCallback);
    });
  }

  /**
   * Get Keys to Bind Queue with
   *
   * @param topics
   */
  getQueueBindingKeys(topics) {
    throw 'Sub-class to implement';
  }
}

module.exports = SubscribeEventBase;
