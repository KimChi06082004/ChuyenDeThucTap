import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

/**
 * ========== TOKEN HELPERS ==========
 * Sinh accessToken / refreshToken & tiện ích tạo cả 2 cùng lúc.
 */
export const signAccess = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || "30m", // Access Token sống 30 phút
  });

export const signRefresh = (payload) =>
  jwt.sign(payload, process.env.REFRESH_SECRET, {
    expiresIn: process.env.REFRESH_EXPIRES || "7d", // Refresh Token sống 7 ngày
  });

export const signTokens = (payload) => ({
  accessToken: signAccess(payload),
  refreshToken: signRefresh(payload),
});

/**
 * ========== VERIFY TOKEN ==========
 * Middleware xác minh token, giải mã và gắn vào req.user
 */
export const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "❌ Thiếu token xác thực" });
    }

    // Giải mã token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Gắn thông tin người dùng vào request
    req.user = {
      id: decoded.user_id || decoded.id,
      role: decoded.role,
      full_name: decoded.full_name,
    };

    next();
  } catch (error) {
    console.error("JWT verify error:", error.message);
    return res
      .status(401)
      .json({
        success: false,
        message: "❌ Token không hợp lệ hoặc đã hết hạn",
      });
  }
};

/**
 * ========== ROLE-BASED AUTH ==========
 * Kiểm tra quyền truy cập theo vai trò (role)
 * Ví dụ: requireRole(['admin', 'cskh'])
 */
export const requireRole = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "❌ Không có quyền truy cập" });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `🚫 Quyền hạn không đủ (yêu cầu: ${roles.join(", ")})`,
      });
    }

    next();
  };
};
