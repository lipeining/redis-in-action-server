'use strict';

const Service = require('egg').Service;
const assert = require('assert');
const BBPromise = require('bluebird');
/* eslint-disable no-bitwise */
/**
 * shard cha 09
 */
class ShardService extends Service {
  hashCode(values, options = {}) {
    const { key } = values;
    // FNV1_32_HASH
    const p = 16777619;
    let hash = 2166136261;
    for (let i = 0; i < key.length; i++) {
      hash = (hash ^ key.charCodeAt(i)) * p;
    }
    hash += hash << 13;
    hash ^= hash >> 7;
    hash += hash << 3;
    hash ^= hash >> 17;
    hash += hash << 5;
    // 如果算出来的值为负数则取其绝对值
    if (hash < 0) {
      hash = Math.abs(hash);
    }
    return hash;
  }
  shardKey(values, options = {}) {
    const { app, ctx, config } = this;
    const { base, key, totalElements, shardSize } = values;
    const intKey = Math.floor(Number(key));
    let shardId = '';
    if (intKey > 0) {
      shardId = intKey;
    } else {
      shardId = ctx.service.shard.hashCode(values, options);
      // const shards = 2 * totalElements;
      // shardId = crc32(key) % shards;
    }
    return `${base}:${shardId}`;
  }
  async shardHset(values, options = {}) {
    // 一个大的 hash 可以分为多个小的 hash
    const { app, ctx, config } = this;
    const { key, value } = values;
    const shard = ctx.service.shard.shardKey(values, options);
    return await app.redis.hset(shard, key, value);
  }
  async shardHget(values, options = {}) {
    const { app, ctx, config } = this;
    const { key, value } = values;
    const shard = ctx.service.shard.shardKey(values, options);
    return await app.redis.hget(shard, key);
  }
  async shardSadd(values, options = {}) {
    const { app, ctx, config } = this;
    const { key, member } = values;
    const shard = ctx.service.shard.shardKey(values, options);
    return await app.redis.sadd(shard, member);
  }
  // 拓展 srem, sinterstore, sunionstore,
  async countVisit(values, options = {}) {
    const { app, ctx, config } = this;
    const now = new Date();
    const today = now.getDate();
    const visitKey = `visit:unique:${today}`;
    const expected = await ctx.service.shard.getVisitExpected(values, options);
    const { member } = values; // 一般为 uuid 前 15 位
    const key = `X${member}`;
    const base = visitKey;
    const saddRes = await ctx.service.shard.shardSadd({ key, member, base, totalElements: expected, shardSize: 10 }, options);
    if (saddRes) {
      await app.redis.incr(visitKey);
    }
  }
  async getVisitExpected(values, options = {}) {
    const { app, ctx, config } = this;
    const { key } = values;
    const exKey = `expected:${key}`;
    const expected = Number(await app.redis.get(exKey));
    // if (!expected) {
    //   // 可以考虑获取昨天的数量，yesterday * 2 再适配到 2 的幂次方
    //   expected = 100;
    // }
    return expected || 100000;
  }
}
module.exports = ShardService;
