// backend/utils/systemEngine.js
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// إعدادات الإيميل
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gnk.group',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

async function sendEmailGNK(toEmail, subject, htmlBody) {
  try {
    if (!toEmail || !toEmail.includes('@')) return false;
    await transporter.sendMail({
      from: '"GNK OPERATIONS" <' + (process.env.EMAIL_USER || 'system@gnk.group') + '>',
      to: toEmail,
      subject: subject,
      html: htmlBody
    });
    console.log(`✅ Email sent to: ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${toEmail}:`, error);
    return false;
  }
}

function escapeHtml(s) {
  return (s || "").toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function frow(label, value) {
  if (!value) return "";
  return "<div style='display:flex;margin-bottom:6px'>" +
    "<span style='width:148px;flex-shrink:0;font-size:10.5px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.4px'>" + label + "</span>" +
    "<span style='font-size:12px;color:#111'>" + value + "</span></div>";
}

function appr(label, stamp, pending) {
  const isAppr = stamp && stamp.includes("APPROVED");
  const isRej  = stamp && stamp.includes("REJECTED");
  const color  = isAppr ? "#16a34a" : (isRej ? "#dc2626" : "#9ca3af");
  const bg     = isAppr ? "#f0fdf4" : (isRej ? "#fef2f2" : "#f9fafb");
  const text   = stamp ? stamp : (pending ? "⏳ Pending…" : "—");
  return "<div style='margin-bottom:8px;padding:8px 12px;border-left:3px solid " + color + ";background:" + bg + "'>" +
    "<div style='font-size:9.5px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:2px'>" + label + "</div>" +
    "<div style='font-size:11.5px;color:" + color + ";font-weight:600'>" + text + "</div></div>";
}

// توليد PDF لطلبات الدفع بنفس تصميم جوجل
async function generatePaymentPDF(data) {
  try {
    const amount = parseFloat(data.amount) || 0;
    const currency = data.currency || "L.E";
    const submitDate = new Date().toLocaleDateString('en-GB');
    const genDate = new Date().toLocaleString('en-GB');
    
    let payBlock = "";
    if (data.payment_method) {
      payBlock =
        "<div style='height:1px;background:#e5e7eb;margin:14px 0'></div>" +
        "<div style='font-size:9.5px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:.8px;margin-bottom:10px'>Payment Execution</div>" +
        frow("Method", data.payment_method) +
        frow("Date Paid", data.date_paid) +
        frow("Amount Paid", data.amount_paid + " " + currency) +
        frow("Reference", data.payment_ref);
    }

    const html = `
      <!DOCTYPE html><html><head><meta charset='UTF-8'><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#111;padding:36px 46px;font-size:12px;line-height:1.65}
      </style></head><body>
      <div style='display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px'>
        <div><div style='font-size:22px;font-weight:900;letter-spacing:5px'>GNK</div>
        <div style='font-size:8.5px;color:#9ca3af;letter-spacing:2px;margin-top:1px;text-transform:uppercase'>Group Operations</div></div>
        <div style='text-align:right'>
          <div style='font-size:14px;font-weight:700'>${data.request_id}</div>
          <div style='display:inline-block;margin-top:4px;padding:2px 10px;border:1.5px solid #111;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px'>${data.status}</div>
          <div style='font-size:9.5px;color:#9ca3af;margin-top:3px'>Submitted: ${submitDate}</div>
        </div></div>
      <div style='height:1px;background:#e5e7eb;margin-bottom:12px'></div>
      <div style='font-size:10.5px;color:#b45309;background:#fffbeb;padding:7px 12px;border-radius:4px;margin-bottom:16px;font-weight:600'>
        ⚠️ Any payment must be requested at least 48 hours before the due date.</div>
      ${frow("Requested By", data.name)}
      ${frow("Email", data.email)}
      ${frow("Project", data.project)}
      ${frow("Department", data.department)}
      ${frow("Due Date", data.due_date)}
      ${frow("Payment Terms", data.payment_terms)}
      ${frow("COR", (data.receiving_ids ? "YES — " + data.receiving_ids : "NO"))}
      <div style='height:1px;background:#e5e7eb;margin:14px 0'></div>
      <div style='text-align:center;padding:16px 0'>
        <div style='font-size:34px;font-weight:900;letter-spacing:2px'>${amount.toFixed(2)} ${currency}</div>
        <div style='font-size:8.5px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;margin-top:4px'>Requested Amount</div></div>
      <div style='height:1px;background:#e5e7eb;margin:14px 0'></div>
      <div style='font-size:9.5px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:.8px;margin-bottom:7px'>Purpose</div>
      <div style='font-size:12px;color:#111;background:#f9fafb;padding:12px;min-height:44px;line-height:1.8'>
        ${data.description || "<span style='color:#9ca3af;font-style:italic'>Not specified</span>"}</div>
      <div style='height:1px;background:#e5e7eb;margin:14px 0'></div>
      <div style='font-size:9.5px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:.8px;margin-bottom:8px'>Approvals</div>
      ${appr(`L1 — Manager (${data.manager_email})`, data.stamp_l1, data.status === "Pending Approval")}
      ${data.needs_l2 ? appr(`L2 — ${data.l2_label} (${data.l2_email})`, data.stamp_l2, data.status === "Pending L2 Approval") : ""}
      ${payBlock}
      <div style='margin-top:32px;padding-top:8px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:8.5px;color:#d1d5db'>
        <span>GNK Group Operations System</span><span>${data.request_id}</span><span>Generated: ${genDate}</span></div></body></html>
    `;

    const dir = path.join(__dirname, '../uploads/pdfs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const fileName = `${data.request_id}.pdf`;
    const filePath = path.join(dir, fileName);

    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html);
    await page.pdf({ path: filePath, format: 'A4', printBackground: true });
    await browser.close();

    return `/pdfs/${fileName}`;
  } catch (error) {
    console.error("❌ PDF Generation Error:", error);
    return null;
  }
}

// توليد PDF لـ سندات الاستلام
async function generateReceivingPDF(recData) {
  try {
    let rows = "", total = 0;
    if (recData.items && recData.items.length > 0) {
      recData.items.forEach((it, i) => {
        const qty   = parseFloat(it.qty)   || 0;
        const price = parseFloat(it.price) || 0;
        const vat   = Math.round(parseFloat(it.vat) || 0);
        const tax   = Math.round(parseFloat(it.tax) || 0);
        const base  = qty * price;
        const sub   = base + (base * vat / 100) - (base * tax / 100);
        total += sub;
        rows += `<tr><td style='padding:7px;border:1px solid #ddd;text-align:center'>${i + 1}</td>
          <td style='padding:7px;border:1px solid #ddd'>${escapeHtml(it.name)}</td>
          <td style='padding:7px;border:1px solid #ddd;text-align:center'>${qty}</td>
          <td style='padding:7px;border:1px solid #ddd;text-align:center'>${escapeHtml(it.unit || "")}</td>
          <td style='padding:7px;border:1px solid #ddd;text-align:right'>${price.toFixed(2)}</td>
          <td style='padding:7px;border:1px solid #ddd;text-align:center'>${vat}%</td>
          <td style='padding:7px;border:1px solid #ddd;text-align:center'>${tax}%</td>
          <td style='padding:7px;border:1px solid #ddd;text-align:right'>${sub.toFixed(2)}</td></tr>`;
      });
    }

    const timestamp = new Date().toLocaleString('en-GB');
    const html = `<!DOCTYPE html><html><head><meta charset='UTF-8'><style>
      body{font-family:Arial;padding:40px;color:#2c3e50;max-width:800px;margin:0 auto}
      h1{text-align:center;border-bottom:3px solid #2c3e50;padding-bottom:15px}
      .badge{text-align:center;margin:20px 0}.badge span{background:#27ae60;color:#fff;padding:6px 24px;border-radius:20px;font-weight:bold}
      .row{display:flex;gap:20px;margin:20px 0}.box{background:#f8f9fa;padding:16px;border-radius:8px;flex:1;font-size:13px}.box p{margin:5px 0}
      table{width:100%;border-collapse:collapse;margin:20px 0}thead tr{background:#2c3e50;color:#fff}th,td{padding:9px;border:1px solid #ddd;font-size:13px}
      </style></head><body>
      <h1>${recData.type === "Services" ? "Service Receipt Note" : "Goods Receipt Note"}</h1>
      <div class='badge'><span>${escapeHtml(recData.rec_number)}</span></div>
      <div class='row'>
        <div class='box'><p><strong>Date:</strong> ${timestamp}</p>
          <p><strong>Supplier:</strong> ${escapeHtml(recData.supplier)}</p>
          ${recData.supplierId ? `<p><strong>Supplier ID:</strong> ${escapeHtml(recData.supplierId)}</p>` : ""}
          <p><strong>Project:</strong> ${escapeHtml(recData.project)}</p></div>
        <div class='box'><p><strong>Received By:</strong> ${escapeHtml(recData.employeeName)}</p>
          <p><strong>Job Title:</strong> ${escapeHtml(recData.jobTitle)}</p>
          <p><strong>Email:</strong> ${escapeHtml(recData.email)}</p></div></div>
      ${recData.paymentRequestId ? `<p><strong>Linked Request:</strong> <span style='color:#2563eb;font-weight:bold'>${escapeHtml(recData.paymentRequestId)}</span></p>` : ""}
      <table><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Unit</th><th>Price</th><th>VAT%</th><th>Tax%</th><th>Subtotal</th></tr></thead><tbody>
      ${rows}</tbody></table>
      <p style='text-align:right;font-size:16px;font-weight:bold'>Total: ${total.toFixed(2)}</p>
      <div style='margin:20px 0;padding:16px;background:#f8f9fa;border-radius:8px'><strong>Confirmation:</strong><p>I confirm the received items match the invoice and quantities.</p></div>
      <div style='position:fixed;bottom:30px;right:30px;text-align:right;'>
        <p style='margin:0;font-size:11px;color:#2c3e50;font-weight:bold'>Received By: ${escapeHtml(recData.employeeName)}</p>
        <p style='margin:4px 0 0 0;font-size:10px;color:#555'>${timestamp}</p></div>
      </body></html>`;

    const dir = path.join(__dirname, '../uploads/pdfs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const fileName = `${recData.rec_number}.pdf`;
    const filePath = path.join(dir, fileName);

    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html);
    await page.pdf({ path: filePath, format: 'A4', printBackground: true });
    await browser.close();

    return `/pdfs/${fileName}`;
  } catch (error) {
    console.error("❌ Receiving PDF Error:", error);
    return null;
  }
}

module.exports = { sendEmailGNK, generatePaymentPDF, generateReceivingPDF };
