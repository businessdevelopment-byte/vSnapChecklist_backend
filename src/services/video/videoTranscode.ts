import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import ffmpegBundledPath from "ffmpeg-static";
import { path as ffprobeBundledPath } from "ffprobe-static";
import { env } from "../../config/env";

// FFMPEG_PATH/FFPROBE_PATH win; otherwise the binaries the npm packages
// download at install time; otherwise whatever is on PATH.
function resolveBinary(explicit: string | undefined, bundled: string | null | undefined, onPath: string): string {
  if (explicit) return explicit;
  if (bundled && fs.existsSync(bundled)) return bundled;
  return onPath;
}

export const FFMPEG_BIN = resolveBinary(env.FFMPEG_PATH, ffmpegBundledPath, "ffmpeg");
export const FFPROBE_BIN = resolveBinary(env.FFPROBE_PATH, ffprobeBundledPath, "ffprobe");

// ffmpeg reads paths with forward slashes fine on Windows, and the HLS muxer
// only makes the master playlist's variant URIs relative when they use "/".
const ffPath = (p: string) => p.replace(/\\/g, "/");

interface RunOptions {
  timeoutMs: number;
  lowPriority?: boolean;
  onStdout?: (text: string) => void;
  onSpawn?: (child: ChildProcess) => void;
}

interface RunResult {
  code: number | null;
  stdout: string;
  stderrTail: string;
  timedOut: boolean;
}

function run(bin: string, args: string[], opts: RunOptions): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderrTail = "";
    let timedOut = false;

    // Encoding must never starve the API on the same machine.
    if (opts.lowPriority && child.pid) {
      try {
        os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
      } catch {
        /* not fatal — runs at normal priority */
      }
    }
    opts.onSpawn?.(child);

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, opts.timeoutMs);

    child.stdout.on("data", (buf: Buffer) => {
      const text = buf.toString();
      if (opts.onStdout) opts.onStdout(text);
      else if (stdout.length < 1_000_000) stdout += text;
    });
    child.stderr.on("data", (buf: Buffer) => {
      stderrTail = (stderrTail + buf.toString()).slice(-4000);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderrTail, timedOut });
    });
  });
}

export async function ffmpegVersion(): Promise<string | null> {
  try {
    const r = await run(FFMPEG_BIN, ["-hide_banner", "-version"], { timeoutMs: 15_000 });
    return r.code === 0 ? r.stdout.split(/\r?\n/)[0] : null;
  } catch {
    return null;
  }
}

export interface ProbeResult {
  durationSec: number | null;
  // Display size (after the phone's rotation flag is applied).
  width: number;
  height: number;
  fps: number | null;
  hasAudio: boolean;
}

interface FfprobeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  duration?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  tags?: { rotate?: string };
  side_data_list?: { rotation?: number }[];
  disposition?: { attached_pic?: number };
}

function parseRate(rate?: string): number | null {
  if (!rate) return null;
  const [num, den] = rate.split("/").map(Number);
  const value = den ? num / den : num;
  return Number.isFinite(value) && value > 0 ? value : null;
}

// null → not a video ffprobe can read (wrong file, audio only, corrupt).
export async function probeVideo(file: string): Promise<ProbeResult | null> {
  let result: RunResult;
  try {
    result = await run(
      FFPROBE_BIN,
      ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", ffPath(file)],
      { timeoutMs: 60_000 }
    );
  } catch {
    throw Object.assign(new Error("Video tools are not installed on the server"), { status: 503 });
  }
  if (result.code !== 0) return null;

  let parsed: { streams?: FfprobeStream[]; format?: { duration?: string } };
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return null;
  }
  const streams = parsed.streams ?? [];
  // A cover image on an audio file shows up as a one-frame "video" stream.
  const video = streams.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic);
  if (!video?.width || !video?.height) return null;

  const rotation = Number(video.tags?.rotate ?? 0) || (video.side_data_list?.find((d) => typeof d.rotation === "number")?.rotation ?? 0);
  const sideways = Math.abs(rotation) % 180 === 90;
  const duration = Number(parsed.format?.duration ?? video.duration);

  return {
    durationSec: Number.isFinite(duration) && duration > 0 ? duration : null,
    width: sideways ? video.height : video.width,
    height: sideways ? video.width : video.height,
    fps: parseRate(video.avg_frame_rate) ?? parseRate(video.r_frame_rate),
    hasAudio: streams.some((s) => s.codec_type === "audio"),
  };
}

export interface Rung {
  label: string;
  // Target size of the picture's short side (height for landscape, width for portrait).
  short: number;
  videoKbps: number;
  maxKbps: number;
  bufKbps: number;
}

const LADDER: Rung[] = [
  { label: "1080p", short: 1080, videoKbps: 5000, maxKbps: 5350, bufKbps: 7500 },
  { label: "720p", short: 720, videoKbps: 2800, maxKbps: 2996, bufKbps: 4200 },
  { label: "480p", short: 480, videoKbps: 1400, maxKbps: 1498, bufKbps: 2100 },
  { label: "360p", short: 360, videoKbps: 800, maxKbps: 856, bufKbps: 1200 },
];

const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);

// Only rungs the source can fill (never upscale), judged by the short side so
// a portrait phone video gets the same ladder as a landscape one. A source
// smaller than 360p keeps a single rung at its own size.
export function pickLadder(width: number, height: number): Rung[] {
  const short = Math.min(width, height);
  const rungs = LADDER.filter((r) => short >= r.short * 0.95).map((r) => {
    const s = Math.min(r.short, even(short));
    return { ...r, short: s, label: `${s}p` };
  });
  if (rungs.length > 0) return rungs;
  const lowest = LADDER[LADDER.length - 1];
  const s = even(short);
  return [{ ...lowest, short: s, label: `${s}p` }];
}

const TRANSCODE_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const SEGMENT_SECONDS = 4;

/**
 * One ffmpeg pass: decode once, split, scale each rung, encode H.264/AAC, and
 * write an HLS VOD ladder (outDir/master.m3u8 + outDir/<label>/index.m3u8 +
 * .ts segments). Keyframes are forced every segment so every rung switches
 * cleanly at the same boundaries.
 */
export async function transcodeToHls(
  input: string,
  outDir: string,
  probe: ProbeResult,
  rungs: Rung[],
  hooks: { onProgress: (percent: number) => void; onSpawn: (child: ChildProcess) => void }
): Promise<void> {
  for (const r of rungs) fs.mkdirSync(path.join(outDir, r.label), { recursive: true });

  const landscape = probe.width >= probe.height;
  const scale = (s: number) => (landscape ? `scale=-2:${s}` : `scale=${s}:-2`);
  const fpsCap = probe.fps && probe.fps > 30.5 ? "fps=30," : "";
  const filter =
    rungs.length === 1
      ? `[0:v]${fpsCap}${scale(rungs[0].short)}[v0]`
      : `[0:v]${fpsCap}split=${rungs.length}${rungs.map((_, i) => `[s${i}]`).join("")};` +
        rungs.map((r, i) => `[s${i}]${scale(r.short)}[v${i}]`).join(";");

  const args = ["-hide_banner", "-nostdin", "-y", "-progress", "pipe:1", "-nostats", "-i", ffPath(input), "-filter_complex", filter];
  rungs.forEach((_, i) => args.push("-map", `[v${i}]`));
  if (probe.hasAudio) rungs.forEach(() => args.push("-map", "0:a:0"));
  args.push(
    // Parallel conversions split the CPU: each gets its share of the threads.
    "-threads", String(Math.max(1, Math.floor(os.cpus().length / env.VIDEO_WORKER_CONCURRENCY))),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-profile:v", "main",
    "-pix_fmt", "yuv420p",
    "-sc_threshold", "0",
    "-force_key_frames", `expr:gte(t,n_forced*${SEGMENT_SECONDS})`
  );
  rungs.forEach((r, i) =>
    args.push(`-b:v:${i}`, `${r.videoKbps}k`, `-maxrate:v:${i}`, `${r.maxKbps}k`, `-bufsize:v:${i}`, `${r.bufKbps}k`)
  );
  if (probe.hasAudio) args.push("-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "48000");
  const streamMap = rungs
    .map((r, i) => (probe.hasAudio ? `v:${i},a:${i},name:${r.label}` : `v:${i},name:${r.label}`))
    .join(" ");
  args.push(
    "-f", "hls",
    "-hls_time", String(SEGMENT_SECONDS),
    "-hls_playlist_type", "vod",
    "-hls_flags", "independent_segments",
    "-hls_segment_type", "mpegts",
    "-hls_segment_filename", ffPath(path.join(outDir, "%v", "seg_%04d.ts")),
    "-master_pl_name", "master.m3u8",
    "-var_stream_map", streamMap,
    ffPath(path.join(outDir, "%v", "index.m3u8"))
  );

  const totalUs = (probe.durationSec ?? 0) * 1_000_000;
  let lastPercent = -1;
  const result = await run(FFMPEG_BIN, args, {
    timeoutMs: TRANSCODE_TIMEOUT_MS,
    lowPriority: true,
    onSpawn: hooks.onSpawn,
    onStdout: (text) => {
      if (!totalUs) return;
      const m = /out_time_(?:us|ms)=(\d+)/.exec(text);
      if (!m) return;
      const percent = Math.min(99, Math.floor((Number(m[1]) / totalUs) * 100));
      if (percent > lastPercent) {
        lastPercent = percent;
        hooks.onProgress(percent);
      }
    },
  });

  if (result.timedOut) throw new Error("Video conversion took longer than 2 hours and was stopped");
  if (result.code !== 0) {
    const lastLines = result.stderrTail.trim().split(/\r?\n/).slice(-6).join(" | ");
    throw new Error(`ffmpeg exited with code ${result.code}: ${lastLines}`);
  }
  if (!fs.existsSync(path.join(outDir, "master.m3u8"))) throw new Error("ffmpeg finished without writing master.m3u8");
}

// A still for the player before it starts. Failure is harmless (no poster).
export async function makePoster(input: string, posterPath: string, durationSec: number | null): Promise<boolean> {
  const seek = durationSec && durationSec > 2 ? 1 : 0;
  try {
    const r = await run(
      FFMPEG_BIN,
      ["-hide_banner", "-nostdin", "-y", "-ss", String(seek), "-i", ffPath(input), "-frames:v", "1", "-vf", "scale='min(960,iw)':-2", "-q:v", "3", ffPath(posterPath)],
      { timeoutMs: 60_000, lowPriority: true }
    );
    return r.code === 0 && fs.existsSync(posterPath);
  } catch {
    return false;
  }
}
