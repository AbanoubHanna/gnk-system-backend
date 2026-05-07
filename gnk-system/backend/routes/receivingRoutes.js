const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { generateReceivingPDF } = require('../utils/systemEngine');

const pool = new Pool({
  host: process.env.DB_HOST || '34.185.145.100',
  database: process.env.DB_NAME || 'gnk_operations',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '##Gnk0315-BM87387##',
  port: 5432,
});

router.post('/submit', async (req, res) => {
  try {
    const data = req.body;
    
    // إنشاء الأعمدة لو مش موجودة في قاعدة البيانات
    await pool.query(`ALTER TABLE receiving_vouchers ADD COLUMN IF NOT EXISTS pdf_link VARCHAR(255), ADD COLUMN IF NOT EXISTS attachments TEXT, ADD COLUMN IF NOT EXISTS items TEXT;`);

    // توليد رقم الـ REC
    const countRes = await pool.query('SELECT COUNT(*) FROM receiving_vouchers');
    const count = parseInt(countRes.rows[0].count) + 1;
    const rec_number = `REC-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    data.rec_number = rec_number;

    // حساب التوتال
    let total_amount = 0;
    if (data.items) {
      data.items.forEach(it => {
        const base = (parseFloat(it.qty) || 0) * (parseFloat(it.price) || 0);
        total_amount += base + (base * (parseFloat(it.vat) || 0) / 100) - (base * (parseFloat(it.tax) || 0) / 100);
      });
    }

    // توليد الـ PDF
    const pdfUrl = await generateReceivingPDF(data);

    // الحفظ في الداتا بيز
    const query = `
      INSERT INTO receiving_vouchers 
      (rec_number, email, employee_name, supplier, project, type, total_amount, linked_request, pdf_link, attachments, items, timestamp) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
    `;
    
    const values = [
      rec_number, 
      data.email?.toLowerCase().trim(), 
      data.employeeName, 
      data.supplier, 
      data.project, 
      data.type,
      total_amount, 
      data.paymentRequestId || '', 
      pdfUrl || '',
      JSON.stringify(data.attachments || []), 
      JSON.stringify(data.items || [])
    ];

    await pool.query(query, values);
    
    res.json({ success: true, recNumber: rec_number, pdfUrl });
  } catch (error) {
    console.error('❌ Receiving Error:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

module.exports = router;