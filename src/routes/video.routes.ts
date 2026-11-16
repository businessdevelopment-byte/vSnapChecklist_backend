import express, { Router, type NextFunction, type Request, type Response } from "express";
import { videoController } from "../controllers/video.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import { env } from "../config/env";
import { sendError } from "../utils/apiResponse";
import { VIDEO_CHUNK_BYTES } from "../services/video/videoUpload.service";

// Reference videos for tasks. A separate path from POST /api/upload (images,
// one multipart request): a video goes up in resumable chunks and is then
// converted into an adaptive-bitrate HLS ladder — see services/video/.
const router = Router();

router.use(authMiddleware);

// Every chunk body is held in memory while it is read, so many users sending
// at once could exhaust the process. Past the limit the request is refused
// with 503 and the client retries it with backoff (uploads resume, nothing is
// lost). Checked before the body is read; released when the response is done.
let chunksInFlight = 0;
function chunkSlot(req: Request, res: Response, next: NextFunction) {
  if (chunksInFlight >= env.VIDEO_MAX_CONCURRENT_CHUNKS) {
    res.setHeader("Retry-After", "2");
    sendError(res, "The server is busy receiving videos — retrying shortly", 503);
    return;
  }
  chunksInFlight++;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    chunksInFlight--;
  };
  res.on("finish", release);
  res.on("close", release);
  next();
}

router.post("/", videoController.init);
router.put(
  "/:id/chunks",
  chunkSlot,
  // Raw bytes for this route only; a little headroom over the chunk size.
  express.raw({ type: "application/octet-stream", limit: VIDEO_CHUNK_BYTES + 512 * 1024 }),
  videoController.uploadChunk
);
router.post("/:id/complete", videoController.complete);
router.get("/:id", videoController.get);
router.delete("/:id", videoController.cancel);

export default router;
