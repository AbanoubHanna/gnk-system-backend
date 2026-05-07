const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { sendEmailGNK, generatePaymentPDF } = require('../utils/systemEngine');

// إعداد الاتصال بقاعدة البيانات
const pool = new Pool({
  host: process.env.DB_HOST || '34.185.145.100',
  database: process.env.DB_NAME || 'gnk_operations',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '##Gnk0315-BM87387##',
  port: 5432,
});

// 1. مسار حفظ طلب الدفع (Submit Payment)
router.post('/submit', async (req, res) => {
  try {
    const data = req.body;
    
    // إنشاء رقم الطلب التسلسلي (مثال: PR-2026-0001)
    const countRes = await pool.query('SELECT COUNT(*) FROM payment_requests');
    const count = parseInt(countRes.rows[0].count) + 1;
    const request_id = `PR-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

    const query = `
      INSERT INTO payment_requests 
      (request_id, email, name, project, department, description, amount, currency, due_date, manager_email, payment_terms, attachment_urls, status, timestamp) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Pending Approval', CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    
    const values = [
      request_id, 
      data.email?.toLowerCase().trim(), 
      data.requestedBy, 
      data.project, 
      data.department,
      data.purpose, 
      parseFloat(data.amount) || 0, 
      data.currency, 
      data.dueDate, 
      data.managerEmail?.toLowerCase().trim(),
      data.paymentTerms,
      JSON.stringify(data.attachmentUrls || [])
    ];

    await pool.query(query, values);
    res.json({ success: true, data: { request_id } });

  } catch (error) {
    console.error('❌ Error submitting payment:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// 2. مسار تحميل لوحة البيانات (Dashboard)
router.get('/dashboard', async (req, res) => {
  try {
    const email = req.query.email?.toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const paymentsRes = await pool.query('SELECT * FROM payment_requests WHERE LOWER(email) = $1 ORDER BY timestamp DESC', [email]);
    const payments = paymentsRes.rows;

    const receivingsRes = await pool.query('SELECT * FROM receiving_vouchers WHERE LOWER(email) = $1', [email]);
    const receivings = receivingsRes.rows;

    // اللوجيك المحاسبي
    let aggTotal = payments.length;
    let aggPendingApproval = 0, aggPendingVal = 0;
    let aggRejected = 0, aggRejectedVal = 0;
    let aggApproved = 0, aggApprovedVal = 0;
    let aggClosed = 0, aggClosedVal = 0;
    let aggSettlement = 0, aggSettlementVal = 0;
    let aggPaidTotal = 0;
    let aggReceivedTotal = 0;

    payments.forEach(r => {
      const amt = parseFloat(r.amount) || 0;
      const paid = parseFloat(r.amount_paid) || 0;
      const status = r.status || 'Pending Approval';

      if (status === "Pending Approval" || status === "Pending L2 Approval") {
        aggPendingApproval++; aggPendingVal += amt;
      } else if (status === "Rejected") {
        aggRejected++; aggRejectedVal += amt;
      } else if (status === "Approved") {
        aggApproved++; aggApprovedVal += amt; aggPaidTotal += paid;
      } else if (status === "Closed") {
        aggClosed++; aggApprovedVal += amt; aggClosedVal += amt; aggPaidTotal += paid;
      } else if (status === "Pending Settlement") {
        aggSettlement++; aggSettlementVal += amt; aggApprovedVal += amt; aggPaidTotal += paid;
      }
    });

    receivings.forEach(rv => {
      if (rv.linked_request && rv.linked_request !== "NO" && rv.linked_request.trim() !== "") {
        aggReceivedTotal += parseFloat(rv.total_amount) || 0;
      }
    });

    const financials = {
      total: aggTotal,
      pendingApproval: aggPendingApproval,
      pendingVal: aggPendingVal,
      rejected: aggRejected,
      rejectedVal: aggRejectedVal,
      approved: aggApproved,
      approvedVal: aggApprovedVal,
      closed: aggClosed,
      closedVal: aggClosedVal,
      settlement: aggSettlement,
      settlementVal: aggSettlementVal,
      paidTotal: aggPaidTotal,
      receivedTotal: aggReceivedTotal,
      outstanding: Math.max(0, aggApprovedVal - aggPaidTotal),
      refundVal: Math.max(0, aggPaidTotal - aggReceivedTotal)
    };

    const mappedPayments = payments.map(p => ({
      requestId: p.request_id,
      project: p.project,
      amount: p.amount,
      currency: p.currency,
      status: p.status || 'Pending Approval',
      dueDate: p.due_date,
      pdfUrl: p.pdf_url
    }));

    res.json({ success: true, payments: mappedPayments, receivings: receivings, financials: financials });

  } catch (error) {
    console.error('❌ Error fetching dashboard data:', error);
    res.status(500).json({ success: false, error: 'Failed to load dashboard' });
  }
});

// 3. جلب الطلبات المعلقة للمدير (Pending Approvals)
router.get('/manager/pending', async (req, res) => {
  try {
    const email = req.query.email?.toLowerCase().trim();
    const result = await pool.query(
      "SELECT * FROM payment_requests WHERE LOWER(manager_email) = $1 AND status = 'Pending Approval' ORDER BY timestamp ASC",
      [email]
    );
    res.json({ success: true, rows: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Database error' });
  }
});
  
// 4. تنفيذ قرار المدير (مع توليد الـ PDF وإرسال الإيميل)
router.post('/manager/action', async (req, res) => {
  try {
    const { requestId, action, reason, managerEmail } = req.body;
    const newStatus = action === 'Approved' ? 'Approved' : 'Rejected';
    
    // 1. تحديث الحالة في الداتا بيز
    const updateRes = await pool.query(
      "UPDATE payment_requests SET status = $1, notes = COALESCE(notes, '') || $2 WHERE request_id = $3 RETURNING *",
      [newStatus, reason ? ` | Reason: ${reason}` : '', requestId]
    );

    const requestData = updateRes.rows[0];

    // 2. لو توافق عليه -> اعمل PDF
    let pdfUrl = requestData.pdf_url;
    if (newStatus === 'Approved') {
      pdfUrl = await generatePaymentPDF(requestData);
      if (pdfUrl) {
        await pool.query("UPDATE payment_requests SET pdf_url = $1 WHERE request_id = $2", [pdfUrl, requestId]);
      }
    }

    // 3. ابعت إيميل للموظف اللي قدم الطلب
    const emailSubject = newStatus === 'Approved' ? `✅ Approved: ${requestId}` : `❌ Rejected: ${requestId}`;
    const emailBody = `
      <div style="font-family:Arial;padding:20px;border:1px solid #ddd;border-radius:10px;text-align:center;">
        <h2 style="color:${newStatus === 'Approved' ? '#16a34a' : '#dc2626'}">Your Request was ${newStatus}</h2>
        <p><strong>ID:</strong> ${requestId}</p>
        <p><strong>Action by:</strong> ${managerEmail}</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      </div>
    `;
    await sendEmailGNK(requestData.email, emailSubject, emailBody);
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Action Error:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// 5. جلب سجل قرارات المدير (Action History)
router.get('/manager/history', async (req, res) => {
  try {
    const email = req.query.email?.toLowerCase().trim();
    const result = await pool.query(
      "SELECT * FROM payment_requests WHERE LOWER(manager_email) = $1 AND status != 'Pending Approval' ORDER BY timestamp DESC",
      [email]
    );
    res.json({ success: true, rows: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// 6. جلب كل بيانات المحاسب (طلبات، تسويات، استلامات)
router.get('/accountant/data', async (req, res) => {
  try {
    const paymentsRes = await pool.query("SELECT * FROM payment_requests ORDER BY timestamp DESC");
    const receivingsRes = await pool.query("SELECT * FROM receiving_vouchers ORDER BY timestamp DESC");
    
    res.json({ 
      success: true, 
      payments: paymentsRes.rows,
      receivings: receivingsRes.rows 
    });
  } catch (error) {
    console.error('Error fetching accountant data:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});
  
// 7. تنفيذ الدفع
router.post('/accountant/execute', async (req, res) => {
  try {
    const { requestId, paymentMethod, amountPaid, paymentRef } = req.body;
    const datePaid = new Date().toLocaleDateString('en-GB'); 

    await pool.query(
      "UPDATE payment_requests SET payment_method = $1, amount_paid = $2, payment_ref = $3, date_paid = $4 WHERE request_id = $5",
      [paymentMethod, amountPaid, paymentRef, datePaid, requestId]
    );

    res.json({ success: true, datePaid });
  } catch (error) {
    console.error('Error executing payment:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});
  
// 8. تأكيد التسوية واستلام الكاش
router.post('/accountant/settle', async (req, res) => {
  try {
    const { requestId, confirmedAmount, notes, accountantEmail } = req.body;
    const settlementLog = ` | Settled: ${confirmedAmount} by ${accountantEmail} (Notes: ${notes})`;

    await pool.query(
      "UPDATE payment_requests SET status = 'Closed', notes = COALESCE(notes, '') || $1 WHERE request_id = $2",
      [settlementLog, requestId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error confirming settlement:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

module.exports = router;