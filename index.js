const PLGWorksBase = require('@plgworks/base');

const rootPrefix = '.',
  version = require(rootPrefix + '/package.json').version,
  rabbitmqHelper = require(rootPrefix + '/lib/rabbitmq/helper'),
  coreConstant = require(rootPrefix + '/config/coreConstant');

const InstanceComposer = PLGWorksBase.InstanceComposer;

require(rootPrefix + '/lib/rabbitmq/helper');
require(rootPrefix + '/lib/rabbitmq/connection');
require(rootPrefix + '/services/publishEvent');
require(rootPrefix + '/services/subscribeEvent');

/**
 * Queue Manager.
 *
 * @param configStrategy
 * @constructor
 */
const QueueManager = function(configStrategy) {
  const oThis = this;

  if (!configStrategy) {
    throw 'Mandatory argument configStrategy missing.';
  }

  const instanceComposer = (oThis.ic = new InstanceComposer(configStrategy));

  oThis.version = version;
  oThis.connection = instanceComposer.getInstanceFor(coreConstant.icNameSpace, 'rabbitmqConnection');
  oThis.publishEvent = instanceComposer.getInstanceFor(coreConstant.icNameSpace, 'publishEvent');
  oThis.subscribeEvent = instanceComposer.getInstanceFor(coreConstant.icNameSpace, 'subscribeEvent');
};

// Instance Map to ensure that only one object is created per config strategy.
const instanceMap = {};

const QueueFactory = function() {};

QueueFactory.prototype = {
  /**
   * Get an instance of QueueManager
   *
   * @param configStrategy
   * @returns {QueueManager}
   */
  getInstance: function(configStrategy) {
    const oThis = this,
      rabbitMqMandatoryParams = ['username', 'password', 'host', 'port', 'heartbeats'];

    if (!configStrategy.hasOwnProperty('rabbitmq')) {
      throw 'RabbitMQ one or more mandatory connection parameters missing.';
    }

    // Check if all the mandatory connection parameters for RabbitMQ are available or not.
    for (let key = 0; key < rabbitMqMandatoryParams.length; key++) {
      if (!configStrategy.rabbitmq.hasOwnProperty(rabbitMqMandatoryParams[key])) {
        throw 'RabbitMQ one or more mandatory connection parameters missing.';
      }
    }

    // Check if instance already present.
    let instanceKey = rabbitmqHelper.getInstanceKey(configStrategy),
      _instance = instanceMap[instanceKey];

    if (!_instance) {
      _instance = new QueueManager(configStrategy);
      instanceMap[instanceKey] = _instance;
    }
    _instance.connection.get();

    return _instance;
  }
};

const factory = new QueueFactory();
QueueManager.getInstance = function() {
  return factory.getInstance.apply(factory, arguments);
};

module.exports = QueueManager;
