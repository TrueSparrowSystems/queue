/**
 * Utility methods
 *
 * @module lib/util
 */

/**
 * Utility methods constructor
 *
 * @constructor
 */
class Util {
  constructor() {}

  /**
   * check if the value is undefined or null. Empty value is considered as present.
   *
   * @param {object} val - object to check for present
   *
   * @returns {boolean}
   */
  valPresent(val) {
    return !(val === undefined || val === null);
  }
}

module.exports = new Util();
