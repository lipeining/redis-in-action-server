'use strict';
const Redlock = require('redlock');

module.exports = async app => {
  app.beforeStart(async () => {
    const force = app.config.env === 'unittest';
    await app.model.sync({ force });
    if (force) {
      await app.redis.flushdb();
    }
    // 这里加载 redlock
    app.redlock = new Redlock([ app.redis ]);
    app.logger.info(app.redlock);
  });
};
