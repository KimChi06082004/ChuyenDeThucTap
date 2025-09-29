// src/routes/notifications.js
import express from "express";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

/**
 * GET /api/notifications
 * - Lấy thông báo của user hiện tại
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT notification_id, title, message, type, is_read, created_at
       FROM notifications
       WHERE user_id=?
       ORDER BY created_at DESC`,
      [req.user.user_id]
    );
    res.json(rows);
  } catch (err) {
    console.error("Notification list error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * PUT /api/notifications/:id/read
 * - Đánh dấu 1 thông báo là đã đọc
 */
router.put("/:id/read", verifyToken, async (req, res) => {
  try {
    await pool.query(
      "UPDATE notifications SET is_read=1 WHERE notification_id=? AND user_id=?",
      [req.params.id, req.user.user_id]
    );
    res.json({ success: true, message: "Notification marked as read" });
  } catch (err) {
    console.error("Notification mark read error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * PUT /api/notifications/read-all
 * - Đánh dấu tất cả thông báo là đã đọc
 */
router.put("/read-all", verifyToken, async (req, res) => {
  try {
    await pool.query("UPDATE notifications SET is_read=1 WHERE user_id=?", [
      req.user.user_id,
    ]);
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    console.error("Notification read all error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * DELETE /api/notifications/:id
 * - Xoá 1 thông báo
 */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM notifications WHERE notification_id=? AND user_id=?",
      [req.params.id, req.user.user_id]
    );
    res.json({ success: true, message: "Notification deleted" });
  } catch (err) {
    console.error("Notification delete error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * DELETE /api/notifications
 * - Xoá tất cả thông báo của user
 */
router.delete("/", verifyToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM notifications WHERE user_id=?", [
      req.user.user_id,
    ]);
    res.json({ success: true, message: "All notifications deleted" });
  } catch (err) {
    console.error("Notification delete all error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
