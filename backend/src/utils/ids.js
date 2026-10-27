// Random identifiers: tracking token, order reference, group link code, file names.
const crypto = require("crypto");

// No 0/O, 1/I/L so codes are easy to read out and type.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomChars(n) {
  const bytes = crypto.randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

exports.trackingToken = () => crypto.randomBytes(16).toString("hex"); // 128-bit, unguessable
exports.fileKey = () => crypto.randomBytes(16).toString("hex");
exports.orderRef = () => `HH-${randomChars(6)}`;
exports.accessCode = () => `${randomChars(4)}-${randomChars(4)}`;
