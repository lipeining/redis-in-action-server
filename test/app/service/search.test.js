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
    // set search
    const want = [[ 'guy', 'house' ], [ 'river' ]];
    // const unwant = [ 'lucky' ];
    const unwant = [ 'wow' ];
    const searchId = await ctx.service.search.setSearch({ want, unwant });
    console.log(searchId);
    await app.redis.hmset(`kb:doc:${docId}`, { docId, createTime: Date.now(), content });
    const start = 0;
    const num = 10;
    const desc = true;
    const alpha = false;
    const sort = 'createTime';
    const sortRes = await ctx.service.search.sortSetSearch({ searchId, sort, alpha, desc, start, num });
    console.log(sortRes);
  });
  it(' str 2 code ', async () => {
    ctx.service.search.string2code({ str: 'abcde' }, { n: 6 });
  });
  it(' job ', async () => {
    const jobId = '999';
    const skills = [ 'computer', 'keyboard', 'pen', 'mouse' ];
    const candidateSkills = [ 'computer', 'keyboard', 'pen', 'mouse' ];
    await ctx.service.search.indexJob({ jobId, skills });
    const findJobsResult = await ctx.service.search.findJobs({ candidateSkills });
    console.log(findJobsResult);
  });
});
