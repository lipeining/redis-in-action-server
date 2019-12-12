'use strict';

const { app, assert } = require('egg-mock/bootstrap');

describe('test/app/controller/redlock.test.js', () => {
  let ctx;
  before(async () => {
    ctx = app.mockContext();
  });
  it(' redlock ', async () => {
    const resource = 'rrred';
    const value = null;
    const ttl = 20000;
    const lock = await ctx.service.redlock.lock({ resource, value, ttl });
    await ctx.service.redlock.extend({ lock, ttl: 30000 });
    await ctx.service.redlock.unlock({ lock });
  });
  it(' appp redlock ', async () => {
    const resource = 'applock';
    const value = null;
    const ttl = 20000;
    const lock = await app.redlock.lock(resource, ttl);
    console.log(lock);
    await lock.unlock();
  });
});
