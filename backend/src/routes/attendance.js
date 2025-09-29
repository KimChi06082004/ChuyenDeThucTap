// src/routes/attendance.js
import express from "express";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

/**
 * GET /api/attendance/:session_id
 * - Tutor/Admin: xem danh sách điểm danh trong session
 * - Student: chỉ xem điểm danh của chính mình
 */
router.get("/:session_id", verifyToken, async (req, res) => {
  try {
    let sql = `SELECT a.*, u.full_name AS student_name
               FROM attendance a 
               JOIN users u ON u.user_id = a.student_id
               WHERE a.session_id=?`;
    let params = [req.params.session_id];

    // Nếu là student → chỉ lấy của mình
    if (req.user.role === "student") {
      sql += " AND a.student_id=?";
      params.push(req.user.user_id);
    }

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Attendance list error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /api/attendance/:session_id
 * - Tutor: tạo điểm danh cho từng học viên
 */
router.post(
  "/:session_id",
  verifyToken,
  requireRole(["tutor"]),
  async (req, res) => {
    try {
      const { student_id, status, note } = req.body || {};
      if (!student_id || !status) {
        return res
          .status(400)
          .json({ success: false, message: "Missing required fields" });
      }

      const [rs] = await pool.query(
        `INSERT INTO attendance (session_id, student_id, status, note) VALUES (?,?,?,?)`,
        [req.params.session_id, student_id, status, note || ""]
      );

      res.status(201).json({
        success: true,
        message: "Attendance record created",
        attendance_id: rs.insertId,
      });
    } catch (err) {
      console.error("Attendance create error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/**
 * PUT /api/attendance/:id
 * - Tutor: chỉnh sửa điểm danh
 */
router.put("/:id", verifyToken, requireRole(["tutor"]), async (req, res) => {
  try {
    const { status, note } = req.body || {};
    await pool.query(
      "UPDATE attendance SET status=?, note=? WHERE attendance_id=?",
      [status, note, req.params.id]
    );
    res.json({ success: true, message: "Attendance updated successfully" });
  } catch (err) {
    console.error("Attendance update error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * DELETE /api/attendance/:id
 * - Admin hoặc Tutor: xoá record điểm danh
 */
router.delete(
  "/:id",
  verifyToken,
  requireRole(["admin", "tutor"]),
  async (req, res) => {
    try {
      await pool.query("DELETE FROM attendance WHERE attendance_id=?", [
        req.params.id,
      ]);
      res.json({ success: true, message: "Attendance deleted successfully" });
    } catch (err) {
      console.error("Attendance delete error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export default router;
