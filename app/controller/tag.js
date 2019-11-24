'use strict';

const Controller = require('egg').Controller;

class TagController extends Controller {
  async ping() {
    const { ctx } = this;
    ctx.body = 'hi, egg';
  }
  async list() {
    const { ctx } = this;
    ctx.validate({
      page: { type: 'int', defValue: 1, desc: 'page' },
      size: { type: 'int', defValue: 10, desc: 'size' },
    });
    const { query } = ctx.request;
    const range = ctx.get('range');
    const [ start, end ] = JSON.parse(range || '[]');
    const offset = start || (query.page - 1) * query.size || 0;
    const limit = end - start || query.size;
    const data = await ctx.service.tag.list({ query: { start: offset, end: offset + limit, zset: 'score:' } });
    ctx.set('Content-Range', `${offset}-${offset + limit}/${data.count}`);
    ctx.set('Access-Control-Expose-Headers', 'Content-Range');
    ctx.logger.info(data.rows.length);
    ctx.body = data.rows;
  }
  async add() {
    const { ctx } = this;
    ctx.validate({
      name: { type: 'string', required: false, desc: 'name' },
      userId: { type: 'int', required: false, desc: 'userId' },
    });
    const { body } = ctx.request;
    const user = await ctx.model.User.findOne({
      where: { id: body.userId },
      plain: true,
    });
    const data = await ctx.service.tag.add({ body, user });
    ctx.body = data;
  }
  async info() {
    const { ctx, app } = this;
    ctx.validate({
      id: { type: 'int', required: true, desc: 'id' },
    });
    const tagId = `tag:${ctx.params.id}`;
    const data = await app.redis.hgetall(tagId);
    ctx.body = data;
  }
  async edit() {
    const { ctx, app } = this;
    ctx.validate({
      name: { type: 'string', required: false, desc: 'name' },
      id: { type: 'int', required: true, desc: 'id' },
    });
    const tagId = `tag:${ctx.params.id}`;
    await app.redis.hset(tagId, 'name', ctx.request.body.name);
    const data = await app.redis.hgetall(tagId);
    ctx.body = data;
  }
  async vote() {
    const { ctx, app } = this;
    ctx.validate({
      type: { type: 'int', required: false, desc: 'type' },
      userId: { type: 'int', required: false, desc: 'userId' },
      id: { type: 'int', required: true, desc: 'id' },
    });
    const tagId = `tag:${ctx.params.id}`;
    const { body } = ctx.request;
    const user = await ctx.model.User.findOne({
      where: { id: body.userId },
      plain: true,
    });
    const typeMap = { 1: 'plus', 0: 'decr' };
    await ctx.service.tag.vote({ user, id: ctx.params.id, type: typeMap[body.type] });
    const data = await app.redis.hgetall(tagId);
    ctx.body = data;
  }
}

module.exports = TagController;
