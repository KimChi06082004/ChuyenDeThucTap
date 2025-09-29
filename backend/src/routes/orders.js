// src/routes/orders.js
import express from "express";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

/**
 * GET /api/orders
 * - Admin: xem tất cả đơn
 * - Student: xem đơn của chính mình
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    let sql = `SELECT o.*, c.subject, c.grade 
               FROM orders o 
               JOIN classes c ON c.class_id=o.class_id`;
    const params = [];

    if (req.user.role === "student") {
      sql += " WHERE o.student_id=?";
      params.push(req.user.user_id);
    }

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Orders list error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /api/orders (student tạo đơn cho class đã chọn tutor)
 */
router.post("/", verifyToken, requireRole(["student"]), async (req, res) => {
  try {
    const { class_id, amount } = req.body || {};

    // Kiểm tra class có thuộc về student không
    const [cls] = await pool.query("SELECT * FROM classes WHERE class_id=?", [
      class_id,
    ]);
    if (!cls.length || cls[0].student_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const [rs] = await pool.query(
      `INSERT INTO orders (class_id, student_id, amount, status) VALUES (?,?,?, 'PENDING')`,
      [class_id, req.user.user_id, amount]
    );

    res.status(201).json({
      success: true,
      message: "Order created, awaiting payment",
      order_id: rs.insertId,
    });
  } catch (err) {
    console.error("Order create error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * PUT /api/orders/:id/pay (student trả tiền → giả lập thanh toán)
 */
router.put(
  "/:id/pay",
  verifyToken,
  requireRole(["student"]),
  async (req, res) => {
    try {
      const [rows] = await pool.query("SELECT * FROM orders WHERE order_id=?", [
        req.params.id,
      ]);
      if (!rows.length)
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });

      const order = rows[0];
      if (order.student_id !== req.user.user_id) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      if (order.status !== "PENDING") {
        return res
          .status(400)
          .json({ success: false, message: "Order is not pending" });
      }

      // Cập nhật trạng thái
      await pool.query("UPDATE orders SET status='PAID' WHERE order_id=?", [
        req.params.id,
      ]);
      await pool.query(
        "UPDATE classes SET status='IN_PROGRESS' WHERE class_id=?",
        [order.class_id]
      );

      res.json({
        success: true,
        message: "Order paid successfully, class in progress",
      });
    } catch (err) {
      console.error("Order pay error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/**
 * PUT /api/orders/:id/cancel (student hủy đơn trước khi thanh toán)
 */
router.put(
  "/:id/cancel",
  verifyToken,
  requireRole(["student"]),
  async (req, res) => {
    try {
      const [rows] = await pool.query("SELECT * FROM orders WHERE order_id=?", [
        req.params.id,
      ]);
      if (!rows.length)
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });

      const order = rows[0];
      if (order.student_id !== req.user.user_id) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      if (order.status !== "PENDING") {
        return res
          .status(400)
          .json({
            success: false,
            message: "Only pending orders can be cancelled",
          });
      }

      await pool.query(
        "UPDATE orders SET status='CANCELLED' WHERE order_id=?",
        [req.params.id]
      );

      res.json({ success: true, message: "Order cancelled successfully" });
    } catch (err) {
      console.error("Order cancel error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export default router;
