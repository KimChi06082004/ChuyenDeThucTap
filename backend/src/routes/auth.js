import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

const router = express.Router();

/* =========================================================
   POST /api/auth/register
========================================================= */
router.post("/register", async (req, res) => {
  try {
    const { full_name, email, password, role } = req.body;

    if (!full_name || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu thông tin bắt buộc" });
    }

    const [dup] = await pool.query(
      "SELECT user_id FROM users WHERE email = ?",
      [email]
    );
    if (dup.length)
      return res
        .status(400)
        .json({ success: false, message: "Email đã tồn tại" });

    const hashed = await bcrypt.hash(password, 10);
    const referralCode =
      "REF" + Math.random().toString(36).substring(2, 8).toUpperCase();

    const [rs] = await pool.query(
      "INSERT INTO users (full_name, email, password, role, referral_code) VALUES (?, ?, ?, ?, ?)",
      [full_name, email, hashed, role || "student", referralCode]
    );

    res.status(201).json({
      success: true,
      message: "Đăng ký thành công",
      user: { user_id: rs.insertId, full_name, email, role: role || "student" },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =========================================================
   POST /api/auth/login
========================================================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (!rows.length)
      return res
        .status(401)
        .json({ success: false, message: "Sai email hoặc mật khẩu" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok)
      return res
        .status(401)
        .json({ success: false, message: "Sai email hoặc mật khẩu" });

    // ✅ Token có đầy đủ thông tin user để middleware nhận diện
    const accessToken = jwt.sign(
      {
        user_id: user.user_id,
        full_name: user.full_name,
        role: user.role,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "7d" }
    );

    const refreshToken = jwt.sign(
      {
        user_id: user.user_id,
        role: user.role,
      },
      process.env.REFRESH_SECRET,
      { expiresIn: process.env.REFRESH_EXPIRES || "14d" }
    );

    res.json({
      success: true,
      message: "Đăng nhập thành công",
      token: accessToken,
      refreshToken,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
