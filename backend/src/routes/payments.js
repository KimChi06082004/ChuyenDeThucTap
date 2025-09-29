// src/routes/payments.js
import express from "express";
import querystring from "qs";
import crypto from "crypto";
import dayjs from "dayjs";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

/**
 * GET /api/payments/create/:order_id
 * - Student gọi để tạo link thanh toán VNPay
 */
router.get(
  "/create/:order_id",
  verifyToken,
  requireRole(["student"]),
  async (req, res) => {
    try {
      const { order_id } = req.params;

      // Lấy thông tin đơn hàng
      const [rows] = await pool.query("SELECT * FROM orders WHERE order_id=?", [
        order_id,
      ]);
      if (!rows.length)
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });

      const order = rows[0];
      if (order.student_id !== req.user.user_id) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      // Tạo params VNPay
      const vnp_Params = {
        vnp_Version: "2.1.0",
        vnp_Command: "pay",
        vnp_TmnCode: process.env.VNPAY_TMNCODE,
        vnp_Locale: "vn",
        vnp_CurrCode: "VND",
        vnp_TxnRef: order.order_id.toString(),
        vnp_OrderInfo: `Thanh toan don hang #${order.order_id}`,
        vnp_OrderType: "other",
        vnp_Amount: order.amount * 100, // nhân 100
        vnp_ReturnUrl: process.env.VNPAY_RETURN_URL,
        vnp_IpAddr: req.ip,
        vnp_CreateDate: dayjs().format("YYYYMMDDHHmmss"),
      };

      // Sắp xếp params theo alphabet
      const sorted = Object.keys(vnp_Params)
        .sort()
        .reduce((acc, key) => {
          acc[key] = vnp_Params[key];
          return acc;
        }, {});

      const signData = querystring.stringify(sorted, { encode: false });
      const hmac = crypto.createHmac("sha512", process.env.VNPAY_HASHSECRET);
      const secureHash = hmac
        .update(Buffer.from(signData, "utf-8"))
        .digest("hex");

      const vnpUrl =
        process.env.VNPAY_URL +
        "?" +
        querystring.stringify(sorted, { encode: true }) +
        `&vnp_SecureHash=${secureHash}`;

      res.json({ success: true, paymentUrl: vnpUrl });
    } catch (err) {
      console.error("VNPay create error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/**
 * GET /api/payments/vnpay-return
 * - Callback từ VNPay
 */
router.get("/vnpay-return", async (req, res) => {
  try {
    const vnp_Params = { ...req.query };
    const secureHash = vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHashType;

    // Sắp xếp lại
    const sorted = Object.keys(vnp_Params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = vnp_Params[key];
        return acc;
      }, {});

    const signData = querystring.stringify(sorted, { encode: false });
    const hmac = crypto.createHmac("sha512", process.env.VNPAY_HASHSECRET);
    const checkHash = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    if (secureHash !== checkHash) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
    }

    const orderId = vnp_Params.vnp_TxnRef;
    const rspCode = vnp_Params.vnp_ResponseCode;

    if (rspCode === "00") {
      // Thanh toán thành công → cập nhật order + class
      await pool.query("UPDATE orders SET status='PAID' WHERE order_id=?", [
        orderId,
      ]);
      const [ord] = await pool.query(
        "SELECT class_id FROM orders WHERE order_id=?",
        [orderId]
      );
      if (ord.length) {
        await pool.query(
          "UPDATE classes SET status='IN_PROGRESS' WHERE class_id=?",
          [ord[0].class_id]
        );
      }

      return res.json({
        success: true,
        message: "Payment successful",
        order_id: orderId,
      });
    } else {
      await pool.query(
        "UPDATE orders SET status='CANCELLED' WHERE order_id=?",
        [orderId]
      );
      return res.json({
        success: false,
        message: "Payment failed",
        order_id: orderId,
      });
    }
  } catch (err) {
    console.error("VNPay return error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
