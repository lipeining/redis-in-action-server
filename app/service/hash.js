'use strict';
const Service = require('egg').Service;
const assert = require('assert');
/* eslint-disable no-bitwise */
/**
 * 一致性 hash 代码，不采用红黑树，使用列表保存节点映射。
 */
class HashService extends Service {
  constructor(options) {
    super(options);
    this.serverList = options.serverList || [];
    this.virtualNodeNumber = options.virtualNodeNumber || 0;
    this.totalNodeNumber = 100;
    this.virtualSep = '###';
    this.hostPortSep = ':';
    this.init = false;
  }
  /**
   *
   * @param {*} values object
   * @param {*} values.serverList array
   * @param {*} values.serverList.$.host host
   * @param {*} values.serverList.$.port port
   * @param {*} values.virtualNodeNumber number
   * @param {*} options object
   */
  initServer(values, options = {}) {
    // 是否允许重复初始化
    assert(values.serverList && Array.isArray(values.serverList), 'serverList is wrong');
    if (values.virtualNodeNumber) {
      assert(values.virtualNodeNumber > 0, 'virtualNodeNumber is wrong');
    }
    this.serverList = values.serverList;
    this.virtualNodeNumber = values.virtualNodeNumber || Math.ceil(this.totalNodeNumber / this.serverList.length);
    this.serverMap = new Map();
    // 暂时以 {} fake 一个实际的 redis 实例
    for (const server of this.serverList) {
      this.serverMap.set(this.server2key({ server }), {});
    }
    this.initVirtualServer();
  }
  initVirtualServer() {
    // 虚拟节点需要根据 hashCode 进行排序，然后可以 点 到 线 的映射。
    this.virtualServerList = [];
    for (let i = 1; i <= this.virtualNodeNumber; i++) {
      for (const server of this.serverList) {
        const key = this.server2key({ server, index: i });
        const hashCode = this.hashCode({ key });
        this.virtualServerList.push({ key, hashCode });
      }
    }
    this.virtualServerList.sort((a, b) => {
      return a.hashCode - b.hashCode;
    });
    this.ctx.logger.info(`init virtual server : ${this.virtualServerList.map(s => { return `${s.hashCode}-${s.key}`; })}`);
    this.init = true;
  }
  server2key(values, options = {}) {
    const { server, index } = values;
    const key = `${server.host}${this.hostPortSep}${server.port}${index ? `${this.virtualSep}${index}` : ''}`;
    return key;
  }
  key2server(values, options = {}) {
    const { key } = values;
    const [ serverName, index ] = key.split(this.virtualSep);
    const [ host, port ] = serverName.split(this.hostPortSep);
    return { server: { host, port: Number(port) }, index: Number(index) };
  }
  hashCode(values, options = {}) {
    const { key } = values;
    // FNV1_32_HASH
    const p = 16777619;
    let hash = 2166136261;
    for (let i = 0; i < key.length; i++) {
      hash = (hash ^ key.charCodeAt(i)) * p;
    }
    hash += hash << 13;
    hash ^= hash >> 7;
    hash += hash << 3;
    hash ^= hash >> 17;
    hash += hash << 5;
    // 如果算出来的值为负数则取其绝对值
    if (hash < 0) {
      hash = Math.abs(hash);
    }
    return hash;
  }
  getServer(values, options = {}) {
    const { key } = values;
    const hashCode = this.hashCode({ key });
    const nextIndex = this.virtualServerList.findIndex(s => {
      return s.hashCode > hashCode;
    });
    const index = nextIndex > 0
      ? nextIndex - 1
      : nextIndex === -1
        ? 0
        : this.virtualServerList.length - 1;
    const virtualServer = this.virtualServerList[index];
    const server = this.key2server(virtualServer).server;
    const serverConnector = this.serverMap.get(this.server2key({ server }));
    return { server, serverConnector };
  }
  test() {
    const { app, ctx } = this;
    const times = 1000;
    const map = {};
    for (let i = 0; i < times; i++) {
      const key = app.uuid();
      const { server, serverConnector } = this.getServer({ key });
      const serverName = this.server2key({ server });
      if (!map[serverName]) {
        map[serverName] = 0;
      }
      map[serverName]++;
    }
    console.log(map);
  }
}


module.exports = HashService;
