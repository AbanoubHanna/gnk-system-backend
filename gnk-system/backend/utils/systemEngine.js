const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// إعدادات الإيميل (استخدم إيميلك وباسورد الـ App Passwords)
const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gnk.group',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// دالة إرسال الإيميل
async function sendEmailGNK(toEmail, subject, htmlBody) {
  try {
    await transporter.sendMail({
      from: '"GNK OPERATIONS" <your-email@gnk.group>',
      to: toEmail,
      subject: subject,
      html: htmlBody
    });
    console.log(`✅ Email sent to: ${toEmail}`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${toEmail}:`, error);
  }
}

// دالة توليد الـ PDF لطلبات الدفع
async function generatePaymentPDF(data) {
  try {
    const html = `
      <!DOCTYPE html><html><head><meta charset='UTF-8'>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;color:#111;line-height:1.6}
        .header{display:flex;justify-content:space-between;border-bottom:2px solid #e5e7eb;padding-bottom:20px;margin-bottom:20px}
        .title{font-size:24px;font-weight:900;letter-spacing:4px}
        .row{display:flex;margin-bottom:8px}
        .label{width:150px;font-weight:bold;color:#6b7280;text-transform:uppercase;font-size:11px}
        .val{font-size:13px;font-weight:600}
        .amount-box{text-align:center;padding:20px;background:#f8fafc;border:1px solid #e2e8f0;margin:20px 0;border-radius:8px}
      </style></head><body>
        <div class="header">
          <div><div class="title">GNK</div><div style="font-size:10px;color:#64748b">GROUP OPERATIONS</div></div>
          <div style="text-align:right">
            <div style="font-size:16px;font-weight:bold">${data.request_id}</div>
            <div style="font-size:12px;color:#2563eb;font-weight:bold;margin-top:5px">${data.status || 'Pending'}</div>
          </div>
        </div>
        <div class="row"><div class="label">Requested By</div><div class="val">${data.name}</div></div>
        <div class="row"><div class="label">Project</div><div class="val">${data.project}</div></div>
        <div class="row"><div class="label">Department</div><div class="val">${data.department}</div></div>
        <div class="row"><div class="label">Due Date</div><div class="val">${data.due_date}</div></div>
        
        <div class="amount-box">
          <div style="font-size:28px;font-weight:900">${data.amount} ${data.currency}</div>
          <div style="font-size:11px;color:#64748b;margin-top:5px">APPROVED AMOUNT</div>
        </div>
        
        <div class="row"><div class="label">Purpose</div><div class="val" style="background:#f1f5f9;padding:10px;flex:1;border-radius:6px">${data.description}</div></div>
      </body></html>
    `;

    const dir = path.join(__dirname, '../uploads/pdfs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const fileName = `${data.request_id}.pdf`;
    const filePath = path.join(dir, fileName);

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setContent(html);
    await page.pdf({ path: filePath, format: 'A4', printBackground: true });
    await browser.close();

    console.log(`✅ PDF Generated: ${fileName}`);
    return `/pdfs/${fileName}`; 

  } catch (error) {
    console.error('❌ PDF Generation Error:', error);
    return null;
  }
}

// دالة توليد الـ PDF لسند الاستلام (Receiving Voucher)
async function generateReceivingPDF(data) {
  try {
    let itemsHtml = '';
    let total = 0;
    
    if (data.items && data.items.length > 0) {
      data.items.forEach((it, i) => {
        const qty = parseFloat(it.qty) || 0;
        const price = parseFloat(it.price) || 0;
        const vat = Math.round(parseFloat(it.vat) || 0);
        const tax = Math.round(parseFloat(it.tax) || 0);
        const base = qty * price;
        const sub = base + (base * vat / 100) - (base * tax / 100);
        total += sub;
        
        itemsHtml += `<tr>
          <td style="padding:10px;border:1px solid #cbd5e1;text-align:center">${i + 1}</td>
          <td style="padding:10px;border:1px solid #cbd5e1">${it.desc || it.name || 'Item'}</td>
          <td style="padding:10px;border:1px solid #cbd5e1;text-align:center">${qty}</td>
          <td style="padding:10px;border:1px solid #cbd5e1;text-align:center">${it.unit || '-'}</td>
          <td style="padding:10px;border:1px solid #cbd5e1;text-align:right">${price.toFixed(2)}</td>
          <td style="padding:10px;border:1px solid #cbd5e1;text-align:center">${vat}%</td>
          <td style="padding:10px;border:1px solid #cbd5e1;text-align:center">${tax}%</td>
          <td style="padding:10px;border:1px solid #cbd5e1;text-align:right;font-weight:bold">${sub.toFixed(2)}</td>
        </tr>`;
      });
    }

    const html = `
      <!DOCTYPE html><html><head><meta charset='UTF-8'>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;color:#1e293b;line-height:1.6}
        .header{text-align:center;border-bottom:3px solid #0f172a;padding-bottom:20px;margin-bottom:30px}
        table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px}
        th{background:#0f172a;color:#fff;padding:12px;text-align:center;text-transform:uppercase}
        .box{background:#f8fafc;padding:15px;border:1px solid #e2e8f0;border-radius:8px;width:48%}
      </style></head><body>
        <div class="header">
          <h2 style="margin:0;letter-spacing:2px">${data.type === 'Services' ? 'SERVICE RECEIPT NOTE' : 'GOODS RECEIPT NOTE'}</h2>
          <h3 style="color:#2563eb;margin:10px 0 0 0;letter-spacing:1px">${data.rec_number}</h3>
        </div>
        
        <div style="display:flex;justify-content:space-between;margin-bottom:20px;font-size:13px">
          <div class="box">
            <p><strong>Supplier:</strong> ${data.supplier}</p>
            <p><strong>Project:</strong> ${data.project}</p>
            ${data.paymentRequestId ? `<p><strong>Linked PR:</strong> <span style="color:#2563eb">${data.paymentRequestId}</span></p>` : ''}
          </div>
          <div class="box">
            <p><strong>Received By:</strong> ${data.employeeName}</p>
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB')}</p>
          </div>
        </div>

        <table>
          <thead><tr><th>#</th><th>Item Description</th><th>Qty</th><th>Unit</th><th>Price</th><th>VAT</th><th>Tax</th><th>Subtotal</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        
        <h2 style="text-align:right;margin-top:20px;color:#16a34a">TOTAL: ${total.toFixed(2)} L.E</h2>
        
        <div style="margin-top:40px;font-size:11px;color:#64748b;text-align:center;border-top:1px solid #e2e8f0;padding-top:10px">
          I confirm the received items match the invoice and quantities. | GNK Operations System
        </div>
      </body></html>
    `;

    const dir = path.join(__dirname, '../uploads/pdfs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const fileName = `${data.rec_number}.pdf`;
    const filePath = path.join(dir, fileName);

    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setContent(html);
    await page.pdf({ path: filePath, format: 'A4', printBackground: true });
    await browser.close();

    console.log(`✅ Receiving PDF Generated: ${fileName}`);
    return `/pdfs/${fileName}`;
  } catch (error) {
    console.error('❌ Receiving PDF Error:', error);
    return null;
  }
}

module.exports = { sendEmailGNK, generatePaymentPDF, generateReceivingPDF };