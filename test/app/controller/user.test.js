'use strict';

const { app, assert } = require('egg-mock/bootstrap');

describe('test/app/controller/user.test.js', () => {
  let user;
  it('should GET /users', async () => {
    const resp = await app
      .httpRequest()
      .get('/users')
      .set('range', JSON.stringify([ 0, 10 ]))
      .expect(200);
  });
  it('should POST /users', async () => {
    const resp = await app
      .httpRequest()
      .post('/users')
      .send({ nickName: 'test1', email: 'test1@qq.com' })
      .expect(200);
    user = resp.body;
    console.log(JSON.stringify(resp.body, null, 2));
  });
  it('should GET /users/:userId', async () => {
    const resp = await app
      .httpRequest()
      .get(`/users/${user.userId}`)
      .expect(200);
    console.log(JSON.stringify(resp.body, null, 2));
  });
  it('should PUT /users/:userId', async () => {
    const resp = await app
      .httpRequest()
      .put(`/users/${user.userId}`)
      .send({ nickName: 'test1-edit' })
      .expect(200);
    console.log(JSON.stringify(resp.body, null, 2));
  });
  it('should DELETE /users/:userId', async () => {
    const resp = await app
      .httpRequest()
      .delete(`/users/${user.userId}`)
      .expect(200);
    console.log(JSON.stringify(resp.body, null, 2));
  });
});
