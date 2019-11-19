'use strict';

const Controller = require('egg').Controller;

/**
 * Maps react-admin queries to a simple REST API
 *
 * The REST dialect is similar to the one of FakeRest
 * @see https://github.com/marmelab/FakeRest
 * @example
 * GET_LIST     => GET http://my.api.url/posts?sort=['title','ASC']&range=[0, 24]
 * GET_ONE      => GET http://my.api.url/posts/123
 * GET_MANY     => GET http://my.api.url/posts?filter={ids:[123,456,789]}
 * UPDATE       => PUT http://my.api.url/posts/123
 * CREATE       => POST http://my.api.url/posts
 * DELETE       => DELETE http://my.api.url/posts/123
 *  total: parseInt(headers
                        .get('content-range')
                        .split('/')
                        .pop(), 10)
 */

class UserController extends Controller {
  async list() {
    const { ctx } = this;
    ctx.validate({
      page: { type: 'int', defValue: 1, desc: 'page' },
      size: { type: 'int', defValue: 10, desc: 'size' },
      sort: { type: 'string', defValue: '["id", "ASC"]', desc: 'sort' },
    });
    const { query } = ctx.request;
    const range = ctx.get('range');
    const [ start, end ] = JSON.parse(range || '[]');
    const offset = start || (query.page - 1) * query.size || 0;
    const limit = end - start || query.size;
    const sort = JSON.parse(query.sort);
    const data = await ctx.model.User.findAndCountAll({
      // plain: true,
      where: { deleteTime: 0 },
      order: [ sort ],
      offset,
      limit,
    });
    ctx.set('Content-Range', `${offset}-${offset + limit}/${data.count}`);
    ctx.set('Access-Control-Expose-Headers', 'Content-Range');
    ctx.logger.info(data.rows.length);
    ctx.body = data.rows;
  }
  async add() {
    const { ctx } = this;
    ctx.validate({
      nickName: { type: 'string', required: true, desc: 'nickName' },
      email: { type: 'string', required: true, desc: 'email' },
    });
    const { query, body } = ctx.request;
    const data = await ctx.model.User.create(
      Object.assign({ createTime: Date.now() }, body),
      { plain: true }
    );
    ctx.body = data;
  }
  async info() {
    const { ctx } = this;
    ctx.validate({
      id: { type: 'int', required: true, desc: 'id' },
    });
    const { query, body } = ctx.request;
    const params = ctx.params;
    const data = await ctx.model.User.findOne({
      where: params,
    });
    ctx.body = data;
  }
  async edit() {
    const { ctx } = this;
    ctx.validate({
      id: { type: 'int', required: true, desc: 'id' },
      nickName: { type: 'string', required: false, desc: 'nickName' },
      email: { type: 'string', required: false, desc: 'email' },
    });
    const { query, body } = ctx.request;
    const params = ctx.params;
    await ctx.model.User.update(
      Object.assign({ updateTime: Date.now() }, body),
      { where: params }
    );
    const data = await ctx.model.User.findOne({
      where: params,
    });
    ctx.body = data;
  }
  async del() {
    const { ctx } = this;
    ctx.validate({
      id: { type: 'int', required: true, desc: 'id' },
    });
    const { query, body } = ctx.request;
    const params = ctx.params;
    await ctx.model.User.update(
      Object.assign({ deleteTime: Date.now() }, body),
      { where: params }
    );
    const data = await ctx.model.User.findOne({
      where: params,
    });
    ctx.body = data;
  }
}

module.exports = UserController;
