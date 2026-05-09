const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const NodeCache = require('node-cache');
const crypto = require('crypto');

const otpCache = new NodeCache({ stdTTL: 300 });
const sessionCache = new NodeCache({ stdTTL: 30 * 24 * 60 * 60 });

// إعدادات جوجل المباشرة
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'abanoubhanna7@gmail.com',
    pass: 'حط_الباسورد_الـ16_حرف_هنا' // 👈 امسح الكلمة العربي دي وحط الباسورد الجديد بين علامتين التنصيص
  },
  tls: {
    rejectUnauthorized: false
  }
});

const PROJECT_MAP = {
  "byGanz": { accountant: "semon.fayek@gnk.group" },
  "Head Office": { accountant: "karim.salama@gnk.group" },
  "Buoy": { accountant: "mohamed.mohab@gnk.group" },
  "Studio Samara": { accountant: "romany.attia@gnk.group" },
  "Mazeej": { accountant: "mokhtar.mahmoud@gnk.group" },
  "KiKi's White": { accountant: "treasury@gnk.group" }
};

const MANAGER_EMAILS = [
  "kareem@gnk.group","ganz@byganz.com","marylise.michael@gnk.group",
  "imad.dargham@gnk.group","marize.george@gnk.group","marian.mounir@gnk.group",
  "sayed.awad@gnk.group","karim.salama@gnk.group","marylise.milad@gnk.group",
  "semon.fayek@gnk.group","treasury@gnk.group","islam.khaled@gnk.group",
  "galal@byganz.com","rady@byganz.com","marwan@byganz.com","engy@byganz.com",
  "mahmoud.elhakam@gnk.group","rafic.khairallah@mazeejhotels.com",
  "ahmed.amin@gnk.group"
];

const ADMIN_EDITORS = [
  "marian.Mounir@gnk.group","sayed.awad@gnk.group",
  "marylise.milad@gnk.group","karim.salama@gnk.group",
  "semon.Fayek@gnk.group","treasury@gnk.group"
];

function isAdmin(email) { return ADMIN_EDITORS.some(a => a.toLowerCase() === email.toLowerCase()); }
function isManager(email) { return isAdmin(email) || MANAGER_EMAILS.some(m => m.toLowerCase() === email.toLowerCase()); }
function isAccountant(email) {
  if (isAdmin(email)) return true;
  for (const p in PROJECT_MAP) {
    if ((PROJECT_MAP[p].accountant || "").toLowerCase() === email.toLowerCase()) return true;
  }
  return false;
}

router.post('/send-otp', async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase().trim();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email required' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpCache.set(`otp_${email}`, otp);
    otpCache.set(`attempts_${email}`, 0);

    const htmlBody = `
      <div style="font-family:Arial;padding:20px;border:1px solid #eee;border-radius:10px;max-width:500px">
        <h2 style="color:#2563eb">GNK Operations Login</h2>
        <p>Your verification code is:</p>
        <h1 style="background:#f1f5f9;padding:15px;letter-spacing:5px;text-align:center">${otp}</h1>
        <p style="color:#94a3b8;font-size:12px">Valid for 5 minutes. Do not share this code.</p>
      </div>
    `;

    await transporter.sendMail({
      from: '"GNK OPERATIONS" <system@gnk.group>',
      to: email,
      subject: 'GNK Access Code: ' + otp,
      html: htmlBody
    });

    res.json({ success: true });
  } catch (err) {
    console.error('OTP Send Error:', err);
    res.status(500).json({ success: false, error: 'Failed to send email', real_error: err.message });
  }
});

router.post('/verify-otp', (req, res) => {
  const email = req.body.email?.toLowerCase().trim();
  const code = req.body.code?.trim();

  let attempts = otpCache.get(`attempts_${email}`) || 0;
  if (attempts >= 5) return res.status(400).json({ success: false, error: 'Too many attempts. Request new code.' });

  const storedOtp = otpCache.get(`otp_${email}`);
  if (!storedOtp) return res.status(400).json({ success: false, error: 'Code expired. Request new code.' });

  if (storedOtp !== code) {
    otpCache.set(`attempts_${email}`, attempts + 1);
    return res.status(400).json({ success: false, error: `Wrong code. ${4 - attempts} attempts left.` });
  }

  otpCache.del(`otp_${email}`);
  otpCache.del(`attempts_${email}`);

  const sessionToken = crypto.randomBytes(16).toString('hex');
  sessionCache.set(`session_${sessionToken}`, email);

  const employeeName = email.split('@')[0].replace(/[._-]/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

  res.json({
    success: true,
    token: sessionToken,
    email: email,
    employeeName: employeeName,
    isAdmin: isAdmin(email),
    isManager: isManager(email),
    isAccountant: isAccountant(email)
  });
});

module.exports = router;const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const NodeCache = require('node-cache');
const crypto = require('crypto');

// كاش لحفظ الـ OTP لمدة 5 دقايق (300 ثانية)
const otpCache = new NodeCache({ stdTTL: 300 });
const sessionCache = new NodeCache({ stdTTL: 30 * 24 * 60 * 60 });

// إعدادات جوجل المباشرة (عشان نلغي مشكلة الـ env)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'abanoubhanna7@gmail.com', // 👈 حطينا الإيميل بإيدينا
    pass: 'kcefuvqhwfpupaka'         // 👈 حطينا الباسورد بإيدينا
  },
  tls: {
    rejectUnauthorized: false
  }
});

// مصفوفات الصلاحيات
const PROJECT_MAP = {
  "byGanz": { accountant: "semon.fayek@gnk.group" },
  "Head Office": { accountant: "karim.salama@gnk.group" },
  "Buoy": { accountant: "mohamed.mohab@gnk.group" },
  "Studio Samara": { accountant: "romany.attia@gnk.group" },
  "Mazeej": { accountant: "mokhtar.mahmoud@gnk.group" },
  "KiKi's White": { accountant: "treasury@gnk.group" }
};
const MANAGER_EMAILS = [
  "kareem@gnk.group","ganz@byganz.com","marylise.michael@gnk.group",
  "imad.dargham@gnk.group","marize.george@gnk.group","marian.mounir@gnk.group",
  "sayed.awad@gnk.group","karim.salama@gnk.group","marylise.milad@gnk.group",
  "semon.fayek@gnk.group","treasury@gnk.group","islam.khaled@gnk.group",
  "galal@byganz.com","rady@byganz.com","marwan@byganz.com","engy@byganz.com",
  "mahmoud.elhakam@gnk.group","rafic.khairallah@mazeejhotels.com",
  "ahmed.amin@gnk.group"
];
const ADMIN_EDITORS = [
  "marian.Mounir@gnk.group","sayed.awad@gnk.group",
  "marylise.milad@gnk.group","karim.salama@gnk.group",
  "semon.Fayek@gnk.group","treasury@gnk.group"
];

function isAdmin(email) { return ADMIN_EDITORS.some(a => a.toLowerCase() === email.toLowerCase()); }
function isManager(email) { return isAdmin(email) || MANAGER_EMAILS.some(m => m.toLowerCase() === email.toLowerCase()); }
function isAccountant(email) {
  if (isAdmin(email)) return true;
  for (const p in PROJECT_MAP) {
    if ((PROJECT_MAP[p].accountant || "").toLowerCase() === email.toLowerCase()) return true;
  }
  return false;
}

// 1. إرسال الكود
router.post('/send-otp', async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase().trim();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email required' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpCache.set(`otp_${email}`, otp);
    otpCache.set(`attempts_${email}`, 0);

    const htmlBody = `
      <div style="font-family:Arial;padding:20px;border:1px solid #eee;border-radius:10px;max-width:500px">
        <h2 style="color:#2563eb">GNK Operations Login</h2>
        <p>Your verification code is:</p>
        <h1 style="background:#f1f5f9;padding:15px;letter-spacing:5px;text-align:center">${otp}</h1>
        <p style="color:#94a3b8;font-size:12px">Valid for 5 minutes. Do not share this code.</p>
      </div>
    `;

    await transporter.sendMail({
      from: '"GNK OPERATIONS" <system@gnk.group>',
      to: email,
      subject: 'GNK Access Code: ' + otp,
      html: htmlBody
    });

    res.json({ success: true });
  } catch (err) {
    console.error('OTP Send Error:', err);
    res.status(500).json({ success: false, error: 'Failed to send email', real_error: err.message });
  }
});

// 2. التحقق من الكود وإرسال الصلاحيات
router.post('/verify-otp', (req, res) => {
  const email = req.body.email?.toLowerCase().trim();
  const code = req.body.code?.trim();

  let attempts = otpCache.get(`attempts_${email}`) || 0;
  if (attempts >= 5) return res.status(400).json({ success: false, error: 'Too many attempts. Request new code.' });

  const storedOtp = otpCache.get(`otp_${email}`);
  if (!storedOtp) return res.status(400).json({ success: false, error: 'Code expired. Request new code.' });

  if (storedOtp !== code) {
    otpCache.set(`attempts_${email}`, attempts + 1);
    return res.status(400).json({ success: false, error: `Wrong code. ${4 - attempts} attempts left.` });
  }

  otpCache.del(`otp_${email}`);
  otpCache.del(`attempts_${email}`);

  const sessionToken = crypto.randomBytes(16).toString('hex');
  sessionCache.set(`session_${sessionToken}`, email);

  const employeeName = email.split('@')[0].replace(/[._-]/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

  res.json({
    success: true,
    token: sessionToken,
    email: email,
    employeeName: employeeName,
    isAdmin: isAdmin(email),
    isManager: isManager(email),
    isAccountant: isAccountant(email)
  });
});

module.exports = router;
