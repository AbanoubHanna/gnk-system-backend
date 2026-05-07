import { useState, useEffect } from 'react';
import api from '../api';

export default function ManagerView({ user }) {
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // بنجيب الطلبات المعلقة والسجل في نفس الوقت
      const [pendingRes, historyRes] = await Promise.all([
        api.get(`/payments/manager/pending?email=${user.email}`),
        api.get(`/payments/manager/history?email=${user.email}`)
      ]);
      
      if (pendingRes.data.success) setPending(pendingRes.data.rows);
      if (historyRes.data.success) setHistory(historyRes.data.rows);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleAction = async (requestId, action) => {
    const reason = action === 'Rejected' ? prompt("Please enter rejection reason:") : "";
    if (action === 'Rejected' && reason === null) return;

    setActionLoading(requestId);
    try {
      const res = await api.post('/payments/manager/action', {
        requestId, action, reason, managerEmail: user.email
      });
      if (res.data.success) {
        // تحديث الشاشة فوراً
        fetchData(); 
      }
    } catch (err) { alert("❌ Failed to process action"); }
    setActionLoading(null);
  };

  if (loading) return <div className="card" style={{textAlign:'center', padding:'40px'}}>⏳ Loading Manager View...</div>;

  // الحسابات الخاصة بالكروت
  const l1Count = pending.length; // مؤقتاً كل اللي بيجيله بيبقى L1
  const l2Count = 0; 
  const totalPending = l1Count + l2Count;

  const approvedCount = history.filter(h => h.status === 'Approved' || h.status === 'Closed' || h.status === 'Pending Settlement').length;
  const rejectedCount = history.filter(h => h.status === 'Rejected').length;

  return (
    <div id="managerView" style={{ paddingBottom: '40px' }}>
      
      {/* 1. الكروت العلوية (Summary Cards) المطابقة للصورة */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '24px 16px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#2563eb', lineHeight: '1', marginBottom: '8px' }}>{l1Count}</div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '1px' }}>L1 APPROVALS</div>
        </div>
        <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '12px', padding: '24px 16px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#8b5cf6', lineHeight: '1', marginBottom: '8px' }}>{l2Count}</div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '1px' }}>L2 APPROVALS</div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '24px 16px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#16a34a', lineHeight: '1', marginBottom: '8px' }}>{totalPending}</div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '1px' }}>TOTAL PENDING</div>
        </div>
      </div>

      {/* 2. قسم الطلبات المعلقة (Pending Approvals) */}
      <div className="card" style={{ border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>⏳ PENDING APPROVALS — AWAITING YOUR DECISION</span>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
        </div>
        
        {pending.length === 0 ? (
          <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '14px', fontWeight: '500' }}>
            ✅ No pending approvals — you're all caught up!
          </div>
        ) : (
          <div className="tbl-wrap">
            <table className="gnk-table">
              <thead>
                <tr>
                  <th width="120">ID</th>
                  <th>REQUESTED BY</th>
                  <th>PROJECT</th>
                  <th width="140">AMOUNT</th>
                  <th>PURPOSE</th>
                  <th width="180">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.request_id}>
                    <td style={{fontWeight:'700', color:'#2563eb'}}>{r.request_id}</td>
                    <td>
                      <strong style={{color: 'var(--ink)'}}>{r.name}</strong><br/>
                      <span style={{fontSize:'11px', color:'var(--ink3)'}}>{r.email}</span>
                    </td>
                    <td style={{ fontWeight: '500' }}>{r.project}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '13px' }}>{parseFloat(r.amount).toLocaleString()} <span style={{fontSize:'10px'}}>{r.currency}</span></td>
                    <td style={{fontSize:'12px', color: 'var(--ink2)'}}>{r.description}</td>
                    <td>
                      <div style={{display:'flex', gap:'8px'}}>
                        <button 
                          style={{flex: 1, height:'34px', background:'#16a34a', color:'#fff', border:'none', borderRadius:'6px', fontSize:'12px', fontWeight:'700', cursor:'pointer'}}
                          onClick={() => handleAction(r.request_id, 'Approved')}
                          disabled={actionLoading === r.request_id}
                        >
                          {actionLoading === r.request_id ? '...' : '✅ Approve'}
                        </button>
                        <button 
                          style={{flex: 1, height:'34px', background:'#dc2626', color:'#fff', border:'none', borderRadius:'6px', fontSize:'12px', fontWeight:'700', cursor:'pointer'}}
                          onClick={() => handleAction(r.request_id, 'Rejected')}
                          disabled={actionLoading === r.request_id}
                        >
                          {actionLoading === r.request_id ? '...' : '❌ Reject'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. سجل الإجراءات (Action History) المطابق للصورة */}
      <div className="card" style={{ border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>📋 MY ACTION HISTORY</span>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }}></div>
        </div>

        {/* الـ Pills بتاعت الملخص */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <span style={{ border: '1.5px solid #22c55e', color: '#16a34a', padding: '6px 16px', borderRadius: '24px', fontSize: '13px', fontWeight: '700', background: '#f0fdf4' }}>
            ✅ Approved: {approvedCount}
          </span>
          <span style={{ border: '1.5px solid #ef4444', color: '#dc2626', padding: '6px 16px', borderRadius: '24px', fontSize: '13px', fontWeight: '700', background: '#fef2f2' }}>
            ❌ Rejected: {rejectedCount}
          </span>
          <span style={{ border: '1.5px solid #3b82f6', color: '#2563eb', padding: '6px 16px', borderRadius: '24px', fontSize: '13px', fontWeight: '700', background: '#eff6ff' }}>
            📋 Total: {history.length}
          </span>
        </div>

        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '13px' }}>No action history found.</div>
        ) : (
          <div className="tbl-wrap">
            <table className="gnk-table">
              <thead>
                <tr>
                  <th width="120">ID</th>
                  <th>DATE</th>
                  <th>REQUESTED BY</th>
                  <th>PROJECT</th>
                  <th width="120">AMOUNT</th>
                  <th>MY DECISION</th>
                  <th>LEVEL</th>
                  <th>FINAL STATUS</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => {
                  const isAppr = h.status === 'Approved' || h.status === 'Closed' || h.status === 'Pending Settlement';
                  const isRej = h.status === 'Rejected';
                  return (
                    <tr key={i}>
                      <td style={{fontWeight:'700', color:'#2563eb'}}>{h.request_id}</td>
                      <td style={{fontSize:'12px'}}>{new Date(h.timestamp).toLocaleString()}</td>
                      <td>
                        <strong style={{color: 'var(--ink)'}}>{h.name}</strong><br/>
                        <span style={{fontSize:'11px', color:'var(--ink3)'}}>{h.email}</span>
                      </td>
                      <td style={{ fontWeight: '500' }}>{h.project}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '13px' }}>{parseFloat(h.amount).toLocaleString()} <span style={{fontSize:'10px'}}>{h.currency}</span></td>
                      
                      {/* My Decision Badge */}
                      <td>
                        <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: isAppr ? '#dcfce7' : '#fef2f2', color: isAppr ? '#16a34a' : '#dc2626', display:'inline-flex', alignItems:'center', gap:'4px' }}>
                          {isAppr ? '✅ Approved' : '❌ Rejected'}
                        </span>
                      </td>
                      
                      {/* Level Badge */}
                      <td>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: '#eff6ff', color: '#2563eb' }}>
                          L1
                        </span>
                      </td>
                      
                      {/* Final Status Badge */}
                      <td>
                        <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: '#f1f5f9', color: '#475569' }}>
                          {h.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}