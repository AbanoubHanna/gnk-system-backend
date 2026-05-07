import { useState, useEffect, useMemo } from 'react';
import api from '../api';

export default function Dashboard({ user }) {
  const [data, setData] = useState({ payments: [], receivings: [], financials: {} });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // بنجيب داتا الموظف اللي فاتح السيستم بس
      const res = await api.get(`/payments/dashboard?email=${user.email}`);
      if (res.data.success) {
        setData({
          payments: res.data.payments || [],
          receivings: res.data.receivings || [],
          financials: res.data.financials || {}
        });
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    }
    setLoading(false);
  };

  // فلترة الجداول
  const filteredPayments = useMemo(() => {
    return data.payments.filter(p => 
      !searchQuery || (p.requestId + p.project + p.status).toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data.payments, searchQuery]);

  const filteredReceivings = useMemo(() => {
    return data.receivings.filter(r => 
      !searchQuery || (r.rec_number + r.project + r.supplier).toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data.receivings, searchQuery]);

  if (loading) {
    return <div className="card" style={{textAlign:'center', padding:'50px'}}>⏳ Loading your dashboard...</div>;
  }

  const { financials } = data;

  return (
    <div id="dashboardView" style={{ paddingBottom: '40px', fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' }}>
      
      {/* رأس الداشبورد */}
      <div style={{ background: '#fff', borderRadius: '8px', padding: '20px', marginBottom: '20px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0', color: '#1e293b', fontSize: '20px' }}>👋 Welcome, {user.employeeName || user.email.split('@')[0]}</h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Here is the summary of all your operational requests.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>🔍 SEARCH:</span>
          <input 
            type="text" 
            placeholder="Search ID, project..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '8px 14px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none', width: '200px' }}
          />
          <button onClick={fetchDashboardData} style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}>🔄</button>
        </div>
      </div>

      {/* كروت الملخص المالي */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderTop: '3px solid #64748b', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#475569' }}>{financials.total || 0}</div>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Requests</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderTop: '3px solid #d97706', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#b45309' }}>{financials.pendingApproval || 0}</div>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#b45309', textTransform: 'uppercase', letterSpacing: '1px' }}>Pending</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderTop: '3px solid #16a34a', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#16a34a' }}>{financials.approved || 0}</div>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '1px' }}>Approved</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderTop: '3px solid #dc2626', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#dc2626' }}>{financials.rejected || 0}</div>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '1px' }}>Rejected</div>
        </div>
      </div>

      {/* 1. جدول طلبات الدفع الخاصة بالموظف */}
      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', fontSize: '12px', fontWeight: '700', color: '#64748b', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>💳 MY PAYMENT REQUESTS</span>
        </div>
        <div style={{ overflowX: 'auto', padding: '0 20px 20px 20px', marginTop: '16px' }}>
          <div className="gnk-table-wrap">
            <table className="gnk-table">
              <thead style={{ background: '#0f172a' }}>
                <tr>
                  <th style={{ padding: '12px', color: '#fff', fontSize: '10px', textAlign: 'left' }}>ID</th>
                  <th style={{ padding: '12px', color: '#fff', fontSize: '10px', textAlign: 'left' }}>PROJECT</th>
                  <th style={{ padding: '12px', color: '#fff', fontSize: '10px', textAlign: 'left' }}>AMOUNT</th>
                  <th style={{ padding: '12px', color: '#fff', fontSize: '10px', textAlign: 'left' }}>STATUS</th>
                  <th style={{ padding: '12px', color: '#fff', fontSize: '10px', textAlign: 'left' }}>DUE DATE</th>
                  <th style={{ padding: '12px', color: '#fff', fontSize: '10px', textAlign: 'center' }}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr><td colSpan="6" style={{textAlign:'center', padding:'20px', color:'#64748b'}}>No requests found.</td></tr>
                ) : (
                  filteredPayments.map((p) => (
                    <tr key={p.requestId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px', fontWeight: '700', color: '#2563eb' }}>{p.requestId}</td>
                      <td style={{ padding: '12px', fontWeight: '500', color: '#334155' }}>{p.project}</td>
                      <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: '700', color: '#1e293b' }}>
                        {parseFloat(p.amount).toLocaleString()} {p.currency}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span className={`badge-pill ${p.status === 'Approved' ? 'approved' : p.status === 'Rejected' ? 'rejected' : p.status === 'Closed' ? 'closed' : 'pending'}`}>
                          {p.status || 'Pending'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#64748b' }}>{new Date(p.dueDate).toLocaleDateString('en-GB')}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {p.pdfUrl ? (
                          <a href={`http://localhost:5000${p.pdfUrl}`} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: '700', textDecoration: 'none', fontSize: '12px' }}>📄 View</a>
                        ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. جدول سندات الاستلام الخاصة بالموظف */}
      <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', fontSize: '12px', fontWeight: '700', color: '#64748b', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📦 MY RECEIVING VOUCHERS</span>
        </div>
        <div style={{ overflowX: 'auto', padding: '0 20px 20px 20px', marginTop: '16px' }}>
          <div className="gnk-table-wrap">
            <table className="gnk-table">
              <thead style={{ background: '#0f172a' }}>
                <tr>
                  <th style={{ padding: '12px', color: '#fff', fontSize: '10px', textAlign: 'left' }}>REC NUMBER</th>
                  <th style={{ padding: '12px', color: '#fff', fontSize: '10px', textAlign: 'left' }}>DATE</th>
                  <th style={{ padding: '12px', color: '#fff', fontSize: '10px', textAlign: 'left' }}>SUPPLIER</th>
                  <th style={{ padding: '12px', color: '#fff', fontSize: '10px', textAlign: 'left' }}>PROJECT</th>
                  <th style={{ padding: '12px', color: '#fff', fontSize: '10px', textAlign: 'left' }}>TOTAL</th>
                  <th style={{ padding: '12px', color: '#fff', fontSize: '10px', textAlign: 'center' }}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceivings.length === 0 ? (
                  <tr><td colSpan="6" style={{textAlign:'center', padding:'20px', color:'#64748b'}}>No vouchers found.</td></tr>
                ) : (
                  filteredReceivings.map((r) => (
                    <tr key={r.rec_number} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px', fontWeight: '700', color: '#7c3aed' }}>{r.rec_number}</td>
                      <td style={{ padding: '12px', color: '#64748b' }}>{new Date(r.timestamp).toLocaleDateString('en-GB')}</td>
                      <td style={{ padding: '12px', color: '#334155' }}>{r.supplier}</td>
                      <td style={{ padding: '12px', color: '#475569' }}>{r.project}</td>
                      <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: '700', color: '#16a34a' }}>
                        {parseFloat(r.total_amount).toLocaleString()} L.E
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {r.pdf_link ? (
                          <a href={`http://localhost:5000${r.pdf_link}`} target="_blank" rel="noreferrer" style={{ color: '#7c3aed', fontWeight: '700', textDecoration: 'none', fontSize: '12px' }}>📄 View</a>
                        ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}