import { Router } from "express";
import { pool } from "../config/db.js";
import { verifyToken } from "../middlewares/auth.js";
import { requireRoles } from "../middlewares/roles.js";

const router = Router();

/* =========================================================
   POST /api/classes (student tạo lớp → chờ admin duyệt)
========================================================= */
router.post("/", verifyToken, requireRoles("student"), async (req, res) => {
  try {
    const {
      subject,
      grade,
      schedule,
      tuition_amount,
      visibility = "PUBLIC",
      lat,
      lng,
      city,
    } = req.body || {};

    if (!subject || !grade || !schedule || !tuition_amount) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const finalLat = lat || 10.7769;
    const finalLng = lng || 106.7009;

    const [rs] = await pool.query(
      `INSERT INTO classes(
        student_id, subject, grade, schedule, tuition_amount,
        visibility, status, lat, lng, city
      )
      VALUES (?,?,?,?,?,?, 'PENDING_ADMIN_APPROVAL', ?, ?, ?)`,
      [
        req.user.user_id,
        subject,
        grade,
        schedule,
        parseFloat(tuition_amount),
        visibility,
        finalLat,
        finalLng,
        city || "Hồ Chí Minh",
      ]
    );

    res.status(201).json({
      success: true,
      message: "Class created and pending admin approval",
      class: {
        class_id: rs.insertId,
        student_id: req.user.user_id,
        subject,
        grade,
        schedule,
        tuition_amount: parseFloat(tuition_amount),
        status: "PENDING_ADMIN_APPROVAL",
        lat: finalLat,
        lng: finalLng,
        city: city || "Hồ Chí Minh",
      },
    });
  } catch (err) {
    console.error("❌ Create class error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =========================================================
   PUT /api/classes/:id/approve (admin duyệt lớp)
========================================================= */
router.put(
  "/:id/approve",
  verifyToken,
  requireRoles("admin"),
  async (req, res) => {
    try {
      await pool.query("UPDATE classes SET status=? WHERE class_id=?", [
        "APPROVED_VISIBLE",
        req.params.id,
      ]);
      res.json({
        success: true,
        message: "Class approved and visible to tutors",
      });
    } catch (err) {
      console.error("❌ Approve class error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/* =========================================================
 // PUT /api/classes/:id/reject  (admin từ chối lớp)//
========================================================= */
router.put(
  "/:id/reject",
  verifyToken,
  requireRoles("admin"),
  async (req, res) => {
    try {
      const classId = req.params.id;
      const reason = req.body?.reason || "Không có lý do";

      // Check class tồn tại
      const [rows] = await pool.query(
        "SELECT * FROM classes WHERE class_id=?",
        [classId]
      );
      if (!rows.length) {
        return res
          .status(404)
          .json({ success: false, message: "Class not found" });
      }

      // Update
      await pool.query(
        "UPDATE classes SET status=?, admin_reject_reason=?, admin_reject_at=NOW() WHERE class_id=?",
        ["REJECTED", reason, classId]
      );

      res.json({ success: true, message: "Class rejected", reason });
    } catch (err) {
      console.error("❌ Reject class error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/* =========================================================
   GET /api/classes (lọc theo status, subject)
========================================================= */
router.get("/", async (req, res) => {
  try {
    const { status, subject } = req.query || {};
    let sql = `
      SELECT c.class_id, c.subject, c.grade, c.schedule, 
             c.tuition_amount, c.status, c.lat, c.lng, c.city,
             u.full_name AS student_name
      FROM classes c 
      JOIN users u ON u.user_id = c.student_id 
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += " AND c.status=?";
      params.push(status);
    }
    if (subject) {
      sql += " AND c.subject=?";
      params.push(subject);
    }

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("❌ Classes list error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =========================================================
   GET /api/classes/:id (chi tiết 1 lớp)
========================================================= */
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, 
              s.full_name AS student_name, 
              t.tutor_id, 
              ut.full_name AS selected_tutor_name
       FROM classes c 
       JOIN users s ON s.user_id=c.student_id
       LEFT JOIN tutors t ON t.tutor_id=c.selected_tutor_id
       LEFT JOIN users ut ON ut.user_id=t.user_id
       WHERE c.class_id=?`,
      [req.params.id]
    );

    if (!rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Class not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Class detail error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =========================================================
   POST /api/classes/:id/apply (tutor apply)
========================================================= */
router.post(
  "/:id/apply",
  verifyToken,
  requireRoles("tutor"),
  async (req, res) => {
    try {
      const { message } = req.body || {};
      const [cls] = await pool.query(
        "SELECT student_id FROM classes WHERE class_id=?",
        [req.params.id]
      );

      if (!cls.length)
        return res
          .status(404)
          .json({ success: false, message: "Class not found" });

      await pool.query(
        "INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,?)",
        [
          cls[0].student_id,
          "Có gia sư ứng tuyển",
          `Gia sư #${req.user.user_id} ứng tuyển: ${message || ""}`,
          "CLASS_UPDATE",
        ]
      );

      res.status(201).json({
        success: true,
        message: "Application submitted, student notified",
      });
    } catch (err) {
      console.error("❌ Class apply error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/* =========================================================
   PUT /api/classes/:id/select-tutor (student chọn tutor)
========================================================= */
router.put(
  "/:id/select-tutor",
  verifyToken,
  requireRoles("student"),
  async (req, res) => {
    try {
      const { tutor_id } = req.body || {};
      const [own] = await pool.query(
        "SELECT student_id FROM classes WHERE class_id=?",
        [req.params.id]
      );

      if (!own.length || own[0].student_id !== req.user.user_id) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      await pool.query(
        "UPDATE classes SET selected_tutor_id=?, status=? WHERE class_id=?",
        [tutor_id, "AWAITING_PAYMENTS", req.params.id]
      );

      res.json({
        success: true,
        message: "Tutor selected, waiting for payment",
        class_status: "AWAITING_PAYMENTS",
      });
    } catch (err) {
      console.error("❌ Select tutor error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/* =========================================================
   PUT /api/classes/:id/complete (admin)
========================================================= */
router.put(
  "/:id/complete",
  verifyToken,
  requireRoles("admin"),
  async (req, res) => {
    try {
      await pool.query("UPDATE classes SET status=? WHERE class_id=?", [
        "DONE",
        req.params.id,
      ]);
      res.json({
        success: true,
        message: "Class marked as completed",
        class_status: "DONE",
      });
    } catch (err) {
      console.error("❌ Complete class error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/* =========================================================
   PUT /api/classes/:id/cancel (student/tutor yêu cầu)
========================================================= */
router.put("/:id/cancel", verifyToken, async (req, res) => {
  try {
    const { reason } = req.body || {};
    const [cskh] = await pool.query(
      "SELECT user_id FROM users WHERE role IN ('cskh','admin') LIMIT 1"
    );

    if (cskh.length) {
      await pool.query(
        "INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,?)",
        [
          cskh[0].user_id,
          "Yêu cầu hủy lớp",
          `Class #${req.params.id} yêu cầu hủy: ${reason || ""}`,
          "CLASS_UPDATE",
        ]
      );
    }

    res.json({
      success: true,
      message: "Cancel request sent, waiting for approval from CSKH/Admin",
    });
  } catch (err) {
    console.error("❌ Cancel class error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
