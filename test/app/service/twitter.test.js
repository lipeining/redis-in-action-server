'use strict';

const { app, assert } = require('egg-mock/bootstrap');
const BBPromise = require('bluebird');

describe('test/app/controller/twitter.test.js', () => {
  let ctx;
  before(async () => {
    ctx = app.mockContext();
  });
  it(' add twitter ', async () => {
    const xiaoming = { name: 'xiaoming', following: 10, followers: 20, posts: 10, createTime: Date.now() };
    const xiaozhang = { name: 'xiaozhang', following: 10, followers: 20, posts: 10, createTime: Date.now() };
    const fromId = await ctx.service.twitter.createUser({ user: xiaoming });
    const sid = await ctx.service.twitter.createStatus({ tid: fromId, message: `${xiaoming.name} here give out the first message!` });
    const toId = await ctx.service.twitter.createUser({ user: xiaozhang });
    // 给 xiaozhang 个人主页发布一条虚假信息
    const fakeId = await ctx.service.twitter.createStatus({ tid: toId, message: `${xiaozhang.name} here give out the first message!` });
    await app.redis.zadd([ 'profile', toId ].join(':'), Date.now(), fakeId);
    await ctx.service.twitter.followUser({ fromId, toId, homePageSize: 1000 });
    // await ctx.service.twitter.unfollowUser({ fromId, toId, homePageSize: 1000 });
    const msg3Id = await ctx.service.twitter.postStatus({ tid: toId, message: `${xiaozhang.name} 2222 give out the first message!`, offset: 0, count: 10 });
    await ctx.service.twitter.deleteStatus({ tid: toId, sid: msg3Id });
  });
});
