'use strict';

const Service = require('egg').Service;
const EventEmitter = require('events').EventEmitter;
const assert = require('assert');
const BBPromise = require('bluebird');
const crypto = require('crypto');
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
    return this.redlock.unlock(this);
  }
  async extend(ttl) {
    return this.redlock.extend(this, ttl);
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
    assert(Array.isArray(servers) && servers.length, ' servers is not array or is empty');
    this.options = Object.assign({}, defaultOptions, options);
    this.driftFactor = this.options.driftFactor;
    this.retryCount = this.options.retryCount;
    this.retryDelay = this.options.retryDelay;
    this.retryJitter = this.options.retryJitter;
    this.lockScript = this.options.lockScript;
    this.unlockScript = this.options.unlockScript;
    this.extendScript = this.options.extendScript;
    this.servers = servers;
    // 不能提前知道 keyNum
    // for (const server of this.servers) {
    //   server.defineCommand('lock');
    // }
  }
  async _initScript() {
    this.scriptMap = {};
    for (const server of this.servers) {
      for (const script of [ 'lockScript', 'unlockScript', 'extendScript' ]) {
        const scriptSha = await server.script('load', this[script]);
        // if (!this.scriptMap[server.name]) {
        //   this.scriptMap[server.name] = {};
        // }
        // this.scriptMap[server.name][script] = scriptSha;
        server[script] = scriptSha;
      }
    }
  }
  _random() {
    return crypto.randomBytes(16).toString('hex');
  }
  async lock(resource, value, ttl) {
    // array of locked resources
    resource = Array.isArray(resource) ? resource : [ resource ];
    let request;

    // the number of times we have attempted this lock
    const attempts = 0;

    // create a new lock
    if (value === null) {
      value = this._random();
      // request = server => {
      //   return server.eval(
      //     ...[
      //       this.lockScript,
      //       resource.length,
      //       ...resource,
      //       value,
      //       ttl,
      //     ]
      //   );
      // };
      request = server => {
        return server.evalsha(
          ...[
            server.lockScript,
            resource.length,
            ...resource,
            value,
            ttl,
          ]
        );
      };
    } else {
      // request = server => {
      //   return server.eval(
      //     ...[
      //       this.extendScript,
      //       resource.length,
      //       ...resource,
      //       value,
      //       ttl,
      //     ]
      //   );
      // };
      request = server => {
        return server.evalsha(
          ...[
            server.extendScript,
            resource.length,
            ...resource,
            value,
            ttl,
          ]
        );
      };
    }

    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      // the time when this attempt started
      const start = Date.now();
      // the number of votes needed for consensus
      const quorum = Math.floor(this.servers.length / 2) + 1;
      let voteResults = [];
      try {
        const promises = this.servers.map(server => {
          return request(server);
        });
        // 可以考虑 Promise.all Promise.map
        voteResults = await Promise.all(promises);
        // the number of servers which have agreed to release this lock
        let votes = 0;
        for (const voteResult of voteResults) {
          if (voteResult === resource.length || voteResult === '' + resource.length) {
            votes++;
          }
        }
        // Add 2 milliseconds to the drift to account for Redis expires precision, which is 1 ms,
        // plus the configured allowable drift factor
        const drift = Math.round(this.driftFactor * ttl) + 2;
        const lock = new Lock(this, resource, value, start + ttl - drift, attempts);
        // SUCCESS: there is concensus and the lock is released
        if (votes >= quorum && lock.expiration > Date.now()) {
          return Promise.resolve(lock);
        }
        // remove this lock from servers that voted for it
        await lock.unlock();
        // RETRY
        await BBPromise.delay(Math.max(0, this.retryDelay + Math.floor((Math.random() * 2 - 1) * this.retryJitter)));
      } catch (err) {
        console.log(err);
        this.emit('clientError', err);
      } finally {
        //
      }
    }
    // FAILED
    return Promise.reject(new LockError('Exceeded ' + this.retryCount + ' attempts to lock the resource "' + resource + '".', attempts));
  }
  async unlock(lock) {
    const resource = Array.isArray(lock.resource) ? lock.resource : [ lock.resource ];
    lock.expiration = 0;
    let voteResults = [];
    // the number of votes needed for consensus
    const quorum = Math.floor(this.servers.length / 2) + 1;
    try {
      const promises = this.servers.map(server => {
        // const args = [ this.unlockScript, resource.length, ...resource, lock.value ];
        // return server.eval(...args);
        const args = [ server.unlockScript, resource.length, ...resource, lock.value ];
        return server.evalsha(...args);
      });
      // 可以考虑 Promise.all Promise.map
      voteResults = await Promise.all(promises);
      // the number of servers which have agreed to release this lock
      let votes = 0;
      for (const voteResult of voteResults) {
        if (voteResult === resource.length || voteResult === '' + resource.length) {
          votes++;
        }
      }
      // SUCCESS: there is concensus and the lock is released
      if (votes >= quorum) {
        return Promise.resolve();
      }
      return Promise.reject(new LockError('Unable to fully release the lock on resource "' + lock.resource + '".'));
    } catch (err) {
      console.log(err);
      this.emit('clientError', err);
    } finally {
      //
    }
  }
  async extend(lock, ttl) {
    // the lock has expired
    if (lock.expiration < Date.now()) {
      return Promise.reject(new LockError('Cannot extend lock on resource "' + lock.resource + '" because the lock has already expired.', 0));
    }
    // extend the lock
    const extension = await this.lock(lock.resource, lock.value, ttl);
    lock.value = extension.value;
    lock.expiration = extension.expiration;
    return lock;
  }
}
class RedlockService extends Service {
  constructor(options) {
    super(options);
    this.redlock = new Redlock([ this.app.redis ]);
  }
  async lock(values, options = {}) {
    const { resource, value, ttl } = values;
    await this.redlock._initScript();
    const lock = await this.redlock.lock(resource, value || null, ttl || 1000);
    return lock;
  }
  async unlock(values, options = {}) {
    const { lock } = values;
    return lock.unlock();
  }
  async extend(values, options = {}) {
    const { lock, ttl } = values;
    return lock.extend(ttl);
  }
}

module.exports = RedlockService;

// -----------------
// this.redis.evalsha(this.popMessage_sha1, 2, `${this.redisns}${options.qname}`, q.ts, this._handleReceivedMessage(cb));
// -----------------
// const script_popMessage = `local msg = redis.call("ZRANGEBYSCORE", KEYS[1], "-inf", KEYS[2], "LIMIT", "0", "1")
// if #msg == 0 then
//   return {}
// end
// redis.call("HINCRBY", KEYS[1] .. ":Q", "totalrecv", 1)
// local mbody = redis.call("HGET", KEYS[1] .. ":Q", msg[1])
// local rc = redis.call("HINCRBY", KEYS[1] .. ":Q", msg[1] .. ":rc", 1)
// local o = {msg[1], mbody, rc}
// if rc==1 then
//   table.insert(o, KEYS[2])
// else
//   local fr = redis.call("HGET", KEYS[1] .. ":Q", msg[1] .. ":fr")
//   table.insert(o, fr)
// end
// redis.call("ZREM", KEYS[1], msg[1])
// redis.call("HDEL", KEYS[1] .. ":Q", msg[1], msg[1] .. ":rc", msg[1] .. ":fr")
// return o`;
//       const script_receiveMessage = `local msg = redis.call("ZRANGEBYSCORE", KEYS[1], "-inf", KEYS[2], "LIMIT", "0", "1")
// if #msg == 0 then
//   return {}
// end
// redis.call("ZADD", KEYS[1], KEYS[3], msg[1])
// redis.call("HINCRBY", KEYS[1] .. ":Q", "totalrecv", 1)
// local mbody = redis.call("HGET", KEYS[1] .. ":Q", msg[1])
// local rc = redis.call("HINCRBY", KEYS[1] .. ":Q", msg[1] .. ":rc", 1)
// local o = {msg[1], mbody, rc}
// if rc==1 then
//   redis.call("HSET", KEYS[1] .. ":Q", msg[1] .. ":fr", KEYS[2])
//   table.insert(o, KEYS[2])
// else
//   local fr = redis.call("HGET", KEYS[1] .. ":Q", msg[1] .. ":fr")
//   table.insert(o, fr)
// end
// return o`;
//       const script_changeMessageVisibility = `local msg = redis.call("ZSCORE", KEYS[1], KEYS[2])
// if not msg then
//   return 0
// end
// redis.call("ZADD", KEYS[1], KEYS[3], KEYS[2])
// return 1`;
//       this.redis.script("load", script_popMessage, (err, resp) => {
//           if (err) {
//               console.log(err);
//               return;
//           }
//           this.popMessage_sha1 = resp;
//           this.emit("scriptload:popMessage");
//       });
//       this.redis.script("load", script_receiveMessage, (err, resp) => {
//           if (err) {
//               console.log(err);
//               return;
//           }
//           this.receiveMessage_sha1 = resp;
//           this.emit("scriptload:receiveMessage");
//       });
//       this.redis.script("load", script_changeMessageVisibility, (err, resp) => {
//           if (err) {
//               console.log(err);
//               return;
//           }
//           this.changeMessageVisibility_sha1 = resp;
//           this.emit('scriptload:changeMessageVisibility');
//       });
