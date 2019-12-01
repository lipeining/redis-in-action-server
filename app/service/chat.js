'use strict';
const Service = require('egg').Service;
const assert = require('assert');
const BBPromise = require('bluebird');
/**
 * chat 不丢失信息的列表
 */
class ChatService extends Service {
  async createChat(values, options = {}) {
    const { app, ctx, config } = this;
    const { sender, message, recipients } = values;
    const chatId = values.chatId || (await app.redis.incr('ids:chat:'));
    const recipientRecords = recipients.reduce((records, id) => {
      return [ ...records, 0, id ];
    }, []);
    ctx.logger.info(recipientRecords);
    // 创建 chat:id recipient:id 的映射
    const chatZset = `chat:${chatId}`;
    await app.redis.zadd(chatZset, recipientRecords);
    for (const recipient of recipients) {
      await app.redis.zadd(`seen:${recipient}`, 0, chatId);
    }
    await ctx.service.chat.sendMessage(Object.assign(values, { chatId }), options);
    return chatId;
  }
  async sendMessage(values, options) {
    const { app, ctx, config } = this;
    const { chatId, sender, message, recipients } = values;
    // 使用锁避免重复发送
    const lock = `sendMessage:${chatId}`;
    const identifier = await ctx.service.lock.acquireLock({ lock });
    if (!identifier) {
      ctx.logger.info(`${chatId}, ${sender} send message get no lock`);
      return false;
    }
    const msgId = await app.redis.incr(`ids:chats:${chatId}:msgs:`);
    const msgZset = `msgs:${chatId}`;
    await app.redis.zadd(msgZset, msgId, JSON.stringify({ msgId, sender, message, createTime: Date.now() }));
    await ctx.service.lock.releaseLock({ lock, identifier });
    return msgId;
  }
  async fetchPendingMessage(values, options = {}) {
    const { app, ctx, config } = this;
    const { recipient } = values;

    const seenZset = `seen:${recipient}`;
    // 获取用户的已读信息列表
    const seens = await app.redis.zrange(seenZset, 0, -1, 'WITHSCORES');
    ctx.logger.info(seens);
    const result = [];
    for (const [ chatId, seenId ] of app._.chunk(seens, 2)) {
      const msgs = await app.redis.zrangebyscore(`msgs:${chatId}`, Number(seenId) + 1, Infinity);
      ctx.logger.info(msgs);
      result.push({ chatId, seenId, messages: msgs ? app._.map(msgs, JSON.parse) : [] });
    }
    // 对于全部人都已读的消息进行删除
    for (const { chatId, seenId, messages } of result) {
      if (!messages || messages.length === 0) {
        continue;
      }
      const chatZset = `chat:${chatId}`;
      const messageIds = app._.map(messages, 'msgId');
      const lastId = messageIds[messageIds.length - 1];
      // 更新该用户的已读
      await app.redis.zadd(chatZset, lastId, recipient);
      await app.redis.zadd(seenZset, lastId, chatId);
      const minRead = await app.redis.zrange(chatZset, 0, 0, 'WITHSCORES');
      ctx.logger.info(minRead);
      // 是否删除 可以结合现实情况处理吧
      if (minRead) {
        // 这个是这个群组里面，最小的未读信息
        await app.redis.zremrangebyscore(`msgs:${chatId}`, 0, minRead[1]);
      }
    }
    return result;
  }
  async joinChat(values, options = {}) {
    const { app, ctx, config } = this;
    const { recipient, chatId } = values;
    const msgId = await app.redis.get(`ids:chats:${chatId}:msgs:`);
    const seenZset = `seen:${recipient}`;
    const chatZset = `chat:${chatId}`;
    await app.redis.zadd(seenZset, msgId, chatId);
    await app.redis.zadd(chatZset, msgId, recipient);
    return true;
  }
  async leaveChat(values, options = {}) {
    const { app, ctx, config } = this;
    const { recipient, chatId } = values;
    const seenZset = `seen:${recipient}`;
    const chatZset = `chat:${chatId}`;
    await app.redis.zrem(seenZset, chatId);
    await app.redis.zrem(chatZset, recipient);
    const leftUsers = await app.redis.zcard(chatZset);
    ctx.logger.info(leftUsers);
    if (!Number(leftUsers)) {
      await app.redis.del(`msgs:${chatId}`);
      await app.redis.del(`ids:chats:${chatId}:msgs:`);
    } else {
      const oldest = await app.redis.zrange(chatZset, 0, 0, 'WITHSCORES');
      if (oldest) {
        // 如果只有一条记录的话
        await app.redis.zremrangebyscore(`msgs:${chatId}`, 0, oldest[1]);
      }
    }
    return true;
  }
}
module.exports = ChatService;
