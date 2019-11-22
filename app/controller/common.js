'use strict';

const Controller = require('egg').Controller;
const { PassThrough } = require('stream');

class CommonController extends Controller {
  async file() {
    const { ctx, app, config } = this;
    ctx.validate({
      fileName: { type: 'string', required: true, desc: 'fileName' },
    });
    const { query } = ctx.request;
    const filePath = app.path.resolve(config.paths.upload, query.fileName);
    ctx.logger.info(filePath);
    const { md5Str, input } = await new Promise((resolve, reject) => {
      const md5 = app.crypto.createHash('md5');
      const input = app.fs.createReadStream(filePath);
      input.on('data', d => {
        md5.update(d);
      });
      input.on('end', () => {
        const text = md5.digest('hex');
        console.log('文件的MD5是：%s', text);
        resolve({ md5Str: text, input });
      });
      input.on('error', err => {
        reject(err);
      });
    });
    console.log(md5Str, input);
    if (md5Str === 'ad186dff62430eb4bc4184a552685c82') {
      ctx.attachment(query.fileName);
      ctx.body = input;
    }
  }
}

module.exports = CommonController;
