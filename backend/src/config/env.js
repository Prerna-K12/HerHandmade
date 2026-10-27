// Reads .env and exposes one settings object. The app stops at start-up if
// something important is missing, instead of failing later in a confusing way.
const path = require("path");
require("dotenv").config({ quiet: true });

for (const key of ["DATABASE_URL", "JWT_SECRET"]) {
  if (!process.env[key]) {
    throw new Error(`Missing ${key}. Copy .env.example to .env and fill it in (see help.md).`);
  }
}
if (process.env.NODE_ENV === "production" && process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production.");
}

const e = process.env;

module.exports = {
  nodeEnv: e.NODE_ENV || "development",
  port: Number(e.PORT) || 5000,
  databaseUrl: e.DATABASE_URL,
  jwtSecret: e.JWT_SECRET,
  cookieSecure: e.COOKIE_SECURE === "true",
  clientOrigin: e.CLIENT_ORIGIN || "http://192.168.1.66:5173",
  publicBaseUrl: e.PUBLIC_BASE_URL || "http://192.168.1.66:5173",
  uploadDir: path.resolve(e.UPLOAD_DIR || "./uploads"),
  bcryptRounds: Number(e.BCRYPT_ROUNDS) || 10,
  smtp: {
    host: e.SMTP_HOST || "",
    port: Number(e.SMTP_PORT) || 587,
    user: e.SMTP_USER || "",
    pass: e.SMTP_PASS || "",
    from: e.MAIL_FROM || "HerHandmade <no-reply@example.com>",
  },
  ngo: {
    name: e.NGO_NAME || "HerHandmade",
    email: e.NGO_EMAIL || "",
    phone: e.NGO_PHONE || "",
  },
  seed: {
    adminName: e.SEED_ADMIN_NAME || "NGO Admin",
    adminPhone: e.SEED_ADMIN_PHONE || "9000000001",
    adminPassword: e.SEED_ADMIN_PASSWORD || "admin12345",
  },
};
