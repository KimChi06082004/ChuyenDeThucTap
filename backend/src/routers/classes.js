const express = require("express");
const { getPool } = require("../config/db");
const { authMiddleware } = require("./auth");
const router = express.Router();

/* ===========================
   Student đăng lớp
   -> trả về class_id (insertId)
   =========================== */
router.post("/", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res
        .status(403)
        .json({ message: "Chỉ học viên mới được đăng lớp" });
    }

    const {
      subject,
      grade,
      schedule,
      tuition_amount,
      visibility,
      selected_tutor_id,
    } = req.body;

    if (!subject || !schedule || !tuition_amount) {
      return res
        .status(400)
        .json({ message: "Thiếu subject/schedule/tuition_amount" });
    }

    const pool = getPool();

    const [rs] = await pool.query(
      `INSERT INTO classes
        (student_id, subject, grade, schedule, tuition_amount, visibility, status, selected_tutor_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        req.user.id,
        subject,
        grade || null,
        schedule,
        tuition_amount,
        visibility || "PUBLIC",
        visibility === "PRIVATE"
          ? "PRIVATE_SELECTED_TUTOR"
          : "PENDING_ADMIN_APPROVAL",
        selected_tutor_id || null,
      ]
    );

    return res.status(201).json({
      message: "Đăng lớp thành công, chờ duyệt",
      class_id: rs.insertId,
    });
  } catch (err) {
    console.error("Post class error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   Student xem các lớp của chính mình
   (đặt TRƯỚC /:id để tránh bắt nhầm path)
   =========================== */
router.get("/mine", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Chỉ học viên" });
    }
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT class_id, subject, visibility, status, created_at
       FROM classes
       WHERE student_id=?
       ORDER BY class_id DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   Tutor xem danh sách lớp công khai
   =========================== */
router.get("/", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "tutor") {
      return res
        .status(403)
        .json({ message: "Chỉ gia sư mới được xem lớp công khai" });
    }
    const pool = getPool();
    const [rows] = await pool.query(
      "SELECT * FROM classes WHERE status='APPROVED_VISIBLE' ORDER BY class_id DESC"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   Admin duyệt / từ chối lớp
   =========================== */
router.post("/:id/admin-approve", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Chỉ admin mới được duyệt lớp" });
    }
    const pool = getPool();
    await pool.query(
      "UPDATE classes SET status='APPROVED_VISIBLE' WHERE class_id=?",
      [req.params.id]
    );
    res.json({ message: "Duyệt lớp thành công" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:id/admin-reject", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Chỉ admin mới được từ chối lớp" });
    }
    const pool = getPool();
    await pool.query("UPDATE classes SET status='CANCELLED' WHERE class_id=?", [
      req.params.id,
    ]);
    res.json({ message: "Từ chối lớp thành công" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   Xem chi tiết lớp (mọi role có token)
   =========================== */
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query("SELECT * FROM classes WHERE class_id=?", [
      req.params.id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy lớp" });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
