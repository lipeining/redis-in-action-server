'use strict';
const Service = require('egg').Service;
const assert = require('assert');
const BBPromise = require('bluebird');
/**
 * redis 队列
 */
class QueueService extends Service {
  async pushSimpleWorkerQueue(values, options = {}) {
    const { app, ctx, config } = this;
    const { name, args, queue } = values;
    const queueName = `simple:queue:${queue}`;
    return await app.redis.rpush(queueName, JSON.stringify({ name, args }));
  }
  async simpleWorkerQueue(values, options = {}) {
    // 浪费资源
    const { app, ctx, config } = this;
    const { callbacks, queue } = values;
    const queueName = `simple:queue:${queue}`;
    // blpop 的第一个参数 queues，优先级高的放在前面，后面的低优先级的
    const packed = await app.redis.blpop(queueName, 5);
    if (!packed) {
      return false;
    }
    const { name, args } = JSON.parse(packed[1]);
    if (!callbacks[name]) {
      return false;
    }
    return await callbacks[name](args);
  }
  async excuteLater(values, options = {}) {
    const { app, ctx, config } = this;
    const { name, args, queue, delay } = values;
    const delayQueueName = `delay:queue:${queue}`;
    const listQueueName = `list:queue:${queue}`;
    const identifier = app.uuid();
    const item = JSON.stringify({ identifier, name, args });
    if (delay > 0) {
      await app.redis.zadd(delayQueueName, Date.now() + delay, item);
    } else {
      await app.redis.rpush(listQueueName, item);
    }
    return identifier;
  }
  async pollQueue(values, options = {}) {
    // 定时获取最新的延时队列，看情况是否需要执行
    const { app, ctx, config } = this;
    const { queue, callbacks } = values;
    const delayQueueName = `delay:queue:${queue}`;
    const listQueueName = `list:queue:${queue}`;
    const item = await app.redis.zrange(delayQueueName, 0, 0, 'WITHSCORES');
    if (!item) {
      ctx.logger.info(`${delayQueueName} has no item`);
      return false;
    }
    ctx.logger.info(item);
    const delayTime = Number(item[1]);
    const { name, args, identifier } = JSON.parse(item[0]);
    if (delayTime > Date.now()) {
      ctx.logger.info(`${identifier} does not come to time`);
      return false;
    }
    const lock = name;
    const selfLock = await ctx.service.lock.acquireLock({ lock });
    if (!selfLock) {
      ctx.logger.info(`${identifier} acquire lock false`);
      return false;
    }
    await app.redis.zrem(delayQueueName, item);
    await app.redis.rpush(listQueueName, JSON.stringify({ identifier, name, args }));
    await ctx.service.lock.releaseLock({ lock, identifier: selfLock });
    return true;
    // return callbacks[name](args);
  }
}
module.exports = QueueService;
