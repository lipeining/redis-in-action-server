'use strict';
const Service = require('egg').Service;
const assert = require('assert');
const BBPromise = require('bluebird');
/**
 * redis 锁相关
 */
class LockService extends Service {
  async acquireLock(values, options = {}) {
    const { app, ctx, config } = this;
    const { lock } = values;
    const identifier = app.uuid();
    const lockName = `locks:${lock}`;
    const timeout = (values.timeout || 10) * 1000;
    const end = timeout + +Date.now();
    const expire = 10;
    while (Date.now() < end) {
      const res = await app.redis.setnx(lockName, identifier);
      if (res) {
        await app.redis.expire(lockName, expire);
        return identifier;
      }
      await BBPromise.delay(100);
    }
    return false;
  }
  async releaseLock(values, options = {}) {
    const { app, ctx, config } = this;
    const { lock, identifier } = values;
    const lockName = `locks:${lock}`;
    while (true) {
      await app.redis.watch(lockName);
      const token = await app.redis.get(lockName);
      if (token === identifier) {
        await app.redis.multi().del(lockName).exec();
        return true;
      }
      await app.redis.unwatch();
      break;
    }
    return false;
  }
  async acquireSemaphore(values, options = {}) {
    const { app, ctx, config } = this;
    const { lock } = values;
    const identifier = app.uuid();
    const semaphoreName = `semaphores:${lock}`;
    // 使用 时间戳作为 zset 的排序条件，删除超时的键
    const multi = await app.redis.multi();
    const expire = 5;
    const now = Date.now();
    const max = now - (expire * 1000);
    const limit = 5;
    await multi.zremrangebyscore(semaphoreName, -Infinity, max);
    await multi.zadd(semaphoreName, now, identifier);
    await multi.zrank(semaphoreName, identifier);
    const res = await multi.exec();
    console.log(res);
    if (res[res.length - 1][1] < limit) {
      // 成功进入前5
      return identifier;
    }
    await app.redis.zrem(semaphoreName, identifier);
    return false;
  }
  async releaseSemaphore(values, options = {}) {
    const { app, ctx, config } = this;
    const { lock, identifier } = values;
    const semaphoreName = `semaphores:${lock}`;
    return await app.redis.zrem(semaphoreName, identifier);
  }
  async acquireFairSemaphore(values, options = {}) {
    const { app, ctx, config } = this;
    const { lock } = values;
    const identifier = app.uuid();
    const semaphoreName = `semaphores:fair:${lock}`;
    const timeoutSemaphoreName = `semaphores:timeout:${lock}`;
    const counterName = `semaphores:fair:counter:${lock}`;
    // 一个是时间戳为值的 zset, 一个计数器值为值的 zset
    // 使用 时间戳作为 zset 的排序条件，删除超时的键
    const multi = await app.redis.multi();
    const expire = 5;
    const now = Date.now();
    const max = now - (expire * 1000);
    const limit = 5;
    await multi.zremrangebyscore(timeoutSemaphoreName, -Infinity, max);
    // await multi.zinterstore(semaphoreName, 2, semaphoreName, 1, timeoutSemaphoreName, 0);
    await multi.zinterstore(semaphoreName, 2, semaphoreName, timeoutSemaphoreName, [ 'weights', '1', '0' ]);
    // 在取交集后，更新了有序集合
    await multi.incr(counterName);
    const res = await multi.exec();
    // console.log(res);
    const counter = res[res.length - 1][1];
    await app.redis.zadd(timeoutSemaphoreName, Date.now(), identifier);
    await app.redis.zadd(semaphoreName, counter, identifier);
    const addRank = await app.redis.zrank(semaphoreName, identifier);
    if (addRank < limit) {
      // 成功进入前5
      return identifier;
    }
    await app.redis.zrem(timeoutSemaphoreName, identifier);
    await app.redis.zrem(semaphoreName, identifier);
    return false;
  }
  async acquireFairSemaphoreWithLock(values, options = {}) {
    const { app, ctx, config } = this;
    const { lock } = values;
    const selfLock = await ctx.service.lock.acquireLock(values);
    if (selfLock) {
      try {
        return await ctx.service.lock.acquireFairSemaphore(values, options);
      } finally {
        await ctx.service.lock.releaseLock({ lock, identifier: selfLock }, options);
      }
    }
    return false;
  }
  async refreshFairSemaphore(values, options = {}) {
    const { app, ctx, config } = this;
    const { lock, identifier } = values;
    const semaphoreName = `semaphores:fair:${lock}`;
    const timeoutSemaphoreName = `semaphores:timeout:${lock}`;
    const add = await app.redis.zadd(timeoutSemaphoreName, Date.now(), identifier);
    if (add) {
      await ctx.service.lock.releaseFairSemaphore(values, options);
      return false;
    }
    return true;
  }
  async releaseFairSemaphore(values, options = {}) {
    const { app, ctx, config } = this;
    const { lock, identifier } = values;
    const semaphoreName = `semaphores:fair:${lock}`;
    const timeoutSemaphoreName = `semaphores:timeout:${lock}`;
    await app.redis.zrem(timeoutSemaphoreName, identifier);
    return await app.redis.zrem(semaphoreName, identifier);
  }
}
module.exports = LockService;
