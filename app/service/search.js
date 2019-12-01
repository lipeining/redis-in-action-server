'use strict';

const Service = require('egg').Service;
const assert = require('assert');
const BBPromise = require('bluebird');
const STOP_WORDS = Symbol('Search#STOP_WORDS');
/**
 * search cho7
 */
class SearchService extends Service {
  constructor(options) {
    super(options);
    this[STOP_WORDS] = `able about across after all almost also am among
    an and any are as at be because been but by can cannot could dear did
    do does either else ever every for from get got had has have he her
    hers him his how however if in into is it its just least let like
    likely may me might most must my neither no nor not of off often on
    only or other our own rather said say says she should since so some
    than that the their them then there these they this tis to too twas us
    wants was we were what when where which while who whom why will with
    would yet you your`.split(' ').map(str => { return str.trim(); }).filter(Boolean);
  }
  tokenize(values, options = {}) {
    const { app, ctx, config } = this;
    const { content } = values;
    const reg = /[a-z']{2,}/gi;
    let match;
    const want = new Set();
    while ((match = reg.exec(content)) !== null) {
      const word = app._.trim(match[0], "'");
      if (word.length >= 2) {
        want.add(word);
      }
    }
    return app._.difference([ ...want ], this[STOP_WORDS]);
  }
  async indexDocument(values, options = {}) {
    const { app, ctx, config } = this;
    const { docId, content } = values;
    const words = ctx.service.search.tokenize(values, options);
    const multi = await app.redis.multi();
    for (const word of words) {
      await multi.sadd(`words:${word}`, docId);
    }
    return await multi.exec();
  }
}

module.exports = SearchService;
