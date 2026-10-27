const storage = require("../../services/storage");

// Logged-in users only. File names are random 128-bit values, so they cannot be guessed.
exports.serve = (req, res, next) => {
  let file;
  try {
    file = storage.pathFor(req.params.fileName);
  } catch (err) {
    return next(err);
  }
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.sendFile(file, (err) => {
    if (err) next(err.code === "ENOENT" ? new (require("../../utils/AppError"))(404, "NOT_FOUND", "File not found") : err);
  });
};
