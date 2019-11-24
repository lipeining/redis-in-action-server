'use strict';

const { app, assert } = require('egg-mock/bootstrap');

describe('test/app/controller/tag.test.js', () => {
  let tag;
  let ctx;
  let user;
  before(async () => {
    ctx = app.mockContext();
    user = await ctx.model.User.create(
      { nickName: 'tag-controller' },
      { plain: true }
    );
  });
  it('should GET /tags', async () => {
    const resp = await app
      .httpRequest()
      .get('/tags')
      .set('range', JSON.stringify([ 0, 10 ]))
      .expect(200);
  });
  it('should POST /tags', async () => {
    const resp = await app
      .httpRequest()
      .post('/tags')
      .send({ name: 'test1', userId: user.id })
      .expect(200);
    tag = resp.body;
    console.log(JSON.stringify(resp.body, null, 2));
  });
  it('should GET /tags/:id', async () => {
    const resp = await app
      .httpRequest()
      .get(`/tags/${tag.id}`)
      .expect(200);
    console.log(JSON.stringify(resp.body, null, 2));
  });
  it('should PUT /tags/:id', async () => {
    const resp = await app
      .httpRequest()
      .put(`/tags/${tag.id}`)
      .send({ name: 'test1-edit' })
      .expect(200);
    console.log(JSON.stringify(resp.body, null, 2));
  });
  it('should PUT /tags/:id/vote', async () => {
    const resp1 = await app
      .httpRequest()
      .put(`/tags/${tag.id}/vote`)
      .send({ userId: user.id, type: { plus: 1, decr: 0 }.plus })
      .expect(200);
    console.log(JSON.stringify(resp1.body, null, 2));
    const resp2 = await app
      .httpRequest()
      .put(`/tags/${tag.id}/vote`)
      .send({ userId: user.id, type: { plus: 1, decr: 0 }.decr })
      .expect(200);
    console.log(JSON.stringify(resp2.body, null, 2));
  });
});
