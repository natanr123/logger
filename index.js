/**
 * Module dependencies.
 */
'use strict'

const Counter = require('passthrough-counter')
const humanize = require('humanize-number')
const bytes = require('bytes')
const chalk = require('chalk')

/**
 * Expose logger.
 */

module.exports = dev

/**
 * Color map.
 */

const colorCodes = {
  7: 'magenta',
  5: 'red',
  4: 'yellow',
  3: 'cyan',
  2: 'green',
  1: 'green',
  0: 'yellow'
}

/**
 * Development logger.
 */

function dev (opts) {

  return async function logger (ctx, next) {
    // request
    const start = Date.now()


    if(isLog4jsAviable(opts)) {
      requestBeginWriteToLog4js(opts.log4js.logger,opts.log4js.level,ctx.method, ctx.originalUrl);
    } else {
      requestBeginWriteToSimpleConsole(ctx.method, ctx.originalUrl);
    }


    try {
      await next()
    } catch (err) {
      // log uncaught downstream errors
      if(isLog4jsAviable(opts)) {
        requestEndWriteLog4js(opts.log4js.logger,opts.log4js.level,logParts(ctx, start, null, err));
      } else {
        requestEndWriteToSimpleConsole(logParts(ctx, start, null, err));
      }

      throw err
    }

    // calculate the length of a streaming response
    // by intercepting the stream with a counter.
    // only necessary if a content-length header is currently not set.
    const length = ctx.response.length
    const body = ctx.body
    let counter
    if (length == null && body && body.readable) {
      ctx.body = body
        .pipe(counter = Counter())
        .on('error', ctx.onerror)
    }

    // log when the response is finished or closed,
    // whichever happens first.
    const res = ctx.res

    const onfinish = done.bind(null, 'finish')
    const onclose = done.bind(null, 'close')

    res.once('finish', onfinish)
    res.once('close', onclose)

    function done (event) {
      res.removeListener('finish', onfinish)
      res.removeListener('close', onclose)
      if(isLog4jsAviable(opts)) {
        requestEndWriteLog4js(opts.log4js.logger,opts.log4js.level,logParts(ctx, start, counter ? counter.length : length, null, event))
      } else {
        requestEndWriteToSimpleConsole(logParts(ctx, start, counter ? counter.length : length, null, event));
      }

    }
  }
}

/**
 * Log helper.
 */

function logParts(ctx, start, len, err, event) {
  // get the status code of the response
  const status = err
    ? (err.status || 500)
    : (ctx.status || 404)
  // get the human readable response length
  let length
  if (~[204, 205, 304].indexOf(status)) {
    length = ''
  } else if (len == null) {
    length = '-'
  } else {
    length = bytes(len).toLowerCase()
  }

  const upstream = err ? chalk.red('xxx')
    : event === 'close' ? chalk.yellow('-x-')
      : chalk.gray('-->')


  return { 'upstream': upstream,
    'method': ctx.method,
    'originalUrl': ctx.originalUrl,
    'status': status,
    'time': time(start),
    'length': length
  }
}

function requestBeginWriteToSimpleConsole(method,originalUrl) {
  console.log('  ' + chalk.gray('<--') +
    ' ' + chalk.bold('%s') +
    ' ' + chalk.gray('%s'),
    method,
    originalUrl)
}

function requestEndWriteToSimpleConsole(logParts) {
  // set the color of the status code;
  const s = logParts['status'] / 100 | 0
  const color = colorCodes.hasOwnProperty(s) ? colorCodes[s] : 0
  console.log('  ' + logParts['upstream'] +
    ' ' + chalk.bold('%s') +
    ' ' + chalk.gray('%s') +
    ' ' + chalk[color]('%s') +
    ' ' + chalk.gray('%s') +
    ' ' + chalk.gray('%s'),
    logParts['method'],
    logParts['originalUrl'],
    logParts['status'],
    logParts['time'],
    logParts['length'])
}

function isLog4jsAviable(opts) {
  return opts && opts.log4js && opts.log4js.logger && opts.log4js.level;
}

function requestBeginWriteToLog4js(logger,level,method,originalUrl) {
  let message = method +' '+ originalUrl;
  (logger[level])(message);
}

function requestEndWriteLog4js(logger, level, logParts) {
  let message = logParts['method'] + ' ' + logParts['originalUrl']+ ' ' + logParts['status'] + ' ' + logParts['time']+ ' ' + logParts['length'];
  (logger[level])(message);
}

/**
 * Show the response time in a human readable format.
 * In milliseconds if less than 10 seconds,
 * in seconds otherwise.
 */

function time (start) {
  const delta = Date.now() - start
  return humanize(delta < 10000
    ? delta + 'ms'
    : Math.round(delta / 1000) + 's')
}
