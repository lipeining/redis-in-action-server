'use strict';

class Task {
  async run() {
    const { ctx, app } = this;
    const next = await app.redis.zrange('schedule:row:', 0, 0, 'WITHSCORES');
    console.log(next);
    if (next[0][1] > Date.now()) {
      // 还没有调度的时间
      return;
    }
    const rowId = next[0][0];
    const delay = await app.redis.zrank('delay:row:', rowId);
    if (delay <= 0) {
      await app.redis.zrem('delay:row:', rowId);
      await app.redis.zrem('schedule:row:', rowId);
      await app.redis.del(`inv:${rowId}`);
    }
    const row = { rowId };
    await app.zadd('schedule:row:', rowId, Date.now() + delay);
    await app.redis.set(`inv:${rowId}`, JSON.stringify(row));
  }
}

module.exports = app => {

};
