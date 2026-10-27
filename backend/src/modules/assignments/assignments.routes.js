const router = require("express").Router();
const asyncHandler = require("../../utils/asyncHandler");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { uploadImages } = require("../../middleware/upload");
const { idParam } = require("../../utils/zodHelpers");
const schema = require("./assignments.schema");
const c = require("./assignments.controller");

router.use(requireAuth);

// Both roles (a captain only ever sees her own group's work: see the service)
router.get("/", requireRole("admin", "leader"), validate({ query: schema.list }), asyncHandler(c.list));
router.get("/:id", requireRole("admin", "leader"), validate({ params: idParam() }), asyncHandler(c.get));

// Admin
router.post("/:id/reference", requireRole("admin"), validate({ params: idParam() }), uploadImages("images", 3), asyncHandler(c.addReference));
router.patch("/:id/approve", requireRole("admin"), validate({ params: idParam(), body: schema.approve }), asyncHandler(c.setApproval));
router.delete("/:id/evidence/:mediaId", requireRole("admin"), validate({ params: schema.mediaParams }), asyncHandler(c.removeEvidence));

// Captain
router.patch("/:id/response", requireRole("leader"), validate({ params: idParam(), body: schema.respond }), asyncHandler(c.respond));
router.post("/:id/evidence", requireRole("leader"), validate({ params: idParam() }), uploadImages("photos", 5), asyncHandler(c.addEvidence));
router.patch("/:id/done", requireRole("leader"), validate({ params: idParam(), body: schema.done }), asyncHandler(c.markDone));

module.exports = router;
