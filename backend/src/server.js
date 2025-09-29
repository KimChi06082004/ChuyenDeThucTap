// src/server.js
import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import tutorRoutes from "./routes/tutors.js";
import classRoutes from "./routes/classes.js";
import sessionRoutes from "./routes/sessions.js";
import attendanceRoutes from "./routes/attendance.js";
import orderRoutes from "./routes/orders.js";
import paymentRoutes from "./routes/payments.js";
import payoutRoutes from "./routes/payouts.js";
import complaintRoutes from "./routes/complaints.js";
import notificationRoutes from "./routes/notifications.js";
import ratingRoutes from "./routes/ratings.js";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ===== Routes =====
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tutors", tutorRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/payouts", payoutRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/ratings", ratingRoutes);
// Default route
app.get("/", (req, res) => {
  res.send("🚀 Website Dạy Thêm API is running...");
});

// Start
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
