// src/routes/users.js
import express from "express";
import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

/**
 * GET /api/users
 * Admin: lấy danh sách tất cả users
 */
router.get("/", verifyToken, requireRole(["admin"]), async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT user_id, full_name, email, role, referral_code, created_at FROM users"
    );
    res.json(rows);
  } catch (err) {
    console.error("Users list error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * GET /api/users/:id
 * Admin hoặc chính chủ user_id
 */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.user_id != req.params.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const [rows] = await pool.query(
      "SELECT user_id, full_name, email, role, referral_code, created_at FROM users WHERE user_id=?",
      [req.params.id]
    );
    if (!rows.length)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.json(rows[0]);
  } catch (err) {
    console.error("User detail error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * PUT /api/users/:id
 * Admin hoặc chính chủ update profile
 */
router.put("/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.user_id != req.params.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const { full_name, password } = req.body;
    const fields = [];
    const params = [];

    if (full_name) {
      fields.push("full_name=?");
      params.push(full_name);
    }

    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      fields.push("password=?");
      params.push(hashed);
    }

    if (!fields.length) {
      return res
        .status(400)
        .json({ success: false, message: "No data to update" });
    }

    params.push(req.params.id);
    await pool.query(
      `UPDATE users SET ${fields.join(", ")} WHERE user_id=?`,
      params
    );

    res.json({ success: true, message: "User updated successfully" });
  } catch (err) {
    console.error("User update error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * PATCH /api/users/:id/role
 * Admin thay đổi role (student/tutor/admin)
 */
router.patch(
  "/:id/role",
  verifyToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const { role } = req.body;
      if (!["student", "tutor", "admin"].includes(role)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid role" });
      }

      await pool.query("UPDATE users SET role=? WHERE user_id=?", [
        role,
        req.params.id,
      ]);
      res.json({ success: true, message: "Role updated successfully" });
    } catch (err) {
      console.error("Role update error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export default router;
