import express from "express";
import { pool } from "../config/db.js";
import { verifyToken } from "../middlewares/auth.js";
import { requireRoles } from "../middlewares/roles.js";

const router = express.Router();

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
      lat,
      lng,
      city,
      district,
      ward,
      address,
    } = req.body || {};

    if (!subject || !grade || !schedule || !tuition_amount)
      return res
        .status(400)
        .json({ success: false, message: "Thiếu thông tin bắt buộc." });

    const scheduleData =
      typeof schedule === "object" ? JSON.stringify(schedule) : schedule;
    const finalLat = parseFloat(lat) || 10.7769;
    const finalLng = parseFloat(lng) || 106.7009;
    const finalTuition = parseFloat(tuition_amount);
    const studentId = req.user.user_id || req.user.id;

    // ✅ lớp mới luôn ở trạng thái chờ duyệt và riêng tư
    const [rs] = await pool.query(
      `INSERT INTO classes(
        student_id, subject, grade, schedule, tuition_amount,
        visibility, status, lat, lng, city, district, ward, address
      )
      VALUES (?,?,?,?,?,?,?, ?, ?, ?, ?, ?, ?)`,
      [
        studentId,
        subject,
        grade,
        scheduleData,
        finalTuition,
        "PRIVATE",
        "PENDING_ADMIN_APPROVAL",
        finalLat,
        finalLng,
        city || "Hồ Chí Minh",
        district || null,
        ward || null,
        address || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "✅ Lớp đã được tạo, chờ admin duyệt.",
      data: { class_id: rs.insertId },
    });
  } catch (err) {
    console.error("❌ Create class error:", err);
    res.status(500).json({ success: false, message: err.message });
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
      const [rows] = await pool.query(
        "SELECT status FROM classes WHERE class_id=?",
        [req.params.id]
      );
      if (!rows.length)
        return res
          .status(404)
          .json({ success: false, message: "Không tìm thấy lớp học." });

      const current = rows[0].status;
      if (["APPROVED_VISIBLE", "REJECTED", "DONE"].includes(current)) {
        return res.status(400).json({
          success: false,
          message: "Lớp đã được xử lý, không thể duyệt lại.",
        });
      }

      await pool.query(
        "UPDATE classes SET status='APPROVED_VISIBLE' WHERE class_id=?",
        [req.params.id]
      );
      res.json({ success: true, message: "✅ Lớp đã được duyệt." });
    } catch (err) {
      console.error("❌ Approve class error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/* =========================================================
   PUT /api/classes/:id/reject (admin từ chối lớp)
========================================================= */
router.put(
  "/:id/reject",
  verifyToken,
  requireRoles("admin"),
  async (req, res) => {
    try {
      const reason = req.body?.reason || "Không có lý do";
      await pool.query(
        "UPDATE classes SET status=?, visibility=?, admin_reject_reason=?, admin_reject_at=NOW() WHERE class_id=?",
        ["REJECTED", "PRIVATE", reason, req.params.id]
      );
      res.json({ success: true, message: "❌ Lớp đã bị từ chối." });
    } catch (err) {
      console.error("❌ Reject class error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/* =========================================================
   GET /api/classes (gia sư: chỉ thấy lớp công khai đã duyệt)
========================================================= */
router.get("/", verifyToken, async (req, res) => {
  try {
    const { subject } = req.query || {};
    const role = req.user.role;
    const userId = req.user.user_id || req.user.id;

    let sql = `
      SELECT c.class_id, c.subject, c.grade, c.schedule, 
             c.tuition_amount, c.status, c.lat, c.lng, 
             c.city, c.district, c.ward,
             u.full_name AS student_name
      FROM classes c 
      JOIN users u ON u.user_id = c.student_id 
      WHERE 1=1
    `;
    const params = [];

    if (role === "student") {
      sql += " AND c.student_id = ?";
      params.push(userId);
    } else if (role === "tutor") {
      sql +=
        " AND c.status = 'APPROVED_VISIBLE' AND c.visibility = 'PUBLIC' AND c.selected_tutor_id IS NULL";
    }

    if (subject) {
      sql += " AND c.subject LIKE ?";
      params.push(`%${subject}%`);
    }

    sql += " ORDER BY c.created_at DESC";
    const [rows] = await pool.query(sql, params);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("❌ Classes list error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

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

      if (!own.length || own[0].student_id !== req.user.user_id)
        return res.status(403).json({ success: false, message: "Forbidden" });

      // ✅ Khi chọn gia sư → chuyển sang IN_PROGRESS, ẩn lớp
      await pool.query(
        "UPDATE classes SET selected_tutor_id=?, status=?, visibility=? WHERE class_id=?",
        [tutor_id, "IN_PROGRESS", "PRIVATE", req.params.id]
      );

      res.json({
        success: true,
        message: "🎯 Gia sư đã được chọn, lớp chuyển sang trạng thái đang học.",
        class_status: "IN_PROGRESS",
      });
    } catch (err) {
      console.error("❌ Select tutor error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/* =========================================================
   PUT /api/classes/:id/complete (admin hoặc tutor kết thúc)
========================================================= */
router.put("/:id/complete", verifyToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.user_id;

    const [rows] = await pool.query(
      "SELECT selected_tutor_id FROM classes WHERE class_id=?",
      [req.params.id]
    );
    if (!rows.length)
      return res
        .status(404)
        .json({ success: false, message: "Class not found" });

    if (userRole !== "admin" && userId !== rows[0].selected_tutor_id)
      return res
        .status(403)
        .json({ success: false, message: "Không có quyền hoàn tất lớp này" });

    await pool.query(
      "UPDATE classes SET status=?, visibility=?, completed_at=NOW() WHERE class_id=?",
      ["DONE", "PRIVATE", req.params.id]
    );

    res.json({
      success: true,
      message: "🏁 Lớp đã hoàn tất.",
      class_status: "DONE",
    });
  } catch (err) {
    console.error("❌ Complete class error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =========================================================
   GET /api/classes/mine (học viên xem lớp đã đăng)
========================================================= */
router.get("/mine", verifyToken, requireRoles("student"), async (req, res) => {
  try {
    const studentId = req.user.user_id;
    const [rows] = await pool.query(
      `SELECT class_id, subject, grade, schedule, tuition_amount, 
              status, visibility, created_at, city, district, ward
       FROM classes
       WHERE student_id = ?
       ORDER BY created_at DESC`,
      [studentId]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("❌ Get my classes error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =========================================================
   PUT /api/classes/:id/approve-cancel (admin duyệt yêu cầu hủy)
========================================================= */
router.put(
  "/:id/approve-cancel",
  verifyToken,
  requireRoles("admin"),
  async (req, res) => {
    try {
      await pool.query(
        "UPDATE classes SET status=?, visibility=? WHERE class_id=?",
        ["CANCELLED", "PRIVATE", req.params.id]
      );
      res.json({ success: true, message: "✅ Lớp đã được duyệt hủy." });
    } catch (err) {
      console.error("❌ Approve cancel error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);
/* =========================================================
   DELETE /api/classes/:id (admin xóa lớp)
========================================================= */
router.delete("/:id", verifyToken, requireRoles("admin"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT status FROM classes WHERE class_id=?",
      [req.params.id]
    );
    if (!rows.length)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy lớp học." });

    const current = rows[0].status;
    if (["IN_PROGRESS"].includes(current)) {
      return res.status(400).json({
        success: false,
        message: "Không thể xóa lớp đang được dạy.",
      });
    }

    await pool.query("DELETE FROM classes WHERE class_id=?", [req.params.id]);
    res.json({ success: true, message: "🗑️ Lớp đã bị xóa vĩnh viễn." });
  } catch (err) {
    console.error("❌ Delete class error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
