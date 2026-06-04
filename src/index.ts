import { env } from "./config/env";
import app from "./app";

const server = app.listen(env.PORT, () => {
  console.log(`[server] Running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

process.on("SIGTERM", () => {
  server.close(() => {
    console.log("[server] Shut down gracefully");
    process.exit(0);
  });
});
