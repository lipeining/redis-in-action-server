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
    await ctx.service.redlock.unlock({ lock });
  });
});
