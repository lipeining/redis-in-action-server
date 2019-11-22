'use strict';
exports.sequelize = {
  dialect: 'mysql',
  host: 'localhost',
  port: 3306,
  database: 'actiontest',
  username: 'duoyi',
  password: 'DUOYIqaz123',
};
exports.redis = {
  client: {
    host: 'localhost',
    port: 6379,
    password: '',
    db: 6,
  },
};
