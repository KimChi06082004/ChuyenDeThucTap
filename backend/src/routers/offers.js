// backend/src/routers/offers.js
const express = require("express");
const { getPool } = require("../config/db");
const { authMiddleware } = require("./auth");
const router = express.Router();

/* ===========================
   Student gửi lời mời cho tutor (PRIVATE)
   =========================== */
router.post("/", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res
        .status(403)
        .json({ message: "Chỉ học viên mới được mời tutor" });
    }

    const { class_id, tutor_id } = req.body;
    if (!class_id || !tutor_id) {
      return res.status(400).json({ message: "Thiếu class_id hoặc tutor_id" });
    }

    const pool = getPool();

    // Lớp phải thuộc về student và ở PRIVATE + đúng phase
    const [cls] = await pool.query(
      "SELECT class_id, visibility, status FROM classes WHERE class_id=? AND student_id=?",
      [class_id, req.user.id]
    );
    if (cls.length === 0)
      return res.status(403).json({ message: "Bạn không sở hữu lớp này" });
    if (cls[0].visibility !== "PRIVATE") {
      return res.status(400).json({ message: "Lớp phải ở chế độ PRIVATE" });
    }
    if (
      ["AWAITING_PAYMENTS", "IN_PROGRESS", "DONE", "CANCELLED"].includes(
        cls[0].status
      )
    ) {
      return res
        .status(400)
        .json({ message: "Trạng thái lớp không cho phép gửi offer" });
    }

    // Tutor phải tồn tại
    const [tutorExists] = await pool.query(
      "SELECT tutor_id FROM tutors WHERE tutor_id=?",
      [tutor_id]
    );
    if (!tutorExists.length)
      return res.status(404).json({ message: "Tutor không tồn tại" });

    // Không cho trùng offer đang còn hiệu lực
    const [dup] = await pool.query(
      "SELECT offer_id FROM offers WHERE class_id=? AND tutor_id=? AND status='SENT'",
      [class_id, tutor_id]
    );
    if (dup.length)
      return res.status(400).json({ message: "Đã gửi lời mời trước đó" });

    const [rs] = await pool.query(
      `INSERT INTO offers(class_id, tutor_id, status, deadline_at)
       VALUES (?,?, 'SENT', DATE_ADD(NOW(), INTERVAL 48 HOUR))`,
      [class_id, tutor_id]
    );

    return res
      .status(201)
      .json({ message: "Đã gửi lời mời cho tutor", offer_id: rs.insertId });
  } catch (err) {
    console.error("Send offer error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   Tutor ACCEPT lời mời
   =========================== */
router.post("/:id/accept", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "tutor") {
      return res
        .status(403)
        .json({ message: "Chỉ tutor mới được accept offer" });
    }

    const offerId = req.params.id;
    const pool = getPool();

    // Lấy offer + ánh xạ tutor_user
    const [rows] = await pool.query(
      `SELECT o.*, t.user_id AS tutor_user_id
       FROM offers o
       JOIN tutors t ON o.tutor_id = t.tutor_id
       WHERE o.offer_id=?`,
      [offerId]
    );
    if (!rows.length)
      return res.status(404).json({ message: "Offer không tồn tại" });

    const offer = rows[0];
    if (offer.tutor_user_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền accept offer này" });
    }
    if (offer.status !== "SENT") {
      return res.status(400).json({ message: "Offer không còn hợp lệ" });
    }
    if (offer.deadline_at && new Date(offer.deadline_at) < new Date()) {
      return res.status(400).json({ message: "Offer đã hết hạn" });
    }

    // Chỉ cập nhật khi còn SENT & chưa hết hạn
    const [upd] = await pool.query(
      `UPDATE offers
         SET status='TUTOR_ACCEPTED'
       WHERE offer_id=? AND status='SENT' AND (deadline_at IS NULL OR deadline_at > NOW())`,
      [offerId]
    );
    if (!upd.affectedRows) {
      return res
        .status(400)
        .json({ message: "Offer không còn hợp lệ để accept" });
    }

    // Cập nhật class -> AWAITING_PAYMENTS + chọn tutor
    await pool.query(
      "UPDATE classes SET status='AWAITING_PAYMENTS', selected_tutor_id=? WHERE class_id=?",
      [offer.tutor_id, offer.class_id]
    );

    // (Tuỳ chọn) vô hiệu hoá các offer khác của cùng lớp
    await pool.query(
      "UPDATE offers SET status='EXPIRED' WHERE class_id=? AND offer_id<>? AND status='SENT'",
      [offer.class_id, offerId]
    );

    res.json({ message: "Tutor đã accept lời mời" });
  } catch (err) {
    console.error("Accept offer error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   Tutor DECLINE lời mời
   =========================== */
router.post("/:id/decline", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "tutor") {
      return res
        .status(403)
        .json({ message: "Chỉ tutor mới được decline offer" });
    }

    const offerId = req.params.id;
    const pool = getPool();

    const [rows] = await pool.query(
      `SELECT o.*, t.user_id AS tutor_user_id
       FROM offers o
       JOIN tutors t ON o.tutor_id = t.tutor_id
       WHERE o.offer_id=?`,
      [offerId]
    );
    if (!rows.length)
      return res.status(404).json({ message: "Offer không tồn tại" });

    if (rows[0].tutor_user_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền decline offer này" });
    }
    if (rows[0].status !== "SENT") {
      return res.status(400).json({ message: "Offer không còn hợp lệ" });
    }

    const [upd] = await pool.query(
      "UPDATE offers SET status='DECLINED' WHERE offer_id=? AND status='SENT'",
      [offerId]
    );
    if (!upd.affectedRows) {
      return res
        .status(400)
        .json({ message: "Offer không còn hợp lệ để decline" });
    }

    res.json({ message: "Tutor đã từ chối lời mời" });
  } catch (err) {
    console.error("Decline offer error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
// Tutor xem các offer đang chờ
router.get("/mine", authMiddleware, async (req, res) => {
  if (req.user.role !== "tutor")
    return res.status(403).json({ message: "Chỉ tutor" });
  const pool = getPool();
  const [rowTutor] = await pool.query(
    "SELECT tutor_id FROM tutors WHERE user_id=?",
    [req.user.id]
  );
  if (!rowTutor.length)
    return res.status(400).json({ message: "Bạn chưa có hồ sơ tutor" });
  const tutorId = rowTutor[0].tutor_id;

  const [rows] = await pool.query(
    `SELECT o.offer_id, o.class_id, o.status, o.deadline_at,
            c.subject, c.grade, c.schedule, c.tuition_amount
     FROM offers o
     JOIN classes c ON o.class_id=c.class_id
     WHERE o.tutor_id=? AND o.status='SENT'
     ORDER BY o.offer_id DESC`,
    [tutorId]
  );
  res.json(rows);
});

module.exports = router;
