// Express 4 does not catch errors from async functions by itself.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
