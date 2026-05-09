// backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { sendEmailGNK, generatePaymentPDF } = require('../utils/systemEngine');

const PROJECT_MAP = {
  "byGanz":        { accountant: "semon.fayek@gnk.group",     owner: "abdelaziz@byganz.com" },
  "Head Office":   { accountant: "karim.salama@gnk.group",    owner: "kareem@gnk.group" },
  "Buoy":          { accountant: "mohamed.mohab@gnk.group",   owner: "kareem@gnk.group" },
  "Studio Samara": { accountant: "romany.attia@gnk.group",    owner: "kareem@gnk.group" },
  "Mazeej":        { accountant: "mokhtar.mahmoud@gnk.group", owner: "kareem@gnk.group" },
  "KiKi's White":  { accountant: "treasury@gnk.group",        owner: "treasury@gnk.group" },
  "KiKi's Henies": { accountant: "",                          owner: "" },
  "SAX":           { accountant: "",                          owner: "" },
  "Gar El-Qamer":  { accountant: "",                          owner: "" },
  "MAMA":          { accountant: "",                          owner: "" },
  "At9":           { accountant: "",                          owner: "" },
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

const ALLOWED_EDITORS = [
  "romany.attia@gnk.group","youssef.gamel@gnk.group",
  "mohamed.mohab@gnk.group","mokhtar.mahmoud@gnk.group",
  "beshoui.medhat99@gmail.com"
];

function isAdmin(email) {
  const el = (email || "").toString().toLowerCase().trim();
  return ADMIN_EDITORS.some(a => a.toLowerCase().trim() === el);
}

function isAllowedEditor(email) {
  return ALLOWED_EDITORS.includes(email) || isAdmin(email);
}

function isManager(email) {
  const el = email.toString().toLowerCase().trim();
  if (isAdmin(el)) return true;
  return MANAGER_EMAILS.some(m => m.toLowerCase() === el);
}

function isAccountant(email) {
  const el = email.toString().toLowerCase().trim();
  if (isAdmin(el)) return true;
  for (const p in PROJECT_MAP) {
    if ((PROJECT_MAP[p].accountant || "").toLowerCase().trim() === el) return true;
  }
  return false;
}

const generateRID = () => crypto.randomBytes(8).toString('hex');

// ============================================================================
// 1. Submit Payment Request
// ============================================================================
router.post('/submit', async (req, res) => {
  try {
    const data = req.body;
    const pool = req.app.locals.pool; 

    // التأكد من وجود الجداول (MySQL لا يدعم ALTER COLUMN بنفس طريقة Postgres)
    // لتجنب الأخطاء، يفضل إنشاء هذه الأعمدة مسبقاً في الداتا بيز إذا لم تكن موجودة.

    const [countRes] = await pool.query('SELECT COUNT(*) as count FROM payment_requests');
    const count = parseInt(countRes[0].count) + 1;
    const request_id = `PR-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

    const amount = parseFloat(data.amount) || 0;
    const currency = data.currency || 'L.E';
    
    const isForeign = (currency !== "L.E");
    const needsL2 = !isForeign && (amount > 10000);
    const pData = PROJECT_MAP[data.project] || { accountant: '', owner: '' };
    const l2_email = needsL2 ? ((amount <= 150000 && pData.accountant) ? pData.accountant : pData.owner) : "";
    const l2_label = (amount <= 150000) ? "Project Accountant" : "Project Owner";

    const isSelfApproval = (data.email.toLowerCase().trim() === data.managerEmail.toLowerCase().trim());
    
    let status = "Pending Approval";
    let stamp_l1 = "";
    let rid_l1 = generateRID();
    let rid_l2 = needsL2 ? generateRID() : "";
    let link_timestamp = new Date().getTime();
    
    if (isSelfApproval) {
      stamp_l1 = `✅ AUTO-APPROVED (Self) | ${data.email} | Date: ${new Date().toLocaleString('en-GB')}`;
      status = needsL2 ? "Pending L2 Approval" : "Approved";
    }

    const receiving_ids = (data.receivingIds || []).join(", ");
    const cor = receiving_ids ? "YES" : "No";

    const query = `
      INSERT INTO payment_requests 
      (request_id, email, name, project, department, description, amount, currency, due_date, manager_email, payment_terms, attachment_urls, status, rid_l1, rid_l2, stamp_l1, receiving_ids, cor, link_timestamp) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      request_id, data.email.toLowerCase().trim(), data.requestedBy, data.project, data.department, 
      data.purpose || '', amount, currency, data.dueDate, data.managerEmail, 
      data.paymentTerms, (data.attachmentUrls || []).join('\n'), status, rid_l1, rid_l2, stamp_l1, receiving_ids, cor, link_timestamp
    ];

    await pool.query(query, values);
    
    // سحب الداتا اللي لسه متسجلة عشان نبعتها لـ PDF
    const [savedDataRes] = await pool.query('SELECT * FROM payment_requests WHERE request_id = ?', [request_id]);
    const savedData = savedDataRes[0];

    // Generate PDF
    savedData.needs_l2 = needsL2;
    savedData.l2_email = l2_email;
    savedData.l2_label = l2_label;
    
    const pdfUrl = await generatePaymentPDF(savedData);
    await pool.query(`UPDATE payment_requests SET pdf_url = ? WHERE request_id = ?`, [pdfUrl, request_id]);

    // Update Receivings if linked
    if (data.receivingIds && data.receivingIds.length > 0) {
      for (const rn of data.receivingIds) {
        await pool.query(
          `UPDATE receiving_vouchers SET linked_request = 
            CASE 
              WHEN linked_request IS NULL OR linked_request = '' OR linked_request = 'NO' THEN ? 
              ELSE CONCAT(linked_request, ', ', ?) 
            END 
          WHERE rec_number = ?`, 
          [request_id, request_id, rn.trim()]
        );
      }
    }

    const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'; 

    // Send Emails
    if (!isSelfApproval && data.managerEmail) {
      const approveUrl = `${BACKEND_URL}/api/payments/approve-email?reqId=${request_id}&status=Approved&rid=${rid_l1}&level=L1`;
      const rejectUrl  = `${BACKEND_URL}/api/payments/approve-email?reqId=${request_id}&status=Rejected&rid=${rid_l1}&level=L1`;
      
      const emailHtml = `
        <div style='font-family:Arial;max-width:600px;border:1px solid #eee;padding:25px;border-radius:10px;'>
          <h2 style='color:#2c3e50;text-align:center'>Payment Approval Request</h2>
          <p style='color:#e74c3c;font-weight:bold;text-align:center'>⚠️ Single-use link — expires in 7 days</p>
          <table style='border-collapse:collapse;width:100%;border:1px solid #ddd'>
            <tr><td style='border:1px solid #ddd;padding:10px;background:#fff3cd;font-weight:bold'>Requested By</td><td style='border:1px solid #ddd;padding:10px;font-weight:bold'>${data.requestedBy}</td></tr>
            <tr><td style='border:1px solid #ddd;padding:10px;background:#f8f9fa;font-weight:bold'>Project</td><td style='border:1px solid #ddd;padding:10px'>${data.project}</td></tr>
            <tr><td style='border:1px solid #ddd;padding:10px;background:#f8f9fa;font-weight:bold'>Amount</td><td style='border:1px solid #ddd;padding:10px'>${amount} ${currency}</td></tr>
            <tr><td style='border:1px solid #ddd;padding:10px;background:#f8f9fa;font-weight:bold'>Due Date</td><td style='border:1px solid #ddd;padding:10px'>${data.dueDate}</td></tr>
          </table><br>
          <div style='text-align:center'>
            <a href='${approveUrl}' style='background:#27ae60;color:#fff;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;margin-right:10px'>✅ APPROVE</a>
            <a href='${rejectUrl}' style='background:#c0392b;color:#fff;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block'>❌ REJECT</a>
          </div>
        </div>`;
      await sendEmailGNK(data.managerEmail, `Payment Approval Request - From: ${data.requestedBy}`, emailHtml);
    } else if (isSelfApproval && needsL2 && l2_email) {
      const approveUrl = `${BACKEND_URL}/api/payments/approve-email?reqId=${request_id}&status=Approved&rid=${rid_l2}&level=L2`;
      const rejectUrl  = `${BACKEND_URL}/api/payments/approve-email?reqId=${request_id}&status=Rejected&rid=${rid_l2}&level=L2`;
      
      const emailHtml = `
        <div style='font-family:Arial;max-width:600px;border:1px solid #eee;padding:25px;border-radius:10px;'>
          <h2 style='color:#2c3e50;text-align:center'>Level 2 Approval (${l2_label})</h2>
          <p style='color:#e74c3c;font-weight:bold;text-align:center'>⚠️ Single-use link — expires in 7 days</p>
          <div style='text-align:center'>
            <a href='${approveUrl}' style='background:#27ae60;color:#fff;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;margin-right:10px'>✅ APPROVE (L2)</a>
            <a href='${rejectUrl}' style='background:#c0392b;color:#fff;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block'>❌ REJECT (L2)</a>
          </div>
        </div>`;
      await sendEmailGNK(l2_email, `L2 Approval Required - From: ${data.requestedBy}`, emailHtml);
    }

    let l2msg = "";
    if (!isForeign && amount > 10000 && amount <= 150000) l2msg = "<p>A second approval will be required from the Project Accountant.</p>";
    else if (!isForeign && amount > 150000)               l2msg = "<p>A second approval will be required from the Project Owner.</p>";

    await sendEmailGNK(data.email, `Payment Request Submitted - ${request_id}`, `
      <div style='font-family:Arial;max-width:600px;border:1px solid #eee;padding:25px;border-radius:10px;text-align:center;'>
        <h2 style='color:#2c3e50;'>✅ Request Submitted</h2>
        <p><strong>${request_id}</strong></p>
        <p>Sent to: <strong>${data.managerEmail}</strong></p>${l2msg}
      </div>`);

    res.json({ success: true, requestId: request_id, pdfUrl: pdfUrl });
  } catch (error) {
    console.error('❌ Error submitting payment:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// ============================================================================
// 2. Dashboard Data 
// ============================================================================
async function getActualBalance(pool, requestId, totalAmount) {
  try {
    const [res] = await pool.query("SELECT SUM(total_amount) as used FROM receiving_vouchers WHERE linked_request LIKE ?", [`%${requestId}%`]);
    const used = parseFloat(res[0].used) || 0;
    return Math.max(0, totalAmount - used);
  } catch (err) {
    return totalAmount;
  }
}

router.get('/dashboard', async (req, res) => {
  try {
    const pool = req.app.locals.pool; 
    const email = req.query.email?.toLowerCase().trim();
    if (!email) return res.status(400).json({ success: false, error: 'Email required' });

    const isAdminUser = isAdmin(email) || isAllowedEditor(email);

    let pQuery = "SELECT * FROM payment_requests";
    let pValues = [];
    if (!isAdminUser) {
      pQuery += " WHERE LOWER(email) = ?";
      pValues.push(email);
    }
    const [pResult] = await pool.query(pQuery, pValues);
    
    let payments = [];
    for (let row of pResult) {
      const amt = parseFloat(row.amount) || 0;
      const remaining = (row.status === "Approved") ? await getActualBalance(pool, row.request_id, amt) : amt;
      payments.push({
        requestId: row.request_id,
        email: row.email,
        requestedBy: row.name,
        project: row.project,
        department: row.department,
        amount: amt,
        currency: row.currency,
        remaining: remaining,
        status: row.status,
        dueDate: row.due_date,
        pdfUrl: row.pdf_url,
        date: new Date(row.timestamp).toLocaleDateString('en-GB'),
        paymentMethod: row.payment_method,
        datePaid: row.date_paid,
        amountPaid: row.amount_paid,
        paymentRef: row.payment_ref,
        attachmentUrls: row.attachment_urls
      });
    }

    let rQuery = "SELECT * FROM receiving_vouchers";
    let rValues = [];
    if (!isAdminUser) {
      rQuery += " WHERE LOWER(email) = ?";
      rValues.push(email);
    }
    const [rResult] = await pool.query(rQuery, rValues);
    
    let receivings = rResult.map(row => ({
      recNumber: row.rec_number,
      email: row.email,
      employeeName: row.employee_name,
      supplier: row.supplier,
      project: row.project,
      type: row.type,
      totalAmount: parseFloat(row.total_amount) || 0,
      linked: row.linked_request,
      pdfUrl: row.pdf_link,
      date: new Date(row.timestamp).toLocaleDateString('en-GB')
    }));

    // Financials Calculation
    let aggPendingApproval = 0, aggPendingVal = 0, aggRejected = 0, aggRejectedVal = 0;
    let aggApproved = 0, aggApprovedVal = 0, aggClosed = 0, aggClosedVal = 0;
    let aggSettlement = 0, aggSettlementVal = 0, aggPaidTotal = 0, aggReceivedTotal = 0;

    payments.forEach(r => {
      const amt = parseFloat(r.amount) || 0;
      const paid = parseFloat(r.amountPaid) || 0;
      if (r.status === "Pending Approval" || r.status === "Pending L2 Approval") {
        aggPendingApproval++; aggPendingVal += amt;
      } else if (r.status === "Rejected") {
        aggRejected++; aggRejectedVal += amt;
      } else if (r.status === "Approved") {
        aggApproved++; aggApprovedVal += amt; aggPaidTotal += paid;
      } else if (r.status === "Closed") {
        aggClosed++; aggApprovedVal += amt; aggClosedVal += amt; aggPaidTotal += paid;
      } else if (r.status === "Pending Settlement") {
        aggSettlement++; aggSettlementVal += amt; aggApprovedVal += amt; aggPaidTotal += paid;
      }
    });

    receivings.forEach(rv => {
      if (rv.linked && rv.linked !== "NO" && rv.linked.trim() !== "") {
        aggReceivedTotal += parseFloat(rv.totalAmount) || 0;
      }
    });

    const financials = {
      total: payments.length,
      pendingApproval: aggPendingApproval, pendingVal: aggPendingVal,
      rejected: aggRejected, rejectedVal: aggRejectedVal,
      approved: aggApproved, approvedVal: aggApprovedVal,
      closed: aggClosed, closedVal: aggClosedVal,
      settlement: aggSettlement, settlementVal: aggSettlementVal,
      paidTotal: aggPaidTotal, receivedTotal: aggReceivedTotal,
      outstanding: Math.max(0, aggApprovedVal - aggPaidTotal),
      refundVal: Math.max(0, aggPaidTotal - aggReceivedTotal)
    };

    res.json({ success: true, payments, receivings, isAdmin: isAdminUser, financials });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// ============================================================================
// 3. Manager Views & Actions 
// ============================================================================
router.post('/manager/requests', async (req, res) => {
  try {
    const pool = req.app.locals.pool; 
    const email = req.body.email?.toLowerCase().trim();
    if (!isManager(email)) return res.json({ success: false, error: "Access denied" });

    const [result] = await pool.query("SELECT * FROM payment_requests WHERE status IN ('Pending Approval', 'Pending L2 Approval')");
    let rows = [];

    result.forEach(row => {
      const isL1 = (row.manager_email.toLowerCase() === email) && (row.status === "Pending Approval");
      
      const amt = parseFloat(row.amount);
      const cur = row.currency;
      const pData = PROJECT_MAP[row.project];
      let isL2 = false;
      
      if (pData && row.status === "Pending L2 Approval" && cur === "L.E" && amt > 10000) {
        const l2email = (amt <= 150000 && pData.accountant) ? pData.accountant : pData.owner;
        if ((l2email || "").toLowerCase().trim() === email) isL2 = true;
      }

      if (isL1 || isL2) {
        rows.push({
          requestId: row.request_id,
          date: new Date(row.timestamp).toLocaleDateString('en-GB'),
          requestedBy: row.name,
          email: row.email,
          project: row.project,
          department: row.department,
          amount: amt,
          currency: cur,
          dueDate: row.due_date,
          paymentTerms: row.payment_terms,
          status: row.status,
          pdfUrl: row.pdf_url,
          level: isL1 ? "L1" : "L2"
        });
      }
    });

    res.json({ success: true, rows });
  } catch (error) {
    console.error('Error fetching manager requests:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Approve from UI (React)
router.post('/manager/action', async (req, res) => {
  try {
    const pool = req.app.locals.pool; 
    const { email, requestId, level, action, reason } = req.body;
    const userEmail = email.toLowerCase().trim();
    if (!isManager(userEmail)) return res.json({ success: false, error: "Access denied" });

    const [check] = await pool.query("SELECT * FROM payment_requests WHERE request_id = ?", [requestId]);
    if (check.length === 0) return res.json({ success: false, error: "Request not found" });
    const row = check[0];

    if (level === "L1" && row.status !== "Pending Approval") return res.json({ success: false, error: "Not in L1 stage" });
    if (level === "L2" && row.status !== "Pending L2 Approval") return res.json({ success: false, error: "Not in L2 stage" });

    const ts = new Date().toLocaleString('en-GB');
    
    if (action === "Rejected") {
      const stamp = ` REJECTED BY: ${userEmail} | Date: ${ts}`;
      await pool.query(
        `UPDATE payment_requests SET status = 'Rejected', ${level === 'L1' ? 'stamp_l1' : 'stamp_l2'} = ?, rid_${level.toLowerCase()} = 'USED' WHERE request_id = ?`,
        [stamp, requestId]
      );
      await sendEmailGNK(row.email, `❌ Payment Request Rejected - ${requestId}`, `Rejected by: ${userEmail}<br>Reason: ${reason}`);
    } else if (action === "Approved") {
      const stamp = `✅ APPROVED BY: ${userEmail} | Date: ${ts}`;
      const amount = parseFloat(row.amount);
      const isForeign = (row.currency !== "L.E");
      const needsL2 = !isForeign && (amount > 10000);
      const pData = PROJECT_MAP[row.project];
      
      if (level === "L1") {
        if (!needsL2) {
          await pool.query(`UPDATE payment_requests SET status = 'Approved', stamp_l1 = ?, rid_l1 = 'USED' WHERE request_id = ?`, [stamp, requestId]);
          await sendEmailGNK(row.email, `✅ Payment Request Approved - ${requestId}`, `Approved by: ${userEmail}`);
        } else {
          const rid_l2 = generateRID();
          await pool.query(`UPDATE payment_requests SET status = 'Pending L2 Approval', stamp_l1 = ?, rid_l1 = 'USED', rid_l2 = ? WHERE request_id = ?`, [stamp, rid_l2, requestId]);
          const l2_email = (amount <= 150000 && pData.accountant) ? pData.accountant : pData.owner;
          if (l2_email) {
            const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
            const approveUrl = `${BACKEND_URL}/api/payments/approve-email?reqId=${requestId}&status=Approved&rid=${rid_l2}&level=L2`;
            const rejectUrl  = `${BACKEND_URL}/api/payments/approve-email?reqId=${requestId}&status=Rejected&rid=${rid_l2}&level=L2`;
            const html = `<h2>L2 Approval Needed</h2><a href="${approveUrl}">APPROVE</a> | <a href="${rejectUrl}">REJECT</a>`;
            await sendEmailGNK(l2_email, `L2 Approval Required - ${requestId}`, html);
          }
        }
      } else {
        await pool.query(`UPDATE payment_requests SET status = 'Approved', stamp_l2 = ?, rid_l2 = 'USED' WHERE request_id = ?`, [stamp, requestId]);
        await sendEmailGNK(row.email, `✅ Payment Request Fully Approved - ${requestId}`, `Final approval by: ${userEmail}`);
      }
    }

    const [updatedRowRes] = await pool.query("SELECT * FROM payment_requests WHERE request_id = ?", [requestId]);
    const pdfUrl = await generatePaymentPDF(updatedRowRes[0]);
    await pool.query("UPDATE payment_requests SET pdf_url = ? WHERE request_id = ?", [pdfUrl, requestId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error in manager action:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Approve from Email (GET Request)
router.get('/approve-email', async (req, res) => {
  try {
    const pool = req.app.locals.pool; 
    const { reqId, status, rid, level } = req.query;
    if (!reqId || !status || !rid || !level) return res.send("❌ Invalid Request");

    const [check] = await pool.query(`SELECT status, rid_${level.toLowerCase()}, email, amount, currency, project FROM payment_requests WHERE request_id = ?`, [reqId]);
    if (check.length === 0) return res.send("❌ Request not found");
    const row = check[0];

    const dbRid = row[`rid_${level.toLowerCase()}`];
    if (dbRid === 'USED') return res.send("✅ Already recorded 🙏");
    if (dbRid !== rid) return res.send("❌ Access Denied");

    if (level === "L1" && row.status !== "Pending Approval") return res.send("⚠️ No longer in your approval stage");
    if (level === "L2" && row.status !== "Pending L2 Approval") return res.send("⚠️ No longer in your approval stage");

    res.send(status === "Approved" ? "✅ Request Approved 🙏" : "❌ Request Rejected 🙏");
  } catch (err) {
    res.send("❌ System Error");
  }
});


// ============================================================================
// 4. Accountant Views & Actions
// ============================================================================
router.get('/accountant/data', async (req, res) => {
  try {
    const pool = req.app.locals.pool; 
    const email = req.query.email?.toLowerCase().trim();
    if (!isAccountant(email)) return res.status(403).json({ success: false, error: "Access denied" });

    const [result] = await pool.query("SELECT * FROM payment_requests ORDER BY timestamp DESC");
    
    let rows = result.map(r => ({
      requestId: r.request_id,
      date: new Date(r.timestamp).toLocaleDateString('en-GB'),
      requestedBy: r.name,
      email: r.email,
      project: r.project,
      department: r.department,
      amount: parseFloat(r.amount) || 0,
      currency: r.currency,
      dueDate: r.due_date,
      status: r.status,
      paymentMethod: r.payment_method,
      datePaid: r.date_paid,
      amountPaid: r.amount_paid,
      paymentRef: r.payment_ref,
      pdfUrl: r.pdf_url,
      Purpose: r.description
    }));

    res.json({ success: true, rows });
  } catch (error) {
    console.error('Error fetching accountant data:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

router.post('/accountant/execute', async (req, res) => {
  try {
    const pool = req.app.locals.pool; 
    const { email, requestId, paymentMethod, amountPaid, paymentRef } = req.body;
    if (!isAccountant(email)) return res.json({ success: false, error: "Access denied" });

    const datePaid = new Date().toLocaleString('en-GB'); 

    const [check] = await pool.query("SELECT amount, status FROM payment_requests WHERE request_id = ?", [requestId]);
    if (check.length === 0) return res.json({success:false, error: "Request not found"});
    if (check[0].status !== "Approved") return res.json({success:false, error: "Only Approved requests can be executed"});

    const approvedAmount = parseFloat(check[0].amount) || 0;
    if (parseFloat(amountPaid) > approvedAmount + 0.01) {
      return res.json({ success: false, error: `❌ BLOCKED: Cannot pay ${amountPaid} — Approved amount is ${approvedAmount}` });
    }

    await pool.query(
      "UPDATE payment_requests SET payment_method = ?, amount_paid = ?, payment_ref = ?, date_paid = ? WHERE request_id = ?",
      [paymentMethod, amountPaid, paymentRef, datePaid, requestId]
    );

    const [updatedRowRes] = await pool.query("SELECT * FROM payment_requests WHERE request_id = ?", [requestId]);
    const pdfUrl = await generatePaymentPDF(updatedRowRes[0]);
    await pool.query("UPDATE payment_requests SET pdf_url = ? WHERE request_id = ?", [pdfUrl, requestId]);

    res.json({ success: true, datePaid, pdfUrl });
  } catch (error) {
    console.error('Error executing payment:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

router.post('/accountant/settle', async (req, res) => {
  try {
    const pool = req.app.locals.pool; 
    const { email, requestId, confirmedAmount, notes } = req.body;
    if (!isAccountant(email)) return res.json({ success: false, error: "Access denied" });

    const [check] = await pool.query("SELECT amount, status, currency, email as req_email FROM payment_requests WHERE request_id = ?", [requestId]);
    if (check.length === 0) return res.json({success:false, error: "Request not found"});
    const row = check[0];
    
    if (row.status !== "Pending Settlement") return res.json({ success: false, error: "Request is not in Pending Settlement status" });

    const approvedAmount = parseFloat(row.amount) || 0;
    if (parseFloat(confirmedAmount) > approvedAmount + 0.01) {
      return res.json({ success: false, error: `❌ BLOCKED: Cannot confirm ${confirmedAmount} — Approved amount is ${approvedAmount}` });
    }

    const ts = new Date().toLocaleString('en-GB');
    const newNotes = (row.notes ? row.notes + "\n" : "") + `Settled: ${confirmedAmount} by ${email} (Notes: ${notes})`;

    await pool.query("UPDATE payment_requests SET status = 'Closed', description = ? WHERE request_id = ?", [newNotes, requestId]);

    const [updatedRowRes] = await pool.query("SELECT * FROM payment_requests WHERE request_id = ?", [requestId]);
    const pdfUrl = await generatePaymentPDF(updatedRowRes[0]);
    await pool.query("UPDATE payment_requests SET pdf_url = ? WHERE request_id = ?", [pdfUrl, requestId]);

    await sendEmailGNK(row.req_email, `✅ Settlement Confirmed — ${requestId}`, `Request ${requestId} has been fully settled. Cash Confirmed: ${confirmedAmount} ${row.currency}`);

    res.json({ success: true, closedAt: ts });
  } catch (error) {
    console.error('Error confirming settlement:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

module.exports = router;
