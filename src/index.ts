import { env } from "./config/env";
import app from "./app";
import { sheetSyncScheduler } from "./services/sheetSync/sheetSyncScheduler";
import { videoWorker } from "./services/video/videoWorker";

// In production only IIS (same host) may reach this port
const host = env.NODE_ENV === "production" ? "127.0.0.1" : "::";

const server = app.listen(env.PORT, host, () => {
  console.log(`[server] Running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  // Nightly Checklist & Delegation → Google Sheet mirror (off unless configured).
  sheetSyncScheduler.start();
  // Converts uploaded task videos into adaptive-bitrate HLS.
  videoWorker.start().catch((err: Error) => console.error(`[video] worker failed to start: ${err.message}`));
});

// A running ffmpeg is a separate process; don't leave it behind.
process.on("exit", () => videoWorker.killChild());

process.on("SIGTERM", () => {
  sheetSyncScheduler.stop();
  videoWorker.stop();
  server.close(() => {
    console.log("[server] Shut down gracefully");
    process.exit(0);
  });
});
