const env = require("./config/env");
const { pool } = require("./db");
const app = require("./app");

const server = app.listen(env.port, () => {
  console.log(`HerHandmade API running on port ${env.port} (${env.nodeEnv})`);
});

// Close cleanly when Docker or the OS asks the app to stop.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => pool.end().then(() => process.exit(0)));
  });
}
