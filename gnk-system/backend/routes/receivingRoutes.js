// backend/routes/receivingRoutes.js
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

// 1. حفظ سند استلام العهدة
router.post('/submit', async (req, res) => {
  try {
    const data = req.body;
    
    // التأكد من وجود الأعمدة
    await pool.query(`ALTER TABLE receiving_vouchers ADD COLUMN IF NOT EXISTS pdf_link VARCHAR(255), ADD COLUMN IF NOT EXISTS attachments TEXT, ADD COLUMN IF NOT EXISTS items TEXT;`);

    const countRes = await pool.query('SELECT COUNT(*) FROM receiving_vouchers');
    const count = parseInt(countRes.rows[0].count) + 1;
    const rec_number = `REC-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    data.rec_number = rec_number;

    let total_amount = 0;
    if (data.items && Array.isArray(data.items)) {
      data.items.forEach(it => {
        const qty = parseFloat(it.qty) || 0;
        const price = parseFloat(it.price) || 0;
        const vat = Math.round(parseFloat(it.vat) || 0);
        const tax = Math.round(parseFloat(it.tax) || 0);
        const base = qty * price;
        total_amount += base + (base * vat / 100) - (base * tax / 100);
      });
    }

    const pdfUrl = await generateReceivingPDF(data);

    const query = `
      INSERT INTO receiving_vouchers 
      (rec_number, email, employee_name, supplier, project, type, total_amount, linked_request, pdf_link, attachments, items, timestamp) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    
    const values = [
      rec_number, 
      data.email?.toLowerCase().trim(), 
      data.employeeName, 
      data.supplier, 
      data.project, 
      data.type,
      total_amount, 
      data.paymentRequestId || 'NO', 
      pdfUrl, 
      (data.attachmentUrls || []).join(','), 
      JSON.stringify(data.items)
    ];

    await pool.query(query, values);

    // لو مربوط بطلب دفع، نحدث طلب الدفع كأنه "Pending Settlement" لو كان مغلق أو معتمد
    if (data.paymentRequestId) {
      await pool.query(
        "UPDATE payment_requests SET status = 'Pending Settlement' WHERE request_id = $1 AND status = 'Approved'", 
        [data.paymentRequestId]
      );
    }

    res.json({ success: true, recNumber: rec_number, pdfUrl: pdfUrl });
  } catch (error) {
    console.error('Error submitting receiving:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// 2. جلب الوصولات غير المربوطة (لعرضها في فورم الدفع)
router.get('/unlinked', async (req, res) => {
  try {
    const email = req.query.email?.toLowerCase().trim();
    if (!email) return res.json({ success: false, receivings: [] });

    const result = await pool.query(
      "SELECT rec_number, total_amount, project, supplier FROM receiving_vouchers WHERE LOWER(email) = $1 AND (linked_request IS NULL OR linked_request = '' OR linked_request = 'NO')",
      [email]
    );

    const receivings = result.rows.map(r => ({
      recNumber: r.rec_number,
      totalAmount: parseFloat(r.total_amount),
      project: r.project,
      supplier: r.supplier
    }));

    res.json({ success: true, receivings });
  } catch (error) {
    console.error('Error fetching unlinked receivings:', error);
    res.json({ success: false, receivings: [] });
  }
});

// 3. جلب طلبات الدفع المفتوحة (لعرضها في فورم الاستلام)
router.get('/open-requests', async (req, res) => {
  try {
    const email = req.query.email?.toLowerCase().trim();
    if (!email) return res.json({ success: false, requests: [] });

    // بنجيب الطلبات المعتمدة للموظف
    const result = await pool.query(
      "SELECT request_id, amount, currency FROM payment_requests WHERE LOWER(email) = $1 AND status IN ('Approved', 'Pending Settlement')",
      [email]
    );

    let requests = [];
    for (let row of result.rows) {
      const approvedAmount = parseFloat(row.amount);
      
      // بنحسب هو استهلك كام منها لحد دلوقتي
      const recResult = await pool.query(
        "SELECT SUM(total_amount) as used FROM receiving_vouchers WHERE linked_request LIKE $1",
        [`%${row.request_id}%`]
      );
      const usedAmount = parseFloat(recResult.rows[0].used) || 0;
      const remainingAmount = approvedAmount - usedAmount;

      if (remainingAmount > 0) {
        requests.push({
          requestId: row.request_id,
          currency: row.currency,
          remainingAmount: remainingAmount
        });
      }
    }

    res.json({ success: true, requests });
  } catch (error) {
    console.error('Error fetching open requests:', error);
    res.json({ success: false, requests: [] });
  }
});

module.exports = router;
