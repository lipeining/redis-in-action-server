'use strict';

const { app, assert } = require('egg-mock/bootstrap');
const BBPromise = require('bluebird');

describe('test/app/controller/chat.test.js', () => {
  let ctx;
  const recipients = [];
  before(async () => {
    ctx = app.mockContext();
    for (let i = 0; i < 2; i++) {
      const user = await ctx.model.User.create(
        { nickName: `chat-service-${i + 1}` },
        { plain: true }
      );
      recipients.push(user.id);
    }
  });
  it(' chat ', async () => {
    const sender = 'sender-1';
    const message = 'message-1';
    const chatId = await ctx.service.chat.createChat({ sender, message, recipients });
    await ctx.service.chat.sendMessage({ chatId, sender, message, recipients });
    await ctx.service.chat.fetchPendingMessage({ recipient: recipients[0] });
    await ctx.service.chat.fetchPendingMessage({ recipient: recipients[1] });
    await ctx.service.chat.sendMessage({ chatId, sender, message, recipients });
    await ctx.service.chat.leaveChat({ chatId, recipient: recipients[1] });
  });
});
