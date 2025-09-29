// src/routes/tutors.js
import express from "express";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

/**
 * GET /api/tutors
 * - Query params: ?subject, ?city, ?priceMin, ?priceMax, ?status
 */
router.get("/", async (req, res) => {
  try {
    const { subject, city, priceMin, priceMax, status, page = 1 } = req.query;
    let sql = "SELECT * FROM tutors WHERE 1=1";
    const params = [];

    if (subject) {
      sql += " AND subject LIKE ?";
      params.push(`%${decodeURIComponent(subject)}%`);
    }
    if (city) {
      sql += " AND city LIKE ?";
      params.push(`%${decodeURIComponent(city)}%`);
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

    sql += " LIMIT 10 OFFSET ?";
    params.push((page - 1) * 10);

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Tutors list error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/tutors/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM tutors WHERE tutor_id=?", [
      req.params.id,
    ]);
    if (!rows.length)
      return res.status(404).json({ message: "Tutor not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * PUT /api/tutors/:id/approve
 * - CSKH/Admin duyệt tutor (APPROVED / REJECTED)
 */
router.put(
  "/:id/approve",
  verifyToken,
  requireRole(["admin", "cskh"]),
  async (req, res) => {
    try {
      const { status } = req.body;
      if (!["APPROVED", "REJECTED"].includes(status)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid status" });
      }

      await pool.query("UPDATE tutors SET status=? WHERE tutor_id=?", [
        status,
        req.params.id,
      ]);
      res.json({ success: true, message: `Tutor ${status}` });
    } catch (err) {
      console.error("Tutor approve error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

export default router;
