'use strict';

const { app, assert } = require('egg-mock/bootstrap');
const BBPromise = require('bluebird');

describe('test/app/controller/hyperlog.test.js', () => {
  let ctx;
  before(async () => {
    ctx = app.mockContext();
  });
  it(' hyperlog ', async () => {
    const key = 'hyperlog:class';
    const elements = [ 'xiaoming', 'xiaozhang', 'xiaohong', 'xiaoqiang' ];
    const resAdd = await ctx.service.hyperlog.add({ key, elements });
    console.log(resAdd);
    const resCountF = await ctx.service.hyperlog.count({ keys: key });
    console.log(resCountF);
    await ctx.service.hyperlog.add({ key, elements: [ ...elements, 'xiaoqing' ] });
    const resCountS = await ctx.service.hyperlog.count({ keys: key });
    console.log(resCountS);
    const MATH = 'math';
    const ENGLISH = 'english';
    const CHINAESE = 'chinese';
    await ctx.service.hyperlog.add({ key: MATH, elements: [ ...elements, 'xiaofang' ] });
    await ctx.service.hyperlog.add({ key: ENGLISH, elements: [ ...elements, 'xiaohei' ] });
    const resMerge = await ctx.service.hyperlog.merge({ destKey: CHINAESE, sourceKeys: [ MATH, ENGLISH ] });
    console.log(resMerge);
    const resCountC = await ctx.service.hyperlog.count({ keys: CHINAESE });
    const resCountM = await ctx.service.hyperlog.count({ keys: MATH });
    const resCountE = await ctx.service.hyperlog.count({ keys: ENGLISH });
    console.log(resCountC, resCountM, resCountE);
  });
});
