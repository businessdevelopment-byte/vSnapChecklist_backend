import { Request, Response } from "express";
import { sendSuccess } from "../utils/apiResponse";

export const uploadController = {
  uploadFile: (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, message: "No file uploaded" });
      return;
    }
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const filePath = req.file.path.replace(/\\/g, "/");
    const relativePath = "/uploads/" + filePath.split("uploads/")[1];
    const url = `${baseUrl}${relativePath}`;
    sendSuccess(res, { url }, "File uploaded successfully");
  },
};
