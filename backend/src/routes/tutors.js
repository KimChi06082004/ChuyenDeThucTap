// src/routes/tutors.js
import express from "express";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

/**
 * ============================================================
 * ⚙️ 1. ADMIN – Danh sách hồ sơ chờ duyệt
 * ============================================================
 */
router.get(
  "/pending",
  verifyToken,
  requireRole(["admin", "cskh"]),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT tutor_id, full_name, university, major, avatar, status, created_at
         FROM tutors
         WHERE status='PENDING'
         ORDER BY created_at DESC`
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error("❌ Get pending tutors error:", err);
      res
        .status(500)
        .json({ success: false, message: "Server error: " + err.message });
    }
  }
);

/**
 * ============================================================
 * ⚙️ 2. HỌC VIÊN – Lấy danh sách gia sư (APPROVED)
 * ============================================================
 */
router.get("/", async (req, res) => {
  try {
    const {
      subject,
      city,
      priceMin,
      priceMax,
      status = "APPROVED",
      page = 1,
    } = req.query;

    let sql = `
      SELECT tutor_id, full_name, avatar, city, subject, hourly_rate, lat, lng
      FROM tutors
      WHERE 1=1
    `;
    const params = [];

    if (subject) {
      sql += " AND subject LIKE ?";
      params.push(`%${subject}%`);
    }
    if (city) {
      sql += " AND city LIKE ?";
      params.push(`%${city}%`);
    }
    if (priceMin) {
      sql += " AND hourly_rate >= ?";
      params.push(priceMin);
    }
    if (priceMax) {
      sql += " AND hourly_rate <= ?";
      params.push(priceMax);
    }
    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }

    sql += " ORDER BY tutor_id DESC LIMIT 10 OFFSET ?";
    params.push((page - 1) * 10);

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("❌ Tutors list error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error: " + err.message });
  }
});

/**
 * ============================================================
 * ⚙️ 3. GIA SƯ – Lấy danh sách học viên có tọa độ (để hiển thị map)
 * ============================================================
 */
router.get("/students", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT student_id, full_name, avatar, city, lat, lng
      FROM students
      WHERE lat IS NOT NULL AND lng IS NOT NULL
      ORDER BY student_id DESC
      LIMIT 50
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("❌ Students list error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error: " + err.message });
  }
});

/**
 * ============================================================
 * ⚙️ 4. Lấy chi tiết hồ sơ gia sư
 * ============================================================
 */
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM tutors WHERE tutor_id=?", [
      req.params.id,
    ]);
    if (!rows.length)
      return res.status(404).json({ message: "Tutor not found" });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("❌ Get tutor detail error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error: " + err.message });
  }
});

/**
 * ============================================================
 * ⚙️ 5. GỬI CV – Gia sư tạo hồ sơ chờ duyệt
 * ============================================================
 */
router.post("/submit-cv", verifyToken, async (req, res) => {
  try {
    const {
      full_name,
      birth_date,
      avatar,
      cccd_front,
      cccd_back,
      certificates,
      bio,
      education_level,
      major,
      university,
      experience,
    } = req.body;

    if (!full_name || !avatar) {
      return res.status(400).json({
        success: false,
        message: "⚠️ Vui lòng điền đầy đủ thông tin!",
      });
    }

    const user_id = req.user?.user_id || req.user?.id;
    const [exists] = await pool.query(
      "SELECT tutor_id FROM tutors WHERE user_id=?",
      [user_id]
    );

    if (exists.length) {
      await pool.query(
        `UPDATE tutors SET full_name=?, birth_date=?, avatar=?, cccd_front=?, cccd_back=?,
         certificates=?, bio=?, education_level=?, major=?, university=?, experience=?, 
         status='PENDING', created_at=NOW() WHERE user_id=?`,
        [
          full_name,
          birth_date,
          avatar,
          cccd_front,
          cccd_back,
          JSON.stringify(certificates || []),
          bio,
          education_level,
          major,
          university,
          experience,
          user_id,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO tutors 
        (user_id, full_name, birth_date, avatar, cccd_front, cccd_back, certificates, bio,
         education_level, major, university, experience, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW())`,
        [
          user_id,
          full_name,
          birth_date,
          avatar,
          cccd_front,
          cccd_back,
          JSON.stringify(certificates || []),
          bio,
          education_level,
          major,
          university,
          experience,
        ]
      );
    }

    res.json({
      success: true,
      message: "✅ Hồ sơ đã được gửi – vui lòng chờ admin duyệt!",
    });
  } catch (err) {
    console.error("❌ Submit CV error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error: " + err.message });
  }
});

export default router;
