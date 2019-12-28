'use strict';
const Service = require('egg').Service;

class HyperLogService extends Service {
  async add(values, options = {}) {
    const { app, ctx, config } = this;
    const { key, elements } = values;
    const res = await app.redis.pfadd(key, elements);
    return res;
  }
  async count(values, options = {}) {
    const { app, ctx, config } = this;
    const { keys } = values;
    const res = await app.redis.pfcount(keys);
    return res;
  }
  async merge(values, options = {}) {
    const { app, ctx, config } = this;
    const { destKey, sourceKeys } = values;
    const res = await app.redis.pfmerge(destKey, sourceKeys);
    return res;
  }
}
module.exports = HyperLogService;
