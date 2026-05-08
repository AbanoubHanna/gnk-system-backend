import { useState, useMemo } from 'react';
import api from '../api';

export default function ReceivingForm({ user }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  // بيانات الفورم الأساسية
  const [formData, setFormData] = useState({
    employeeName: user?.employeeName || '',
    jobTitle: '',
    supplier: '',
    supplierId: '',
    project: '',
    type: '',
    paymentRequestId: '', // لو حابب يربط بطلب دفع
  });

  const [confirmChecked, setConfirmChecked] = useState(false);
  const [files, setFiles] = useState([]);

  // جدول الأصناف الديناميكي (ببدأ بصف واحد فاضي)
  const [items, setItems] = useState([
    { name: '', qty: '', unit: '', price: '', vat: '0', tax: '0' }
  ]);

  // إضافة صف جديد
  const addRow = () => {
    setItems([...items, { name: '', qty: '', unit: '', price: '', vat: '0', tax: '0' }]);
  };

  // حذف صف
  const removeRow = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  // تحديث بيانات صف معين
  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  // حساب التوتال النهائي بشكل ديناميكي (Live Calculation)
  const grandTotal = useMemo(() => {
    return items.reduce((total, it) => {
      const qty = parseFloat(it.qty) || 0;
      const price = parseFloat(it.price) || 0;
      const vat = parseFloat(it.vat) || 0;
      const tax = parseFloat(it.tax) || 0;
      const base = qty * price;
      const subtotal = base + (base * vat / 100) - (base * tax / 100);
      return total + subtotal;
    }, 0);
  }, [items]);

  // رفع الملفات
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    let newFiles = [...files, ...selectedFiles];
    if (newFiles.length > 10) {
      alert("❌ Maximum 10 files allowed.");
      newFiles = newFiles.slice(0, 10);
    }
    const totalSize = newFiles.reduce((acc, f) => acc + f.size, 0);
    if (totalSize > 200 * 1024 * 1024) {
      alert("❌ Total size exceeds 200MB limit.");
      return;
    }
    setFiles(newFiles);
    e.target.value = '';
  };

  // الإرسال للباك إند
  const handleSubmit = async () => {
    setError('');

    // 1. Validation
    if (!formData.employeeName || !formData.jobTitle || !formData.supplier || !formData.project || !formData.type) {
      setError('⚠️ Please fill all required general information fields (*)');
      window.scrollTo(0, 0); return;
    }
    if (!confirmChecked) {
      setError('⚠️ You must confirm the items at the bottom of the form.');
      return;
    }

    // التحقق من الأصناف
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.name || !it.qty || !it.price) {
        setError(`⚠️ Row ${i + 1}: Description, Qty, and Price are required.`);
        return;
      }
    }

    setLoading(true);

    try {
      let attachmentUrls = [];

      // 2. رفع الملفات أولاً
      if (files.length > 0) {
        const fileData = new FormData();
        files.forEach(f => fileData.append('attachments', f));
        const uploadRes = await api.post('/upload', fileData, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (uploadRes.data.success) {
          attachmentUrls = uploadRes.data.urls;
        } else { throw new Error('File upload failed'); }
      }

      // 3. إرسال بيانات الاستلام
      const payload = {
        email: user?.email,
        ...formData,
        items: items,
        attachments: attachmentUrls
      };

      const res = await api.post('/receivings/submit', payload);

      if (res.data.success) {
        setSuccessData({
          recNumber: res.data.recNumber,
          pdfUrl: res.data.pdfUrl
        });
      } else {
        setError(res.data.error || 'Submission failed');
      }

    } catch (err) {
      console.error(err);
      setError('❌ Connection error. Please try again.');
    }
    setLoading(false);
  };

  if (successData) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '50px 20px' }}>
        <div style={{ width: '68px', height: '68px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '34px', margin: '0 auto 18px' }}>✅</div>
        <h2 style={{ fontSize: '20px', marginBottom: '6px' }}>Receipt Submitted Successfully</h2>
        <p style={{ color: '#4a5568', marginBottom: '20px' }}>Your Receipt Note has been saved and the PDF is generated.</p>
        <div style={{ display: 'inline-block', fontFamily: 'monospace', fontSize: '18px', fontWeight: '700', color: '#7c3aed', background: '#faf5ff', padding: '10px 26px', borderRadius: '8px', marginBottom: '20px' }}>
          {successData.recNumber}
        </div>
        <br/>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {successData.pdfUrl && (
            <a href={`http://localhost:5000${successData.pdfUrl}`} target="_blank" rel="noreferrer" style={{ padding: '12px 26px', background: '#16a34a', color: '#fff', textDecoration: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700' }}>
              📄 Download PDF
            </a>
          )}
          <button 
            onClick={() => { setSuccessData(null); setItems([{ name: '', qty: '', unit: '', price: '', vat: '0', tax: '0' }]); setFiles([]); setConfirmChecked(false); }} 
            style={{ padding: '12px 22px', background: 'transparent', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', fontWeight: '600', color: '#4a5568', cursor: 'pointer' }}
          >
            + New Receipt
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="receivingForm">
      {error && <div style={{ background: '#fef2f2', border: '1.5px solid #dc2626', color: '#dc2626', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: '600', textAlign: 'center' }}>{error}</div>}

      {/* 1. General Information */}
      <div className="card" style={{ border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📋 General Information</span>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ gridColumn: '1 / -1' }} className="field">
            <label>Your Email</label>
            <input type="email" value={user?.email || ''} readOnly style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }} />
          </div>
          <div className="field">
            <label>Employee Name <span style={{color: '#dc2626'}}>*</span></label>
            <input type="text" value={formData.employeeName} onChange={e => setFormData({...formData, employeeName: e.target.value})} placeholder="Full name" />
          </div>
          <div className="field">
            <label>Job Title <span style={{color: '#dc2626'}}>*</span></label>
            <input type="text" value={formData.jobTitle} onChange={e => setFormData({...formData, jobTitle: e.target.value})} placeholder="e.g. Procurement Officer" />
          </div>
          <div className="field">
            <label>Supplier Name <span style={{color: '#dc2626'}}>*</span></label>
            <input type="text" value={formData.supplier} onChange={e => setFormData({...formData, supplier: e.target.value})} placeholder="e.g. Al-Nour Trading" />
          </div>
          <div className="field">
            <label>Project <span style={{color: '#dc2626'}}>*</span></label>
            <select value={formData.project} onChange={e => setFormData({...formData, project: e.target.value})}>
              <option value="">— Select Project —</option>
              <option>byGanz</option><option>Head Office</option><option>Buoy</option><option>Studio Samara</option>
              <option>Mazeej</option><option>KiKi's White</option><option>KiKi's Henies</option><option>SAX</option>
            </select>
          </div>
          <div className="field">
            <label>Type <span style={{color: '#dc2626'}}>*</span></label>
            <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
              <option value="">— Select Type —</option>
              <option value="Goods">🛍️ Goods</option>
              <option value="Services">🛠️ Services</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Items Table */}
      <div className="card" style={{ border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📦 Items Received</span>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ background: '#111827', color: '#fff' }}>
              <tr>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: '11px' }}>#</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: '11px' }}>Item Description</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: '11px', width: '80px' }}>Qty</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: '11px', width: '100px' }}>Unit</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: '11px', width: '100px' }}>Price</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: '11px', width: '80px' }}>VAT%</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: '11px', width: '80px' }}>Tax%</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontSize: '11px' }}>Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const q = parseFloat(it.qty) || 0;
                const p = parseFloat(it.price) || 0;
                const v = parseFloat(it.vat) || 0;
                const t = parseFloat(it.tax) || 0;
                const base = q * p;
                const sub = base + (base * v / 100) - (base * t / 100);
                
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px', color: '#94a3b8' }}>{i + 1}</td>
                    <td style={{ padding: '8px' }}><input type="text" value={it.name} onChange={e => handleItemChange(i, 'name', e.target.value)} placeholder="Description" style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }} /></td>
                    <td style={{ padding: '8px' }}><input type="number" min="0" value={it.qty} onChange={e => handleItemChange(i, 'qty', e.target.value)} placeholder="0" style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }} /></td>
                    <td style={{ padding: '8px' }}>
                      <select value={it.unit} onChange={e => handleItemChange(i, 'unit', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', background: '#fff' }}>
                        <option value="">Unit</option><option>pcs</option><option>kg</option><option>box</option><option>m</option>
                      </select>
                    </td>
                    <td style={{ padding: '8px' }}><input type="number" min="0" value={it.price} onChange={e => handleItemChange(i, 'price', e.target.value)} placeholder="0.00" style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }} /></td>
                    <td style={{ padding: '8px' }}><input type="number" min="0" max="100" value={it.vat} onChange={e => handleItemChange(i, 'vat', e.target.value)} placeholder="0" style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }} /></td>
                    <td style={{ padding: '8px' }}><input type="number" min="0" max="100" value={it.tax} onChange={e => handleItemChange(i, 'tax', e.target.value)} placeholder="0" style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }} /></td>
                    <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', color: '#16a34a' }}>{sub.toFixed(2)}</td>
                    <td style={{ padding: '8px' }}>
                      <button onClick={() => removeRow(i)} style={{ width: '28px', height: '28px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8fafc' }}>
                <td colSpan="7" style={{ padding: '12px', textAlign: 'right', fontWeight: '700', color: '#475569', letterSpacing: '1px' }}>GRAND TOTAL</td>
                <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '800', fontSize: '16px', color: '#16a34a' }}>{grandTotal.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <button onClick={addRow} style={{ marginTop: '12px', padding: '8px 16px', background: 'transparent', border: '1.5px dashed #7c3aed', borderRadius: '8px', color: '#7c3aed', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
          ＋ Add Item
        </button>
      </div>

      {/* 3. Attachments */}
      <div className="card" style={{ border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📎 Attachments</span>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
        </div>
        <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block', width: '100%' }}>
          <input type="file" id="r_fileInput" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileSelect} style={{ position: 'absolute', left: '-9999px' }} />
          <label htmlFor="r_fileInput" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', height: '40px', border: '1.5px dashed #7c3aed', borderRadius: '8px', background: '#faf5ff', color: '#7c3aed', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            📤 Click to upload invoices
          </label>
        </div>
        {files.length > 0 && (
          <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {files.map((file, i) => (
              <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', color: '#334155' }}>
                📄 {file.name.substring(0, 20)}... <span style={{color: '#94a3b8'}}>({(file.size/1024/1024).toFixed(1)}MB)</span>
                <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Confirmation */}
      <div className="card" style={{ border: '1px solid #e2e8f0' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', cursor: 'pointer', fontWeight: '600', color: '#334155' }}>
          <input type="checkbox" checked={confirmChecked} onChange={e => setConfirmChecked(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#2563eb' }} />
          I confirm the received items match the invoice and quantities. <span style={{color: '#dc2626'}}>*</span>
        </label>
      </div>

      <button 
        onClick={handleSubmit} 
        disabled={loading}
        style={{ width: '100%', height: '50px', background: loading ? '#94a3b8' : '#7c3aed', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: loading ? 'none' : '0 4px 14px rgba(124,58,237,0.3)' }}
      >
        {loading ? 'Processing...' : 'Submit Receipt'}
      </button>

    </div>
  );
}
