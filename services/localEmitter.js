/**
 * Singleton class to manage the local emitter.
 *
 * @module services/localEmitter
 */

const EventEmitter = require('events'),
  emitObj = new EventEmitter();

/**
 * Constructor for local emitter
 *
 * @constructor
 */
class LocalEmitter {
  constructor() {
    this.emitObj = emitObj;
  }
}

module.exports = new LocalEmitter();
