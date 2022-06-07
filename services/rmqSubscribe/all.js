/**
 * Listening to RabbitMq channels to receive published message.
 *
 * @module services/rmqSubscribe/all
 */

const PLGWorksBase = require('@plgworks/base');

const rootPrefix = '../..',
  SubscriptionBase = require(rootPrefix + '/services/rmqSubscribe/Base'),
  coreConstant = require(rootPrefix + '/config/coreConstant');

const InstanceComposer = PLGWorksBase.InstanceComposer;

require(rootPrefix + '/lib/rabbitmq/connection');

/**
 * Constructor to subscribe RMQ event
 *
 * @constructor
 */
class FanoutSubscription extends SubscriptionBase {
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

    options.exchangeName = 'fanout_events';
    options.exchangeType = 'fanout';
    return super.rabbit(topics, options, readCallback, subscribeCallback);
  }

  /**
   * Get Keys to Bind Queue with
   *
   * @param topics
   */
  getQueueBindingKeys(topics) {
    // Queue doesn't needs to be bind to any key for Fanout.
    return [''];
  }
}

InstanceComposer.registerAsObject(FanoutSubscription, coreConstant.icNameSpace, 'FanoutSubscription', true);

module.exports = {};
