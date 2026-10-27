const router = require("express").Router();
const asyncHandler = require("../../utils/asyncHandler");
const validate = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/auth");
const { loginLimiter } = require("../../middleware/rateLimit");
const schema = require("./auth.schema");
const c = require("./auth.controller");

router.post("/login", loginLimiter, validate({ body: schema.login }), asyncHandler(c.login));
router.post("/logout", c.logout);
router.get("/me", requireAuth, asyncHandler(c.me));

module.exports = router;
