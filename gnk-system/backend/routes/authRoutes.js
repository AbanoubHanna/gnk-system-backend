const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const NodeCache = require('node-cache');
const crypto = require('crypto');

// كاش لحفظ الـ OTP لمدة 5 دقايق (300 ثانية)
const otpCache = new NodeCache({ stdTTL: 300 });
// كاش لحفظ الجلسة (Session) لمدة 30 يوم
const sessionCache = new NodeCache({ stdTTL: 30 * 24 * 60 * 60 });

// إعدادات مرسل الإيميل (Nodemailer)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 1. مسار إرسال كود التحقق (Send OTP)
router.post('/send-otp', async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase().trim();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email required' });
    }

    // توليد كود من 6 أرقام
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // حفظ الكود وعدد المحاولات في الكاش
    otpCache.set(`otp_${email}`, otp);
    otpCache.set(`attempts_${email}`, 0);

    // قالب الإيميل اللي هيتبعت للموظف
    const mailOptions = {
      from: `"GNK Operations" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `GNK Verification Code: ${otp}`,
      html: `
        <div style='font-family:Arial;max-width:420px;margin:0 auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px;text-align:center;'>
          <h2 style='color:#1a1f2e;'>GNK Verification Code</h2>
          <p style='color:#64748b;'>Use this code to access the Operations System</p>
          <div style='font-family:Courier New;font-size:38px;font-weight:700;letter-spacing:10px;color:#2563eb;background:#eff6ff;padding:18px;border-radius:10px;margin:20px 0;'>
            ${otp}
          </div>
          <p style='color:#94a3b8;font-size:12px;'>Valid for 5 minutes.</p>
        </div>
      `
    };

  // await transporter.sendMail(mailOptions);
  console.log(`\n🔑 OTP for ${email} is: ===>  ${otp}  <===\n`);

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('❌ Error sending OTP:', error);
    res.status(500).json({ success: false, error: 'Failed to send OTP. Check email config.' });
  }
});

// 2. مسار التحقق من الكود (Verify OTP)
router.post('/verify-otp', (req, res) => {
  try {
    const email = req.body.email?.toLowerCase().trim();
    const code = req.body.code?.trim();

    let attempts = otpCache.get(`attempts_${email}`) || 0;

    // حماية ضد التخمين (Brute-force)
    if (attempts >= 5) {
      return res.status(400).json({ success: false, error: 'Too many attempts. Request new code.' });
    }

    const storedOtp = otpCache.get(`otp_${email}`);

    if (!storedOtp) {
      return res.status(400).json({ success: false, error: 'Code expired. Request new code.' });
    }

    if (storedOtp !== code) {
      otpCache.set(`attempts_${email}`, attempts + 1);
      return res.status(400).json({ success: false, error: `Wrong code. ${4 - attempts} attempts left.` });
    }

    // الكود صحيح: امسح الـ OTP من الكاش
    otpCache.del(`otp_${email}`);
    otpCache.del(`attempts_${email}`);

    // توليد Session Token قوي
    const sessionToken = crypto.randomBytes(16).toString('hex');
    sessionCache.set(`session_${sessionToken}`, email);

    // استخراج اسم الموظف من الإيميل (زي الكود القديم بتاعك)
    const employeeName = email.split('@')[0].replace(/[._-]/g, ' ').split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

    res.json({
      success: true,
      email: email,
      sessionToken: sessionToken,
      employeeName: employeeName
    });

  } catch (error) {
    console.error('❌ Error verifying OTP:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;