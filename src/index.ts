import { env } from "./config/env";
import app from "./app";

// In production only IIS (same host) may reach this port
const host = env.NODE_ENV === "production" ? "127.0.0.1" : undefined;

const server = app.listen(env.PORT, host, () => {
  console.log(`[server] Running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

process.on("SIGTERM", () => {
  server.close(() => {
    console.log("[server] Shut down gracefully");
    process.exit(0);
  });
});
