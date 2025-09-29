// src/routes/payouts.js
import express from "express";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

/**
 * GET /api/payouts
 * - Admin: xem tất cả payout
 * - Tutor: xem payout của chính mình
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    let sql = `SELECT p.*, u.full_name AS tutor_name, u.email
               FROM payouts p 
               JOIN users u ON u.user_id=p.tutor_id`;
    const params = [];

    if (req.user.role === "tutor") {
      sql += " WHERE p.tutor_id=?";
      params.push(req.user.user_id);
    }

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Payout list error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /api/payouts/request
 * - Tutor gửi yêu cầu rút tiền
 */
router.post(
  "/request",
  verifyToken,
  requireRole(["tutor"]),
  async (req, res) => {
    try {
      const { amount } = req.body || {};
      if (!amount || amount <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid amount" });
      }

      const [rs] = await pool.query(
        "INSERT INTO payouts (tutor_id, amount, status) VALUES (?,?, 'PENDING')",
        [req.user.user_id, amount]
      );

      res.status(201).json({
        success: true,
        message: "Payout request submitted",
        payout_id: rs.insertId,
      });
    } catch (err) {
      console.error("Payout request error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/**
 * PUT /api/payouts/:id/process
 * - Admin duyệt & xử lý chi trả
 */
router.put(
  "/:id/process",
  verifyToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      await pool.query(
        "UPDATE payouts SET status='PROCESSING' WHERE payout_id=?",
        [req.params.id]
      );
      res.json({ success: true, message: "Payout marked as processing" });
    } catch (err) {
      console.error("Payout process error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/**
 * PUT /api/payouts/:id/complete
 * - Admin xác nhận chi trả thành công
 */
router.put(
  "/:id/complete",
  verifyToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      await pool.query("UPDATE payouts SET status='PAID' WHERE payout_id=?", [
        req.params.id,
      ]);
      res.json({ success: true, message: "Payout completed successfully" });
    } catch (err) {
      console.error("Payout complete error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/**
 * PUT /api/payouts/:id/fail
 * - Admin đánh dấu payout thất bại
 */
router.put(
  "/:id/fail",
  verifyToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      await pool.query("UPDATE payouts SET status='FAILED' WHERE payout_id=?", [
        req.params.id,
      ]);
      res.json({ success: true, message: "Payout marked as failed" });
    } catch (err) {
      console.error("Payout fail error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export default router;
