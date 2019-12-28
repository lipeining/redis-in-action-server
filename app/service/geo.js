'use strict';
const Service = require('egg').Service;

class GeoService extends Service {
  async add(values, options = {}) {
    const { app, ctx, config } = this;
    const { key, list } = values;
    // longitude latitude member
    const res = await app.redis.geoadd(key, ...list);
    return res;
  }
  async pos(values, options = {}) {
    const { app, ctx, config } = this;
    const { key, members } = values;
    // longitude latitude member
    const res = await app.redis.geopos(key, members);
    return res;
  }
  async dist(values, options = {}) {
    const { app, ctx, config } = this;
    const { key, members, unit } = values;
    // longitude latitude member
    const res = await app.redis.geodist(key, members, unit);
    return res;
  }
  async radius(values, options = {}) {
    const { app, ctx, config } = this;
    const { key, longitude, latitude, radius, unit } = values;
    // longitude latitude member
    const res = await app.redis.georadius(key, longitude, latitude, radius, unit);
    return res;
  }
}
module.exports = GeoService;
