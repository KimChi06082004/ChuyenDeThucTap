const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getPool } = require("../config/db");

const router = express.Router();

/* ========== Middleware xác thực JWT ========== */
function authMiddleware(req, res, next) {
  try {
    const raw = req.headers["authorization"];
    if (!raw) return res.status(401).json({ message: "No token provided" });

    // Nếu có nhiều header hoặc có xuống dòng, tách & lấy cái cuối cùng bắt đầu bằng Bearer
    const candidate = raw
      .split(",") // đề phòng có 2 header Authorization gộp
      .map((s) => s.trim())
      .reverse()
      .find((s) => /^Bearer\s+/i.test(s));

    if (!candidate) return res.status(401).json({ message: "No bearer token" });

    const token = candidate.replace(/^Bearer\s+/i, "").trim(); // loại bỏ 'Bearer ' và trim \n, spaces

    jwt.verify(token, process.env.JWT_SECRET || "secretkey", (err, decoded) => {
      if (err) {
        console.error("JWT verify error:", err.message);
        return res.status(403).json({ message: "Invalid token" });
      }
      req.user = decoded; // { id, role }
      next();
    });
  } catch (e) {
    console.error("Auth middleware error:", e);
    return res.status(403).json({ message: "Invalid token" });
  }
}

/* ========== API: Đăng ký ========== */
router.post("/register", async (req, res) => {
  try {
    const { full_name, email, password, role } = req.body;
    const pool = getPool();

    // Kiểm tra email trùng
    const [check] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (check.length > 0) {
      return res.status(400).json({ message: "Email đã tồn tại" });
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Thêm user
    await pool.query(
      "INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)",
      [full_name, email, hashedPassword, role || "student"]
    );

    res.json({ message: "Đăng ký thành công" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

/* ========== API: Đăng nhập ========== */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const pool = getPool();

    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (rows.length === 0) {
      return res.status(400).json({ message: "Sai email hoặc mật khẩu" });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Sai email hoặc mật khẩu" });
    }

    // Tạo token
    const token = jwt.sign(
      { id: user.user_id, role: user.role },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "1d" }
    );

    res.json({
      message: "Đăng nhập thành công",
      token,
      user: { id: user.user_id, full_name: user.full_name, role: user.role },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

/* ========== API: Lấy thông tin user từ token ========== */
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      "SELECT user_id, full_name, email, role FROM users WHERE user_id = ?",
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ message: "Lỗi server" });
  }
});

module.exports = { router, authMiddleware };
