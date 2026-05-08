import React, { useState, useEffect } from 'react';
import { runGoogleScript } from '../api';

function Dashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterQuery, setFilterQuery] = useState('');

  useEffect(() => {
    if (user?.email) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await runGoogleScript('getDashboardData', user.email);
      if (res && res.success) {
        setData(res);
      } else {
        setError(res ? res.error : "Error loading dashboard");
      }
    } catch (err) {
      setError("Connection error");
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏳</div>
        <p style={{ color: 'var(--ink3)', fontSize: '14px' }}>Loading your dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ color: 'var(--red)' }}>⚠️ {error}</p>
        <button className="btn-new" onClick={loadDashboardData}>Try Again</button>
      </div>
    );
  }

  const f = data?.financials || {};
  const payments = (data?.payments || []).filter(p => 
    !filterQuery || p.email.includes(filterQuery.toLowerCase()) || p.requestedBy.toLowerCase().includes(filterQuery.toLowerCase())
  );
  const receivings = (data?.receivings || []).filter(r => 
    !filterQuery || r.email.includes(filterQuery.toLowerCase()) || r.employeeName.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div>
      {data?.isAdmin && (
        <div className="card" style={{ padding: '14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink2)', letterSpacing: '1px' }}>🔍 FILTER BY EMPLOYEE:</span>
            <input 
              type="text" 
              placeholder="Email or name…" 
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              style={{ flex: 1, minWidth: '200px', padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: '8px', outline: 'none' }}
            />
            <button onClick={() => setFilterQuery('')} style={{ padding: '8px 14px', border: '1.5px solid var(--border)', borderRadius: '8px', background: '#fff', cursor: 'pointer' }}>Show All</button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ background: '#ffffff', width: '100%', padding: '24px 0', borderRadius: '12px', marginBottom: '14px' }}>
        <h2 style={{ fontSize: '18px', color: '#334155', margin: '0 0 20px 20px', fontWeight: 500 }}>FINANCIAL SUMMARY</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', padding: '0 20px' }}>
          {[
            { label: "TOTAL", val: f.total, sub: "Requests", color: "#475569", border: "#94a3b8" },
            { label: "PENDING", val: f.pendingApproval, sub: (f.pendingVal || 0).toFixed(0) + " LE", color: "#b45309", border: "#f59e0b" },
            { label: "APPROVED", val: f.approved, sub: (f.approvedVal || 0).toFixed(0) + " LE", color: "#1d4ed8", border: "#3b82f6" },
            { label: "CLOSED", val: f.closed, sub: (f.closedVal || 0).toFixed(0) + " LE", color: "#15803d", border: "#22c55e" },
            { label: "PAID", val: (f.paidTotal || 0).toFixed(0), sub: "LE Total", color: "#059669", border: "#10b981" }
          ].map((c, i) => (
            <div key={i} style={{ border: '1px solid #f1f5f9', borderTop: `4px solid ${c.border}`, borderRadius: '12px', padding: '24px 8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '32px', color: c.color, marginBottom: '8px', lineHeight: 1 }}>{c.val}</div>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', letterSpacing: '1px' }}>{c.label}</div>
              <div style={{ fontSize: '12px', color: c.color, opacity: 0.8 }}>{c.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">💳 Payment Requests</div>
        <div className="tbl-wrap">
          {payments.length === 0 ? <div className="link-empty">No payment requests found.</div> : (
            <table>
              <thead>
                <tr><th>ID</th><th>DATE</th><th>PROJECT</th><th>AMOUNT</th><th>STATUS</th><th>DUE</th><th>PDF</th></tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, color: '#2563eb' }}>{p.requestId}</td>
                    <td>{p.date}</td>
                    <td>{p.project}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.amount.toFixed(2)} {p.currency}</td>
                    <td><span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', background: '#f1f5f9' }}>{p.status}</span></td>
                    <td>{p.dueDate}</td>
                    <td>{p.pdfUrl ? <a href={p.pdfUrl} target="_blank" rel="noreferrer">📄 View</a> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">📦 Receiving Vouchers</div>
        <div className="tbl-wrap">
          {receivings.length === 0 ? <div className="link-empty">No receiving vouchers found.</div> : (
            <table>
              <thead>
                <tr><th>REC#</th><th>DATE</th><th>SUPPLIER</th><th>PROJECT</th><th>TYPE</th><th>TOTAL</th><th>PDF</th></tr>
              </thead>
              <tbody>
                {receivings.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, color: '#7c3aed' }}>{r.recNumber}</td>
                    <td>{r.date}</td>
                    <td>{r.supplier}</td>
                    <td>{r.project}</td>
                    <td>{r.type}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#16a34a' }}>{r.totalAmount.toFixed(2)}</td>
                    <td>{r.pdfUrl ? <a href={r.pdfUrl} target="_blank" rel="noreferrer">📄 View</a> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
