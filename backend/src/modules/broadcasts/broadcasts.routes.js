const router = require("express").Router();
const asyncHandler = require("../../utils/asyncHandler");
const validate = require("../../middleware/validate");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { uploadImages } = require("../../middleware/upload");
const { idParam } = require("../../utils/zodHelpers");
const schema = require("./broadcasts.schema");
const c = require("./broadcasts.controller");

router.use(requireAuth, requireRole("admin", "leader"));

// uploadImages runs first so multipart fields are available to validate()
router.post("/", uploadImages("image", 1), validate({ body: schema.create }), asyncHandler(c.create));
router.get("/", validate({ query: schema.feed }), asyncHandler(c.feed));
router.delete("/:id", validate({ params: idParam() }), asyncHandler(c.remove));

module.exports = router;
