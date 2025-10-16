import bcrypt from "bcryptjs";
import { pool } from "./db.js";

export const seedData = async () => {
  const hashed = await bcrypt.hash("123456", 10);

  // Admin
  await pool.query(
    "INSERT IGNORE INTO users(user_id, full_name,email,password,role) VALUES(1,?,?,?,?)",
    ["Admin", "admin@example.com", hashed, "admin"]
  );

  // Student
  await pool.query(
    "INSERT IGNORE INTO users(user_id, full_name,email,password,role) VALUES(2,?,?,?,?)",
    ["Nguyen Van A", "student1@example.com", hashed, "student"]
  );

  // Tutor
  await pool.query(
    "INSERT IGNORE INTO users(user_id, full_name,email,password,role) VALUES(3,?,?,?,?)",
    ["Tran Thi B", "tutor1@example.com", hashed, "tutor"]
  );

  // Tutor profile
  await pool.query(
    "INSERT IGNORE INTO tutors(user_id, bio, experience, hourly_rate, city, subject) VALUES(?,?,?, ?, ?, ?)",
    [3, "Tốt nghiệp Sư phạm Toán", "3 năm dạy kèm", 150000, "Hà Nội", "Toán"]
  );

  console.log("✅ Seeder chạy thành công: Admin, Student, Tutor");
};
