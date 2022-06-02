/**
 * Validator service to be called to validate received message to subscriber.
 *
 * @module lib/validator/init
 */

const rootPrefix = '../..',
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  eventParams = require(rootPrefix + '/lib/validator/eventParam'),
  util = require(rootPrefix + '/lib/util'),
  paramErrorConfig = require(rootPrefix + '/config/paramErrorConfig'),
  apiErrorConfig = require(rootPrefix + '/config/apiErrorConfig');

const errorConfig = {
  param_error_config: paramErrorConfig,
  api_error_config: apiErrorConfig
};

/**
 * Validate event parameters constructor
 *
 * @constructor
 */
class Init {
  constructor() {}

  /**
   * Perform detailed validation for specific event params
   *
   * @param {object} params - event parameters
   * @param {array} params.topics - on which topic messages
   * @param {object} params.message -
   * @param {string} params.message.kind - kind of the message
   * @param {object} params.message.payload - Payload to identify message and extra info.
   *
   * @return {Promise<result>}
   */
  async detailed(params) {
    const oThis = this;

    let r = oThis.light(params);

    if (r.isFailure()) {
      return Promise.resolve(r);
    }

    let message = params['message'];

    if (message['kind'] === 'event_received') {
      if (message['payload']['event_name'] === 'StakingIntentConfirmed') {
        r = await eventParams.validateStakingIntent(message['payload']['params']);
        if (r.isFailure()) {
          return Promise.resolve(r);
        }
      }
    }

    return Promise.resolve(responseHelper.successWithData({}));
  }

  /**
   * Perform basic validation for specific event params
   *
   * @param {object} params - event parameters
   *  * {array} topics - on which topic messages
   *  * {object} message -
   *    ** {string} kind - kind of the message
   *    ** {object} payload - Payload to identify message and extra info.
   *
   * @return {Promise<result>}
   */
  light(params) {
    let validatedParams = {};

    if (
      !util.valPresent(params) ||
      !util.valPresent(params['message']) ||
      !util.valPresent(params['topics']) ||
      params['topics'].length === 0 ||
      !util.valPresent(params['publisher'])
    ) {
      let errorParams = {
        internal_error_identifier: 's_v_i_1',
        api_error_identifier: 'invalid_notification_params',
        error_config: errorConfig,
        debug_options: {}
      };
      return Promise.resolve(responseHelper.error(errorParams));
    }

    validatedParams['topics'] = params['topics'];
    validatedParams['publisher'] = params['publisher'];

    validatedParams['message'] = {};

    const message = params['message'];

    if (!util.valPresent(message) || !util.valPresent(message['kind']) || !util.valPresent(message['payload'])) {
      let errorParams = {
        internal_error_identifier: 's_v_i_2',
        api_error_identifier: 'invalid_message_params',
        error_config: errorConfig,
        debug_options: {}
      };
      return Promise.resolve(responseHelper.error(errorParams));
    }

    validatedParams['message']['kind'] = message['kind'];
    validatedParams['message']['payload'] = message['payload'];

    return Promise.resolve(responseHelper.successWithData(validatedParams));
  }
}

module.exports = new Init();
