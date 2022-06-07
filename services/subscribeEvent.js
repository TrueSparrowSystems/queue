/**
 * Listening to RabbitMq channels to receive published message.
 *
 * @module services/subscribeEvent
 */

const PLGWorksBase = require('@plgworks/base');

const rootPrefix = '..',
  coreConstant = require(rootPrefix + '/config/coreConstant');

const InstanceComposer = PLGWorksBase.InstanceComposer;

require(rootPrefix + '/services/rmqSubscribe/topic');
require(rootPrefix + '/services/rmqSubscribe/all');

/**
 * Constructor to publish RMQ event
 *
 * @constructor
 */
class SubscribeEvent {
  constructor() {}

  /**
   * Subscribe to rabbitMq topics to receive messages.
   *
   * @param {array} topics - list of topics to receive messages.
   * @param {object} options -
   * @param {string} [options.queue] - RMQ queue name.
   * @param {string} [options.broadcastSubscription] - Subscribe to events which is broadcasted.
   *    - Name of the queue on which you want to receive all your subscribed events.
   *    These queues and events, published in them, have TTL of 6 days.
   *    If queue name is not passed, a queue with unique name is created and is deleted when subscriber gets disconnected.
   * @param {function} readCallback - function to run on message arrived on the channel.
   * @param {function} subscribeCallback - function to return consumerTag.
   *
   */
  async rabbit(topics, options, readCallback, subscribeCallback) {
    const oThis = this;

    let subOptions = JSON.parse(JSON.stringify(options));
    // If Queue needs to be subscribed for broadcast events
    if (subOptions.broadcastSubscription == 1) {
      let subscribeToAll = oThis.ic().getInstanceFor(coreConstant.icNameSpace, 'FanoutSubscription');
      subscribeToAll.rabbit([], subOptions, readCallback, subscribeCallback);
    }

    subOptions = JSON.parse(JSON.stringify(options));
    // If topics are present then subscribe queue to particluar topics
    if (topics.length > 0) {
      let subscribeToTopics = oThis.ic().getInstanceFor(coreConstant.icNameSpace, 'RmqSubscribeByTopic');
      subscribeToTopics.rabbit(topics, subOptions, readCallback, subscribeCallback);
    }
  }
}

InstanceComposer.registerAsObject(SubscribeEvent, coreConstant.icNameSpace, 'subscribeEvent', true);

module.exports = {};
