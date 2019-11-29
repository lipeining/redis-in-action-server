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
    const indentifier = app.uuid();
    const lockName = `locks:${lock}`;
    const timeout = (values.timeout || 10) * 1000;
    const end = timeout + +Date.now();
    const expire = 10;
    while (Date.now() < end) {
      const res = await app.redis.setnx(lockName, indentifier);
      if (res) {
        await app.redis.expire(lockName, expire);
        return indentifier;
      }
      await BBPromise.delay(100);
    }
    return false;
  }
  async releaseLock(values, options = {}) {
    const { app, ctx, config } = this;
    const { lock, indentifier } = values;
    const lockName = `locks:${lock}`;
    while (true) {
      await app.redis.watch(lockName);
      const token = await app.redis.get(lockName);
      if (token === indentifier) {
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
    const indentifier = app.uuid();
    const semaphoreName = `semaphores:${lock}`;
    // 使用 时间戳作为 zset 的排序条件，删除超时的键
    const multi = await app.redis.multi();
    const expire = 5;
    const now = Date.now();
    const max = now - (expire * 1000);
    const limit = 5;
    await multi.zremrangebyscore(semaphoreName, -Infinity, max);
    await multi.zadd(semaphoreName, now, indentifier);
    await multi.zrank(semaphoreName, indentifier);
    const res = await multi.exec();
    console.log(res);
    if (res[res.length - 1][1] < limit) {
      // 成功进入前5
      return indentifier;
    }
    await app.redis.zrem(semaphoreName, indentifier);
    return false;
  }
  async releaseSemaphore(values, options = {}) {
    const { app, ctx, config } = this;
    const { lock, indentifier } = values;
    const semaphoreName = `semaphores:${lock}`;
    return await app.redis.zrem(semaphoreName, indentifier);
  }
}
module.exports = LockService;
