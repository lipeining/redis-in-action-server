'use strict';

const { app, assert } = require('egg-mock/bootstrap');
const BBPromise = require('bluebird');

describe('test/app/controller/queue.test.js', () => {
  let ctx;
  before(async () => {
    ctx = app.mockContext();
  });
  it(' queue ', async () => {
    const name = 'sendEmail';
    const args = { from: 1, to: 2 };
    const sendEmail = args => {
      console.log(args);
    };
    const queue = 'email';
    const callbacks = { sendEmail };
    const pushRes = await ctx.service.queue.pushSimpleWorkerQueue({ name, args, queue });
    const popRes = await ctx.service.queue.simpleWorkerQueue({ name, queue, args, callbacks });
    console.log(pushRes);
    console.log(popRes);
  });
  it(' delay queue ', async () => {
    const name = 'sendLog';
    const args = { from: 9, to: 8 };
    const sendLog = args => {
      console.log(args);
    };
    const queue = 'log';
    const callbacks = { sendLog };
    const delayRes = await ctx.service.queue.excuteLater({ name, args, queue, delay: 100 });
    await BBPromise.delay(100);
    const pollRes = await ctx.service.queue.pollQueue({ queue, callbacks });
    console.log(delayRes);
    console.log(pollRes);
  });
});
