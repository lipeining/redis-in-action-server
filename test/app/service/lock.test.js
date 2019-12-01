'use strict';

const { app, assert } = require('egg-mock/bootstrap');

describe('test/app/controller/lock.test.js', () => {
  let ctx;
  before(async () => {
    ctx = app.mockContext();
  });
  it(' lock ', async () => {
    const lock = 'first';
    const identifier = await ctx.service.lock.acquireLock({ lock });
    console.log(identifier);
    const unlockRes = await ctx.service.lock.releaseLock({ lock, identifier });
    console.log(unlockRes);
  });
  it(' semaphore ', async () => {
    const lock = 'first';
    for (let i = 0; i < 7; i++) {
      const identifier = await ctx.service.lock.acquireSemaphore({ lock });
      console.log(identifier);
      if (i === 0) {
        const unlockRes = await ctx.service.lock.releaseSemaphore({ lock, identifier });
        console.log(unlockRes);
      }
    }
    const identifier = await ctx.service.lock.acquireSemaphore({ lock });
    console.log(identifier); // false
    if (identifier) {
      const unlockRes = await ctx.service.lock.releaseSemaphore({ lock, identifier });
      console.log(unlockRes); // false
    }
  });
  it(' fair semaphore ', async () => {
    const lock = 'sss';
    for (let i = 0; i < 7; i++) {
      const identifier = await ctx.service.lock.acquireFairSemaphore({ lock });
      console.log(identifier);
      if (i === 0) {
        const unlockRes = await ctx.service.lock.releaseFairSemaphore({ lock, identifier });
        console.log(unlockRes);
      }
    }
    const identifier = await ctx.service.lock.acquireFairSemaphore({ lock });
    console.log(identifier); // false
    if (identifier) {
      const unlockRes = await ctx.service.lock.releaseFairSemaphore({ lock, identifier });
      console.log(unlockRes); // false
    }
  });
  it(' lock fair semaphore', async () => {
    const lock = 'lll123';
    for (let i = 0; i < 7; i++) {
      const identifier = await ctx.service.lock.acquireFairSemaphoreWithLock({ lock });
      console.log(identifier);
      if (i === 0) {
        const unlockRes = await ctx.service.lock.releaseFairSemaphore({ lock, identifier });
        console.log(unlockRes);
      }
    }
  });
});
