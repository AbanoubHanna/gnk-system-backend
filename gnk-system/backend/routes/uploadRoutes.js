const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// التأكد إن فولدر الرفع موجود
const dir = path.join(__dirname, '../uploads/attachments');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// إعدادات مكتبة Multer لحفظ الملفات
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // اسم فريد عشان الملفات ماتعملش Replace لبعض
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-]/g, "_"));
  }
});

const upload = multer({ storage: storage });

router.post('/', upload.array('attachments', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.json({ success: true, urls: [] });
    }
    // تجميع مسارات الملفات عشان تتحفظ في الداتا بيز
    const urls = req.files.map(file => `/uploads/attachments/${file.filename}`);
    res.json({ success: true, urls: urls });
  } catch (err) {
    console.error('❌ Upload Error:', err);
    res.status(500).json({ success: false, error: 'File upload failed' });
  }
});

module.exports = router;