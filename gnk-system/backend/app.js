require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();

// الحل السحري لمشكلة CORS
app.use(cors({
    origin: '*' // هيقبل الطلبات من أي بورت وإحنا شغالين
}));

app.use(express.json({ limit: '10mb' }));

// إتاحة فولدر الملفات والـ PDFs للواجهة الأمامية
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/pdfs', express.static(path.join(__dirname, 'uploads/pdfs')));

// Routes
const paymentRoutes = require('./routes/paymentRoutes');
const receivingRoutes = require('./routes/receivingRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const authRoutes = require('./routes/authRoutes');

// 👇 حطينا النسختين عشان نضمن إن الطلب هيتمسَك في كل الحالات
app.use('/api/payments', paymentRoutes);
app.use('/payments', paymentRoutes);

app.use('/api/receivings', receivingRoutes);
app.use('/receivings', receivingRoutes);

app.use('/api/upload', uploadRoutes);
app.use('/upload', uploadRoutes);

app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

// Database Connection Pool
const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: 5432,
  ssl: {
    rejectUnauthorized: false // السطر ده هو السحر اللي هيخلي جوجل تقبل الاتصال
  }
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to PostgreSQL:', err.stack);
  } else {
    console.log('✅ Successfully connected to Cloud SQL (PostgreSQL)');
  }
  if (release) release();
});

// 👇 مسار التيست بالنسختين
app.get('/api/test', (req, res) => res.json({ success: true, message: 'GNK Backend is running smoothly! 🚀' }));
app.get('/test', (req, res) => res.json({ success: true, message: 'GNK Backend is running smoothly! 🚀' }));

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
