// src/routes/sessions.js
import express from "express";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

/**
 * GET /api/sessions/:class_id
 * - Admin/Tutor/Student: xem danh sách buổi học trong class
 */
router.get("/:class_id", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, c.title AS class_title, c.subject
       FROM sessions s
       JOIN classes c ON c.class_id = s.class_id
       WHERE s.class_id=?`,
      [req.params.class_id]
    );
    res.json(rows);
  } catch (err) {
    console.error("Sessions list error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /api/sessions/:class_id
 * - Tutor tạo buổi học cho class
 */
router.post(
  "/:class_id",
  verifyToken,
  requireRole(["tutor"]),
  async (req, res) => {
    try {
      const { date, start_time, end_time, topic } = req.body || {};

      const [rs] = await pool.query(
        `INSERT INTO sessions (class_id, date, start_time, end_time, topic, status)
       VALUES (?,?,?,?,?, 'SCHEDULED')`,
        [req.params.class_id, date, start_time, end_time, topic]
      );

      res.status(201).json({
        success: true,
        message: "Session created successfully",
        session: {
          session_id: rs.insertId,
          class_id: req.params.class_id,
          date,
          start_time,
          end_time,
          topic,
          status: "SCHEDULED",
        },
      });
    } catch (err) {
      console.error("Session create error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/**
 * PUT /api/sessions/:id
 * - Tutor update buổi học
 */
router.put("/:id", verifyToken, requireRole(["tutor"]), async (req, res) => {
  try {
    const { date, start_time, end_time, topic, status } = req.body || {};
    await pool.query(
      `UPDATE sessions SET date=?, start_time=?, end_time=?, topic=?, status=? WHERE session_id=?`,
      [date, start_time, end_time, topic, status, req.params.id]
    );
    res.json({ success: true, message: "Session updated successfully" });
  } catch (err) {
    console.error("Session update error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * DELETE /api/sessions/:id
 * - Tutor hoặc Admin xoá buổi học
 */
router.delete(
  "/:id",
  verifyToken,
  requireRole(["tutor", "admin"]),
  async (req, res) => {
    try {
      await pool.query("DELETE FROM sessions WHERE session_id=?", [
        req.params.id,
      ]);
      res.json({ success: true, message: "Session deleted successfully" });
    } catch (err) {
      console.error("Session delete error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export default router;
