// Every error leaves the API as { code, message }. The frontend translates `code`.
const AppError = require("../utils/AppError");

const CONSTRAINT_MESSAGES = {
  users_phone_key: "This phone number is already registered",
  uq_skills_name: "This skill already exists",
};

module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    return res.status(err.status).json({ code: err.code, message: err.message });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ code: "VALIDATION_ERROR", message: "Request body is not valid JSON" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ code: "FILE_TOO_LARGE", message: "Request is too large" });
  }

  // Database errors (PostgreSQL error codes)
  if (err.code === "23505") {
    const message = CONSTRAINT_MESSAGES[err.constraint] || "A record with the same value already exists";
    return res.status(409).json({ code: "ALREADY_EXISTS", message });
  }
  if (err.code === "23503") {
    return res.status(400).json({ code: "VALIDATION_ERROR", message: "A referenced record does not exist" });
  }
  if (err.code === "23514" || err.code === "22007") {
    return res.status(400).json({ code: "VALIDATION_ERROR", message: "A value is not allowed" });
  }
  if (err.code === "22P02" || err.code === "22003") {
    return res.status(400).json({ code: "INVALID_ID", message: "Invalid id" });
  }

  if (process.env.NODE_ENV !== "test") console.error(err);
  res.status(500).json({ code: "INTERNAL_ERROR", message: "Something went wrong" });
};
