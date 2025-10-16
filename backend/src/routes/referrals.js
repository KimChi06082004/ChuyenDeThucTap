// src/routes/referrals.js
import { Router } from "express";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";
import jwt from "jsonwebtoken";
const router = Router();

// GET /api/referrals/my-code
router.get("/my-code", verifyToken, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT referral_code FROM users WHERE user_id=?",
    [req.user.user_id]
  );
  const code = rows[0]?.referral_code;
  res.json({
    success: true,
    referral_code: code,
    referral_link: `${process.env.BASE_URL}/register?ref=${code}`,
  });
});

// GET /api/referrals/my-referrals
router.get("/my-referrals", verifyToken, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT r.referral_id, r.status, r.reward_amount, r.created_at, 
            u.user_id AS referred_id, u.full_name AS referred_name
     FROM referrals r 
     JOIN users u ON u.user_id = r.referred_id
     WHERE r.referrer_id=? ORDER BY r.created_at DESC`,
    [req.user.user_id]
  );
  res.json(rows);
});

// GET /api/referrals (admin)
router.get("/", verifyToken, requireRole(["admin"]), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT r.referral_id, r.status, r.reward_amount, r.created_at,
            u1.user_id AS referrer_id, u1.full_name AS referrer_name,
            u2.user_id AS referred_id, u2.full_name AS referred_name
     FROM referrals r
     JOIN users u1 ON u1.user_id=r.referrer_id
     JOIN users u2 ON u2.user_id=r.referred_id
     ORDER BY r.created_at DESC`
  );
  res.json(rows);
});

// PUT /api/referrals/:id (admin update status)
router.put("/:id", verifyToken, requireRole(["admin"]), async (req, res) => {
  const { status, reward_amount = 0 } = req.body || {};
  const allowed = ["PENDING", "SUCCESS", "FAILED"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status" });
  }

  await pool.query(
    "UPDATE referrals SET status=?, reward_amount=? WHERE referral_id=?",
    [status, reward_amount, req.params.id]
  );

  // AUTO NOTIFY khi SUCCESS
  if (status === "SUCCESS") {
    const [rr] = await pool.query(
      "SELECT referrer_id, referred_id FROM referrals WHERE referral_id=?",
      [req.params.id]
    );
    if (rr.length) {
      const reward = Number(reward_amount) || 0;

      // Notify người giới thiệu
      await pool.query(
        "INSERT INTO notifications(user_id, title, message, type) VALUES (?,?,?,?)",
        [
          rr[0].referrer_id,
          "Referral thành công 🎉",
          `Bạn được thưởng ${reward.toLocaleString()}đ`,
          "REFERRAL",
        ]
      );

      // Notify người được giới thiệu
      await pool.query(
        "INSERT INTO notifications(user_id, title, message, type) VALUES (?,?,?,?)",
        [
          rr[0].referred_id,
          "Ưu đãi referral",
          "Bạn được giảm giá/ưu đãi cho lớp đầu tiên",
          "REFERRAL",
        ]
      );
    }
  }
  res.json({ success: true, message: "Referral updated" });
});
router.post("/refresh", (req, res) => {
  try {
    const refreshToken = req.body.refreshToken;
    if (!refreshToken)
      return res.status(401).json({ message: "Thiếu refresh token" });

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    const newAccessToken = signAccess({
      user_id: decoded.user_id,
      full_name: decoded.full_name,
      role: decoded.role,
      email: decoded.email,
    });

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res
      .status(403)
      .json({ message: "Refresh token không hợp lệ hoặc hết hạn" });
  }
});
export default router;
