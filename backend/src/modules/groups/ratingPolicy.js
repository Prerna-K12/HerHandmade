/* =============================================================================
 * RATING RULES LIVE HERE (and only here)
 *
 *  1. Only the admin may set a group's rating for a skill.
 *  2. A rating is a whole number from 1 to 5.
 *  3. `verified` means the admin has checked the group's self-reported skill.
 *  4. effectiveRating() is the number the matcher sorts by. Today it is just the
 *     admin's rating. To use on-time delivery % later, blend it in right here.
 * ========================================================================== */
const AppError = require("../../utils/AppError");

const MIN_RATING = 1;
const MAX_RATING = 5;

function assertCanSetRating(user) {
  if (user.role !== "admin") {
    throw new AppError(403, "FORBIDDEN", "Only the admin can set ratings");
  }
}

function assertValidEntries(entries) {
  for (const e of entries) {
    if (!Number.isInteger(e.rating) || e.rating < MIN_RATING || e.rating > MAX_RATING) {
      throw new AppError(400, "VALIDATION_ERROR", `Rating must be between ${MIN_RATING} and ${MAX_RATING}`);
    }
  }
}

// FUTURE: return a blend of entry.rating and the group's on-time delivery percentage.
function effectiveRating(entry) {
  return entry.rating;
}

module.exports = { MIN_RATING, MAX_RATING, assertCanSetRating, assertValidEntries, effectiveRating };
