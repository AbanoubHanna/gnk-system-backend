import React, { useState, useEffect } from 'react';
import { runGoogleScript } from '../api';

function PaymentForm({ user }) {
  const [formData, setFormData] = useState({
    requestedBy: user?.employeeName || '',
    jobTitle: user?.jobTitle || '',
    project: '',
    department: user?.department || '',
    amount: '',
    currency: 'L.E',
    purpose: '',
    dueDate: '',
    managerEmail: user?.managerEmail || '',
    notes: '',
    paymentTerms: '',
    paymentTermsOther: ''
  });

  const [receivings, setReceivings] = useState([]);
  const [selectedReceivings, setSelectedReceivings] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successData, setSuccessData] = useState({});

  useEffect(() => {
    if (user?.email) {
      loadReceivings(user.email);
    }
  }, [user]);

  const loadReceivings = async (email) => {
    setLoadingRecs(true);
    try {
      const res = await runGoogleScript('getUnlinkedReceivings', email);
      if (res && res.success) {
        setReceivings(res.receivings || []);
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingRecs(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleRecToggle = (rec) => {
    if (selectedReceivings.find(r => r.recNumber === rec.recNumber)) {
      setSelectedReceivings(selectedReceivings.filter(r => r.recNumber !== rec.recNumber));
    } else {
      setSelectedReceivings([...selectedReceivings, rec]);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    let newFiles = [...files];
    
    for (let i = 0; i < selectedFiles.length; i++) {
      if (newFiles.length >= 10) {
        alert("❌ Max 10 files allowed");
        break;
      }
      let totalMB = newFiles.reduce((acc, f) => acc + f.size, 0) + selectedFiles[i].size;
      if (totalMB > 200 * 1024 * 1024) {
        alert("❌ Total size exceeds 200MB limit");
        break;
      }
      newFiles.push(selectedFiles[i]);
    }
    setFiles(newFiles);
    e.target.value = ''; // Reset input
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const totalReceived = selectedReceivings.reduce((sum, r) => sum + r.totalAmount, 0);

  const handleSubmit = async () => {
    setError('');
    
    // Validation
    if (!formData.requestedBy) return setError("Name required");
    if (!formData.jobTitle) return setError("Job title required");
    if (!formData.project) return setError("Project required");
    if (!formData.department) return setError("Department required");
    if (!formData.amount || parseFloat(formData.amount) <= 0) return setError("Amount > 0 required");
    if (!formData.purpose) return setError("Purpose required");
    if (!formData.dueDate) return setError("Due date required");
    if (!formData.managerEmail) return setError("Manager email required");
    
    let pt = formData.paymentTerms;
    if (pt === 'Other') {
      pt = formData.paymentTermsOther;
      if (!pt) return setError("Specify payment terms");
    } else if (!pt) {
      return setError("Payment terms required");
    }

    const dueDate = new Date(formData.dueDate + "T23:59:59");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if ((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60) < 48) {
      return setError("Due date must be at least 48 hours from today");
    }

    if (selectedReceivings.length > 0 && parseFloat(formData.amount) > totalReceived + 0.01) {
      return setError("Amount exceeds total received");
    }

    const payload = {
      email: user.email,
      requestedBy: formData.requestedBy,
      jobTitle: formData.jobTitle,
      project: formData.project,
      department: formData.department,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      purpose: formData.purpose,
      dueDate: formData.dueDate,
      managerEmail: formData.managerEmail,
      notes: formData.notes,
      paymentTerms: pt,
      receivingIds: selectedReceivings.map(r => r.recNumber),
      attachmentUrls: []
    };

    setLoading(true);

    if (files.length > 0) {
      uploadFilesSequential(files, 0, [], payload);
    } else {
      submitToGAS(payload);
    }
  };

  const uploadFilesSequential = (fileArray, index, urls, payload) => {
    if (index >= fileArray.length) {
      payload.attachmentUrls = urls;
      submitToGAS(payload);
      return;
    }
    const file = fileArray[index];
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const res = await runGoogleScript('uploadFile', file.name, e.target.result);
        if (res && res.success && res.url) {
          urls.push(res.url);
        }
        uploadFilesSequential(fileArray, index + 1, urls, payload);
      } catch (err) {
        console.error("Upload error:", err);
        uploadFilesSequential(fileArray, index + 1, urls, payload);
      }
    };
    reader.readAsDataURL(file);
  };

  const submitToGAS = async (payload) => {
    try {
      const res = await runGoogleScript('submitPaymentRequest', payload);
      if (res && res.success) {
        setSuccessData(res);
        setSuccess(true);
      } else {
        setError(res ? res.error : "Unknown error");
      }
    } catch (err) {
      setError("Connection error: " + err.message);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="success-screen" style={{ display: 'block' }}>
        <div className="success-icon">✅</div>
        <h2>Payment Request Submitted</h2>
        <p>Your request has been submitted and sent for approval.</p>
        <div className="rec-badge">{successData.requestId}</div><br/>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' }}>
          {successData.pdfUrl && (
            <a href={successData.pdfUrl} target="_blank" rel="noreferrer" className="btn-submit" style={{ width: 'auto', padding: '0 26px', background: '#2c3e50' }}>
              🖨️ Print / View PDF
            </a>
          )}
          <button className="btn-new" onClick={() => { setSuccess(false); setFormData({...formData, amount: '', purpose: ''}); setFiles([]); setSelectedReceivings([]); }}>
            + New Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="notice-banner">⚠️ Any payment must be requested at least 48 hours before the due date.</div>
      {error && <div className="validation-error" style={{ display: 'block' }}>{error}</div>}
      
      <div className="card">
        <div className="card-title">📋 Request Information</div>
        <div className="grid">
          <div className="field full"><label>Your Email</label><input type="email" readOnly value={user.email} /></div>
          <div className="field"><label>Your Name <span className="req">*</span></label><input type="text" name="requestedBy" value={formData.requestedBy} onChange={handleInputChange} /></div>
          <div className="field"><label>Job Title <span className="req">*</span></label><input type="text" name="jobTitle" value={formData.jobTitle} onChange={handleInputChange} /></div>
          <div className="field">
            <label>Project <span className="req">*</span></label>
            <select name="project" value={formData.project} onChange={handleInputChange}>
              <option value="">— Select Project —</option>
              <option>byGanz</option><option>Head Office</option><option>Buoy</option><option>Studio Samara</option><option>Mazeej</option><option>KiKi's White</option><option>KiKi's Henies</option><option>SAX</option><option>Gar El-Qamer</option>
            </select>
          </div>
          <div className="field">
            <label>Department <span className="req">*</span></label>
            <select name="department" value={formData.department} onChange={handleInputChange}>
              <option value="">— Choose —</option>
              <option>HR</option><option>Logistics</option><option>Hospitality</option><option>IT</option><option>Marketing</option><option>Accounting</option><option>Engineering</option><option>Operation</option>
            </select>
          </div>
          <div className="field"><label>Amount <span className="req">*</span></label><input type="number" name="amount" value={formData.amount} onChange={handleInputChange} /></div>
          <div className="field">
            <label>Currency <span className="req">*</span></label>
            <select name="currency" value={formData.currency} onChange={handleInputChange}>
              <option value="L.E">L.E (Egyptian Pound)</option><option value="USD">USD (US Dollar)</option><option value="EUR">EUR (Euro)</option>
            </select>
          </div>
          <div className="field full"><label>Purpose <span className="req">*</span></label><textarea name="purpose" value={formData.purpose} onChange={handleInputChange}></textarea></div>
          <div className="field"><label>Due Date <span className="req">*</span></label><input type="date" name="dueDate" value={formData.dueDate} onChange={handleInputChange} /></div>
          <div className="field full">
            <label>Manager Email (Approver) <span className="req">*</span></label>
            <select name="managerEmail" value={formData.managerEmail} onChange={handleInputChange}>
              <option value="">— Select Manager —</option>
              <option value="kareem@gnk.group">kareem@gnk.group</option>
              {/* ضيف باقي الإيميلات هنا زي ما في الـ HTML */}
            </select>
          </div>
          <div className="field full"><label>Notes <span className="opt">(optional)</span></label><textarea name="notes" value={formData.notes} onChange={handleInputChange}></textarea></div>
          
          <div className="field full">
            <label>Attachments <span className="opt">(optional, max 10 files)</span></label>
            <div className="file-input-wrapper">
              <input type="file" id="p_fileInput" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileSelect} />
              <label htmlFor="p_fileInput" className="file-input-label">📤 Click to upload files</label>
            </div>
            <div className="files-list">
              {files.map((f, i) => (
                <div key={i} className="file-tag">
                  📄 {f.name.substring(0, 25)} <span style={{color:'#94a3b8', fontSize:'11px'}}>({(f.size/1024/1024).toFixed(1)}MB)</span>
                  <button type="button" onClick={() => removeFile(i)}>✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="field full">
            <label>Payment Terms <span className="req">*</span></label>
            <div className="terms-group">
              <label><input type="radio" name="paymentTerms" value="Deposit" onChange={handleInputChange} /> Deposit</label>
              <label><input type="radio" name="paymentTerms" value="Full payment" onChange={handleInputChange} /> Full payment</label>
              <label>
                <input type="radio" name="paymentTerms" value="Other" onChange={handleInputChange} /> Other:
                <input type="text" name="paymentTermsOther" value={formData.paymentTermsOther} onChange={handleInputChange} disabled={formData.paymentTerms !== 'Other'} style={{flex:1, marginLeft:'8px'}} />
              </label>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          {loadingRecs ? <div className="loading-msg" style={{display:'block'}}>⏳ Loading receiving vouchers…</div> : (
            <>
              <span className="link-label">📦 Your Receiving Vouchers — select to link <span className="opt">(optional)</span></span>
              {receivings.length === 0 ? <div className="link-empty">No unlinked receiving vouchers</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {receivings.map(rec => (
                    <label key={rec.recNumber} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', border: '1.5px solid', borderColor: selectedReceivings.find(r => r.recNumber === rec.recNumber) ? '#2563eb' : '#e2e8f0', background: selectedReceivings.find(r => r.recNumber === rec.recNumber) ? '#eff6ff' : '#fff', borderRadius: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!selectedReceivings.find(r => r.recNumber === rec.recNumber)} onChange={() => handleRecToggle(rec)} style={{ width: '17px', height: '17px', cursor: 'pointer' }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#2563eb' }}>{rec.recNumber}</span>
                        <span style={{ fontSize: '12px', color: '#4a5568' }}>{rec.project} • {rec.supplier} • {rec.totalAmount.toFixed(2)}</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {selectedReceivings.length > 0 && (
                <div className="amount-display" style={{ display: 'block' }}>
                  <div className="total-label">Total Received Amount</div>
                  <div className="total-value">{totalReceived.toFixed(2)}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <button className="btn-submit" onClick={handleSubmit} disabled={loading}>
        {loading ? 'Processing...' : 'Submit Payment Request'}
      </button>
    </div>
  );
}

export default PaymentForm;
