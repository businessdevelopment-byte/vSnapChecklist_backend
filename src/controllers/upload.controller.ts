import { Request, Response } from "express";
import path from "path";
import { sendSuccess } from "../utils/apiResponse";

export const uploadController = {
  uploadFile: (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, message: "No file uploaded" });
      return;
    }
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const uploadDirBase = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));
    console.log(process.env.UPLOAD_DIR, "this is the testing")
    const relativePath = path.relative(uploadDirBase, req.file.path).replace(/\\/g, "/");
    const url = `${baseUrl}/uploads/${relativePath}`;

    console.log(url)
    sendSuccess(res, { url }, "File uploaded successfully");
  },
};
