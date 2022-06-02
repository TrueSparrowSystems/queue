/**
 * Publish event to RabbitMQ.
 *
 * @module services/publishEvent
 */

const PLGWorksBase = require('@plgworks/base');

const rootPrefix = '..',
  coreConstant = require(rootPrefix + '/config/coreConstant');

const InstanceComposer = PLGWorksBase.InstanceComposer;

require(rootPrefix + '/services/rmqPublish/topic');
require(rootPrefix + '/services/rmqPublish/all');

/**
 * Constructor to publish RMQ event
 *
 * @constructor
 */
class RmqPublishEvent {
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

    params = params || {};

    if (params['broadcast']) {
      let rmqBroadcastToAll = oThis.ic().getInstanceFor(coreConstant.icNameSpace, 'PublishEventToAll');
      return rmqBroadcastToAll.perform(params);
    } else {
      let rmqPublishByTopic = oThis.ic().getInstanceFor(coreConstant.icNameSpace, 'RmqPublishByTopic');
      return rmqPublishByTopic.perform(params);
    }
  }
}

InstanceComposer.registerAsObject(RmqPublishEvent, coreConstant.icNameSpace, 'publishEvent', true);

module.exports = {};
