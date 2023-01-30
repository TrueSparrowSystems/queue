/**
 * Custom console log methods.
 *
 * @module lib/logger/customConsoleLogger
 */
const Base = require('@truesparrow/base');

const rootPrefix = '../..',
  coreConstants = require(rootPrefix + '/config/coreConstant');

const Logger = Base.Logger;

// Following is to ensure that INFO logs are printed when debug is off.
let loggerLevel;
if (1 === Number(coreConstants.DEBUG_ENABLED)) {
  loggerLevel = Logger.LOG_LEVELS.DEBUG;
} else {
  loggerLevel = Logger.LOG_LEVELS.INFO;
}

module.exports = new Logger('truesparrow-queue', loggerLevel);
