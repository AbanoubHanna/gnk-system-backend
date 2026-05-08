import { useState, useEffect } from 'react';
import Login from './components/Login';
import PaymentForm from './components/PaymentForm';
import ReceivingForm from './components/ReceivingForm';
import Dashboard from './components/Dashboard';
import ManagerView from './components/ManagerView'; 
import AccountantView from './components/AccountantView';

function App() {
  // 1. حالة المستخدم: لو null يعني لسه معملش تسجيل دخول
  const [user, setUser] = useState(null);
  
  // 2. التاب الحالي والتابات المحملة (لتسريع التنقل زي ما عملنا)
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loadedTabs, setLoadedTabs] = useState(['dashboard']);

  // 3. التحقق هل اليوزر مسجل دخول قبل كده ولا لأ (عشان ميطلبش الكود كل شوية)
  useEffect(() => {
    const savedUser = sessionStorage.getItem('gnk_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // 4. دالة نجاح الدخول (بتستلم الداتا من شاشة اللوجين)
  const handleLoginSuccess = (userData) => {
    sessionStorage.setItem('gnk_user', JSON.stringify(userData));
    setUser(userData);
  };

  // 5. دالة تسجيل الخروج
  const handleLogout = () => {
    sessionStorage.removeItem('gnk_user');
    setUser(null);
    setLoadedTabs(['dashboard']);
    setActiveTab('dashboard');
  };

  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
    if (!loadedTabs.includes(tabName)) {
      setLoadedTabs([...loadedTabs, tabName]);
    }
  };

  // 6. لو مفيش يوزر، اعرض شاشة الدخول (Login) فوراً وامنع فتح الموقع
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // 7. لو فيه يوزر، افتحله الموقع بناءً على صلاحياته
  return (
    <>
      <div className="topbar">
        <span className="topbar-logo">GNK</span>
        <div className="topbar-sep"></div>
        <span className="topbar-title">Operations System</span>
        <div className="topbar-user">
          <span className="topbar-email">{user.email}</span>
          <button onClick={handleLogout} style={{background:'none', border:'1px solid #cbd5e1', color:'#f8fafc', padding:'4px 10px', borderRadius:'6px', cursor:'pointer', fontSize:'11px'}}>Logout</button>
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
