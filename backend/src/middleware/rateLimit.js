// In-memory rate limits (fine for one server). Disabled in tests unless RATE_LIMIT_TEST=1.
const rateLimit = require("express-rate-limit");
const AppError = require("../utils/AppError");

const make = (windowMs, limit, extra = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test" && !process.env.RATE_LIMIT_TEST,
    handler: (req, res, next) =>
      next(new AppError(429, "TOO_MANY_REQUESTS", "Too many attempts, try again later")),
    ...extra,
  });

// Only failed attempts count for these two, so normal use is never blocked.
exports.loginLimiter = make(15 * 60 * 1000, 10, { skipSuccessfulRequests: true });
exports.accessCodeLimiter = make(15 * 60 * 1000, 30, { skipSuccessfulRequests: true });
// Public order form: 20 submissions per hour per IP.
exports.publicOrderLimiter = make(60 * 60 * 1000, 20);
