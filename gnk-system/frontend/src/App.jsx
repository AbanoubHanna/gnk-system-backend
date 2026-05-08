import { useState } from 'react';
import PaymentForm from './components/PaymentForm';
import ReceivingForm from './components/ReceivingForm';
import Dashboard from './components/Dashboard';
import ManagerView from './components/ManagerView'; 
import AccountantView from './components/AccountantView';

function App() {
  const [user] = useState({
    email: 'Treasury@gnk.group',
    employeeName: 'Treasury',
    isManager: true,
    isAccountant: true,
    isAdmin: true
  });
  
  // 1. خلينا الـ dashboard حروف سمول عشان تفتح صح
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // 2. المتغير السحري: ده بيسجل التابات اللي اليوزر داس عليها بس
  const [loadedTabs, setLoadedTabs] = useState(['dashboard']);

  // 3. دالة جديدة: لما بتدوس على تاب، بتشغله، وبتضيفه لقائمة "المحملين"
  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
    if (!loadedTabs.includes(tabName)) {
      setLoadedTabs([...loadedTabs, tabName]);
    }
  };

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
        {user.isAccountant && <button className={`tab-btn ${activeTab === 'accountant' ? 'active' : ''}`} onClick={() => handleTabClick('accountant')}>🏦 Accountant View</button>}
        {user.isManager && <button className={`tab-btn ${activeTab === 'manager' ? 'active' : ''}`} onClick={() => handleTabClick('manager')}>👔 Manager Approvals</button>}
        
        <button className={`tab-btn ${activeTab === 'payment' ? 'active' : ''}`} onClick={() => handleTabClick('payment')}>💳 Payment Request</button>
        <button className={`tab-btn ${activeTab === 'receiving' ? 'active' : ''}`} onClick={() => handleTabClick('receiving')}>📦 Receiving Voucher</button>
        <button className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => handleTabClick('dashboard')}>📊 My Dashboard</button>
      </div>

      <div className="page">
        {/* بنسأل سؤالين: هل هو محاسب؟ + هل هو داس على التاب ده قبل كده؟ */}
        {user.isAccountant && loadedTabs.includes('accountant') && (
          <div style={{ display: activeTab === 'accountant' ? 'block' : 'none' }}>
            <AccountantView user={user} />
          </div>
        )}
        
        {user.isManager && loadedTabs.includes('manager') && (
          <div style={{ display: activeTab === 'manager' ? 'block' : 'none' }}>
            <ManagerView user={user} />
          </div>
        )}
        
        {loadedTabs.includes('payment') && (
          <div style={{ display: activeTab === 'payment' ? 'block' : 'none' }}>
            <PaymentForm user={user} />
          </div>
        )}
        
        {loadedTabs.includes('receiving') && (
          <div style={{ display: activeTab === 'receiving' ? 'block' : 'none' }}>
            <ReceivingForm user={user} />
          </div>
        )}
        
        {loadedTabs.includes('dashboard') && (
          <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
            <Dashboard user={user} />
          </div>
        )}
      </div>
    </>
  );
}

export default App;
