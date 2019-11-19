'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
  router.get('/', controller.home.index);
  // user
  router.get('/users', controller.user.list);
  router.post('/users', controller.user.add);
  router.get('/users/:id', controller.user.info);
  router.put('/users/:id', controller.user.edit);
  router.delete('/users/:id', controller.user.del);
  // article
  router.get('/articles', controller.article.list);
  router.post('/articles', controller.article.add);
  router.get('/articles/:id', controller.article.info);
  router.put('/articles/:id', controller.article.edit);
  router.delete('/articles/:id', controller.article.del);
};
