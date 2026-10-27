// validate({ params, query, body }) checks each part with a Zod schema.
// Cleaned values (numbers converted, defaults filled) replace the originals.
const AppError = require("../utils/AppError");

module.exports = (schemas) => (req, res, next) => {
  for (const part of ["params", "query", "body"]) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] || {});
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join(".") || part}: ${i.message}`)
        .join("; ");
      return next(new AppError(400, part === "params" ? "INVALID_ID" : "VALIDATION_ERROR", message));
    }
    req[part] = result.data;
  }
  next();
};
