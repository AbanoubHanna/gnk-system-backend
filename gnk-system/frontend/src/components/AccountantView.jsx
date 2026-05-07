import { useState, useEffect, useMemo } from 'react';
import api from '../api';

export default function AccountantView({ user }) {
  const [data, setData] = useState({ payments: [], receivings: [] });
  const [loading, setLoading] = useState(true);

  // الفلترة
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // النوافذ (Modals)
  const [execModal, setExecModal] = useState({ isOpen: false, reqId: null, amount: 0 });
  const [settleModal, setSettleModal] = useState({ isOpen: false, reqId: null, maxAmount: 0 });

  const [execForm, setExecForm] = useState({ method: '', amountPaid: '', ref: '' });
  const [settleForm, setSettleForm] = useState({ amount: '', notes: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/payments/accountant/data');
      if (res.data.success) {
        setData({ payments: res.data.payments, receivings: res.data.receivings });
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const filteredPayments = useMemo(() => {
    return data.payments.filter(p => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query || (p.request_id + p.name + p.project + (p.status || '')).toLowerCase().includes(query);
      const matchesStatus = !statusFilter || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data.payments, searchQuery, statusFilter]);

  const summary = useMemo(() => {
    let closed = 0, rejected = 0, approved = 0;
    filteredPayments.forEach(p => {
      if (p.status === 'Closed') closed++;
      else if (p.status === 'Rejected') rejected++;
      else if (p.status === 'Approved') approved++;
    });
    return { closed, rejected, approved };
  }, [filteredPayments]);

  const handleExecuteSubmit = async () => {
    try {
      const res = await api.post('/payments/accountant/execute', {
        requestId: execModal.reqId, paymentMethod: execForm.method, amountPaid: execForm.amountPaid, paymentRef: execForm.ref
      });
      if (res.data.success) { setExecModal({ isOpen: false }); fetchData(); }
    } catch (err) { alert('Error executing payment'); }
  };

  const handleSettleSubmit = async () => {
    try {
      const res = await api.post('/payments/accountant/settle', {
        requestId: settleModal.reqId, confirmedAmount: settleForm.amount, notes: settleForm.notes, accountantEmail: user.email
      });
      if (res.data.success) { setSettleModal({ isOpen: false }); fetchData(); }
    } catch (err) { alert('Error confirming settlement'); }
  };

  const pendingSettlements = data.payments.filter(p => p.status === 'Pending Settlement');

  if (loading) return <div className="card" style={{textAlign:'center', padding:'50px'}}>⏳ Loading Accountant Hub...</div>;

  return (
    <div id="accountantView" style={{ paddingBottom: '40px', fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' }}>
      
      {/* 🔍 شريط الفلترة */}
      <div style={{ background: '#fff', borderRadius: '8px', padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '15px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', letterSpacing: '0.5px' }}>🔍 FILTER:</span>
          <input 
            type="text" 
            placeholder="Search by ID, name, project, status..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, padding: '8px 14px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
          />
        </div>
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '8px 14px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', minWidth: '150px', background: '#fff', outline: 'none' }}
        >
          <option value="">All Statuses</option>
          <option value="Pending Approval">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="Closed">Closed</option>
        </select>
        <button 
          onClick={fetchData}
          style={{ padding: '8px 16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* 📊 كروت الملخص */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>{summary.closed}</div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase' }}>CLOSED</div>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#dc2626', marginBottom: '4px' }}>{summary.rejected}</div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#ef4444', letterSpacing: '1px', textTransform: 'uppercase' }}>REJECTED</div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#16a34a', marginBottom: '4px' }}>{summary.approved}</div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#22c55e', letterSpacing: '1px', textTransform: 'uppercase' }}>APPROVED</div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 1. 💳 ALL PAYMENT REQUESTS                 */}
      {/* ========================================== */}
      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', fontSize: '12px', fontWeight: '700', color: '#64748b', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>💳 ALL PAYMENT REQUESTS</span>
        </div>
        
        <div style={{ overflowX: 'auto', padding: '0 20px 20px 20px', marginTop: '16px' }}>
          <div className="gnk-table-wrap">
            <table className="gnk-table">
              <thead>
                <tr>
                  <th width="110">ID</th>
                  <th width="90">DATE</th>
                  <th>BY</th>
                  <th>PROJECT</th>
                  <th width="80">DEPT</th>
                  <th width="130">AMOUNT</th>
                  <th>PURPOSE</th>
                  <th>STATUS</th>
                  <th width="90">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr><td colSpan="9" style={{textAlign:'center', padding:'20px', color:'#64748b'}}>No requests found.</td></tr>
                ) : (
                  filteredPayments.map((p) => (
                    <tr key={p.request_id}>
                      <td style={{ fontWeight: '600', color: '#2563eb' }}>{p.request_id}</td>
                      <td style={{ color: '#64748b' }}>{new Date(p.timestamp).toLocaleDateString('en-GB')}</td>
                      <td>
                        <strong style={{color: '#1e293b'}}>{p.name}</strong><br/>
                        <span style={{fontSize: '11px', color: '#94a3b8'}}>{p.email}</span>
                      </td>
                      <td style={{ fontWeight: '500', color: '#334155' }}>{p.project}</td>
                      <td style={{ color: '#64748b' }}>{p.department}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>
                        {parseFloat(p.amount).toLocaleString()} <span style={{fontSize:'10px'}}>{p.currency}</span>
                      </td>
                      <td style={{ color: '#64748b', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.description}>
                        {p.description}
                      </td>
                      <td>
                        <span className={`badge-pill ${p.status === 'Approved' ? 'approved' : p.status === 'Rejected' ? 'rejected' : p.status === 'Closed' ? 'closed' : 'pending'}`}>
                          {p.status || 'Pending'}
                        </span>
                      </td>
                      <td>
                        {p.status === 'Approved' && !p.payment_method ? (
                          <button 
                            onClick={() => setExecModal({ isOpen: true, reqId: p.request_id, amount: p.amount })}
                            style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                          >
                            Execute
                          </button>
                        ) : <span style={{ color: '#cbd5e1', fontWeight: '600' }}>—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 2. 💰 PENDING SETTLEMENTS                 */}
      {/* ========================================== */}
      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', fontSize: '12px', fontWeight: '700', color: '#64748b', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>💰 PENDING SETTLEMENTS — CASH REFUND CONFIRMATION</span>
        </div>
        
        <div style={{ overflowX: 'auto', padding: '0 20px 20px 20px', marginTop: '16px' }}>
          {pendingSettlements.length === 0 ? (
            <div style={{ background: '#f8fafc', padding: '24px', textAlign: 'center', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ color: '#16a34a', fontSize: '14px', fontWeight: '600' }}>
                <span style={{ background: '#22c55e', color: '#fff', borderRadius: '4px', padding: '2px 6px', fontSize: '12px', marginRight: '8px' }}>✓</span> 
                No pending settlements — all clear!
              </span>
            </div>
          ) : (
            <div className="gnk-table-wrap">
              <table className="gnk-table">
                <thead>
                  <tr>
                    <th width="130">ID</th>
                    <th>EMPLOYEE</th>
                    <th>PROJECT</th>
                    <th width="150">AMOUNT</th>
                    <th width="100">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingSettlements.map((s) => (
                    <tr key={s.request_id}>
                      <td style={{ fontWeight: '600', color: '#7c3aed' }}>{s.request_id}</td>
                      <td style={{ color: '#1e293b' }}>{s.name}</td>
                      <td style={{ color: '#475569' }}>{s.project}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: '700', color: '#1e293b' }}>{parseFloat(s.amount).toLocaleString()} {s.currency}</td>
                      <td>
                        <button 
                          onClick={() => setSettleModal({ isOpen: true, reqId: s.request_id, maxAmount: s.amount })}
                          style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                        >
                          Confirm
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* 3. 📦 RECEIVING VOUCHERS                  */}
      {/* ========================================== */}
      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', fontSize: '12px', fontWeight: '700', color: '#64748b', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📦 RECEIVING VOUCHERS — YOUR PROJECTS</span>
        </div>
        
        <div style={{ overflowX: 'auto', padding: '0 20px 20px 20px', marginTop: '16px' }}>
          {data.receivings.length === 0 ? (
            <div style={{ background: '#f8fafc', padding: '24px', textAlign: 'center', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: '500' }}>
              No receiving vouchers found.
            </div>
          ) : (
            <div className="gnk-table-wrap">
              <table className="gnk-table">
                <thead>
                  <tr>
                    <th width="130">REC NUMBER</th>
                    <th width="100">DATE</th>
                    <th>EMPLOYEE</th>
                    <th>SUPPLIER</th>
                    <th>PROJECT</th>
                    <th width="130">TOTAL</th>
                    <th width="120">LINKED PR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.receivings.map((r) => (
                    <tr key={r.rec_number}>
                      <td style={{ fontWeight: '600', color: '#7c3aed' }}>{r.rec_number}</td>
                      <td style={{ color: '#64748b' }}>{new Date(r.timestamp).toLocaleDateString('en-GB')}</td>
                      <td>
                        <strong style={{color: '#1e293b'}}>{r.employee_name}</strong><br/>
                        <span style={{fontSize: '11px', color: '#94a3b8'}}>{r.email}</span>
                      </td>
                      <td style={{ color: '#475569' }}>{r.supplier}</td>
                      <td style={{ fontWeight: '500', color: '#334155' }}>{r.project}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: '700', color: '#16a34a' }}>{parseFloat(r.total_amount).toLocaleString()} L.E</td>
                      <td style={{ color: '#2563eb', fontWeight: '600', fontSize: '11px' }}>{r.linked_request || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* النوافذ المنبثقة (Modals) */}
      {execModal.isOpen && (
        <div className="modal-overlay active">
          <div className="modal-box" style={{maxWidth: '400px', textAlign: 'left'}}>
            <h3 style={{color: '#16a34a'}}>💳 Execute Payment</h3>
            <p style={{fontSize: '13px', marginBottom: '20px'}}>Processing: <strong>{execModal.reqId}</strong></p>
            <div className="field" style={{marginBottom: '15px'}}>
              <label>Method <span className="req">*</span></label>
              <select onChange={e => setExecForm({...execForm, method: e.target.value})}><option value="">— Select —</option><option>Bank Transfer</option><option>Cash</option></select>
            </div>
            <div className="field" style={{marginBottom: '15px'}}>
              <label>Amount Paid <span className="req">*</span></label>
              <input type="number" onChange={e => setExecForm({...execForm, amountPaid: e.target.value})} />
            </div>
            <div className="field" style={{marginBottom: '20px'}}>
              <label>Reference <span className="req">*</span></label>
              <input type="text" onChange={e => setExecForm({...execForm, ref: e.target.value})} />
            </div>
            <div className="modal-actions" style={{display:'flex', gap:'10px'}}>
              <button style={{flex:1, padding:'12px', background:'#16a34a', color:'#fff', border:'none', borderRadius:'8px', fontWeight:'700'}} onClick={handleExecuteSubmit}>Confirm</button>
              <button style={{flex:1, padding:'12px', background:'#f1f5f9', border:'none', borderRadius:'8px', fontWeight:'700'}} onClick={() => setExecModal({isOpen: false})}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {settleModal.isOpen && (
        <div className="modal-overlay active">
          <div className="modal-box" style={{maxWidth: '400px', textAlign: 'left'}}>
            <h3 style={{color: '#7c3aed'}}>💰 Confirm Settlement</h3>
            <p style={{fontSize: '13px', marginBottom: '20px'}}>Processing: <strong>{settleModal.reqId}</strong></p>
            <div className="field" style={{marginBottom: '15px'}}>
              <label>Amount Received (Cash) <span className="req">*</span></label>
              <input type="number" onChange={e => setSettleForm({...settleForm, amount: e.target.value})} />
            </div>
            <div className="field" style={{marginBottom: '20px'}}>
              <label>Notes</label>
              <textarea onChange={e => setSettleForm({...settleForm, notes: e.target.value})}></textarea>
            </div>
            <div className="modal-actions" style={{display:'flex', gap:'10px'}}>
              <button style={{flex:1, padding:'12px', background:'#7c3aed', color:'#fff', border:'none', borderRadius:'8px', fontWeight:'700'}} onClick={handleSettleSubmit}>Confirm</button>
              <button style={{flex:1, padding:'12px', background:'#f1f5f9', border:'none', borderRadius:'8px', fontWeight:'700'}} onClick={() => setSettleModal({isOpen: false})}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}