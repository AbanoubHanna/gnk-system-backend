// backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const crypto = require('crypto');
const { sendEmailGNK, generatePaymentPDF } = require('../utils/systemEngine');

const pool = new Pool({
  host: process.env.DB_HOST || '34.185.145.100',
  database: process.env.DB_NAME || 'gnk_operations',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '##Gnk0315-BM87387##',
  port: 5432,
});

// خريطة المشاريع للـ L2 (منقولة من جوجل)
const PROJECT_MAP = {
  "byGanz":        { accountant: "semon.fayek@gnk.group",     owner: "abdelaziz@byganz.com" },
  "Head Office":   { accountant: "karim.salama@gnk.group",    owner: "kareem@gnk.group" },
  "Buoy":          { accountant: "mohamed.mohab@gnk.group",   owner: "kareem@gnk.group" },
  "Studio Samara": { accountant: "romany.attia@gnk.group",    owner: "kareem@gnk.group" },
  "Mazeej":        { accountant: "mokhtar.mahmoud@gnk.group", owner: "kareem@gnk.group" },
  "KiKi's White":  { accountant: "treasury@gnk.group",        owner: "treasury@gnk.group" }
};

// توليد رقم فريد للاعتمادات
const generateRID = () => crypto.randomBytes(8).toString('hex');

// 1. إنشاء طلب الدفع
router.post('/submit', async (req, res) => {
  try {
    const data = req.body;
    
    // التأكد من الجداول
    await pool.query(`ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS stamp_l1 TEXT, ADD COLUMN IF NOT EXISTS stamp_l2 TEXT, ADD COLUMN IF NOT EXISTS rid_l1 TEXT, ADD COLUMN IF NOT EXISTS rid_l2 TEXT;`);

    const countRes = await pool.query('SELECT COUNT(*) FROM payment_requests');
    const count = parseInt(countRes.rows[0].count) + 1;
    const request_id = `PR-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

    const amount = parseFloat(data.amount) || 0;
    const currency = data.currency || 'L.E';
    
    // تحديد شروط الـ L2
    const isForeign = (currency !== "L.E");
    const needsL2 = !isForeign && (amount > 10000);
    const pData = PROJECT_MAP[data.project] || { accountant: '', owner: '' };
    const l2_email = needsL2 ? ((amount <= 150000 && pData.accountant) ? pData.accountant : pData.owner) : "";
    const l2_label = (amount <= 150000) ? "Project Accountant" : "Project Owner";

    // منطق الموافقة الذاتية (Self Approval)
    const isSelfApproval = (data.email.toLowerCase().trim() === data.managerEmail.toLowerCase().trim());
    
    let status = "Pending Approval";
    let stamp_l1 = "";
    let rid_l1 = generateRID();
    let rid_l2 = needsL2 ? generateRID() : "";
    
    if (isSelfApproval) {
      stamp_l1 = `✅ AUTO-APPROVED (Self) | ${data.email} | Date: ${new Date().toLocaleString('en-GB')}`;
      status = needsL2 ? "Pending L2 Approval" : "Approved";
    }

    const query = `
      INSERT INTO payment_requests 
      (request_id, email, name, project, department, description, amount, currency, due_date, manager_email, payment_terms, attachment_urls, status, rid_l1, rid_l2, stamp_l1, timestamp) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    
    const values = [
      request_id, data.email.toLowerCase().trim(), data.requestedBy, data.project, data.department, 
      data.purpose || '', amount, currency, data.dueDate, data.managerEmail, 
      data.paymentTerms, (data.attachmentUrls || []).join(','), status, rid_l1, rid_l2, stamp_l1
    ];

    const result = await pool.query(query, values);
    const savedData = result.rows[0];

    // تجميع البيانات للـ PDF
    savedData.needs_l2 = needsL2;
    savedData.l2_email = l2_email;
    savedData.l2_label = l2_label;
    
    const pdfUrl = await generatePaymentPDF(savedData);
    await pool.query(`UPDATE payment_requests SET pdf_url = $1 WHERE request_id = $2`, [pdfUrl, request_id]);

    // إرسال الإيميلات
    if (!isSelfApproval) {
        // إرسال للمدير L1
        await sendEmailGNK(data.managerEmail, `Payment Approval Request - ${request_id}`, `Please review request ${request_id} in the system.`);
    } else if (isSelfApproval && needsL2 && l2_email) {
        // إرسال للـ L2 مباشرة
        await sendEmailGNK(l2_email, `L2 Approval Required - ${request_id}`, `Please review L2 request ${request_id} in the system.`);
    }

    // إرسال تأكيد للموظف
    await sendEmailGNK(data.email, `Request Submitted - ${request_id}`, `Your request ${request_id} has been submitted.`);

    res.json({ success: true, requestId: request_id, pdfUrl: pdfUrl });
  } catch (error) {
    console.error('❌ Error submitting payment:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// 2. التنفيذ المحاسبي
router.post('/accountant/execute', async (req, res) => {
  try {
    const { requestId, paymentMethod, amountPaid, paymentRef } = req.body;
    const datePaid = new Date().toLocaleString('en-GB'); 

    // الحماية الصارمة زي ما طلبت من جوجل
    const check = await pool.query("SELECT amount FROM payment_requests WHERE request_id = $1", [requestId]);
    if (check.rows.length === 0) return res.json({success:false, error: "Request not found"});
    const approvedAmount = parseFloat(check.rows[0].amount) || 0;
    if (parseFloat(amountPaid) > approvedAmount + 0.01) {
      return res.json({ success: false, error: `❌ BLOCKED: Cannot pay ${amountPaid} — Approved amount is ${approvedAmount}` });
    }

    await pool.query(
      "UPDATE payment_requests SET payment_method = $1, amount_paid = $2, payment_ref = $3, date_paid = $4 WHERE request_id = $5 RETURNING *",
      [paymentMethod, amountPaid, paymentRef, datePaid, requestId]
    );

    // تحديث الـ PDF بعد الدفع
    const updatedRow = (await pool.query("SELECT * FROM payment_requests WHERE request_id = $1", [requestId])).rows[0];
    const pdfUrl = await generatePaymentPDF(updatedRow);
    await pool.query("UPDATE payment_requests SET pdf_url = $1 WHERE request_id = $2", [pdfUrl, requestId]);

    res.json({ success: true, datePaid, pdfUrl });
  } catch (error) {
    console.error('Error executing payment:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

module.exports = router;
