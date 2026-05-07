import { useState } from 'react';
import api from '../api';

export default function PaymentForm({ user }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  // بيانات الفورم
  const [formData, setFormData] = useState({
    requestedBy: user?.employeeName || '',
    project: '',
    department: '',
    amount: '',
    currency: 'L.E',
    purpose: '',
    dueDate: '',
    managerEmail: '',
    notes: '',
    paymentTerms: ''
  });
  
  const [paymentTermsOther, setPaymentTermsOther] = useState('');
  const [files, setFiles] = useState([]);

  // التعامل مع اختيار الملفات (نفس قيود السيستم القديم)
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const MAX_FILES = 10;
    const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200MB

    let newFiles = [...files, ...selectedFiles];
    
    if (newFiles.length > MAX_FILES) {
      alert(`❌ Maximum ${MAX_FILES} files allowed.`);
      newFiles = newFiles.slice(0, MAX_FILES);
    }

    const totalSize = newFiles.reduce((acc, file) => acc + file.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      alert("❌ Total size exceeds 200MB limit.");
      return;
    }

    setFiles(newFiles);
    e.target.value = ''; // Reset
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  // إرسال الطلب
  const handleSubmit = async () => {
    setError('');
    
    // 1. Validation (التحقق من البيانات)
    if (!formData.requestedBy || !formData.project || !formData.department || !formData.amount || !formData.purpose || !formData.dueDate || !formData.managerEmail) {
      setError('⚠️ Please fill all required fields (*)');
      window.scrollTo(0, 0);
      return;
    }

    let finalTerms = formData.paymentTerms;
    if (finalTerms === 'Other') {
      if (!paymentTermsOther) {
        setError('⚠️ Please specify the other payment terms');
        window.scrollTo(0, 0);
        return;
      }
      finalTerms = paymentTermsOther;
    } else if (!finalTerms) {
      setError('⚠️ Please select payment terms');
      window.scrollTo(0, 0);
      return;
    }

    setLoading(true);

    try {
      let attachmentUrls = [];

      // 2. رفع الملفات أولاً (لو موجودة)
      if (files.length > 0) {
        const fileData = new FormData();
        files.forEach(f => fileData.append('attachments', f));

        const uploadRes = await api.post('/upload', fileData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (uploadRes.data.success) {
          attachmentUrls = uploadRes.data.urls;
        } else {
          throw new Error('File upload failed');
        }
      }

      // 3. إرسال بيانات الطلب للباك إند
      const payload = {
        email: user?.email,
        ...formData,
        paymentTerms: finalTerms,
        attachmentUrls: attachmentUrls
      };

      const res = await api.post('/payments/submit', payload);

      if (res.data.success) {
        // عرض شاشة النجاح
        setSuccessData({
          requestId: res.data.data.request_id,
          // الـ PDF لسه هيتعمل لما المدير يوافق، فممكن نعرض رسالة بس
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

  // شاشة النجاح
  if (successData) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '50px 20px' }}>
        <div style={{ width: '68px', height: '68px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '34px', margin: '0 auto 18px' }}>✅</div>
        <h2 style={{ fontSize: '20px', marginBottom: '6px' }}>Payment Request Submitted</h2>
        <p style={{ color: '#4a5568', marginBottom: '20px' }}>Your request has been submitted and sent to your manager for approval.</p>
        <div style={{ display: 'inline-block', fontFamily: 'monospace', fontSize: '18px', fontWeight: '700', color: '#2563eb', background: '#eff6ff', padding: '10px 26px', borderRadius: '8px', marginBottom: '20px' }}>
          {successData.requestId}
        </div>
        <br/>
        <button 
          onClick={() => { setSuccessData(null); setFormData({...formData, amount: '', purpose: ''}); setFiles([]); }} 
          style={{ padding: '10px 22px', background: 'transparent', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', fontWeight: '600', color: '#4a5568', cursor: 'pointer' }}
        >
          + New Request
        </button>
      </div>
    );
  }

  return (
    <div id="paymentForm">
      <div style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: '14px 20px', marginBottom: '16px', borderRadius: '8px', fontSize: '13px', color: '#92400e', fontWeight: '600' }}>
        ⚠️ Any payment must be requested at least 48 hours before the due date.
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1.5px solid #dc2626', color: '#dc2626', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: '600', textAlign: 'center' }}>{error}</div>}

      <div className="card" style={{ border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📋 Request Information</span>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          
          <div style={{ gridColumn: '1 / -1' }} className="field">
            <label>Your Email</label>
            <input type="email" value={user?.email || ''} readOnly style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }} />
          </div>

          <div className="field">
            <label>Your Name <span style={{color: '#dc2626'}}>*</span></label>
            <input type="text" value={formData.requestedBy} onChange={e => setFormData({...formData, requestedBy: e.target.value})} placeholder="Full name" />
          </div>

          <div className="field">
            <label>Project <span style={{color: '#dc2626'}}>*</span></label>
            <select value={formData.project} onChange={e => setFormData({...formData, project: e.target.value})}>
              <option value="">— Select Project —</option>
              <option>byGanz</option><option>Head Office</option><option>Buoy</option>
              <option>Studio Samara</option><option>Mazeej</option>
              <option>KiKi's White</option><option>KiKi's Henies</option>
              <option>SAX</option><option>Gar El-Qamer</option>
            </select>
          </div>

          <div className="field">
            <label>Department <span style={{color: '#dc2626'}}>*</span></label>
            <select value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})}>
              <option value="">— Choose —</option>
              <option>HR</option><option>Logistics</option><option>Hospitality</option>
              <option>IT</option><option>Marketing</option><option>Accounting</option>
              <option>Engineering</option><option>Operation</option>
            </select>
          </div>

          <div className="field">
            <label>Manager Email (Approver) <span style={{color: '#dc2626'}}>*</span></label>
            <select value={formData.managerEmail} onChange={e => setFormData({...formData, managerEmail: e.target.value})}>
              <option value="">— Select Manager —</option>
              <option value="kareem@gnk.group">kareem@gnk.group</option>
              <option value="ganz@byganz.com">ganz@byganz.com</option>
              <option value="marylise.michael@gnk.group">marylise.michael@gnk.group</option>
              <option value="treasury@gnk.group">treasury@gnk.group</option>
              {/* ضيف بقية المديرين هنا */}
            </select>
          </div>

          <div className="field">
            <label>Amount <span style={{color: '#dc2626'}}>*</span></label>
            <input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" />
          </div>

          <div className="field">
            <label>Currency <span style={{color: '#dc2626'}}>*</span></label>
            <select value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})}>
              <option value="L.E">L.E (Egyptian Pound)</option>
              <option value="USD">USD (US Dollar)</option>
              <option value="EUR">EUR (Euro)</option>
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1' }} className="field">
            <label>Purpose <span style={{color: '#dc2626'}}>*</span></label>
            <textarea value={formData.purpose} onChange={e => setFormData({...formData, purpose: e.target.value})} placeholder="Describe the purpose..." style={{ minHeight: '80px' }}></textarea>
          </div>

          <div className="field">
            <label>Due Date <span style={{color: '#dc2626'}}>*</span></label>
            <input type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} />
          </div>

          <div style={{ gridColumn: '1 / -1' }} className="field">
            <label>Payment Terms <span style={{color: '#dc2626'}}>*</span></label>
            <div style={{ display: 'flex', gap: '15px', marginTop: '5px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}>
                <input type="radio" name="terms" value="Deposit" checked={formData.paymentTerms === 'Deposit'} onChange={e => setFormData({...formData, paymentTerms: e.target.value})} /> Deposit
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}>
                <input type="radio" name="terms" value="Full payment" checked={formData.paymentTerms === 'Full payment'} onChange={e => setFormData({...formData, paymentTerms: e.target.value})} /> Full payment
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}>
                <input type="radio" name="terms" value="Other" checked={formData.paymentTerms === 'Other'} onChange={e => setFormData({...formData, paymentTerms: e.target.value})} /> Other:
                <input 
                  type="text" 
                  disabled={formData.paymentTerms !== 'Other'} 
                  value={paymentTermsOther}
                  onChange={e => setPaymentTermsOther(e.target.value)}
                  placeholder="Specify..." 
                  style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none' }}
                />
              </label>
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1' }} className="field">
            <label>Attachments <span style={{ color: '#94a3b8', fontWeight: '400' }}>(optional, max 10 files)</span></label>
            <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block', width: '100%' }}>
              <input type="file" id="p_fileInput" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileSelect} style={{ position: 'absolute', left: '-9999px' }} />
              <label htmlFor="p_fileInput" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', height: '40px', border: '1.5px dashed #2563eb', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                📤 Click to upload files
              </label>
            </div>
            
            {files.length > 0 && (
              <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {files.map((file, i) => (
                  <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', color: '#334155' }}>
                    📄 {file.name.substring(0, 20)}... <span style={{color: '#94a3b8'}}>({(file.size/1024/1024).toFixed(1)}MB)</span>
                    <button onClick={() => removeFile(i)} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      <button 
        onClick={handleSubmit} 
        disabled={loading}
        style={{ width: '100%', height: '50px', background: loading ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: loading ? 'none' : '0 4px 14px rgba(37,99,235,0.3)' }}
      >
        {loading ? 'Processing...' : 'Submit Payment Request'}
      </button>

    </div>
  );
}