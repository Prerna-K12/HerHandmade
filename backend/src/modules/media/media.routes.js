const router = require("express").Router();
const { requireAuth } = require("../../middleware/auth");
const c = require("./media.controller");

router.get("/:fileName", requireAuth, c.serve);

module.exports = router;
