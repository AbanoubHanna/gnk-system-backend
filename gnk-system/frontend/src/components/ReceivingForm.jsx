import React, { useState, useEffect } from 'react';
import { runGoogleScript } from '../api';

function ReceivingForm({ user }) {
  const [formData, setFormData] = useState({
    employeeName: user?.employeeName || '',
    jobTitle: user?.jobTitle || '',
    supplier: '',
    supplierId: '',
    project: '',
    type: ''
  });

  const [items, setItems] = useState([{ id: 1, name: '', qty: '', unit: '', price: '', vat: '', tax: '', sub: 0 }]);
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [files, setFiles] = useState([]);
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successData, setSuccessData] = useState({});

  useEffect(() => {
    if (user?.email) loadRequests(user.email);
  }, [user]);

  const loadRequests = async (email) => {
    setLoadingReqs(true);
    try {
      const res = await runGoogleScript('getUserRequests', email);
      if (res && res.success) {
        setRequests(res.requests || []);
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingReqs(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // ── Items Table Logic ──
  const addItem = () => {
    setItems([...items, { id: Date.now(), name: '', qty: '', unit: '', price: '', vat: '', tax: '', sub: 0 }]);
  };

  const removeItem = (id) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id, field, value) => {
    const newItems = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        // Calculate subtotal
        const qty = parseFloat(updatedItem.qty) || 0;
        const price = parseFloat(updatedItem.price) || 0;
        const vat = Math.round(parseFloat(updatedItem.vat) || 0);
        const tax = Math.round(parseFloat(updatedItem.tax) || 0);
        const base = qty * price;
        updatedItem.sub = base + (base * vat / 100) - (base * tax / 100);
        return updatedItem;
      }
      return item;
    });
    setItems(newItems);
  };

  const grandTotal = items.reduce((sum, item) => sum + item.sub, 0);

  // ── File Logic ──
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    let newFiles = [...files];
    for (let i = 0; i < selectedFiles.length; i++) {
      if (newFiles.length >= 10) { alert("❌ Max 10 files"); break; }
      if (selectedFiles[i].size > 100 * 1024 * 1024) { alert(`❌ ${selectedFiles[i].name} exceeds 100MB`); continue; }
      let totalMB = newFiles.reduce((acc, f) => acc + f.size, 0) + selectedFiles[i].size;
      if (totalMB > 200 * 1024 * 1024) { alert("❌ Total size exceeds 200MB"); break; }
      newFiles.push(selectedFiles[i]);
    }
    setFiles(newFiles);
    e.target.value = '';
  };

  const handleSubmit = async () => {
    setError('');
    
    if (!formData.employeeName) return setError("Name required");
    if (!formData.supplier) return setError("Supplier required");
    if (!formData.project) return setError("Project required");
    if (!formData.type) return setError("Type required");
    if (!confirmCheckbox) return setError("Please confirm the items");

    const validItems = items.filter(it => it.name.trim() !== '');
    if (validItems.length === 0) return setError("Add at least one item");

    for (let i = 0; i < validItems.length; i++) {
      let it = validItems[i];
      if (!it.qty || parseFloat(it.qty) <= 0) return setError(`Row ${i+1}: Qty required`);
      if (!it.price || parseFloat(it.price) < 0) return setError(`Row ${i+1}: Price required`);
      if (it.vat === '') return setError(`Row ${i+1}: VAT required`);
      if (it.tax === '') return setError(`Row ${i+1}: Tax WHT required`);
    }

    if (selectedRequest && grandTotal > selectedRequest.remainingAmount + 0.01) {
      return setError(`Receipt total exceeds remaining balance (${selectedRequest.remainingAmount.toFixed(2)})`);
    }

    const payload = {
      email: user.email,
      employeeName: formData.employeeName,
      jobTitle: formData.jobTitle,
      supplier: formData.supplier,
      supplierId: formData.supplierId,
      project: formData.project,
      type: formData.type,
      items: validItems.map(it => ({ name: it.name, qty: it.qty, unit: it.unit, price: it.price, vat: it.vat, tax: it.tax })),
      paymentRequestId: selectedRequest ? selectedRequest.requestId : "",
      attachmentUrls: [],
      refundAgreed: "NO" // ويمكنك إضافة المودال الخاص بها لاحقاً
    };

    setLoading(true);
    if (files.length > 0) {
      uploadFilesAtomically(files, payload);
    } else {
      submitToGAS(payload);
    }
  };

  const uploadFilesAtomically = (fileArray, payload) => {
    // محاكاة رفع الملفات المتتالية زي HTML
    let urls = [];
    const uploadNext = (index) => {
      if (index >= fileArray.length) {
        payload.attachmentUrls = urls;
        submitToGAS(payload);
        return;
      }
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const res = await runGoogleScript('uploadFile', fileArray[index].name, e.target.result);
          if (res && res.success && res.url) urls.push(res.url);
          uploadNext(index + 1);
        } catch (err) {
          setError(`Upload failed for ${fileArray[index].name}`);
          setLoading(false);
        }
      };
      reader.readAsDataURL(fileArray[index]);
    };
    uploadNext(0);
  };

  const submitToGAS = async (payload) => {
    try {
      const res = await runGoogleScript('submitReceiving', payload);
      if (res && res.success) {
        setSuccessData(res);
        setSuccess(true);
      } else {
        setError(res ? res.error : "Error");
      }
    } catch (err) {
      setError("Connection error");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="success-screen" style={{ display: 'block' }}>
        <div className="success-icon">✅</div>
        <h2>Receipt Submitted</h2>
        <div className="rec-badge">{successData.recNumber}</div><br/>
        {successData.pdfUrl && <a href={successData.pdfUrl} target="_blank" rel="noreferrer" className="btn-download">📄 Download PDF</a>}
        <br/><button className="btn-new" onClick={() => { setSuccess(false); setItems([{ id: 1, name: '', qty: '', unit: '', price: '', vat: '', tax: '', sub: 0 }]); setFiles([]); setSelectedRequest(null); }}>+ New Receipt</button>
      </div>
    );
  }

  return (
    <div>
      {error && <div className="validation-error" style={{ display: 'block' }}>{error}</div>}
      <div className="card">
        <div className="card-title">📋 General Information</div>
        <div className="grid">
          <div className="field full"><label>Your Email</label><input type="email" readOnly value={user.email} /></div>
          <div className="field"><label>Employee Name</label><input type="text" name="employeeName" value={formData.employeeName} onChange={handleInputChange} /></div>
          <div className="field"><label>Job Title</label><input type="text" name="jobTitle" value={formData.jobTitle} onChange={handleInputChange} /></div>
          <div className="field"><label>Supplier Name</label><input type="text" name="supplier" value={formData.supplier} onChange={handleInputChange} /></div>
          <div className="field"><label>Supplier ID</label><input type="text" name="supplierId" value={formData.supplierId} onChange={handleInputChange} /></div>
          <div className="field">
            <label>Project</label>
            <select name="project" value={formData.project} onChange={handleInputChange}>
              <option value="">— Select —</option>
              <option>byGanz</option><option>Head Office</option><option>Buoy</option><option>Studio Samara</option><option>Mazeej</option><option>KiKi's White</option><option>KiKi's Henies</option><option>SAX</option><option>Gar El-Qamer</option>
            </select>
          </div>
          <div className="field">
            <label>Type</label>
            <select name="type" value={formData.type} onChange={handleInputChange}>
              <option value="">— Select —</option>
              <option value="Goods">🛍️ Goods</option>
              <option value="Services">🛠️ Services</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          {loadingReqs ? <div className="loading-msg" style={{display:'block'}}>⏳ Loading open requests…</div> : (
            <>
              <span className="link-label">💳 Your Open Requests — select ONE to link <span className="opt">(optional)</span></span>
              {requests.map(req => (
                <label key={req.requestId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', border: '1.5px solid', borderColor: selectedRequest?.requestId === req.requestId ? '#2563eb' : '#e2e8f0', background: selectedRequest?.requestId === req.requestId ? '#eff6ff' : '#fff', borderRadius: '8px', cursor: 'pointer', marginBottom: '8px' }}>
                  <input type="radio" checked={selectedRequest?.requestId === req.requestId} onChange={() => setSelectedRequest(req)} style={{ width: '17px', height: '17px' }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#2563eb' }}>{req.requestId}</span><br/>
                    <span style={{ fontSize: '12px', color: '#4a5568' }}>Remaining: {req.remainingAmount.toFixed(2)} {req.currency}</span>
                  </div>
                </label>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">📦 Items Received</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Item Description</th><th>Qty</th><th>Unit</th><th>Price</th><th>VAT %</th><th>Tax %</th><th>Subtotal</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td><input type="text" value={item.name} onChange={(e) => updateItem(item.id, 'name', e.target.value)} /></td>
                  <td><input type="number" style={{width:'60px'}} value={item.qty} onChange={(e) => updateItem(item.id, 'qty', e.target.value)} /></td>
                  <td>
                    <select value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)} style={{width:'70px', padding:'5px'}}>
                      <option value="">Unit</option><option>pcs</option><option>kg</option>
                    </select>
                  </td>
                  <td><input type="number" style={{width:'80px'}} value={item.price} onChange={(e) => updateItem(item.id, 'price', e.target.value)} /></td>
                  <td><input type="number" style={{width:'50px'}} value={item.vat} onChange={(e) => updateItem(item.id, 'vat', e.target.value)} /></td>
                  <td><input type="number" style={{width:'50px'}} value={item.tax} onChange={(e) => updateItem(item.id, 'tax', e.target.value)} /></td>
                  <td className="sub-cell">{item.sub.toFixed(2)}</td>
                  <td><button className="btn-del" onClick={() => removeItem(item.id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan="7" style={{textAlign:'right'}}>TOTAL</td><td style={{textAlign:'right', fontWeight:'bold'}}>{grandTotal.toFixed(2)}</td><td></td></tr>
            </tfoot>
          </table>
        </div>
        <button className="btn-add" onClick={addItem}>＋ Add Item</button>
      </div>

      <div className="card">
        <div className="card-title">📎 Attachments</div>
        <div className="file-input-wrapper">
          <input type="file" id="r_fileInput" multiple onChange={handleFileSelect} />
          <label htmlFor="r_fileInput" className="file-input-label">📤 Click to upload</label>
        </div>
        <div className="files-list">
          {files.map((f, i) => (
            <div key={i} className="file-tag">📄 {f.name} <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>✕</button></div>
          ))}
        </div>
      </div>

      <div className="card">
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input type="checkbox" checked={confirmCheckbox} onChange={(e) => setConfirmCheckbox(e.target.checked)} style={{ width: '17px', height: '17px' }} />
          I confirm the received items match the invoice and quantities. <span className="req">*</span>
        </label>
      </div>

      <button className="btn-submit" onClick={handleSubmit} disabled={loading}>{loading ? 'Processing...' : 'Submit Receipt'}</button>
    </div>
  );
}

export default ReceivingForm;
