'use strict';

const { app, assert } = require('egg-mock/bootstrap');

describe('test/app/controller/home.test.js', () => {
  let ctx;
  let user;
  before(async () => {
    ctx = app.mockContext();
    user = await ctx.model.User.create(
      { nickName: 'tag-service' },
      { plain: true }
    );
  });
  it('should nextId', async () => {
    await ctx.service.tag.nextId();
  });
  it('should add and vote up down', async () => {
    const tag = await ctx.service.tag.add({ body: { name: 'one' }, user });
    await ctx.service.tag.addRemGroups({ tag, toAdd: [ 'programming', 'network' ], toRem: [] });
    await ctx.service.tag.addRemGroups({ tag, toRem: [ 'network' ], toAdd: [ 'computer' ] });
    const data = await ctx.service.tag.getGroupTags({ group: 'programming', order: 'score' });
    await ctx.service.tag.vote({ user, id: tag.id, type: 'plus' });
    await ctx.service.tag.vote({ user, id: tag.id, type: 'decr' });
  });
  it('list', async () => {
    const data = await ctx.service.tag.list({ query: { start: 0, end: 10, zset: 'score:' } });
    console.log(data);
  });
});
