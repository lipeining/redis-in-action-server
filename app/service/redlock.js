'use strict';

const Service = require('egg').Service;
const EventEmitter = require('events').EventEmitter;
const assert = require('assert');
// constants
const lockScript = `
	-- Return 0 if an entry already exists.
	for i, key in ipairs(KEYS) do
		if redis.call("exists", key) == 1 then
			return 0
		end
	end
	-- Create an entry for each provided key.
	for i, key in ipairs(KEYS) do
		redis.call("set", key, ARGV[1], "PX", ARGV[2])
	end
	-- Return the number of entries added.
	return #KEYS
`;

const unlockScript = `
	local count = 0
	for i, key in ipairs(KEYS) do
	  -- Only remove entries for *this* lock value.
	  if redis.call("get", key) == ARGV[1] then
	    redis.pcall("del", key)
	    count = count + 1
	  end
	end
	-- Return the number of entries removed.
	return count
`;

const extendScript = `
	-- Return 0 if an entry exists with a *different* lock value.
	for i, key in ipairs(KEYS) do
	  if redis.call("get", key) ~= ARGV[1] then
	    return 0
	  end
	end
	-- Update the entry for each provided key.
	for i, key in ipairs(KEYS) do
	  redis.call("set", key, ARGV[1], "PX", ARGV[2])
	end
	-- Return the number of entries updated.
	return #KEYS
`;
class LockError extends Error {
  constructor(message, attempts) {
    super(message);
    this.name = 'lock error';
    this.attempts = attempts;
  }
}
class Lock {
  constructor(redlock, resource, value, expiration, attempts) {
    this.redlock = redlock;
    this.resource = resource;
    this.value = value;
    this.expiration = expiration;
    this.attempts = attempts;
  }
  async unlock() {
    return this.redlock.unlock();
  }
  async extend(ttl) {
    return this.redlock.extend(ttl);
  }
}
const defaultOptions = {
  lockScript,
  unlockScript,
  extendScript,
  driftFactor: 0.01,
  retryCount: 10,
  retryDelay: 200,
  retryJitter: 100,
};
class Redlock extends EventEmitter {
  constructor(servers, options) {
    super();
    assert(Array.isArray(servers.length) && servers.length, ' servers is not array or is empty');
    this.options = Object.assign({}, defaultOptions, options);
    this.driftFactor = this.options.driftFactor;
    this.retryCount = this.options.retryCount;
    this.retryDelay = this.options.retryDelay;
    this.retryJitter = this.options.retryJitter;
    this.lockScript = this.options.lockScript;
    this.unlockScript = this.options.unlockScript;
    this.extendScript = this.options.extendScript;
    this.servers = servers;
  }
  async lock(resource, ttl) {

  }
  async unlock(lock) {
    const resource = Array.isArray(lock.resource) ? lock.resource : [ lock.resource ];
    lock.expiration = 0;

    return new Promise((resolve, reject) => {

      // the number of votes needed for consensus
      const quorum = Math.floor(this.servers.length / 2) + 1;

      // the number of servers which have agreed to release this lock
      let votes = 0;

      // the number of async redis calls still waiting to finish
      let waiting = this.servers.length;
      const loop = (err, response) => {
        if (err) this.emit('clientError', err);

        // - If the response is less than the resource length, than one or
        //   more resources failed to unlock:
        //   - It may have been re-acquired by another process;
        //   - It may hava already been manually released;
        //   - It may have expired;

        if (response === resource.length || response === '' + resource.length) { votes++; }

        if (waiting-- > 1) return;

        // SUCCESS: there is concensus and the lock is released
        if (votes >= quorum) { return resolve(); }

        // FAILURE: the lock could not be released
        return reject(new LockError('Unable to fully release the lock on resource "' + lock.resource + '".'));
      };
      // release the lock on each server
      this.servers.forEach(server => {
        return server.eval(
          [
            this.unlockScript,
            resource.length,
            ...resource,
            lock.value,
          ],
          loop
        );
      });
    });
  }
  async extend() {

  }
}
class RedlockService extends Service {
  constructor(options) {
    super(options);
    this.redlock = new Redlock([ this.app.redis ]);
  }
  async lock() {

  }
  async unlock() {

  }
  async extend() {

  }
}

module.exports = RedlockService;
