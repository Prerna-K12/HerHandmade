const router = require("express").Router();
const asyncHandler = require("../../utils/asyncHandler");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { idParam, z, id } = require("../../utils/zodHelpers");
const schema = require("./groups.schema");
const c = require("./groups.controller");

router.use(requireAuth);

// Admin
router.get("/match", requireRole("admin"), validate({ query: schema.match }), asyncHandler(c.match));
router.put("/:id/skills", requireRole("admin"), validate({ params: idParam(), body: schema.setSkills }), asyncHandler(c.setSkills));

// Captain (her own group)
router.get("/me", requireRole("leader"), asyncHandler(c.getMine));
router.post("/me/members", requireRole("leader"), validate({ body: schema.addMember }), asyncHandler(c.addMember));
router.delete("/me/members/:memberId", requireRole("leader"), validate({ params: z.object({ memberId: id }) }), asyncHandler(c.removeMember));
router.post("/me/access-code", requireRole("leader"), asyncHandler(c.regenerateCode));

module.exports = router;
