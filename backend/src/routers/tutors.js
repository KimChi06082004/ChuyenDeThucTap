const express = require("express");
const { getPool } = require("../config/db");
const router = express.Router();

// GET /api/tutors?subject=&city=&priceMin=&priceMax=&page=
router.get("/", async (req, res) => {
  try {
    const { subject, city, priceMin, priceMax, page = 1 } = req.query;
    const pool = getPool();

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

    sql += " LIMIT 10 OFFSET ?";
    params.push((page - 1) * 10);

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Tutors list error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/tutors/:id
router.get("/:id", async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query("SELECT * FROM tutors WHERE tutor_id=?", [
      req.params.id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Tutor not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
