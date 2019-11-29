'use strict';

const { app, assert } = require('egg-mock/bootstrap');

describe('test/app/controller/hash.test.js', () => {
  let ctx;
  const serverList = [
    { host: '192.168.1.0', port: 5000 },
    { host: '192.168.1.0', port: 6000 },
    { host: '192.168.1.0', port: 7000 },
    { host: '192.168.1.0', port: 8000 },
    { host: '192.168.1.0', port: 9000 },
  ];
  before(async () => {
    ctx = app.mockContext();
  });
  it('init', async () => {
    ctx.service.hash.initServer({ serverList });
    console.log(ctx.service.hash.virtualServerList.length);
    console.log(ctx.service.hash.virtualNodeNumber);
    const { server, serverConnector } = ctx.service.hash.getServer({ key: 'just-to-test-it' });
    console.log(server);
    ctx.service.hash.test();
  });
});
