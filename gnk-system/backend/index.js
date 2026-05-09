require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');

const app = express();

// إعدادات Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 🚀 إعداد اتصال الداتا بيز MySQL (cPanel)
// ==========================================
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// تحويل الـ Pool لنظام الـ Promises عشان نستخدم async/await
const promisePool = pool.promise();

// اختبار الاتصال فور تشغيل السيرفر
promisePool.query('SELECT 1 + 1 AS solution')
  .then(() => {
    console.log('✅ Connected to cPanel MySQL Database successfully!');
  })
  .catch(err => {
    console.error('❌ Database connection error:', err.message);
  });

// جعل الـ pool متاحاً في كل الـ Routes (مهم جداً)
app.locals.pool = promisePool;

// ==========================================
// 🔗 ربط ملفات الـ Routes (المسارات)
// ==========================================

// 1. مسار المصادقة (الذي عدلناه للإيميل والـ OTP)
const authRoutes = require('./authRoutes');
app.use('/api/auth', authRoutes);

// 2. مسارات العمليات (تأكد أن أسماء الملفات صحيحة في الفولدر عندك)
// لو عندك ملفات تانية للمدفوعات والمقبوضات، شيل علامات الـ // من السطور اللي جاية:

/*
const paymentRoutes = require('./paymentRoutes');
const receivingRoutes = require('./receivingRoutes');
app.use('/api/payments', paymentRoutes);
app.use('/api/receivings', receivingRoutes);
*/

// ==========================================
// 🌐 تشغيل السيرفر
// ==========================================
app.get('/', (req, res) => {
  res.send('GNK Operations Backend is running on cPanel (MySQL Mode)');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is flying on port ${PORT}`);
});
