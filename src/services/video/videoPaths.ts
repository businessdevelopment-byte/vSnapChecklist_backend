import fs from "fs";
import path from "path";
import type { Request } from "express";
import { env } from "../../config/env";

// Windows briefly locks freshly written files (Defender, the search indexer),
// so deletes retry instead of failing on the first EPERM/EBUSY.
export function removePath(target: string): Promise<void> {
  return fs.promises.rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}

// Same lock problem for renaming a file that was just written.
export async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.promises.rename(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (attempt >= 10 || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) throw err;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

// Same base folder app.ts serves at /uploads.
export const UPLOAD_DIR_BASE = path.resolve(env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));
export const VIDEO_ROOT = path.join(UPLOAD_DIR_BASE, "videos");

// Every file of one video lives in its own folder, named by the VideoAsset id
// (a cuid — validated by the routes, so it is always a safe folder name).
export function videoPaths(id: string) {
  const dir = path.join(VIDEO_ROOT, id);
  return {
    dir,
    part: path.join(dir, "original.part"),
    original: (ext: string) => path.join(dir, `original.${ext}`),
    // ffmpeg writes the ladder straight here (a folder rename right after
    // writing hits Windows file locks). Clients only learn the URL once the
    // row is READY.
    hlsDir: path.join(dir, "hls"),
    poster: path.join(dir, "poster.jpg"),
  };
}

// Absolute URL of a file in a video's folder, built from the request like
// upload.controller.ts does for images (IIS forwards the original host/proto).
export function videoFileUrl(req: Request, id: string, relative: string): string {
  return `${req.protocol}://${req.get("host")}/uploads/videos/${id}/${relative}`;
}
