'use strict';

const { app, assert } = require('egg-mock/bootstrap');
const BBPromise = require('bluebird');

describe('test/app/controller/search.test.js', () => {
  let ctx;
  before(async () => {
    ctx = app.mockContext();
  });
  it(' tokenize ', async () => {
    const content = 'i am one of the most lucky guy or not, on the river, on the house,';
    const tokenRes1 = ctx.service.search.tokenize({ content });
    const tokenRes2 = ctx.service.search.tokenize({ content: 'i' });
    console.log(tokenRes1, tokenRes2);
    const docId = '100';
    const indexRes = await ctx.service.search.indexDocument({ docId, content });
    console.log(indexRes);
  });
});
