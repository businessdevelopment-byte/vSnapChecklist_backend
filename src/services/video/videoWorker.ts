import fs from "fs";
import path from "path";
import type { ChildProcess } from "child_process";
import type { VideoAsset } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { FFMPEG_BIN, ffmpegVersion, makePoster, pickLadder, probeVideo, transcodeToHls } from "./videoTranscode";
import { VIDEO_ROOT, removePath, videoPaths } from "./videoPaths";

// In-process converter, like the sheet-sync scheduler: production runs one
// node instance, so one job at a time with a DB status claim is enough. A
// restart mid-job (auto-deploy restarts the service) puts the job back in the
// queue on boot.
const POLL_MS = 30_000;
const SWEEP_MS = 60 * 60 * 1000;
const FIRST_SWEEP_DELAY_MS = 5 * 60 * 1000;
const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;
const PROGRESS_WRITE_MS = 2000;

// Failures caused by the server setup rather than the file. Such videos are
// re-queued automatically once ffmpeg is available again.
const NO_FFMPEG_ERROR = "Video conversion isn't available on the server yet — the video plays as uploaded";
const DISABLED_ERROR = "Video conversion is turned off on the server — the video plays as uploaded";

let started = false;
let lanesRunning = 0;
let ffmpegAvailable = false;
let pollTimer: NodeJS.Timeout | null = null;
let sweepTimer: NodeJS.Timeout | null = null;
let firstSweepTimer: NodeJS.Timeout | null = null;
// Conversions in progress, by video id. Each lane runs one at a time, so with
// VIDEO_WORKER_CONCURRENCY lanes a burst of finished uploads converts in
// parallel instead of queueing behind one ffmpeg.
const running = new Map<string, { child: ChildProcess | null; aborted: boolean }>();

async function claimNext(): Promise<VideoAsset | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const next = await prisma.videoAsset.findFirst({
      where: { status: "QUEUED" },
      orderBy: { updatedAt: "asc" },
      select: { id: true },
    });
    if (!next) return null;
    const { count } = await prisma.videoAsset.updateMany({
      where: { id: next.id, status: "QUEUED" },
      data: { status: "PROCESSING", processingProgress: 0, error: null },
    });
    if (count === 1) return prisma.videoAsset.findUnique({ where: { id: next.id } });
  }
  return null;
}

async function processOne(asset: VideoAsset): Promise<void> {
  const p = videoPaths(asset.id);
  const input = p.original(asset.ext);
  const job = { child: null as ChildProcess | null, aborted: false };
  running.set(asset.id, job);
  // Writes only land while the row is still this job's: a cancel flips it.
  const stillOurs = { id: asset.id, status: "PROCESSING" as const };
  const startedAt = Date.now();

  try {
    if (!env.VIDEO_TRANSCODE_ENABLED) throw new Error(DISABLED_ERROR);
    if (!ffmpegAvailable) throw new Error(NO_FFMPEG_ERROR);
    if (!fs.existsSync(input)) throw new Error("The uploaded file is missing on the server — attach the video again");

    const probe = await probeVideo(input);
    if (!probe) throw new Error("This file isn't a playable video");
    const rungs = pickLadder(probe.width, probe.height);

    // Leftovers of a run cut short by a restart.
    await removePath(p.hlsDir);
    let lastWrite = 0;
    await transcodeToHls(input, p.hlsDir, probe, rungs, {
      onSpawn: (child) => {
        job.child = child;
      },
      onProgress: (percent) => {
        const now = Date.now();
        if (now - lastWrite < PROGRESS_WRITE_MS) return;
        lastWrite = now;
        prisma.videoAsset.updateMany({ where: stillOurs, data: { processingProgress: percent } }).catch(() => undefined);
      },
    });
    if (job.aborted) return;

    const hasPoster = await makePoster(input, p.poster, probe.durationSec);

    const renditions = rungs.map((r) => ({
      label: r.label,
      short: r.short,
      bandwidth: (r.videoKbps + (probe.hasAudio ? 128 : 0)) * 1000,
    }));
    const { count } = await prisma.videoAsset.updateMany({
      where: stillOurs,
      data: {
        status: "READY",
        processingProgress: 100,
        renditions,
        hasPoster,
        hasOriginal: false,
        durationSec: probe.durationSec,
        width: probe.width,
        height: probe.height,
        error: null,
      },
    });
    // The ladder replaces the original; keeping both would double the disk use.
    if (count === 1) await removePath(input).catch(() => undefined);
    console.log(
      `[video] ${asset.id} ready: ${rungs.map((r) => r.label).join("/")} in ${Math.round((Date.now() - startedAt) / 1000)}s`
    );
  } catch (err) {
    if (job.aborted) return;
    const message = ((err as Error).message || "Video conversion failed").slice(0, 1000);
    await removePath(p.hlsDir).catch(() => undefined);
    const hasOriginal = fs.existsSync(input);
    const hasPoster = hasOriginal && ffmpegAvailable ? await makePoster(input, p.poster, asset.durationSec) : false;
    await prisma.videoAsset
      .updateMany({ where: stillOurs, data: { status: "FAILED", error: message, hasOriginal, hasPoster } })
      .catch(() => undefined);
    console.error(`[video] ${asset.id} conversion failed: ${message}`);
  } finally {
    running.delete(asset.id);
  }
}

async function lane(): Promise<void> {
  try {
    while (started) {
      const asset = await claimNext();
      if (!asset) return;
      await processOne(asset);
    }
  } finally {
    lanesRunning--;
  }
}

// Housekeeping that keeps the disk from filling with videos nobody can see.
async function sweep(): Promise<{ staleUploads: number; orphansDeleted: number; strayFolders: number }> {
  const now = Date.now();
  let staleUploads = 0;
  let orphansDeleted = 0;
  let strayFolders = 0;

  // 1. Uploads abandoned half-way (tab closed, phone died).
  const stale = await prisma.videoAsset.findMany({
    where: { status: "UPLOADING", updatedAt: { lt: new Date(now - STALE_UPLOAD_MS) } },
    select: { id: true },
  });
  for (const { id } of stale) {
    const { count } = await prisma.videoAsset.updateMany({
      where: { id, status: "UPLOADING" },
      data: { status: "FAILED", error: "The upload didn't finish — attach the video again", hasOriginal: false },
    });
    if (count === 1) {
      staleUploads++;
      await removePath(videoPaths(id).dir);
    }
  }

  // 2. Videos no task uses any more (form abandoned, task or user deleted).
  // A completion video is kept as long as its submission exists; a replaced
  // or rejected attachment is swept like any other unused video.
  const unused = {
    templates: { none: {} },
    checklistEntries: { none: {} },
    delegationTasks: { none: {} },
    completionEntries: { none: {} },
    submissionHistory: { none: {} },
  };
  const orphans = await prisma.videoAsset.findMany({
    where: { createdAt: { lt: new Date(now - ORPHAN_AGE_MS) }, status: { not: "PROCESSING" }, ...unused },
    select: { id: true },
    take: 500,
  });
  for (const { id } of orphans) {
    // Checked again in the delete, so a task attached meanwhile keeps its video.
    const { count } = await prisma.videoAsset.deleteMany({ where: { id, status: { not: "PROCESSING" }, ...unused } });
    if (count === 1) {
      orphansDeleted++;
      await removePath(videoPaths(id).dir);
    }
  }

  // 3. Folders whose row is gone.
  let entries: fs.Dirent[] = [];
  try {
    entries = await fs.promises.readdir(VIDEO_ROOT, { withFileTypes: true });
  } catch {
    entries = [];
  }
  const folderIds = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  if (folderIds.length > 0) {
    const known = new Set(
      (await prisma.videoAsset.findMany({ where: { id: { in: folderIds } }, select: { id: true } })).map((a) => a.id)
    );
    for (const id of folderIds) {
      if (known.has(id)) continue;
      const dir = path.join(VIDEO_ROOT, id);
      const stat = await fs.promises.stat(dir).catch(() => null);
      if (stat && now - stat.mtimeMs > ORPHAN_AGE_MS) {
        await removePath(dir);
        strayFolders++;
      }
    }
  }

  if (staleUploads || orphansDeleted || strayFolders) {
    console.log(`[video] sweep: ${staleUploads} stale upload(s), ${orphansDeleted} unused video(s), ${strayFolders} stray folder(s) removed`);
  }
  return { staleUploads, orphansDeleted, strayFolders };
}

function runSweep(): void {
  sweep().catch((err: Error) => console.error(`[video] sweep failed: ${err.message}`));
}

export const videoWorker = {
  async start(): Promise<void> {
    if (started) return;
    started = true;

    const version = await ffmpegVersion();
    ffmpegAvailable = version !== null;
    if (ffmpegAvailable) {
      console.log(`[video] ffmpeg ready: ${version} (${FFMPEG_BIN})`);
    } else {
      console.error(
        `[video] ffmpeg NOT found at "${FFMPEG_BIN}" — videos will play as uploaded, without quality options. ` +
          "Set FFMPEG_PATH, or reinstall ffmpeg-static (node node_modules/ffmpeg-static/install.js)."
      );
    }
    if (!env.VIDEO_TRANSCODE_ENABLED) console.log("[video] conversion turned off (VIDEO_TRANSCODE_ENABLED=false)");

    try {
      // Jobs cut off by the last shutdown.
      const resumed = await prisma.videoAsset.updateMany({
        where: { status: "PROCESSING" },
        data: { status: "QUEUED", processingProgress: 0 },
      });
      if (resumed.count) console.log(`[video] re-queued ${resumed.count} conversion(s) interrupted by the last shutdown`);
      // Videos that only failed because conversion wasn't possible at the time.
      if (ffmpegAvailable && env.VIDEO_TRANSCODE_ENABLED) {
        const retried = await prisma.videoAsset.updateMany({
          where: { status: "FAILED", hasOriginal: true, error: { in: [NO_FFMPEG_ERROR, DISABLED_ERROR] } },
          data: { status: "QUEUED", processingProgress: 0, error: null },
        });
        if (retried.count) console.log(`[video] re-queued ${retried.count} video(s) now that ffmpeg is available`);
      }
    } catch (err) {
      console.error(`[video] startup recovery failed: ${(err as Error).message}`);
    }

    pollTimer = setInterval(() => videoWorker.kick(), POLL_MS);
    pollTimer.unref();
    firstSweepTimer = setTimeout(runSweep, FIRST_SWEEP_DELAY_MS);
    firstSweepTimer.unref();
    sweepTimer = setInterval(runSweep, SWEEP_MS);
    sweepTimer.unref();
    videoWorker.kick();
  },

  stop(): void {
    started = false;
    for (const t of [pollTimer, sweepTimer, firstSweepTimer]) if (t) clearTimeout(t);
    pollTimer = sweepTimer = firstSweepTimer = null;
    videoWorker.killChild();
  },

  // Start converting now instead of at the next poll. Fills idle lanes up to
  // VIDEO_WORKER_CONCURRENCY; a lane with nothing to do exits on its own.
  kick(): void {
    if (!started) return;
    while (lanesRunning < env.VIDEO_WORKER_CONCURRENCY) {
      lanesRunning++;
      lane().catch((err: Error) => console.error(`[video] queue error: ${err.message}`));
    }
  },

  // Stop the running conversion of this video, if any (it was cancelled).
  abort(id: string): void {
    const job = running.get(id);
    if (!job) return;
    job.aborted = true;
    job.child?.kill("SIGKILL");
  },

  // ffmpeg is a separate process and would outlive node on Windows.
  killChild(): void {
    for (const job of running.values()) job.child?.kill("SIGKILL");
  },

  sweep,
};
