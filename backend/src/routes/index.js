import { Router } from "express";
import auth from "./auth.js";
import users from "./users.js";
import tutors from "./tutors.js";
import classes from "./classes.js";
import sessions from "./sessions.js";
import attendance from "./attendance.js";
import orders from "./orders.js";
import payments from "./payments.js";
import payouts from "./payouts.js";
import complaints from "./complaints.js";
import referrals from "./referrals.js";
import notifications from "./notifications.js";
import ratings from "./ratings.js";

const router = Router();

router.use("/auth", auth);
router.use("/users", users);
router.use("/tutors", tutors);
router.use("/classes", classes);
router.use("/sessions", sessions);
router.use("/attendance", attendance);
router.use("/orders", orders);
router.use("/payments", payments);
router.use("/payouts", payouts);
router.use("/complaints", complaints);
router.use("/referrals", referrals);
router.use("/notifications", notifications);
router.use("/ratings", ratings);

export default router;
