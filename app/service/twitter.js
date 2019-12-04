'use strict';

const Service = require('egg').Service;
const assert = require('assert');
const BBPromise = require('bluebird');
const STOP_WORDS = Symbol('Search#STOP_WORDS');
/**
 * search cho7
 */
class TwitterService extends Service {
  constructor(options) {
    super(options);
    this.twittersKey = 'twitters';
    this.userPrefix = 'twitter';
    this.statusPrefix = 'status';
    // 用户的时间线可以分为：主页，个人，主题分类

    // 关注，被关注
    this.followersPrefix = 'followers';
    this.followingPrefix = 'following';
    this.homePageSize = 10;
  }
  async nextUserId(values, options = {}) {
    const { app, ctx, config } = this;
    return await app.redis.incr('twitters:counter');
  }
  async nextStatusId(values, options = {}) {
    const { app, ctx, config } = this;
    return await app.redis.incr('status:counter');
  }
  async createUser(values, options = {}) {
    const { app, ctx, config } = this;
    const { user } = values;
    assert(user.name, 'user name is missed!');
    // 使用锁控制并发请求
    const lock = [ 'lock', this.userPrefix, user.name ].join(':');
    const identifier = await ctx.service.lock.acquireLock({ lock });
    if (!identifier) {
      ctx.logger.info('add twitter, get no lock');
      return false;
    }
    const oldUser = await app.redis.hget(this.twittersKey, user.name);
    if (oldUser) {
      ctx.logger.info('add twitter, user is existed!');
      return false;
    }
    const id = await ctx.service.twitter.nextUserId();
    // 将用户信息存储起来
    await app.redis.hset(this.twittersKey, user.name, id);
    await app.redis.hmset([ this.userPrefix, id ].join(':'), Object.assign(user, { id }));
    await ctx.service.lock.releaseLock({ lock, identifier });
    return id;
  }
  async createStatus(values, options = {}) {
    const { app, ctx, config } = this;
    const { tid, message } = values;
    const id = await ctx.service.twitter.nextStatusId();
    // 不判断用户是否存在
    const data = { tid, id, message, createTime: Date.now() };
    await app.redis.hmset([ this.statusPrefix, id ].join(':'), data);
    await app.redis.hincrby([ this.userPrefix, tid ].join(':'), 'posts', 1);
    return id;
  }
  async postStatus(values, options = {}) {
    const { app, ctx, config } = this;
    const { tid, offset, count } = values;
    const sid = await ctx.service.twitter.createStatus(values, options);
    // 添加到用户的 profile
    await app.redis.zadd([ 'profile', tid ].join(':'), Date.now(), sid);
    await ctx.service.twitter.syndicate({ tid, sid, offset, count }, options);
    return sid;
  }
  async syndicate(values, options = {}) {
    const { app, ctx, config } = this;
    const { tid, sid, offset, count } = values;
    // 对于不同的用户区别处理，以 1000 关注为界限
    // 每次最多推送 1000 个用户
    // start 表示的是上次开始的地方，因为关注列表是有时间戳的
    const nums = [ 'limit', offset, count ];
    const followers = await app.redis.zrangebyscore([ this.followersPrefix, tid ].join(':'), 0, Infinity, ...nums);
    console.log(followers);
    for (const follower of followers) {
      await app.redis.zadd([ 'home', follower ].join(':'), Date.now(), sid);
      await app.redis.zremrangebyrank([ 'home', follower ].join(':'), 0, -this.homePageSize - 1);
    }
    if (followers.length > 1000) {
      const name = 'syndicate';
      const args = values;
      const queue = `sync-twitter-${tid}-${sid}`;
      const delay = 1000 * 60;
      // 这里不断调整对应的 offset count
    //   await ctx.service.queue.excuteLater({ name, args, queue, delay });
    }
  }
  async deleteStatus(values, options = {}) {
    const { app, ctx, config } = this;
    const { tid, sid } = values;
    // 获得 锁
    const lock = [ 'lock', this.statusPrefix, sid ].join(':');
    const identifier = await ctx.service.lock.acquireLock({ lock });
    if (!identifier) {
      ctx.logger.info(`${tid} delete ${sid} get lock failed!`);
      return false;
    }
    const statusKey = [ this.statusPrefix, sid ].join(':');
    const status = await app.redis.hgetall(statusKey);
    if (Number(status.tid) !== Number(tid)) {
      ctx.logger.info(`${sid} tid is not equal!`);
      return false;
    }
    await app.redis.del(statusKey);
    // 这里的话，其他用户的页面可能会有旧的数据，但是可以通过代码筛选存在的数据来解决这个问题
    await app.redis.zrem([ 'home', tid ].join(':'), sid);
    await app.redis.zrem([ 'profile', tid ].join(':'), sid);
    await app.redis.hincrby([ this.userPrefix, tid ].join(':'), 'posts', -1);
    await ctx.service.lock.releaseLock({ lock, identifier });
    return sid;
  }
  async getStatuses(values, options = {}) {
    const { app, ctx, config } = this;
    const { tid, timeline, start, end } = values;
    const statusIds = await app.redis.zrevrange([ timeline, tid ].join(':'), start, end);
    const statuses = [];
    for (const sid of statusIds) {
      const statusKey = [ this.statusPrefix, sid ].join(':');
      const status = await app.redis.hgetall(statusKey);
      // 这里需要筛选有数据的 status， 即未被删除的 status
      if (status) {
        statuses.push(status);
      }
    }
    return statuses;
  }
  async followUser(values, options = {}) {
    const { app, ctx, config } = this;
    const { fromId, toId } = values;
    const from = [ this.followingPrefix, fromId ].join(':');
    const to = [ this.followersPrefix, toId ].join(':');
    const again = await app.redis.zscore(from, toId);
    if (again) {
      ctx.logger.info('from 已经关注 to');
      return false;
    }
    // 分别添加两个的列表，并且，增加 twitter 中的关注数，被关注数
    await app.redis.zadd(from, Date.now(), toId);
    await app.redis.hincrby([ this.userPrefix, fromId ].join(':'), 'following', 1);

    await app.redis.zadd(to, Date.now(), fromId);
    await app.redis.hincrby([ this.userPrefix, toId ].join(':'), 'followers', 1);

    // 从被关注者的个人列表中取部分数据，加入到关注者的主页列表中
    const statusAndScore = await app.redis.zrevrange([ 'profile', toId ].join(':'), 0, this.homePageSize - 1, 'WITHSCORES');
    console.log(statusAndScore);
    if (statusAndScore) {
      await app.redis.zadd([ 'home', fromId ].join(':'), app._.reverse(statusAndScore));
    }
    // 修剪 from 得主页
    await app.redis.zremrangebyrank([ 'home', fromId ].join(':'), 0, -this.homePageSize - 1);
    return true;
  }
  async unfollowUser(values, options = {}) {
    const { app, ctx, config } = this;
    const { fromId, toId } = values;
    const from = [ this.followingPrefix, fromId ].join(':');
    const to = [ this.followersPrefix, toId ].join(':');
    const again = await app.redis.zscore(from, toId);
    if (!again) {
      ctx.logger.info('from 未关注 to');
      return false;
    }
    // 分别添加两个的列表，并且，增加 twitter 中的关注数，被关注数
    await app.redis.zrem(from, toId);
    await app.redis.hincrby([ this.userPrefix, fromId ].join(':'), 'following', -1);

    await app.redis.zrem(to, fromId);
    await app.redis.hincrby([ this.userPrefix, toId ].join(':'), 'followers', -1);

    // 从被关注者的个人列表中取部分数据，加入到关注者的主页列表中
    const status = await app.redis.zrevrange([ 'profile', toId ].join(':'), 0, this.homePageSize - 1);
    console.log(status);
    if (status) {
      await app.redis.zrem([ 'home', fromId ].join(':'), status);
    }
    // 修剪 from 得主页
    // await app.redis.zremrangebyrank([ 'home', fromId ].join(':'), 0, -this.homePageSize - 1);
    return true;
  }
}

module.exports = TwitterService;
