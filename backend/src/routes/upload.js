// backend/src/routes/upload.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// Thư mục lưu ảnh tạm
const uploadDir = "uploads/";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Cấu hình Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// === Upload 1 ảnh ===
router.post("/single", upload.single("file"), (req, res) => {
  if (!req.file)
    return res.status(400).json({ success: false, message: "Không có file" });
  res.json({
    success: true,
    filePath: `/uploads/${req.file.filename}`,
    fileName: req.file.originalname,
  });
});

// === Upload nhiều ảnh ===
router.post("/multiple", upload.array("files", 10), (req, res) => {
  if (!req.files || req.files.length === 0)
    return res
      .status(400)
      .json({ success: false, message: "Không có file nào" });
  const urls = req.files.map((f) => `/uploads/${f.filename}`);
  res.json({ success: true, urls });
});

export default router;
