const router = require("express").Router();
const asyncHandler = require("../../utils/asyncHandler");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { idParam } = require("../../utils/zodHelpers");
const schema = require("./captains.schema");
const c = require("./captains.controller");

router.use(requireAuth, requireRole("admin"));
router.get("/", asyncHandler(c.list));
router.post("/", validate({ body: schema.create }), asyncHandler(c.create));
router.put("/:id/password", validate({ params: idParam(), body: schema.resetPassword }), asyncHandler(c.resetPassword));
router.delete("/:id", validate({ params: idParam() }), asyncHandler(c.deactivate));

module.exports = router;
