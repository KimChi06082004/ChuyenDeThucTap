import express from "express";
import { pool } from "../config/db.js";
import { verifyToken } from "../middlewares/auth.js";

const router = express.Router();

/**
 * 🧩 [STUDENT] Gửi yêu cầu học đến gia sư
 * - Học viên gửi yêu cầu dạy cho gia sư (trạng thái mặc định: PENDING)
 * - Ngăn gửi trùng nếu đã có yêu cầu PENDING
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const { tutor_id, subject, message } = req.body;
    const student_id = req.user?.user_id;

    if (!tutor_id || !student_id)
      return res
        .status(400)
        .json({
          success: false,
          message: "Thiếu thông tin học viên hoặc gia sư.",
        });

    // 🔎 Kiểm tra trùng yêu cầu đang chờ
    const [exist] = await pool.query(
      "SELECT * FROM requests WHERE student_id=? AND tutor_id=? AND status='PENDING'",
      [student_id, tutor_id]
    );
    if (exist.length > 0)
      return res.json({
        success: false,
        message:
          "❗ Bạn đã gửi yêu cầu cho gia sư này rồi, vui lòng chờ phản hồi.",
      });

    // 📨 Tạo yêu cầu mới
    await pool.query(
      `INSERT INTO requests (student_id, tutor_id, subject, message)
       VALUES (?, ?, ?, ?)`,
      [student_id, tutor_id, subject || "", message || ""]
    );

    // 🛎️ (Tuỳ chọn) Gửi thông báo cho gia sư
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES (?, ?, ?, 'CLASS_UPDATE')`,
      [
        tutor_id,
        "Yêu cầu học mới",
        "Bạn vừa nhận được yêu cầu học từ một học viên. Vui lòng kiểm tra chi tiết trong trang quản lý.",
      ]
    );

    res.json({ success: true, message: "✅ Yêu cầu đã được gửi tới gia sư!" });
  } catch (err) {
    console.error("Send request error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * 🧩 [TUTOR] Xem danh sách yêu cầu nhận dạy
 * - Hiển thị các yêu cầu học viên gửi đến gia sư đang đăng nhập
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const tutor_id = req.user?.user_id;
    if (!tutor_id)
      return res
        .status(400)
        .json({ success: false, message: "Thiếu thông tin gia sư." });

    const [rows] = await pool.query(
      `SELECT r.*, u.full_name AS student_name, u.email, u.role
       FROM requests r
       JOIN users u ON r.student_id = u.user_id
       WHERE r.tutor_id=? ORDER BY r.created_at DESC`,
      [tutor_id]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Get requests error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * 🧩 [TUTOR] Chấp nhận / từ chối yêu cầu
 * - Cập nhật trạng thái yêu cầu: APPROVED hoặc REJECTED
 * - Chỉ được phép thao tác trên yêu cầu của chính mình
 */
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    const tutor_id = req.user?.user_id;
    const request_id = req.params.id;

    if (!["APPROVED", "REJECTED"].includes(status))
      return res
        .status(400)
        .json({ success: false, message: "Trạng thái không hợp lệ." });

    const [result] = await pool.query(
      "UPDATE requests SET status=? WHERE request_id=? AND tutor_id=?",
      [status, request_id, tutor_id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy yêu cầu hoặc bạn không có quyền cập nhật.",
      });

    // 🛎️ (Tuỳ chọn) Gửi thông báo cho học viên
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES (?, ?, ?, 'CLASS_UPDATE')`,
      [
        // tìm student_id của request vừa duyệt
        tutor_id,
        "Phản hồi yêu cầu học",
        status === "APPROVED"
          ? "Gia sư đã chấp nhận yêu cầu học của bạn."
          : "Gia sư đã từ chối yêu cầu học của bạn.",
      ]
    );

    res.json({
      success: true,
      message: `✅ Yêu cầu đã được ${
        status === "APPROVED" ? "chấp nhận" : "từ chối"
      }.`,
    });
  } catch (err) {
    console.error("Update request error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
