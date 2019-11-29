'use strict';

const { app, assert } = require('egg-mock/bootstrap');

describe('test/app/controller/lock.test.js', () => {
  let ctx;
  before(async () => {
    ctx = app.mockContext();
  });
  it(' lock ', async () => {
    const lock = 'first';
    const indentifier = await ctx.service.lock.acquireLock({ lock });
    console.log(indentifier);
    const unlockRes = await ctx.service.lock.releaseLock({ lock, indentifier });
    console.log(unlockRes);
  });
  it(' semaphore ', async () => {
    const lock = 'first';
    for (let i = 0; i < 7; i++) {
      const indentifier = await ctx.service.lock.acquireSemaphore({ lock });
      console.log(indentifier);
      if (i === 0) {
        const unlockRes = await ctx.service.lock.releaseSemaphore({ lock, indentifier });
        console.log(unlockRes);
      }
    }
    const indentifier = await ctx.service.lock.acquireSemaphore({ lock });
    console.log(indentifier); // false
    if (indentifier) {
      const unlockRes = await ctx.service.lock.releaseSemaphore({ lock, indentifier });
      console.log(unlockRes); // false
    }
  });
});
