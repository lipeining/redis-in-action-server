'use strict';
exports.sequelize = {
  dialect: 'mysql',
  host: 'localhost',
  port: 3306,
  database: 'actiontest',
  username: 'root',
  password: 'root',
};
exports.redis = {
  client: {
    host: 'localhost',
    port: 6379,
    password: 'admin',
    db: 6,
  },
};
