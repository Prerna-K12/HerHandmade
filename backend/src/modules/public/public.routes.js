// Everything here needs NO login.
const router = require("express").Router();
const asyncHandler = require("../../utils/asyncHandler");
const validate = require("../../middleware/validate");
const { publicOrderLimiter, accessCodeLimiter } = require("../../middleware/rateLimit");
const ordersSchema = require("../orders/orders.schema");
const schema = require("./public.schema");
const c = require("./public.controller");

// Business: place an order and follow it
router.post("/orders", publicOrderLimiter, validate({ body: ordersSchema.createPublic }), asyncHandler(c.createOrder));
router.get("/track/:token", validate({ params: schema.tokenParams }), asyncHandler(c.track));
router.get("/track/:token/photos/:mediaId", validate({ params: schema.photoParams }), asyncHandler(c.trackPhoto));

// Workers: read-only group link
router.get("/group-view/:code", accessCodeLimiter, validate({ params: schema.codeParams }), asyncHandler(c.groupView));
router.get("/group-view/:code/media/:fileName", accessCodeLimiter, validate({ params: schema.codeMediaParams }), asyncHandler(c.groupMedia));

module.exports = router;
