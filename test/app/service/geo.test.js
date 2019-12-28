'use strict';

const { app, assert } = require('egg-mock/bootstrap');
const BBPromise = require('bluebird');

describe('test/app/controller/geo.test.js', () => {
  let ctx;
  before(async () => {
    ctx = app.mockContext();
  });
  it(' geo ', async () => {
    const key = 'geo:cars';
    const resAdd = await ctx.service.geo.add({ key, list: [ 70, 50, 'a' ] });
    console.log(resAdd);
    const resPos = await ctx.service.geo.pos({ key, members: [ 'a' ] });
    console.log(resPos);
    const resAdd2 = await ctx.service.geo.add({ key, list: [ 50, 70, 'b' ] });
    console.log(resAdd2);
    const resPos2 = await ctx.service.geo.pos({ key, members: [ 'b' ] });
    console.log(resPos2);
    const resDist = await ctx.service.geo.dist({ key, members: [ 'a', 'b' ], unit: 'km' });
    console.log(resDist);
    const resRadius = await ctx.service.geo.radius({ key, longitude: 50, latitude: 70, radius: 3, unit: 'km' });
    console.log(resRadius);
  });
});
