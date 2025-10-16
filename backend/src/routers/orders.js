const express = require("express");
const { getPool } = require("../config/db");
const { authMiddleware } = require("./auth");
const router = express.Router();

/* ===========================
   Tạo orders khi lớp đã AWAITING_PAYMENTS
   =========================== */
router.post("/create/:classId", authMiddleware, async (req, res) => {
  try {
    const { classId } = req.params;
    const pool = getPool();

    // Chỉ student sở hữu lớp mới tạo order
    const [clsRows] = await pool.query(
      `SELECT c.*, u.full_name AS student_name
       FROM classes c
       JOIN users u ON c.student_id = u.user_id
       WHERE c.class_id=?`,
      [classId]
    );
    if (!clsRows.length)
      return res.status(404).json({ message: "Không tìm thấy lớp" });

    const cls = clsRows[0];
    if (cls.student_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền tạo order cho lớp này" });
    }
    if (cls.status !== "AWAITING_PAYMENTS") {
      return res.status(400).json({ message: "Lớp chưa đến bước thanh toán" });
    }

    // Kiểm tra đã có order chưa
    const [exists] = await pool.query("SELECT * FROM orders WHERE class_id=?", [
      classId,
    ]);
    if (exists.length) {
      return res.json({ message: "Orders đã được tạo", orders: exists });
    }

    // Tạo orders: student phải trả toàn bộ học phí, tutor đặt cọc 10%
    const tuitionAmount = cls.tuition_amount;
    const depositAmount = Math.round(tuitionAmount * 0.1);

    await pool.query(
      `INSERT INTO orders (class_id, user_id, role, type, amount, status)
       VALUES (?,?,?,?,?, 'PENDING')`,
      [classId, cls.student_id, "student", "STUDENT_TUITION", tuitionAmount]
    );

    await pool.query(
      `INSERT INTO orders (class_id, user_id, role, type, amount, status)
       VALUES (?,?,?,?,?, 'PENDING')`,
      [classId, cls.selected_tutor_id, "tutor", "TUTOR_DEPOSIT", depositAmount]
    );

    const [newOrders] = await pool.query(
      "SELECT * FROM orders WHERE class_id=?",
      [classId]
    );

    res
      .status(201)
      .json({ message: "Tạo orders thành công", orders: newOrders });
  } catch (err) {
    console.error("Create orders error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   Get chi tiết 1 order
   =========================== */
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query("SELECT * FROM orders WHERE order_id=?", [
      req.params.id,
    ]);
    if (!rows.length)
      return res.status(404).json({ message: "Order không tồn tại" });

    res.json(rows[0]);
  } catch (err) {
    console.error("Get order error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
