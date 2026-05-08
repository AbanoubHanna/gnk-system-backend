import React, { useState, useEffect } from 'react';
import { runGoogleScript } from '../api';

function AccountantView({ user }) {
  const [requests, setRequests] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [receivings, setReceivings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [execReq, setExecReq] = useState(null);
  const [execForm, setExecForm] = useState({ method: '', amount: '', ref: '' });
  const [settleReq, setSettleReq] = useState(null);
  const [settleForm, setSettleForm] = useState({ amount: '', notes: '' });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (user?.email) loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const p1 = runGoogleScript('getAccountantData', user.email);
      const p2 = runGoogleScript('getPendingSettlements', user.email);
      const p3 = runGoogleScript('getAccountantReceivings', user.email);
      
      const [res1, res2, res3] = await Promise.all([p1, p2, p3]);
      
      if (res1?.success) setRequests(res1.rows || []);
      if (res2?.success) setSettlements(res2.rows || []);
      if (res3?.success) setReceivings(res3.receivings || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleExecutePayment = async () => {
    if (!execForm.method || !execForm.amount || !execForm.ref) {
      alert("All fields are required"); return;
    }
    setActionLoading(true);
    try {
      const res = await runGoogleScript('executePayment', {
        email: user.email,
        requestId: execReq.requestId,
        paymentMethod: execForm.method,
        amountPaid: parseFloat(execForm.amount),
        paymentRef: execForm.ref
      });
      if (res?.success) {
        alert("✅ Payment Executed");
        setExecReq(null);
        loadData();
      } else {
        alert("❌ " + (res?.error || "Error"));
      }
    } catch (err) {
      alert("Connection error");
    }
    setActionLoading(false);
  };

  const handleSettle = async () => {
    if (!settleForm.amount || parseFloat(settleForm.amount) <= 0) {
      alert("Valid amount required"); return;
    }
    if (parseFloat(settleForm.amount) > settleReq.remaining + 0.01) {
      alert(`Cannot exceed ${settleReq.remaining}`); return;
    }
    setActionLoading(true);
    try {
      const res = await runGoogleScript('confirmSettlement', {
        email: user.email,
        requestId: settleReq.requestId,
        confirmedAmount: parseFloat(settleForm.amount),
        notes: settleForm.notes
      });
      if (res?.success) {
        alert("✅ Settlement Confirmed");
        setSettleReq(null);
        loadData();
      } else {
        alert("❌ " + (res?.error || "Error"));
      }
    } catch (err) {
      alert("Connection error");
    }
    setActionLoading(false);
  };

  if (loading) return <div className="card" style={{textAlign:'center', padding:'40px'}}>⏳ Loading accountant view…</div>;

  const filteredRequests = requests.filter(r => {
    const matchQ = !filterText || (r.requestId + r.requestedBy + r.project).toLowerCase().includes(filterText.toLowerCase());
    const matchSt = !statusFilter || r.status === statusFilter;
    return matchQ && matchSt;
  });

  return (
    <div>
      {/* Pending Settlements Card */}
      {settlements.length > 0 && (
        <div className="card" style={{ border: '2px solid #7c3aed' }}>
          <div className="card-title" style={{ color: '#7c3aed' }}>💰 Pending Settlements — Cash Refund Confirmation</div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>ID</th><th>Employee</th><th>Project</th><th>Cash to Receive</th><th>Action</th></tr></thead>
              <tbody>
                {settlements.map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{s.requestId}</td>
                    <td>{s.requestedBy}</td>
                    <td>{s.project}</td>
                    <td style={{ color: '#dc2626', fontWeight: 700 }}>{s.remaining.toFixed(2)} {s.currency}</td>
                    <td>
                      <button onClick={() => { setSettleReq(s); setSettleForm({amount:'', notes:''}); }} style={{ padding: '6px 14px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>💰 Confirm</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Requests Filter & Table */}
      <div className="card" style={{ padding: '14px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input type="text" placeholder="Search..." value={filterText} onChange={e => setFilterText(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #ccc' }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #ccc' }}>
            <option value="">All Statuses</option>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Approved">Approved</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-title">💳 All Payment Requests</div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>ID</th><th>By</th><th>Project</th><th>Amount</th><th>Status</th><th>Paid</th><th>Action</th></tr></thead>
            <tbody>
              {filteredRequests.map((r, i) => {
                const canExec = r.status === 'Approved' && !r.paymentMethod;
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{r.requestId}</td>
                    <td>{r.requestedBy}</td>
                    <td>{r.project}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{r.amount.toFixed(2)} {r.currency}</td>
                    <td>{r.status}</td>
                    <td style={{ color: '#16a34a', fontWeight: 'bold' }}>{r.paymentMethod ? '✅ Yes' : '—'}</td>
                    <td>
                      {canExec ? (
                        <button onClick={() => { setExecReq(r); setExecForm({method:'', amount:'', ref:''}); }} style={{ padding: '6px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>💳 Execute</button>
                      ) : (r.paymentMethod ? <span style={{ color: '#94a3b8' }}>✅ Paid</span> : "—")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Execution Modal */}
      {execReq && (
        <div className="modal-overlay active">
          <div className="modal-box" style={{ maxWidth: '480px', textAlign: 'left' }}>
            <h3 style={{ color: '#16a34a' }}>💳 Execute Payment</h3>
            <div style={{ padding: '10px', background: '#f0fdf4', marginBottom: '10px', borderRadius: '8px' }}>
              <strong>{execReq.requestId}</strong> - {execReq.amount} {execReq.currency}
            </div>
            <div className="field">
              <label>Method</label>
              <select value={execForm.method} onChange={e => setExecForm({...execForm, method: e.target.value})}>
                <option value="">— Select —</option><option value="Cash">Cash</option><option value="Bank Transfer">Bank Transfer</option><option value="Check">Check</option>
              </select>
            </div>
            <div className="field">
              <label>Amount Paid</label>
              <input type="number" value={execForm.amount} onChange={e => setExecForm({...execForm, amount: e.target.value})} />
            </div>
            <div className="field">
              <label>Reference</label>
              <input type="text" value={execForm.ref} onChange={e => setExecForm({...execForm, ref: e.target.value})} />
            </div>
            <div className="modal-actions">
              <button onClick={handleExecutePayment} disabled={actionLoading} style={{ background: '#16a34a', color: '#fff' }}>{actionLoading ? 'Saving...' : '✅ Confirm Payment'}</button>
              <button className="modal-btn-no" onClick={() => setExecReq(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Modal */}
      {settleReq && (
        <div className="modal-overlay active">
          <div className="modal-box" style={{ maxWidth: '460px', textAlign: 'left' }}>
            <h3 style={{ color: '#7c3aed' }}>💰 Confirm Cash Receipt</h3>
            <div style={{ padding: '10px', background: '#faf5ff', marginBottom: '10px', borderRadius: '8px' }}>
              <strong>{settleReq.requestId}</strong> (Max: {settleReq.remaining} {settleReq.currency})
            </div>
            <div className="field">
              <label>Amount Received</label>
              <input type="number" value={settleForm.amount} onChange={e => setSettleForm({...settleForm, amount: e.target.value})} />
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea value={settleForm.notes} onChange={e => setSettleForm({...settleForm, notes: e.target.value})}></textarea>
            </div>
            <div className="modal-actions">
              <button onClick={handleSettle} disabled={actionLoading} style={{ background: '#7c3aed', color: '#fff' }}>{actionLoading ? 'Saving...' : '✅ Confirm Receipt'}</button>
              <button className="modal-btn-no" onClick={() => setSettleReq(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountantView;
