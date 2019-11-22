'use strict';

const { app, assert } = require('egg-mock/bootstrap');

describe('test/app/controller/article.test.js', () => {
  let article;
  let user;
  let ctx;
  before(async () => {
    ctx = app.mockContext();
    user = await ctx.model.User.create(
      { nickName: 'article-post' },
      { plain: true }
    );
  });
  it('should GET /articles', async () => {
    const resp = await app
      .httpRequest()
      .get('/articles')
      .set('range', JSON.stringify([ 0, 10 ]))
      .expect(200);
  });
  it('should POST /articles', async () => {
    const resp = await app
      .httpRequest()
      .post('/articles')
      .send({
        title: 'article-1',
        link: 'http://localhost:7001/articles/article-1',
        content: 'some words',
        createUserId: user.id,
      })
      .expect(200);
    article = resp.body;
    console.log(JSON.stringify(resp.body, null, 2));
  });
  it('should GET /articles/:id', async () => {
    const resp = await app
      .httpRequest()
      .get(`/articles/${article.id}`)
      .expect(200);
    console.log(JSON.stringify(resp.body, null, 2));
  });
  it('should PUT /articles/:id', async () => {
    const resp = await app
      .httpRequest()
      .put(`/articles/${article.id}`)
      .send({ title: 'article1-edit' })
      .expect(200);
    console.log(JSON.stringify(resp.body, null, 2));
  });
  it('should DELETE /articles/:id', async () => {
    const resp = await app
      .httpRequest()
      .delete(`/articles/${article.id}`)
      .expect(200);
    console.log(JSON.stringify(resp.body, null, 2));
  });
});
