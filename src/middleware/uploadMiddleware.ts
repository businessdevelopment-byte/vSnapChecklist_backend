import multer, { StorageEngine } from "multer";
import type { RequestHandler } from "express";
import path from "path";
import fs from "fs";

export function createUploadMiddleware(subfolder: string, maxSizeMB = 5) {
  const uploadDirBase = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));
  const uploadDir = path.join(uploadDirBase, subfolder);
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const storage: StorageEngine = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase();
      const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      cb(null, name);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (allowed.includes(file.mimetype)) return cb(null, true);
      cb(Object.assign(new Error("Only image files are allowed (jpeg, png, gif, webp)"), { status: 400 }));
    },
  });

  return {
    // Multer's errors carry a code but no status, so they reached the client
    // as a 500 "Internal server error": a phone photo over the limit failed
    // with nothing saying why, and every retry failed the same way.
    single: (field: string): RequestHandler => (req, res, next) =>
      upload.single(field)(req, res, (err?: unknown) => {
        if (err instanceof multer.MulterError) {
          const tooLarge = err.code === "LIMIT_FILE_SIZE";
          const message = tooLarge ? `File is larger than ${maxSizeMB} MB — upload a smaller one` : err.message;
          return next(Object.assign(new Error(message), { status: tooLarge ? 413 : 400 }));
        }
        next(err);
      }),
  };
}
