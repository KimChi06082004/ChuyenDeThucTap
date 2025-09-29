// src/routes/ratings.js
import express from "express";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

/**
 * GET /api/ratings/user/:user_id
 * - Xem tất cả đánh giá của 1 user (tutor hoặc student)
 */
router.get("/user/:user_id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, u.full_name AS from_name
       FROM ratings r
       JOIN users u ON u.user_id=r.from_user_id
       WHERE r.to_user_id=?
       ORDER BY r.created_at DESC`,
      [req.params.user_id]
    );
    res.json(rows);
  } catch (err) {
    console.error("Ratings fetch error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /api/ratings
 * - Student đánh giá tutor sau khi class DONE
 * - Tutor đánh giá student sau khi class DONE
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const { to_user_id, class_id, score, comment } = req.body || {};
    if (!to_user_id || !class_id || !score) {
      return res
        .status(400)
        .json({ success: false, message: "Missing fields" });
    }

    // Kiểm tra class đã hoàn thành chưa
    const [cls] = await pool.query(
      "SELECT * FROM classes WHERE class_id=? AND status='DONE'",
      [class_id]
    );
    if (!cls.length) {
      return res
        .status(400)
        .json({ success: false, message: "Class not completed" });
    }

    // Check nếu user đã đánh giá rồi
    const [dup] = await pool.query(
      "SELECT rating_id FROM ratings WHERE from_user_id=? AND to_user_id=? AND class_id=?",
      [req.user.user_id, to_user_id, class_id]
    );
    if (dup.length) {
      return res.status(400).json({ success: false, message: "Already rated" });
    }

    const [rs] = await pool.query(
      "INSERT INTO ratings (from_user_id, to_user_id, class_id, score, comment) VALUES (?,?,?,?,?)",
      [req.user.user_id, to_user_id, class_id, score, comment || ""]
    );

    res.status(201).json({
      success: true,
      message: "Rating submitted",
      rating_id: rs.insertId,
    });
  } catch (err) {
    console.error("Rating create error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * PUT /api/ratings/:id
 * - Người đánh giá có thể chỉnh sửa comment/score
 */
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { score, comment } = req.body || {};

    // Kiểm tra quyền sở hữu
    const [rows] = await pool.query(
      "SELECT * FROM ratings WHERE rating_id=? AND from_user_id=?",
      [req.params.id, req.user.user_id]
    );
    if (!rows.length) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await pool.query(
      "UPDATE ratings SET score=?, comment=? WHERE rating_id=?",
      [score, comment, req.params.id]
    );
    res.json({ success: true, message: "Rating updated" });
  } catch (err) {
    console.error("Rating update error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * DELETE /api/ratings/:id
 * - Người đánh giá có thể xoá đánh giá của mình
 * - Admin có thể xoá bất kỳ đánh giá nào
 */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM ratings WHERE rating_id=?", [
      req.params.id,
    ]);
    if (!rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Rating not found" });
    }

    const rating = rows[0];
    if (rating.from_user_id !== req.user.user_id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await pool.query("DELETE FROM ratings WHERE rating_id=?", [req.params.id]);
    res.json({ success: true, message: "Rating deleted" });
  } catch (err) {
    console.error("Rating delete error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
