const router = require("express").Router();
const asyncHandler = require("../../utils/asyncHandler");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { idParam } = require("../../utils/zodHelpers");
const schema = require("./orders.schema");
const c = require("./orders.controller");
const assignmentsController = require("../assignments/assignments.controller");
const assignmentsSchema = require("../assignments/assignments.schema");

router.use(requireAuth, requireRole("admin"));

router.get("/", validate({ query: schema.list }), asyncHandler(c.list));
router.get("/:id", validate({ params: idParam() }), asyncHandler(c.get));
router.patch("/:id/status", validate({ params: idParam(), body: schema.updateStatus }), asyncHandler(c.updateStatus));

// Splitting an order into assignments is part of an order's URL, but the code lives in assignments.
router.post(
  "/:orderId/assignments",
  validate({ params: idParam("orderId"), body: assignmentsSchema.create }),
  asyncHandler(assignmentsController.create)
);

module.exports = router;
