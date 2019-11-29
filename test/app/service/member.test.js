'use strict';

const { app, assert } = require('egg-mock/bootstrap');

describe('test/app/controller/member.test.js', () => {
  let ctx;
  before(async () => {
    ctx = app.mockContext();
  });
  it('find range', async () => {
    const prefix = 'abc';
    const ret = ctx.service.member.findPrefixRange({ prefix });
    console.log(ret);
    const gid = 'some';
    await ctx.service.member.fakeMember({ len: 18, gid, prefix });
    await ctx.service.member.findRange({ prefix, gid });
  });
});
