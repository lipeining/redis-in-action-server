'use strict';

const Controller = require('egg').Controller;

class ArticleController extends Controller {
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
    const data = await ctx.model.Article.findAndCountAll({
      // plain: true,
      where: { deleteTime: 0 },
      order: [ sort ],
      include: [{ model: ctx.model.User, as: 'CreateUser' }],
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
      content: { type: 'string', required: true, desc: 'content' },
      title: { type: 'string', required: true, desc: 'title' },
      link: { type: 'string', required: true, desc: 'link' },
      createUserId: { type: 'int', required: true, desc: 'createUserId' },
    });
    const { query, body } = ctx.request;
    const data = await ctx.model.Article.create(
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
    const data = await ctx.model.Article.findOne({
      where: params,
      include: [{ model: ctx.model.User, as: 'CreateUser' }],
      plain: true,
    });
    ctx.body = data;
  }
  async edit() {
    const { ctx } = this;
    ctx.validate({
      id: { type: 'int', required: true, desc: 'id' },
      content: { type: 'string', required: false, desc: 'content' },
      title: { type: 'string', required: false, desc: 'title' },
      link: { type: 'string', required: false, desc: 'link' },
    });
    const { query, body } = ctx.request;
    const params = ctx.params;
    await ctx.model.Article.update(
      Object.assign({ updateTime: Date.now() }, body),
      { where: params, plain: true }
    );
    const data = await ctx.model.Article.findOne({
      where: params,
      plain: true,
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
    await ctx.model.Article.update(
      Object.assign({ deleteTime: Date.now() }, body),
      { where: params, plain: true }
    );
    const data = await ctx.model.Article.findOne({
      where: params,
      plain: true,
    });
    ctx.body = data;
  }
}

module.exports = ArticleController;
