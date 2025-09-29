// src/routes/complaints.js
import express from "express";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

/**
 * GET /api/complaints
 * - Admin: xem tất cả khiếu nại
 * - Student/Tutor: chỉ xem khiếu nại của mình
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    let sql = `SELECT c.*, u.full_name, u.role, cl.subject
               FROM complaints c
               JOIN users u ON u.user_id=c.user_id
               JOIN classes cl ON cl.class_id=c.class_id`;
    const params = [];

    if (req.user.role !== "admin") {
      sql += " WHERE c.user_id=?";
      params.push(req.user.user_id);
    }

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Complaint list error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /api/complaints
 * - Student hoặc Tutor gửi khiếu nại
 */
router.post(
  "/",
  verifyToken,
  requireRole(["student", "tutor"]),
  async (req, res) => {
    try {
      const { class_id, message } = req.body || {};
      if (!class_id || !message) {
        return res
          .status(400)
          .json({ success: false, message: "Missing class_id or message" });
      }

      const [rs] = await pool.query(
        "INSERT INTO complaints (user_id, class_id, message, status) VALUES (?,?,?, 'PENDING')",
        [req.user.user_id, class_id, message]
      );

      res.status(201).json({
        success: true,
        message: "Complaint submitted",
        complaint_id: rs.insertId,
      });
    } catch (err) {
      console.error("Complaint create error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/**
 * PUT /api/complaints/:id/resolve
 * - Admin đánh dấu khiếu nại đã xử lý
 */
router.put(
  "/:id/resolve",
  verifyToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      await pool.query(
        "UPDATE complaints SET status='RESOLVED' WHERE complaint_id=?",
        [req.params.id]
      );
      res.json({ success: true, message: "Complaint resolved" });
    } catch (err) {
      console.error("Complaint resolve error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/**
 * PUT /api/complaints/:id/reject
 * - Admin từ chối khiếu nại
 */
router.put(
  "/:id/reject",
  verifyToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      await pool.query(
        "UPDATE complaints SET status='REJECTED' WHERE complaint_id=?",
        [req.params.id]
      );
      res.json({ success: true, message: "Complaint rejected" });
    } catch (err) {
      console.error("Complaint reject error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export default router;
