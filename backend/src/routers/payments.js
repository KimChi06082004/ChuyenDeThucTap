const express = require("express");
const { getPool } = require("../config/db");
const router = express.Router();

/* ===========================
   Tạo URL thanh toán VNPay (mock)
   =========================== */
/* ===========================
   Tạo URL thanh toán VNPay (mock)
   =========================== */
router.post("/vnpay/create", async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ message: "Thiếu orderId" });

    const pool = getPool();
    const [orders] = await pool.query("SELECT * FROM orders WHERE order_id=?", [
      orderId,
    ]);
    if (!orders.length)
      return res.status(404).json({ message: "Order không tồn tại" });

    // Build full URL trực tiếp thay vì dùng biến env chưa set
    const fakeUrl = `http://localhost:8080/api/payments/vnpay/return?vnp_ResponseCode=00&orderId=${orderId}`;

    res.json({
      message: "Tạo link VNPay giả thành công",
      paymentUrl: fakeUrl,
    });
  } catch (err) {
    console.error("Create VNPay link error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   Return URL (client quay về sau thanh toán)
   =========================== */
router.get("/vnpay/return", async (req, res) => {
  try {
    const { orderId, vnp_ResponseCode } = req.query;
    if (!orderId) return res.status(400).json({ message: "Thiếu orderId" });

    const pool = getPool();

    if (vnp_ResponseCode === "00") {
      await pool.query(
        "UPDATE orders SET status='PAID', paid_at=NOW() WHERE order_id=?",
        [orderId]
      );

      // Kiểm tra toàn bộ orders của class
      const [[order]] = await pool.query(
        "SELECT * FROM orders WHERE order_id=?",
        [orderId]
      );
      const [allOrders] = await pool.query(
        "SELECT status FROM orders WHERE class_id=?",
        [order.class_id]
      );

      const allPaid = allOrders.every((o) => o.status === "PAID");
      if (allPaid) {
        await pool.query(
          "UPDATE classes SET status='IN_PROGRESS' WHERE class_id=?",
          [order.class_id]
        );
      }

      return res.json({
        message: "Thanh toán thành công (mock)",
        orderId,
        status: "PAID",
      });
    }

    res.json({
      message: "Thanh toán thất bại (mock)",
      orderId,
      status: "FAILED",
    });
  } catch (err) {
    console.error("VNPay return error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ===========================
   IPN (VNPay gọi server → mock)
   =========================== */
router.get("/vnpay/ipn", async (req, res) => {
  try {
    const { orderId } = req.query;
    if (!orderId) return res.status(400).json({ message: "Thiếu orderId" });

    const pool = getPool();
    await pool.query(
      "UPDATE orders SET status='PAID', paid_at=NOW() WHERE order_id=?",
      [orderId]
    );

    // Kiểm tra toàn bộ orders
    const [[order]] = await pool.query(
      "SELECT * FROM orders WHERE order_id=?",
      [orderId]
    );
    const [allOrders] = await pool.query(
      "SELECT status FROM orders WHERE class_id=?",
      [order.class_id]
    );

    const allPaid = allOrders.every((o) => o.status === "PAID");
    if (allPaid) {
      await pool.query(
        "UPDATE classes SET status='IN_PROGRESS' WHERE class_id=?",
        [order.class_id]
      );
    }

    res.json({
      RspCode: "00",
      Message: "IPN xác nhận thành công (mock)",
      orderId,
    });
  } catch (err) {
    console.error("VNPay IPN error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
