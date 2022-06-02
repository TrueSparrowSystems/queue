/**
 * RabbitMQ helper methods
 *
 * @module lib/rabbitmq/helper
 */

/**
 * RabbitMQ helper constructor
 *
 * @constructor
 */
class RabbitmqHelper {
  constructor() {}

  /**
   * No of max connections attempt in case of failure.<br><br>
   *
   * @constant {number}
   */
  get maxConnectionAttempts() {
    return 1 * 60 * 60; // 1 hour (in seconds)
  }

  /**
   * Time in milliseconds that the unused queue should be deleted after
   * Note: Unused means the queue has no consumers, the queue has not been re-declared, or no get message tried.
   *
   * @constant {number}
   */
  get dedicatedQueueTtl() {
    return 6 * 24 * 60 * 60 * 1000; // 6 days (in miliseconds)
  }

  /**
   * Messages TTL (in milliseconds) in dedicated queues
   *
   * @constant {number}
   */
  get dedicatedQueueMsgTtl() {
    return 6 * 24 * 60 * 60 * 1000; // 6 days (in miliseconds)
  }

  /**
   * Socket connection timeout (in milliseconds)
   *
   * @constant {number}
   */
  get socketConnectionTimeout() {
    return 15 * 1000; //15 seconds (in miliseconds)
  }

  /**
   * Make connection string using configStrategy parameters.
   *
   * @returns {string}
   */
  connectionString(configStrategy) {
    const oThis = this;

    return (
      'amqp://' +
      configStrategy.rabbitmq.username +
      ':' +
      configStrategy.rabbitmq.password +
      '@' +
      configStrategy.rabbitmq.host +
      ':' +
      configStrategy.rabbitmq.port +
      '/?heartbeat=' +
      configStrategy.rabbitmq.heartbeats
    );
  }

  /**
   *
   * Get instance key from the configStrategy
   *
   * @returns {string}
   */
  getRmqId(configStrategy) {
    const oThis = this;
    return [
      configStrategy.rabbitmq.username,
      configStrategy.rabbitmq.host.toLowerCase(),
      configStrategy.rabbitmq.port,
      configStrategy.rabbitmq.heartbeats
    ].join('-');
  }

  /**
   *
   * Get instance key from the configStrategy.
   *
   *
   * Two different instance key can have same connection. Different instance key is generated so that
   * for all those who want short connection timeout can get timed out on the same connection.
   * For example, app servers connection timeout will be very short.
   *
   * @returns {string}
   */
  getInstanceKey(configStrategy) {
    const oThis = this;
    return oThis.getRmqId(configStrategy) + '-' + configStrategy.rabbitmq.connectionTimeoutSec;
  }

  /**
   *
   * Get RMQ host passed into configStrategy.
   *
   * @returns {string}
   */
  getConfigRmqHost(configStrategy) {
    return configStrategy.rabbitmq.host.toLowerCase();
  }

  /**
   *
   * Get RMQ host passed into configStrategy.
   *
   * @returns {string}
   */
  getConfigRmqClusterNodes(configStrategy) {
    return configStrategy.rabbitmq.clusterNodes;
  }
}

module.exports = new RabbitmqHelper();
