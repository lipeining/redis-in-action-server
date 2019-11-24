'use strict';

module.exports = async app => {
  app.beforeStart(async () => {
    const force = app.config.env === 'unittest';
    await app.model.sync({ force });
    if (force) {
      await app.redis.flushdb();
    }
  });
};
