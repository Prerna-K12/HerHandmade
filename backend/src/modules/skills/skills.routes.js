const router = require("express").Router();
const asyncHandler = require("../../utils/asyncHandler");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const schema = require("./skills.schema");
const c = require("./skills.controller");

router.use(requireAuth);
router.get("/", requireRole("admin", "leader"), asyncHandler(c.list));
router.post("/", requireRole("admin"), validate({ body: schema.create }), asyncHandler(c.create));

module.exports = router;
