// Test settings. They win over any .env file because dotenv never overrides existing values.
const os = require("os");
const path = require("path");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgres://postgres:postgres@localhost:5432/herhandmade_test";
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.BCRYPT_ROUNDS = "4";
process.env.COOKIE_SECURE = "false";
process.env.UPLOAD_DIR = path.join(os.tmpdir(), "hh-test-uploads");
process.env.SMTP_HOST = "";
process.env.PUBLIC_BASE_URL = "http://192.168.1.66:5173";
process.env.NGO_NAME = "HerHandmade";
process.env.NGO_EMAIL = "hello@herhandmade.example";
process.env.NGO_PHONE = "+91-9000000000";
