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
  async setSearch(values, options = {}) {
    const { app, ctx, config } = this;
    const { want, unwant } = values;
    // 通过对每一个 word 的 set 取 交集，并集，差集
    // 每一个 w 都是一个数组，指的是同义词，比如 proxy, proxies,
    // 数组需要取并集，
    // 而每一个 want 之间是 交集关系，比如 proxy, network, connect
    // 每一个 unwant 只是一维数组，表示 差集
    const toIntersect = [];
    for (const w of want) {
      if (w.length > 1) {
        const uid = `words:union:${app.uuid()}`;
        await app.redis.sunionstore(uid, ...w.map(t => { return `words:${t}`; }));
        toIntersect.push(uid);
      } else {
        toIntersect.push(`words:${w[0]}`);
      }
    }
    let interId = `words:inter:${app.uuid()}`;
    if (toIntersect.length > 1) {
      await app.redis.sinterstore(interId, ...toIntersect);
    } else {
      interId = toIntersect[0];
    }
    let searchId = `words:diff:${app.uuid()}`;
    if (unwant.length) {
      // 前面的是 inter
      await app.redis.sdiffstore(searchId, interId, ...unwant.map(t => { return `words:${t}`; }));
    } else {
      searchId = interId;
    }
    return searchId;
  }
  async sortSetSearch(values, options = {}) {
    // 可以使用 setSearch 的结果作为缓存
    const { app, ctx, config } = this;
    const { searchId, sort, alpha, desc, start, num } = values;
    const count = await app.redis.scard(searchId);
    const by = `kb:doc:*->${sort}`;
    const args = [ 'by', by ];
    const list = await app.redis.sort(searchId, args);
    return { count, list };
  }
  async sortZsetSearch(values, options = {}) {
    const { app, ctx, config } = this;
    const { sortUpdate, sortVoted, start, end } = values;
    // 将每一个文章的索引放在 一个对应的 update, vote 的 zset 中，然后取交集并集的方式得到对应的权重的文章
    const searchId = `words:zset:${app.uuid()}`;
    const toSearch = [ 'sort:update', sortUpdate, 'sort:votes', sortVoted ];
    await app.redis.zinterstore(searchId, toSearch);
    // 通过排序
    const count = await app.redis.zcard(searchId);
    // 可以 range or  revrange
    const list = await app.redis.zrevrange(searchId, start, end);
    return { count, list };
  }
  string2code(values, options = {}) {
    const { app, ctx, config } = this;
    let { str } = values;
    const { ignoreCase, n } = options;
    if (ignoreCase) {
      str = str.toLowerCase();
    }
    const pieces = [];
    for (let i = 0; i < n; i++) {
      const code = str.length <= i ? -1 : str.charCodeAt(i);
      pieces.push(code);
    }
    const score = pieces.reduce((sum, num) => {
      return sum * 257 + num + 1;
    }, 0);
    console.log(pieces, score);
    return score * 2 + Number(str.length > n);
  }
  async indexJob(values, options = {}) {
    const { app, ctx, config } = this;
    const { jobId, skills } = values;
    // 对于每一个 skill 记录对应的 jobId,
    // 对于 jobId 记录需要的技能数量
    for (const skill of skills) {
      const skillKey = `idx:skill:${skill}`;
      await app.redis.sadd(skillKey, jobId);
    }
    const jobReqKey = 'idx:jobs:req:';
    await app.redis.zadd(jobReqKey, skills.length, jobId);
    return true;
  }
  async findJobs(values, options = {}) {
    const { app, ctx, config } = this;
    const { candidateSkills } = values;
    // 通过 zunionstroe 得到对应的 skill 的合集
    const unionSkillKey = `idx:skill:union:${app.uuid()}`;
    const unionSet = candidateSkills.map(s => { return `idx:skill:${s}`; });
    const args = [ 'WEIGHTS' ].concat(candidateSkills.map(s => { return 1; }));
    const jobScores = await app.redis.zunionstore(unionSkillKey, unionSet.length, ...unionSet, ...args);
    console.log(jobScores);
    // 使用交集的方式计算 这个已有的并集 与 要求的 jobReq 之间的值。如果为 0 表示可以胜任。
    const interSkillKey = `idx:skill:inter:${app.uuid()}`;
    const jobReqKey = 'idx:jobs:req:';
    // 将 jobReqKey 与对应的 union 进行交集
    const finalResult = await app.redis.zinterstore(interSkillKey, 2, unionSkillKey, jobReqKey, ...[ 'WEIGHTS', -1, 1 ]);
    console.log(finalResult);
    // 只有得分为 0 的才是符合的
    return await app.redis.zrangebyscore(interSkillKey, 0, 0);
  }
  async findJobsWeight(values, options = {}) {
    // 这里跟上面不同的是：每一个技能都有熟练度，说明，这个
    // 熟练度应该作为一个分值记录在 zset 中吗？
    // 还是说通过 简单的 分值转为一个大的分值，因为  'idx:jobs:req:' 只是记录这个职位需要的技能树，
    // 单纯的整数，可以转为 浮点数 吗？
    // 答案里面给出了方法，需要添加新的 有序集合，所以，考虑以下集合
    // interstore 里面的应该不需要修改，还是使用数量判断，
    // 只是通过 union 得到当前用户符合条件的工作时，需要使用不同的 weight 来计算
    // 比如： 1-5 的级别，已有的 skills 为对应的 负数，输入的 candidateSkills 为正数，
    // 所以会有一个 skill 与对应的要求的 map zset
    // skills: { 'computer': 2, 'pen': 1 }; candidateSkills: { 'computer': 4, 'pen': 2 };
    const { app, ctx, config } = this;
    const { candidateSkills, skill } = values;
    // 通过 zunionstroe 得到对应的 skill 的合集
    const unionSkillKey = `idx:skill:union:${app.uuid()}`;
    // 计算服务器上的
    // const needSet = Object.keys(candidateSkills).map(s => { return `idx:skill:${s}`; });
    // const candidateSet = Object.keys(candidateSkills).map(s => { return `idx:skill:owner:${s}`; });
    // // for (const skill of Object(candidateSkills)) {
    // //   const skillKey = `idx:skill:owner:${skill}`;
    // //   await app.redis.sadd(skillKey, jobId);
    // // }
    // const args = [ 'WEIGHTS' ]
    //   .concat(Object.keys(candidateSkills).map(s => { return skill[s]; }))
    //   .concat(Object.keys(candidateSkills).map(s => { return -candidateSkills[s]; }));
    // const jobScores = await app.redis.zunionstore(unionSkillKey, needSet.length + candidateSet.length, ...needSet, ...candidateSet, ...args);
    // console.log(jobScores);
    // // 使用交集的方式计算 这个已有的并集 与 要求的 jobReq 之间的值。如果为 0 表示可以胜任。
    // const interSkillKey = `idx:skill:inter:${app.uuid()}`;
    // const jobReqKey = 'idx:jobs:req:';
    // // 将 jobReqKey 与对应的 union 进行交集
    // const finalResult = await app.redis.zinterstore(interSkillKey, 2, unionSkillKey, jobReqKey, ...[ 'WEIGHTS', -1, 1 ]);
    // console.log(finalResult);
    // // 只有得分为 0 的才是符合的
    // return await app.redis.zrangebyscore(interSkillKey, 0, 0);
  }
}

module.exports = SearchService;
