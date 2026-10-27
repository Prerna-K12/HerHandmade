// Throw this from services. The error handler turns it into
// { "code": "...", "message": "..." } with the right HTTP status.
class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

module.exports = AppError;
