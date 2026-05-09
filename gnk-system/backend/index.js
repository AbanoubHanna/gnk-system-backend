require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// تفعيل قراءة ملفات الـ PDF والمرفقات عشان تظهر في الفرونت إند
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/pdfs', express.static(path.join(__dirname, 'uploads/pdfs')));

// اتصال الداتا بيز
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const promisePool = pool.promise();
promisePool.query('SELECT 1 + 1 AS solution')
  .then(() => console.log('✅ Connected to cPanel MySQL!'))
  .catch(err => console.error('❌ DB Error:', err.message));

app.locals.pool = promisePool;

// ربط كل مسارات السيستم
const authRoutes = require('./authRoutes');
const paymentRoutes = require('./paymentRoutes');
const receivingRoutes = require('./receivingRoutes');
const uploadRoutes = require('./uploadRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/receivings', receivingRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/', (req, res) => res.send('GNK API is Running! 🚀'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server flying on port ${PORT}`));
