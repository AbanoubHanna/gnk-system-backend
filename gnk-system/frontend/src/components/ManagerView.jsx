import React, { useState, useEffect } from 'react';
import { runGoogleScript } from '../api';

function ManagerView({ user }) {
  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Modals state
  const [modalType, setModalType] = useState(null); // 'approve' or 'reject'
  const [selectedReq, setSelectedReq] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (user?.email) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    setLoadingHistory(true);
    try {
      const res1 = await runGoogleScript('getManagerRequests', user.email);
      if (res1?.success) setRequests(res1.rows || []);
      
      const res2 = await runGoogleScript('getManagerHistory', user.email);
      if (res2?.success) setHistory(res2.rows || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
    setLoadingHistory(false);
  };

  const handleAction = async () => {
    if (modalType === 'reject' && !rejectReason.trim()) {
      alert("Rejection reason is required");
      return;
    }

    setActionLoading(true);
    const payload = {
      email: user.email,
      requestId: selectedReq.requestId,
      level: selectedReq.level,
      action: modalType === 'approve' ? 'Approved' : 'Rejected',
      reason: rejectReason
    };

    try {
      const res = await runGoogleScript('approveFromUI', payload);
      if (res?.success) {
        alert(modalType === 'approve' ? "✅ Approved" : "❌ Rejected");
        setModalType(null);
        loadData(); // Refresh lists
      } else {
        alert("⚠️ " + (res?.error || "Error"));
      }
    } catch (err) {
      alert("Connection error");
    }
    setActionLoading(false);
  };

  if (loading) return <div className="card" style={{textAlign:'center', padding:'40px'}}>⏳ Loading pending approvals…</div>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        <div style={{ background: '#2563eb15', border: '1.5px solid #2563eb40', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#2563eb' }}>{requests.filter(r => r.level === 'L1').length}</div>
          <div style={{ fontSize: '11px', color: 'var(--ink3)' }}>L1 Approvals</div>
        </div>
        <div style={{ background: '#16a34a15', border: '1.5px solid #16a34a40', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#16a34a' }}>{requests.length}</div>
          <div style={{ fontSize: '11px', color: 'var(--ink3)' }}>Total Pending</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">⏳ Pending Approvals — Awaiting Your Decision</div>
        <div className="tbl-wrap">
          {requests.length === 0 ? <div className="link-empty">✅ No pending approvals — you're all caught up!</div> : (
            <table>
              <thead>
                <tr><th>ID</th><th>Date</th><th>Requested By</th><th>Project</th><th>Amount</th><th>Level</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {requests.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{r.requestId}</td>
                    <td>{r.date}</td>
                    <td>{r.requestedBy}<br/><span style={{ fontSize: '11px', color: 'var(--ink3)' }}>{r.email}</span></td>
                    <td>{r.project}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{r.amount.toFixed(2)} {r.currency}</td>
                    <td><span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', background: '#e0e7ff', color: '#4338ca' }}>{r.level}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button onClick={() => { setSelectedReq(r); setModalType('approve'); }} style={{ padding: '5px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', marginRight: '4px', cursor: 'pointer' }}>✅ Approve</button>
                      <button onClick={() => { setSelectedReq(r); setRejectReason(''); setModalType('reject'); }} style={{ padding: '5px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>❌ Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">📋 My Action History</div>
        <div className="tbl-wrap">
          {loadingHistory ? "⏳ Loading history..." : (history.length === 0 ? <div className="link-empty">No history.</div> : (
            <table>
              <thead><tr><th>ID</th><th>Project</th><th>Amount</th><th>My Decision</th><th>Final Status</th></tr></thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{h.requestId}</td>
                    <td>{h.project}</td>
                    <td>{h.amount.toFixed(2)} {h.currency}</td>
                    <td>{h.myAction === 'Approved' ? '✅ Approved' : '❌ Rejected'}</td>
                    <td>{h.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </div>

      {/* Approve/Reject Modal */}
      {modalType && (
        <div className="modal-overlay active">
          <div className="modal-box" style={{ maxWidth: '440px', textAlign: 'left' }}>
            <h3 style={{ color: modalType === 'approve' ? '#16a34a' : '#dc2626' }}>
              {modalType === 'approve' ? '✅ Confirm Approval' : '❌ Reject Request'}
            </h3>
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', marginBottom: '16px' }}>
              <strong>{selectedReq?.requestId}</strong> - {selectedReq?.project} ({selectedReq?.amount} {selectedReq?.currency})
            </div>
            
            {modalType === 'reject' && (
              <div className="field">
                <label>Rejection Reason <span className="req">*</span></label>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{ minHeight: '90px' }}></textarea>
              </div>
            )}

            <div className="modal-actions">
              <button 
                onClick={handleAction} 
                disabled={actionLoading} 
                style={{ background: modalType === 'approve' ? '#16a34a' : '#dc2626', color: '#fff' }}
              >
                {actionLoading ? 'Saving...' : (modalType === 'approve' ? '✅ Yes, Approve' : '❌ Confirm Reject')}
              </button>
              <button className="modal-btn-no" onClick={() => setModalType(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManagerView;
