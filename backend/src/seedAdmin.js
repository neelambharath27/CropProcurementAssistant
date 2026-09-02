import dotenv from "dotenv";
dotenv.config();
import db from "./db.js";
import { hashPassword } from "./auth.js";

const name = process.env.ADMIN_NAME || "System Admin";
const email = (process.env.ADMIN_EMAIL || "admin@smartprocure.local").toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 12) throw new Error("Set ADMIN_PASSWORD to at least 12 characters in backend/.env before seeding an admin.");
const existing = db.prepare("SELECT user_id FROM users WHERE email=?").get(email);
if (existing) { console.log("Admin already exists."); process.exit(0); }
const hash = await hashPassword(password);
const result = db.prepare("INSERT INTO users(name,mobile,email,password_hash,role) VALUES(?,?,?,?, 'ADMIN')").run(name,"9999999999",email,hash);
const admin = db.prepare("SELECT * FROM admins WHERE email=?").get(email);
if (admin) db.prepare("UPDATE admins SET user_id=? WHERE admin_id=?").run(result.lastInsertRowid,admin.admin_id);
else db.prepare("INSERT INTO admins(name,email,user_id) VALUES(?,?,?)").run(name,email,result.lastInsertRowid);
console.log(`Admin created: ${email}`);
