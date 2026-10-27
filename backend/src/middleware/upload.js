// Accepts image uploads in memory (max 1 MB each, jpeg/png/webp).
// The real file type is checked again from the file's first bytes in storage.js.
const multer = require("multer");
const AppError = require("../utils/AppError");

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 1024 * 1024;

function uploadImages(field, maxFiles) {
  const handler = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: maxFiles },
    fileFilter: (req, file, cb) =>
      ALLOWED.includes(file.mimetype)
        ? cb(null, true)
        : cb(new AppError(415, "UNSUPPORTED_FILE", "Only JPEG, PNG or WebP images are allowed")),
  }).array(field, maxFiles);

  return (req, res, next) =>
    handler(req, res, (err) => {
      if (!err) return next();
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new AppError(413, "FILE_TOO_LARGE", "Each image must be under 1 MB"));
      }
      if (err.name === "MulterError") {
        return next(new AppError(400, "VALIDATION_ERROR", `Upload problem: ${err.message}`));
      }
      next(err);
    });
}

module.exports = { uploadImages };
