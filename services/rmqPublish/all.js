/**
 * Publish event to RabbitMQ using fanout exchange.
 *
 * @module services/rmqPublish/all
 */

const Base = require('@truesparrow/base');

const rootPrefix = '../..',
  apiErrorConfig = require(rootPrefix + '/config/apiErrorConfig'),
  paramErrorConfig = require(rootPrefix + '/config/paramErrorConfig'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  coreConstant = require(rootPrefix + '/config/coreConstant');

const InstanceComposer = Base.InstanceComposer;

require(rootPrefix + '/lib/rabbitmq/connection');

const errorConfig = {
    param_error_config: paramErrorConfig,
    api_error_config: apiErrorConfig
  },
  exchange = 'fanout_events';

class PublishEventToAll {
  constructor() {}

  async perform(params) {
    const oThis = this;

    if (!params['message']) {
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 's_rp_a_2',
          api_error_identifier: 'invalid_message_params',
          error_config: errorConfig,
          debug_options: {}
        })
      );
    }

    let rabbitMqConnection = oThis.ic().getInstanceFor(coreConstant.icNameSpace, 'rabbitmqConnection'),
      msgString = JSON.stringify(params['message']);

    const conn = await rabbitMqConnection.get();
    if (conn) {
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

        ch.assertExchange(exchange, 'fanout', {
          durable: true
        });
        ch.publish(exchange, '', new Buffer(msgString), { persistent: true });
        console.log(' [x] Sent message');

        ch.close();
      });
    } else {
      return Promise.resolve(
        responseHelper.error({
          internal_error_identifier: 's_rp_a_3',
          api_error_identifier: 'no_rmq_connection',
          error_config: errorConfig,
          debug_options: {}
        })
      );
    }

    return Promise.resolve(responseHelper.successWithData({ publishedToRmq: 1 }));
  }
}

InstanceComposer.registerAsObject(PublishEventToAll, coreConstant.icNameSpace, 'PublishEventToAll', true);

module.exports = {};
