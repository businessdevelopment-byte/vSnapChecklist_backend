import fs from "fs";
import path from "path";
import type { Request } from "express";
import type { VideoAsset } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { probeVideo } from "./videoTranscode";
import { VIDEO_ROOT, removePath, renameWithRetry, videoFileUrl, videoPaths } from "./videoPaths";
import { videoWorker } from "./videoWorker";
import { createLimiter } from "../../utils/concurrency";

export interface VideoRequester {
  userId: number;
  role: string;
}

// The client sends the file in pieces of this size: well under IIS's 30 MB and
// Cloudflare's 100 MB request caps, and a small enough unit to retry on a
// shaky phone connection.
export const VIDEO_CHUNK_BYTES = 5 * 1024 * 1024;
// ffprobe is the only process spawned inside a request; cap how many run at once.
const probeLimit = createLimiter(env.VIDEO_MAX_CONCURRENT_PROBES);

const EXT_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-matroska": "mkv",
  "video/3gpp": "3gp",
  "video/x-m4v": "m4v",
};
const ALLOWED_EXTS = new Set(Object.values(EXT_BY_MIME));

const httpError = (message: string, status: number, errors?: unknown) =>
  Object.assign(new Error(message), { status, errors });

// Windows browsers often send an empty or generic MIME type for .mkv/.mov, so
// the extension decides when it is a known video one. ffprobe checks the real
// content once the upload completes.
function resolveExt(fileName: string, mimeType: string): string | null {
  const fromName = path.extname(fileName).slice(1).toLowerCase();
  if (ALLOWED_EXTS.has(fromName)) return fromName;
  return EXT_BY_MIME[mimeType.toLowerCase()] ?? null;
}

async function loadOwned(id: string, requester: VideoRequester, allowAdmin = false): Promise<VideoAsset> {
  const asset = await prisma.videoAsset.findUnique({ where: { id } });
  if (!asset) throw httpError("Video not found", 404);
  const isOwner = asset.uploadedById === requester.userId;
  if (!isOwner && !(allowAdmin && requester.role === "ADMIN")) {
    throw httpError("This video belongs to someone else", 403);
  }
  return asset;
}

async function removeFolder(id: string): Promise<void> {
  await removePath(videoPaths(id).dir);
}

// Every place a video can be attached: an assigned task (template, checklist
// row, delegation task) or a completion (checklist row, delegation submission).
async function referenceCount(id: string): Promise<number> {
  const [templates, entries, delegations, completions, submissions] = await Promise.all([
    prisma.taskTemplate.count({ where: { sampleVideoId: id } }),
    prisma.checklistEntry.count({ where: { sampleVideoId: id } }),
    prisma.delegationTask.count({ where: { sampleVideoId: id } }),
    prisma.checklistEntry.count({ where: { completionVideoId: id } }),
    prisma.delegationHistory.count({ where: { videoId: id } }),
  ]);
  return templates + entries + delegations + completions + submissions;
}

// Refuse before any byte is sent when the drive can't hold the upload, its
// ffmpeg output (about the same size again) and the configured reserve.
async function assertDiskRoom(sizeBytes: number): Promise<void> {
  await fs.promises.mkdir(VIDEO_ROOT, { recursive: true });
  const stat = await fs.promises.statfs(VIDEO_ROOT);
  const free = Number(stat.bavail) * Number(stat.bsize);
  const needed = sizeBytes * 3 + env.VIDEO_MIN_FREE_DISK_GB * 1024 ** 3;
  if (free < needed) {
    throw httpError("Server storage is full — try again later", 507);
  }
}

// Chunks for one video are written one at a time. A retried chunk that
// overlaps one still being written is told to re-sync instead.
const chunkLocks = new Set<string>();

export const videoUploadService = {
  maxBytes(): number {
    return env.VIDEO_MAX_MB * 1024 * 1024;
  },

  async init(input: { fileName: string; mimeType: string; sizeBytes: number }, requester: VideoRequester) {
    const ext = resolveExt(input.fileName, input.mimeType);
    if (!ext) throw httpError("Only video files can be attached (MP4, MOV, WebM, MKV, 3GP)", 400);
    if (input.sizeBytes > this.maxBytes()) {
      throw httpError(`Video is larger than ${env.VIDEO_MAX_MB} MB — trim it or record a shorter one`, 413);
    }
    await assertDiskRoom(input.sizeBytes);

    // Admission is one transaction under one lock, so racing requests can't
    // both see room under the caps and push past them. The lock is held only
    // for two counts and an insert.
    const asset = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('video-admission'))::text AS locked`;
      const mine = await tx.videoAsset.count({ where: { uploadedById: requester.userId, status: "UPLOADING" } });
      if (mine >= env.VIDEO_MAX_ACTIVE_UPLOADS_PER_USER) {
        throw httpError(
          `You already have ${env.VIDEO_MAX_ACTIVE_UPLOADS_PER_USER} videos uploading — wait for one to finish`,
          429
        );
      }
      const total = await tx.videoAsset.count({ where: { status: "UPLOADING" } });
      if (total >= env.VIDEO_MAX_ACTIVE_UPLOADS_TOTAL) {
        throw httpError("Many videos are uploading right now — try again in a minute", 429);
      }
      return tx.videoAsset.create({
        data: {
          originalName: input.fileName.slice(0, 255),
          mimeType: input.mimeType || `video/${ext}`,
          ext,
          sizeBytes: BigInt(input.sizeBytes),
          uploadedById: requester.userId,
        },
      });
    });
    const p = videoPaths(asset.id);
    await fs.promises.mkdir(p.dir, { recursive: true });
    await fs.promises.writeFile(p.part, Buffer.alloc(0));
    return { id: asset.id, chunkSize: VIDEO_CHUNK_BYTES, receivedBytes: 0 };
  },

  async appendChunk(id: string, offset: number, body: Buffer, requester: VideoRequester) {
    const asset = await loadOwned(id, requester);
    const received = Number(asset.receivedBytes);
    if (asset.status !== "UPLOADING") {
      throw httpError("This upload has already finished", 409, { receivedBytes: received, status: asset.status });
    }
    if (offset !== received) {
      throw httpError("Upload position is out of sync — resuming from the server's position", 409, { receivedBytes: received });
    }
    if (!Buffer.isBuffer(body) || body.length === 0) throw httpError("Empty chunk", 400);
    if (body.length > VIDEO_CHUNK_BYTES) throw httpError("Chunk is too large", 413);
    if (offset + body.length > Number(asset.sizeBytes)) throw httpError("Chunk goes past the end of the file", 400);

    if (chunkLocks.has(id)) {
      throw httpError("Another piece of this video is still being saved", 409, { receivedBytes: received });
    }
    chunkLocks.add(id);
    try {
      // Write at the exact position, then cut anything after it: a retry of a
      // chunk whose earlier attempt half-landed overwrites it cleanly.
      const handle = await fs.promises.open(videoPaths(id).part, "r+");
      try {
        await handle.write(body, 0, body.length, offset);
        await handle.truncate(offset + body.length);
      } finally {
        await handle.close();
      }
      const next = offset + body.length;
      const { count } = await prisma.videoAsset.updateMany({
        where: { id, status: "UPLOADING", receivedBytes: BigInt(offset) },
        data: { receivedBytes: BigInt(next) },
      });
      if (count !== 1) throw httpError("Upload position changed while saving — resuming", 409, { receivedBytes: received });
      return { receivedBytes: next };
    } finally {
      chunkLocks.delete(id);
    }
  },

  async complete(id: string, requester: VideoRequester) {
    const asset = await loadOwned(id, requester);
    // A retried "complete" after the first one already went through.
    if (asset.status !== "UPLOADING") {
      if (asset.status === "FAILED") throw httpError(asset.error ?? "This video failed", 400);
      return asset;
    }
    const received = Number(asset.receivedBytes);
    if (received !== Number(asset.sizeBytes)) {
      throw httpError("The upload isn't finished yet", 409, { receivedBytes: received });
    }

    const p = videoPaths(id);
    const originalPath = p.original(asset.ext);
    await renameWithRetry(p.part, originalPath);

    const fail = async (message: string) => {
      await removeFolder(id);
      await prisma.videoAsset.update({
        where: { id },
        data: { status: "FAILED", error: message, hasOriginal: false },
      });
      return httpError(message, 400);
    };

    const probe = await probeLimit(() => probeVideo(originalPath));
    if (!probe) throw await fail("This file isn't a playable video");
    if (probe.durationSec !== null && probe.durationSec > env.VIDEO_MAX_DURATION_SEC) {
      const minutes = Math.round(env.VIDEO_MAX_DURATION_SEC / 60);
      throw await fail(`Video is longer than ${minutes} minutes — trim it or record a shorter one`);
    }

    const updated = await prisma.videoAsset.update({
      where: { id },
      data: {
        status: "QUEUED",
        hasOriginal: true,
        durationSec: probe.durationSec,
        width: probe.width,
        height: probe.height,
        processingProgress: 0,
      },
    });
    videoWorker.kick();
    return updated;
  },

  // Removing the video from the form, or cancelling it in the upload tray.
  async cancel(id: string, requester: VideoRequester) {
    const asset = await loadOwned(id, requester, true);
    videoWorker.abort(id);
    await removeFolder(id);
    if ((await referenceCount(id)) > 0) {
      // A task already points at it: keep the row so the task shows why.
      await prisma.videoAsset.update({
        where: { id },
        data: { status: "FAILED", error: "The upload was cancelled", hasOriginal: false, hasPoster: false },
      });
    } else {
      await prisma.videoAsset.delete({ where: { id: asset.id } });
    }
  },

  async get(id: string) {
    const asset = await prisma.videoAsset.findUnique({ where: { id } });
    if (!asset) throw httpError("Video not found", 404);
    return asset;
  },

  // The client-facing shape: numbers instead of BigInt, absolute file URLs.
  toView(asset: VideoAsset, req: Request) {
    const size = Number(asset.sizeBytes);
    const received = Number(asset.receivedBytes);
    return {
      id: asset.id,
      status: asset.status,
      originalName: asset.originalName,
      sizeBytes: size,
      receivedBytes: received,
      uploadPercent: size > 0 ? Math.floor((received / size) * 100) : 0,
      processingProgress: asset.processingProgress,
      durationSec: asset.durationSec,
      width: asset.width,
      height: asset.height,
      renditions: asset.renditions,
      hlsUrl: asset.status === "READY" ? videoFileUrl(req, asset.id, "hls/master.m3u8") : null,
      posterUrl: asset.hasPoster ? videoFileUrl(req, asset.id, "poster.jpg") : null,
      originalUrl: asset.hasOriginal ? videoFileUrl(req, asset.id, `original.${asset.ext}`) : null,
      error: asset.error,
      createdAt: asset.createdAt,
    };
  },

  /**
   * May this video be put on a task? It may still be uploading or converting:
   * that is what lets Assign Task create the task without waiting. Only a
   * video that failed with nothing left to play is refused.
   */
  async assertAttachable(id: string, requester: VideoRequester): Promise<void> {
    const asset = await prisma.videoAsset.findUnique({
      where: { id },
      select: { uploadedById: true, status: true, hasOriginal: true },
    });
    if (!asset) throw httpError("The attached video was not found — attach it again", 400);
    if (requester.role !== "ADMIN" && asset.uploadedById !== requester.userId) {
      throw httpError("You can only attach a video you uploaded", 403);
    }
    if (asset.status === "FAILED" && !asset.hasOriginal) {
      throw httpError("The attached video failed to upload — attach it again", 400);
    }
  },
};
