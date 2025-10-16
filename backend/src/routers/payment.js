const express = require("express");
const router = express.Router();

// ==============================
// Stub: Tạo URL thanh toán giả
// ==============================
router.post("/vnpay/create", (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "Thiếu orderId" });
  }

  // Tạo link mock
  const fakeUrl = `${process.env.VNP_URL}?vnp_TxnRef=${orderId}&vnp_Amount=100000`;

  res.json({
    message: "Tạo link thanh toán VNPay giả thành công",
    paymentUrl: fakeUrl,
  });
});

// ==============================
// Stub: Return URL (user quay về từ VNPay)
// ==============================
router.get("/vnpay/return", (req, res) => {
  const { vnp_TxnRef, vnp_ResponseCode } = req.query;

  if (vnp_ResponseCode === "00") {
    return res.json({
      message: "Thanh toán thành công (mock)",
      orderId: vnp_TxnRef,
      status: "PAID",
    });
  }

  res.json({
    message: "Thanh toán thất bại (mock)",
    orderId: vnp_TxnRef,
    status: "FAILED",
  });
});

// ==============================
// Stub: IPN (VNPay gọi server)
// ==============================
router.get("/vnpay/ipn", (req, res) => {
  const { vnp_TxnRef } = req.query;

  console.log("📥 Mock IPN nhận được cho order:", vnp_TxnRef);

  res.json({
    RspCode: "00",
    Message: "IPN xác nhận thành công (mock)",
    orderId: vnp_TxnRef,
  });
});

module.exports = router;
