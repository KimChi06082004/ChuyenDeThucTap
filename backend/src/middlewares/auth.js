// src/middlewares/auth.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

// ===== Token Helpers =====
export const signAccess = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || "30m",
  });

export const signRefresh = (payload) =>
  jwt.sign(payload, process.env.REFRESH_SECRET, {
    expiresIn: process.env.REFRESH_EXPIRES || "7d",
  });

export const signTokens = (payload) => ({
  accessToken: signAccess(payload),
  refreshToken: signRefresh(payload),
});

// ===== Middleware: Verify Token =====
export const verifyToken = (req, res, next) => {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.substring(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "No token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { user_id, role, full_name }
    next();
  } catch (e) {
    console.error("JWT error:", e.message);
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// ===== Middleware: Require Role(s) =====
export const requireRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden: insufficient role" });
    }

    next();
  };
};
