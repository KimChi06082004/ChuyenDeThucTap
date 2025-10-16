const express = require("express");
const { getPool } = require("../config/db");
const { authMiddleware } = require("./auth");
const router = express.Router();

/* ===========================
   Cập nhật trạng thái lớp
   =========================== */

/**
 * Sau khi student & tutor đã thanh toán đủ → IN_PROGRESS
 */
router.patch("/:id/start", authMiddleware, async (req, res) => {
  try {
    const classId = req.params.id;
    const pool = getPool();

    // Kiểm tra quyền (admin hoặc student sở hữu lớp)
    const [cls] = await pool.query("SELECT * FROM classes WHERE class_id=?", [
      classId,
    ]);
    if (!cls.length)
      return res.status(404).json({ message: "Lớp không tồn tại" });

    const classData = cls[0];
    if (req.user.role !== "admin" && req.user.id !== classData.student_id) {
      return res.status(403).json({ message: "Bạn không có quyền start lớp" });
    }

    // Kiểm tra tất cả orders đã PAID
    const [orders] = await pool.query("SELECT * FROM orders WHERE class_id=?", [
      classId,
    ]);
    const allPaid =
      orders.length > 0 && orders.every((o) => o.status === "PAID");
    if (!allPaid) {
      return res
        .status(400)
        .json({ message: "Chưa thanh toán đủ để start lớp" });
    }

    await pool.query(
      "UPDATE classes SET status='IN_PROGRESS' WHERE class_id=?",
      [classId]
    );

    res.json({ message: "Lớp đã bắt đầu (IN_PROGRESS)" });
  } catch (err) {
    console.error("Start class error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * Hoàn thành lớp → COMPLETED
 */
router.patch("/:id/complete", authMiddleware, async (req, res) => {
  try {
    const classId = req.params.id;
    const pool = getPool();

    // Chỉ tutor hoặc admin có thể complete
    const [cls] = await pool.query("SELECT * FROM classes WHERE class_id=?", [
      classId,
    ]);
    if (!cls.length)
      return res.status(404).json({ message: "Lớp không tồn tại" });

    const classData = cls[0];
    if (
      req.user.role !== "admin" &&
      req.user.id !== classData.selected_tutor_id
    ) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền complete lớp" });
    }

    await pool.query("UPDATE classes SET status='COMPLETED' WHERE class_id=?", [
      classId,
    ]);

    res.json({ message: "Lớp đã hoàn thành (COMPLETED)" });
  } catch (err) {
    console.error("Complete class error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * Hủy lớp → CANCELLED
 */
router.patch("/:id/cancel", authMiddleware, async (req, res) => {
  try {
    const classId = req.params.id;
    const pool = getPool();

    // Admin hoặc student sở hữu lớp mới được hủy
    const [cls] = await pool.query("SELECT * FROM classes WHERE class_id=?", [
      classId,
    ]);
    if (!cls.length)
      return res.status(404).json({ message: "Lớp không tồn tại" });

    const classData = cls[0];
    if (req.user.role !== "admin" && req.user.id !== classData.student_id) {
      return res.status(403).json({ message: "Bạn không có quyền hủy lớp" });
    }

    await pool.query("UPDATE classes SET status='CANCELLED' WHERE class_id=?", [
      classId,
    ]);

    res.json({ message: "Lớp đã bị hủy (CANCELLED)" });
  } catch (err) {
    console.error("Cancel class error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
