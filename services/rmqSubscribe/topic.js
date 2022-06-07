/**
 * Listening to RabbitMq channels to receive published message.
 *
 * @module services/rmqSubscribe/topic
 */

const PLGWorksBase = require('@plgworks/base');

const rootPrefix = '../..',
  SubscriptionBase = require(rootPrefix + '/services/rmqSubscribe/Base'),
  logger = require(rootPrefix + '/lib/logger/customConsoleLogger'),
  coreConstant = require(rootPrefix + '/config/coreConstant');

const InstanceComposer = PLGWorksBase.InstanceComposer;

require(rootPrefix + '/lib/rabbitmq/connection');

/**
 * Constructor to subscribe RMQ event
 *
 * @constructor
 */
class RmqSubscribeByTopic extends SubscriptionBase {
  constructor() {
    super();
  }

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

    if (topics.length === 0) {
      logger.error('Invalid topic parameters.');
      process.emit('rmq_error', 'Invalid topic parameters.');
      return;
    }

    oThis.topics = topics;

    options.exchangeName = 'topic_events';
    options.exchangeType = 'topic';
    return super.rabbit(topics, options, readCallback, subscribeCallback);
  }

  /**
   * Get Keys to Bind Queue with
   *
   * @param topics
   */
  getQueueBindingKeys(topics) {
    return topics;
  }
}

InstanceComposer.registerAsObject(RmqSubscribeByTopic, coreConstant.icNameSpace, 'RmqSubscribeByTopic', true);

module.exports = {};
