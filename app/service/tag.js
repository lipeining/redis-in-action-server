'use strict';
const Service = require('egg').Service;

class TagService extends Service {
  async ping() {
    const { ctx } = this;
    ctx.body = 'hi, egg';
  }
  async nextId() {
    const { app, ctx, config } = this;
    const counter = await app.redis.incr('counter:tag');
    return counter;
  }
  async list(values, options = {}) {
    const { app, ctx, config } = this;
    const { query } = values;
    const { start, end, zset } = query;
    // const zset = 'score:';

    const count = await app.redis.zcount(zset, 0, Number.MAX_SAFE_INTEGER);
    const ids = await app.redis.zrevrange(zset, start, end);
    const tags = [];
    for (const id of ids) {
      const tag = await app.redis.hgetall(id);
      tags.push(tag);
    }
    return { rows: tags, count };
  }
  async add(values, options = {}) {
    const { app, ctx, config } = this;
    const id = await ctx.service.tag.nextId();
    const body = Object.assign({ id, vote_up: 0, vote_down: 0 }, { name: values.body.name });
    // 添加 投票 user
    const tagId = `tag:${id}`;
    await app.redis.sadd(`voted:tag:${id}`, [ values.user.id || 0 ]);
    await app.redis.expire(`voted:tag:${id}`, 7 * 24 * 60 * 60);
    await app.redis.hmset(tagId, body);
    await app.redis.zadd('time:', Date.now(), tagId);
    await app.redis.zadd('score:', 10, tagId);
    return body;
  }
  async getGroupTags(values, options = {}) {
    const { app, ctx, config } = this;
    const { group, order } = values;
    const key = `${order}:${group}`;
    const exists = await app.redis.exists(key);
    if (!exists) {
      await app.redis.zinterstore(key, 2, `groups:${group}`, `${order}:`, [ 'aggregate', 'max' ]);
      await app.redis.expire(key, 60 * 5);
    }
    return await ctx.service.tag.list({ query: { start: 0, end: 10 }, zset: key });
  }
  async addRemGroups(values, options = {}) {
    const { app, ctx, config } = this;
    const { tag, toAdd, toRem } = values;
    const tagId = `tag:${tag.id}`;
    for (const group of toAdd) {
      await app.redis.sadd(`groups:${group}`, [ tagId ]);
    }
    for (const group of toRem) {
      await app.redis.srem(`groups:${group}`, [ tagId ]);
    }
  }
  async vote(values, options = {}) {
    const { app, ctx, config } = this;
    const { id, user, type } = values;
    const tagId = `tag:${id}`;
    const scoreMap = { plus: 1, decr: -1 };
    const voteMap = { plus: 'vote_up', decr: 'vote_down' };
    // const voted = await app.redis.sismember(`voted:tag:${id}`, user.id);
    // const tag = await app.redis.hgetall(tagId);
    const score = 100 * scoreMap[type];
    await app.redis.zincrby('score:', score, tagId);
    await app.redis.sadd(`voted:tag:${id}`, [ user.id ]);
    await app.redis.hincrby(tagId, voteMap[type], 1);
  }
}


module.exports = TagService;
