'use strict';
const Service = require('egg').Service;
const assert = require('assert');
/**
 * 工会 service 可以使用 zset value=0 的方式排序 key
 */
class MemberService extends Service {
  /**
   *
   * @param {*} values values
   * @param {*} values.prefix prefix
   * @param {*} options options
   * @return {*} Object
   */
  findPrefixRange(values, options = {}) {
    const validCharacters = '`abcdefghijklmnopqrstuvwxyz{';
    const { prefix } = values;
    assert(prefix, 'prefix is empty');
    const last = prefix.charAt(prefix.length - 1);
    const index = validCharacters.indexOf(last);
    // index should >= 1
    const suffix = validCharacters[(index || 1) - 1];
    return { start: prefix.slice(0, -1) + suffix + '{', end: prefix + '{' };
  }
  async fakeMember(values, options = {}) {
    const { ctx, app, config } = this;
    const { len, gid, prefix } = values;
    const groupKey = `members:${gid}`;
    for (let i = 0; i < len; i++) {
      await app.redis.zadd(groupKey, 0, prefix + app.uuid());
    }
  }
  async joinMember(values, options = {}) {
    const { ctx, app, config } = this;
    const { gid, user } = values;
    const groupKey = `members:${gid}`;
    await app.redis.zadd(groupKey, 0, user);
  }
  async leaveMember(values, options = {}) {
    const { ctx, app, config } = this;
    const { gid, user } = values;
    const groupKey = `members:${gid}`;
    await app.redis.zrem(groupKey, user);
  }
  async findRange(values, options = {}) {
    const { ctx, app, config } = this;
    const { prefix, gid } = values;
    let { start, end } = ctx.service.member.findPrefixRange(values, options);
    start += app.uuid().slice(0, 10);
    end += app.uuid().slice(0, 10);
    const groupKey = `members:${gid}`;
    // 添加 start, end 到时可以获取对应的 rank
    await app.redis.zadd(groupKey, 0, start, 0, end);
    const startRank = await app.redis.zrank(groupKey, start);
    const endRank = await app.redis.zrank(groupKey, end);
    const startI = startRank;
    const endI = Math.min(startRank + 9, endRank - 2);
    let result = [];
    try {
      const m = await app.redis.multi();
      await m.watch(groupKey);
      await m.zrem(groupKey, start, end);
      await m.zrange(groupKey, startI, endI);
      const ret = await m.exec();
      //   console.log(ret);
      result = ret[ret.length - 1][1];
    } catch (err) {
      ctx.logger.error(err);
    }
    return result;
  }
}
module.exports = MemberService;
