'use strict';
const Service = require('egg').Service;

class CartService extends Service {
  async ping() {
    const { ctx } = this;
    ctx.body = 'hi, egg';
  }
  async nextId() {
    const { app, ctx, config } = this;
    const counter = await app.redis.incr('counter:cart');
    return counter;
  }
  async add(values, options = {}) {
    const { app, ctx, config } = this;
    // const id = await ctx.service.cart.nextId();
    // 添加 投票 user
    const { user, product, count } = values;
    const cartId = `cart:${user.id}`;
    if (count <= 0) {
      await app.redis.hrem(cartId, product);
    } else {
      await app.redis.hset(cartId, product, count);
    }
  }
  async cacheRow(values, options = {}) {
    const { app, ctx, config } = this;
    const { rowId, delay } = values;
    await app.redis.zadd('delay:row:', rowId, delay);
    await app.redis.zadd('schedule:row:', rowId, Date.now());
  }
}


module.exports = CartService;
