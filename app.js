'use strict';

module.exports = async app => {
  app.beforeStart(async () => {
    await app.model.sync({ force: app.config.env === 'unittest' });
  });
};
