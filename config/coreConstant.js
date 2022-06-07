'use strict';
/**
 * Load all the core constants.
 *
 * @module config/coreConstant
 */

class CoreConstants {
  /**
   * Constructor for core constants
   *
   * @constructor
   */
  constructor() {}

  /**
   * Get IC Namespace
   *
   * @returns {string}
   */
  get icNameSpace() {
    return 'PLGWorksQueue';
  }

  /**
   * Debug Enabled
   *
   * @returns {boolean}
   */
  get DEBUG_ENABLED() {
    return process.env.DEBUG_ENABLED;
  }
}

module.exports = new CoreConstants();
