// The Express app: middleware, then routes, then error handling.
// (server.js starts it. Tests import this file directly.)
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const env = require("./config/env");
const AppError = require("./utils/AppError");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.set("trust proxy", 1); // behind Caddy, so client IPs are correct for rate limiting
app.use(helmet());
console.log("CORS allowed origin:", env.clientOrigin);
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/public", require("./modules/public/public.routes"));
app.use("/api/auth", require("./modules/auth/auth.routes"));
app.use("/api/skills", require("./modules/skills/skills.routes"));
app.use("/api/captains", require("./modules/captains/captains.routes"));
app.use("/api/groups", require("./modules/groups/groups.routes"));
app.use("/api/orders", require("./modules/orders/orders.routes"));
app.use("/api/assignments", require("./modules/assignments/assignments.routes"));
app.use("/api/broadcasts", require("./modules/broadcasts/broadcasts.routes"));
app.use("/api/media", require("./modules/media/media.routes"));

app.use("/api", (req, res, next) => next(new AppError(404, "NOT_FOUND", "Route not found")));
app.use(errorHandler);

module.exports = app;
