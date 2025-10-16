import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

/**
 * ========== TOKEN HELPERS ==========
 */
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

/**
 * ========== VERIFY TOKEN ==========
 */

export const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token)
      return res.status(401).json({
        success: false,
        message: "❌ Thiếu token xác thực",
      });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("🔐 Header nhận được:", authHeader);
    console.log("✅ Token decode:", decoded);

    req.user = {
      id: decoded.user_id || decoded.id,
      user_id: decoded.user_id || decoded.id,
      role: decoded.role,
      full_name: decoded.full_name || decoded.name,
    };

    next();
  } catch (error) {
    console.error("JWT verify error:", error.message);
    return res.status(401).json({
      success: false,
      message: "❌ Token không hợp lệ hoặc đã hết hạn",
    });
  }
};

/**
 * ========== ROLE-BASED AUTH ==========
 */
export const requireRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user)
      return res.status(401).json({
        success: false,
        message: "❌ Không có quyền truy cập (chưa xác thực)",
      });

    if (roles.length && !roles.includes(req.user.role))
      return res.status(403).json({
        success: false,
        message: `🚫 Quyền hạn không đủ (yêu cầu: ${roles.join(", ")})`,
      });

    next();
  };
};

// ✅ Giữ alias nếu code khác đang gọi requireRoles()
export const requireRoles = requireRole;
