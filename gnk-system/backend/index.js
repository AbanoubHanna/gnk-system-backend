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

// جعل مجلد المرفقات والـ PDF متاحاً للفرونت إند
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/pdfs', express.static(path.join(__dirname, 'uploads/pdfs')));

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

// تحويل الـ Pool لنظام الـ Promises
const promisePool = pool.promise();

promisePool.query('SELECT 1 + 1 AS solution')
  .then(() => console.log('✅ Connected to cPanel MySQL Database successfully!'))
  .catch(err => console.error('❌ Database connection error:', err.message));

app.locals.pool = promisePool;

// ==========================================
// 🔗 ربط ملفات الـ Routes (المسارات)
// ==========================================
const authRoutes = require('./authRoutes');
const paymentRoutes = require('./paymentRoutes');
const receivingRoutes = require('./receivingRoutes');
const uploadRoutes = require('./uploadRoutes');

// تفعيل كل المسارات (الآن الباك إند سيرد على كل طلبات الفرونت إند)
app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/receivings', receivingRoutes);
app.use('/api/upload', uploadRoutes);

// مسار تجريبي
app.get('/api', (req, res) => {
  res.send('GNK Operations API is Running! 🚀');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is flying on port ${PORT}`);
});
