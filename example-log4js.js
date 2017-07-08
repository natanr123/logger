const logger = require('./')
const log4js = require('log4js')
const Koa = require('koa')
const app = new Koa()

app.use(logger())

log4js.configure({
  appenders: {
    everything: { type: 'file', filename: 'all-the-logs.log' }
  },
  categories: {
    default: { appenders: [ 'everything' ], level: 'debug' }
  }
})

let log4jsLogger = log4js.getLogger()

logger.level = 'debug'
app.use(logger({'log4js': {'logger': log4jsLogger, level: 'debug'}}))
app.use(function (ctx, next) {
  ctx.body = 'Hello World'
})

const port = process.env.PORT || 3000
app.listen(port)
console.log('listening on port ' + port)
