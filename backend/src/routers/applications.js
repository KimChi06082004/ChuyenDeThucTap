// backend/src/routers/applications.js
const express = require("express");
const { getPool } = require("../config/db");
const { authMiddleware } = require("./auth");
const router = express.Router();

/* Tutor apply vào lớp PUBLIC */
router.post("/", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "tutor") {
      return res.status(403).json({ message: "Chỉ gia sư mới được apply lớp" });
    }

    const { class_id } = req.body;
    if (!class_id) return res.status(400).json({ message: "Thiếu class_id" });

    const pool = getPool();

    // map user_id -> tutor_id
    const [tutorRow] = await pool.query(
      "SELECT tutor_id FROM tutors WHERE user_id=?",
      [req.user.id]
    );
    if (!tutorRow.length) {
      return res.status(400).json({ message: "Bạn chưa có hồ sơ tutor" });
    }
    const tutorId = tutorRow[0].tutor_id;

    // lớp phải PUBLIC và đang visible
    const [classes] = await pool.query(
      "SELECT class_id FROM classes WHERE class_id=? AND visibility='PUBLIC' AND status='APPROVED_VISIBLE'",
      [class_id]
    );
    if (!classes.length) {
      return res
        .status(400)
        .json({
          message: "Lớp không tồn tại / không phải PUBLIC / chưa được duyệt",
        });
    }

    // chặn apply trùng còn hiệu lực
    const [check] = await pool.query(
      "SELECT 1 FROM applications WHERE class_id=? AND tutor_id=? AND status IN ('SUBMITTED','APPROVED_BY_STUDENT')",
      [class_id, tutorId]
    );
    if (check.length) {
      return res.status(400).json({ message: "Bạn đã apply lớp này rồi" });
    }

    await pool.query(
      "INSERT INTO applications(class_id, tutor_id, status) VALUES (?,?,?)",
      [class_id, tutorId, "SUBMITTED"]
    );

    res.json({ message: "Apply thành công" });
  } catch (err) {
    console.error("Apply error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* Student xem danh sách tutor apply vào lớp */
router.get("/class/:id", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res
        .status(403)
        .json({ message: "Chỉ học viên mới được xem danh sách ứng tuyển" });
    }

    const classId = req.params.id;
    const pool = getPool();

    // kiểm tra quyền sở hữu lớp
    const [cls] = await pool.query(
      "SELECT class_id FROM classes WHERE class_id=? AND student_id=?",
      [classId, req.user.id]
    );
    if (!cls.length) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền xem lớp này" });
    }

    const [rows] = await pool.query(
      `SELECT a.application_id, a.status, a.tutor_id,
              u.full_name, u.email, t.bio, t.experience, t.hourly_rate, t.city
       FROM applications a
       JOIN tutors t ON a.tutor_id = t.tutor_id
       JOIN users u  ON t.user_id = u.user_id
       WHERE a.class_id=?
       ORDER BY a.application_id DESC`,
      [classId]
    );

    res.json(rows);
  } catch (err) {
    console.error("List applications error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* Student duyệt 1 tutor */
router.post("/:id/approve", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res
        .status(403)
        .json({ message: "Chỉ học viên mới được duyệt gia sư" });
    }

    const applicationId = req.params.id;
    const pool = getPool();

    // lấy application + kiểm tra quyền
    const [apps] = await pool.query(
      `SELECT a.application_id, a.class_id, a.tutor_id, a.status,
              c.student_id, c.status AS class_status
       FROM applications a
       JOIN classes c ON a.class_id=c.class_id
       WHERE a.application_id=?`,
      [applicationId]
    );
    if (!apps.length)
      return res.status(404).json({ message: "Application không tồn tại" });

    const app = apps[0];
    if (app.student_id !== req.user.id) {
      return res.status(403).json({ message: "Bạn không có quyền duyệt" });
    }
    if (app.status !== "SUBMITTED") {
      return res.status(400).json({ message: "Application không còn hợp lệ" });
    }
    if (app.class_status !== "APPROVED_VISIBLE") {
      return res
        .status(400)
        .json({ message: "Trạng thái lớp không cho phép duyệt" });
    }

    // cập nhật application -> APPROVED_BY_STUDENT
    const [updApp] = await pool.query(
      "UPDATE applications SET status='APPROVED_BY_STUDENT', selected_at=NOW() WHERE application_id=? AND status='SUBMITTED'",
      [applicationId]
    );
    if (!updApp.affectedRows) {
      return res
        .status(400)
        .json({ message: "Application không hợp lệ để duyệt" });
    }

    // cập nhật lớp -> AWAITING_PAYMENTS + chọn tutor
    await pool.query(
      "UPDATE classes SET status='AWAITING_PAYMENTS', selected_tutor_id=? WHERE class_id=? AND status='APPROVED_VISIBLE'",
      [app.tutor_id, app.class_id]
    );

    // từ chối các application khác của cùng lớp
    await pool.query(
      "UPDATE applications SET status='REJECTED' WHERE class_id=? AND application_id<>? AND status='SUBMITTED'",
      [app.class_id, applicationId]
    );

    res.json({ message: "Duyệt gia sư thành công" });
  } catch (err) {
    console.error("Approve application error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* Student từ chối 1 tutor */
router.post("/:id/reject", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res
        .status(403)
        .json({ message: "Chỉ học viên mới được từ chối gia sư" });
    }

    const applicationId = req.params.id;
    const pool = getPool();

    const [apps] = await pool.query(
      `SELECT a.application_id, a.status, c.student_id
       FROM applications a
       JOIN classes c ON a.class_id=c.class_id
       WHERE a.application_id=?`,
      [applicationId]
    );
    if (!apps.length)
      return res.status(404).json({ message: "Application không tồn tại" });

    const app = apps[0];
    if (app.student_id !== req.user.id) {
      return res.status(403).json({ message: "Bạn không có quyền từ chối" });
    }
    if (app.status !== "SUBMITTED") {
      return res.status(400).json({ message: "Application không còn hợp lệ" });
    }

    const [upd] = await pool.query(
      "UPDATE applications SET status='REJECTED' WHERE application_id=? AND status='SUBMITTED'",
      [applicationId]
    );
    if (!upd.affectedRows) {
      return res
        .status(400)
        .json({ message: "Application không hợp lệ để từ chối" });
    }

    res.json({ message: "Từ chối gia sư thành công" });
  } catch (err) {
    console.error("Reject application error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
