import { useState } from 'react';
import PaymentForm from './components/PaymentForm';
import ReceivingForm from './components/ReceivingForm';
import Dashboard from './components/Dashboard';
import ManagerView from './components/ManagerView'; // ✅ ده عملناه خلاص
import AccountantView from './components/AccountantView'; // ⛔ خليه كومنت عشان لسه هنكتبه

function App() {
  const [user] = useState({
    email: 'Treasury@gnk.group',
    employeeName: 'Treasury',
    isManager: true,
    isAccountant: true,
    isAdmin: true
  });
  
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <>
      <div className="topbar">
        <span className="topbar-logo">GNK</span>
        <div className="topbar-sep"></div>
        <span className="topbar-title">Operations System</span>
        <div className="topbar-user">
          <span className="topbar-email">{user.email}</span>
          <span style={{fontSize: '10px', background: '#22c55e', color: '#fff', padding: '2px 6px', borderRadius: '4px'}}>DEV MODE</span>
        </div>
      </div>

      <div className="tabs">
        {user.isAccountant && <button className={`tab-btn ${activeTab === 'accountant' ? 'active' : ''}`} onClick={() => setActiveTab('accountant')}>🏦 Accountant View</button>}
        {user.isManager && <button className={`tab-btn ${activeTab === 'manager' ? 'active' : ''}`} onClick={() => setActiveTab('manager')}>👔 Manager Approvals</button>}
        
        <button className={`tab-btn ${activeTab === 'payment' ? 'active' : ''}`} onClick={() => setActiveTab('payment')}>💳 Payment Request</button>
        <button className={`tab-btn ${activeTab === 'receiving' ? 'active' : ''}`} onClick={() => setActiveTab('receiving')}>📦 Receiving Voucher</button>
        <button className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>📊 My Dashboard</button>
      </div>

 <div className="page">
        {user.isAccountant && (
          <div style={{ display: activeTab === 'accountant' ? 'block' : 'none' }}>
            <AccountantView user={user} />
          </div>
        )}
        {user.isManager && (
          <div style={{ display: activeTab === 'manager' ? 'block' : 'none' }}>
            <ManagerView user={user} />
          </div>
        )}
        <div style={{ display: activeTab === 'payment' ? 'block' : 'none' }}>
          <PaymentForm user={user} />
        </div>
        <div style={{ display: activeTab === 'receiving' ? 'block' : 'none' }}>
          <ReceivingForm user={user} />
        </div>
        <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
          <Dashboard user={user} />
        </div>
      </div>

export default App;
