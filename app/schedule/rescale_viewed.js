'use strict';


async function run() {
  const { ctx, app } = this;
  // 在接口访问中添加
  // 记录每一个 Item 的访问次数 await app.redis.zincrby('viewed:', item, -1);
  // 如何判断是否需要缓存该 item
  // const count = await app.redis.zrank('viewed:', item); if count > expected 就添加缓存。
  await app.redis.zremrangebyrank('viewed:', 0, -20001);
  await app.redis.zinterstore('viewed:', { viewed: 0.5 });
}
module.exports = app => {

};
