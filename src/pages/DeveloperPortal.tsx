import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Terminal, 
  Copy, 
  Check, 
  Send, 
  ExternalLink, 
  ArrowLeft,
  Cpu, 
  CheckCircle2, 
  RefreshCw,
  FileCode,
  LogIn,
  UserPlus,
  LogOut,
  AlertCircle,
  Key,
  CreditCard,
  User,
  ShieldCheck
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { DeveloperGoLiveTab } from '../components/DeveloperGoLiveTab';

export interface DeveloperSession {
  id: string;
  merchant_name: string;
  contact_email: string;
  contact_phone?: string;
  test_key: string;
  sandbox_balance: number;
  live_status: 'locked' | 'pending_verification' | 'approved' | 'rejected';
  cargo_wallet_balance?: number;
  cargo_wallet_status?: 'active' | 'low_balance' | 'depleted' | 'inactive';
  business_name?: string;
  rc_number?: string;
  director_nin?: string;
  live_key?: string;
  live_key_masked?: string;
  has_live_key?: boolean;
  token?: string;
}

export const DeveloperPortal: React.FC = () => {
  const navigate = useNavigate();
  // 3 Streamlined Tabs
  const [activeTab, setActiveTab] = useState<'sandbox' | 'golive' | 'docs'>('sandbox');
  
  // Developer Account state
  const [devUser, setDevUser] = useState<DeveloperSession | null>(() => {
    try {
      const s = localStorage.getItem('wb_dev_session');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });

  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [regMerchantName, setRegMerchantName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  // Sandbox Keys & Balance
  const [testKey, setTestKey] = useState<string>(() => {
    try {
      const s = localStorage.getItem('wb_dev_session');
      return s ? JSON.parse(s).test_key || 'wb_test_waybilla_sandbox_key' : 'wb_test_waybilla_sandbox_key';
    } catch {
      return 'wb_test_waybilla_sandbox_key';
    }
  });
  const [sandboxBalance, setSandboxBalance] = useState<number>(() => {
    try {
      const s = localStorage.getItem('wb_dev_session');
      const bal = s ? JSON.parse(s).sandbox_balance : 50000;
      return typeof bal === 'number' && !isNaN(bal) ? bal : 50000;
    } catch {
      return 50000;
    }
  });
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isRotatingKey, setIsRotatingKey] = useState(false);
  const [isResettingBalance, setIsResettingBalance] = useState(false);

  // Simulator Form state
  const [simSenderName, setSimSenderName] = useState('Apex Fulfillment Dispatch');
  const [simSenderPhone, setSimSenderPhone] = useState('08031234567');
  const [simReceiverName, setSimReceiverName] = useState('Emeka Okonkwo');
  const [simReceiverPhone, setSimReceiverPhone] = useState('08129876543');
  const [simItemDescription, setSimItemDescription] = useState('Customer Order: Electronics Merchandise');
  const [simOriginPark, setSimOriginPark] = useState('Nnewi Central Park');
  const [simDestinationPark, setSimDestinationPark] = useState('Enugu Holy Ghost Park');
  const [simDeclaredValue, setSimDeclaredValue] = useState('35000');

  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Docs language tab
  const [codeLang, setCodeLang] = useState<'node' | 'curl' | 'python'>('node');

  useEffect(() => {
    if (devUser?.token) {
      fetch('/api/v1/developer/profile', {
        headers: { 'Authorization': `Bearer ${devUser.token}` }
      })
        .then(res => res.json())
        .then(res => {
          if (res.status && res.data) {
            setTestKey(res.data.test_key || 'wb_test_waybilla_sandbox_key');
            setSandboxBalance(typeof res.data.sandbox_balance === 'number' ? res.data.sandbox_balance : 50000);
            const updated = { ...devUser, ...res.data };
            setDevUser(updated);
            localStorage.setItem('wb_dev_session', JSON.stringify(updated));
          }
        })
        .catch(() => {});
    }
  }, [devUser?.token]);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Register Developer
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingAuth(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/v1/developer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_name: regMerchantName,
          contact_email: regEmail,
          contact_phone: regPhone,
          password: regPassword
        })
      });
      const data = await res.json();
      if (!res.ok || !data.status) {
        throw new Error(data.error || 'Failed to register developer account.');
      }
      const sessionData: DeveloperSession = {
        id: data.data.id,
        merchant_name: data.data.merchant_name,
        contact_email: data.data.contact_email,
        contact_phone: data.data.contact_phone,
        test_key: data.data.test_key,
        sandbox_balance: data.data.sandbox_balance,
        live_status: data.data.live_status || 'locked',
        cargo_wallet_balance: data.data.cargo_wallet_balance || 0,
        token: data.data.token
      };
      setDevUser(sessionData);
      setTestKey(sessionData.test_key);
      setSandboxBalance(sessionData.sandbox_balance);
      localStorage.setItem('wb_dev_session', JSON.stringify(sessionData));
      setShowAuthModal(false);
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Sign In Developer
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingAuth(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/v1/developer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword
        })
      });
      const data = await res.json();
      if (!res.ok || !data.status) {
        throw new Error(data.error || 'Invalid developer credentials.');
      }
      const sessionData: DeveloperSession = {
        id: data.data.id,
        merchant_name: data.data.merchant_name,
        contact_email: data.data.contact_email,
        contact_phone: data.data.contact_phone,
        test_key: data.data.test_key,
        sandbox_balance: data.data.sandbox_balance,
        live_status: data.data.live_status || 'locked',
        cargo_wallet_balance: data.data.cargo_wallet_balance || 0,
        has_live_key: data.data.has_live_key || false,
        live_key_masked: data.data.live_key_masked,
        token: data.data.token
      };
      setDevUser(sessionData);
      setTestKey(sessionData.test_key);
      setSandboxBalance(sessionData.sandbox_balance);
      localStorage.setItem('wb_dev_session', JSON.stringify(sessionData));
      setShowAuthModal(false);
    } catch (err: any) {
      setAuthError(err.message || 'Login failed.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('wb_dev_session');
    setDevUser(null);
    setTestKey('wb_test_waybilla_sandbox_key');
    setSandboxBalance(50000);
  };

  // Rotate Sandbox Key
  const handleRotateKey = async () => {
    if (!devUser?.id) return;
    setIsRotatingKey(true);
    try {
      const res = await fetch('/api/v1/developer/rotate-test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ developer_id: devUser.id })
      });
      const data = await res.json();
      if (data.status && data.data?.test_key) {
        const newKey = data.data.test_key;
        setTestKey(newKey);
        const updated = { ...devUser, test_key: newKey };
        setDevUser(updated);
        localStorage.setItem('wb_dev_session', JSON.stringify(updated));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRotatingKey(false);
    }
  };

  // Reset Sandbox Balance
  const handleResetBalance = async () => {
    if (!devUser?.id) return;
    setIsResettingBalance(true);
    try {
      const res = await fetch('/api/v1/developer/reset-sandbox-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ developer_id: devUser.id })
      });
      const data = await res.json();
      if (data.status) {
        setSandboxBalance(50000);
        const updated = { ...devUser, sandbox_balance: 50000 };
        setDevUser(updated);
        localStorage.setItem('wb_dev_session', JSON.stringify(updated));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsResettingBalance(false);
    }
  };

  // Execute Sandbox Waybill
  const handleRunSimulator = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingRequest(true);
    setApiError(null);
    setApiResponse(null);

    try {
      const res = await fetch('/api/v1/waybills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testKey}`
        },
        body: JSON.stringify({
          sender_name: simSenderName,
          sender_phone: simSenderPhone,
          receiver_name: simReceiverName,
          receiver_phone: simReceiverPhone,
          item_description: simItemDescription,
          origin_park: simOriginPark,
          destination_park: simDestinationPark,
          declared_value: parseFloat(simDeclaredValue) || 0
        })
      });

      const data = await res.json();
      if (!res.ok || !data.status) {
        throw new Error(data.error || 'Failed to create waybill.');
      }

      setApiResponse(data);
      setSandboxBalance(prev => Math.max(0, prev - 200));
    } catch (err: any) {
      setApiError(err.message || 'API request failed');
    } finally {
      setIsSendingRequest(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 flex flex-col justify-between overflow-x-hidden w-full max-w-full">
      {/* Header */}
      {/* Modern Developer Header */}
      <header className="bg-[#0A1F44] text-white px-3 sm:px-8 py-3 shadow-md sticky top-0 z-40 border-b border-blue-900/60">
        <div className="max-w-6xl mx-auto flex justify-between items-center gap-2">
          {/* Brand */}
          <div 
            onClick={() => navigate('/')} 
            className="flex items-center gap-2 cursor-pointer hover:opacity-95 transition-opacity shrink-0"
            title="Waybilla Home"
          >
            <Logo size="sm" showText={false} />
            <div className="flex items-center gap-1.5">
              <span className="font-black text-base sm:text-lg tracking-tight">Way<span className="text-[#F2A93B]">billa</span></span>
              <span className="hidden md:inline-block text-[10px] font-extrabold bg-blue-500/20 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Dev Hub
              </span>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {devUser ? (
              <div className="flex items-center gap-1.5 sm:gap-2 bg-white/10 px-2.5 sm:px-3 py-1.5 rounded-xl border border-white/10">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></div>
                <span className="text-[11px] sm:text-xs font-bold text-white truncate max-w-[100px] sm:max-w-[150px]">
                  {devUser.merchant_name}
                </span>
                <button
                  onClick={handleLogout}
                  title="Sign out of developer workspace"
                  className="text-slate-300 hover:text-rose-400 p-1 ml-0.5 transition-colors cursor-pointer rounded-lg hover:bg-white/10"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setShowAuthModal(true);
                  }}
                  className="text-[11px] sm:text-xs font-bold text-slate-200 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl hover:bg-white/10 transition-all cursor-pointer flex items-center gap-1 border border-white/10 whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5 text-slate-300" />
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setShowAuthModal(true);
                  }}
                  className="text-[11px] sm:text-xs font-black bg-[#F2A93B] text-[#0A1F44] hover:bg-amber-400 px-2.5 sm:px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-xs whitespace-nowrap shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline sm:inline">Sign Up</span>
                  <span className="inline xs:hidden sm:hidden">Join</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-xs font-bold text-slate-300 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl hover:bg-white/10 transition-all cursor-pointer items-center gap-1.5 border border-white/10 active:scale-95 shrink-0 hidden md:flex"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Public Tracking</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner with Clean Responsive Tab Selector */}
      <div className="bg-[#0A1F44] text-white border-b border-blue-900/50 pt-6 sm:pt-10 pb-6 sm:pb-8 px-3 sm:px-8">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/10 text-amber-300 text-[11px] sm:text-xs font-black px-2.5 sm:px-3 py-1 rounded-xl border border-white/10">
            <Cpu className="w-3.5 h-3.5 text-[#F2A93B] shrink-0" />
            <span>Waybilla Interstate Dispatch &amp; Tracking API</span>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
                Programmatic Motor Park Dispatch
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-normal mt-1 leading-relaxed">
                Plug interstate motor park bookings directly into your e-commerce checkout, marketplace, or ERP.
              </p>
            </div>

            {/* Clean 3-Tab Navigator (Fully Responsive Grid) */}
            <div className="grid grid-cols-3 gap-1 bg-slate-900/90 p-1 sm:p-1.5 rounded-2xl border border-blue-900/80 w-full lg:w-auto shrink-0">
              <button
                onClick={() => setActiveTab('sandbox')}
                className={`py-2 px-2 sm:px-4 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'sandbox'
                    ? 'bg-[#F2A93B] text-[#0A1F44] shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 shrink-0" />
                <span>1. Sandbox</span>
              </button>

              <button
                onClick={() => setActiveTab('golive')}
                className={`py-2 px-2 sm:px-4 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'golive'
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Key className="w-3.5 h-3.5 shrink-0" />
                <span>2. Go-Live</span>
                {devUser?.has_live_key && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white ml-0.5"></span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('docs')}
                className={`py-2 px-2 sm:px-4 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'docs'
                    ? 'bg-white text-[#0A1F44] shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 shrink-0" />
                <span>3. API Docs</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-8 py-8 flex-1">
        
        {/* ========================================================================= */}
        {/* TAB 1: TEST & SIMULATE (MERGED SANDBOX KEY + LIVE SIMULATOR) */}
        {/* ========================================================================= */}
        {activeTab === 'sandbox' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Top Bar: Sandbox Credentials & Balance */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Your Sandbox Secret Key</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs sm:text-sm font-mono font-black text-slate-900 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 select-all truncate max-w-md">
                    {testKey}
                  </code>
                  <button
                    onClick={() => handleCopy(testKey, 'testKey')}
                    className="bg-[#0A1F44] text-white hover:bg-blue-900 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    {copiedField === 'testKey' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'testKey' ? 'Copied' : 'Copy'}</span>
                  </button>
                  {devUser && (
                    <button
                      onClick={handleRotateKey}
                      disabled={isRotatingKey}
                      title="Rotate test key"
                      className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRotatingKey ? 'animate-spin text-blue-600' : ''}`} />
                    </button>
                  )}
                </div>
              </div>

              {/* Sandbox Balance Pill */}
              <div className="flex items-center gap-3 shrink-0 bg-slate-50 border border-slate-200 p-3 rounded-2xl self-start md:self-auto">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Sandbox Credit</p>
                  <p className="text-base font-black text-slate-900">₦{(sandboxBalance ?? 0).toLocaleString()}</p>
                </div>
                {devUser ? (
                  <button
                    onClick={handleResetBalance}
                    disabled={isResettingBalance}
                    title="Reset to ₦50,000"
                    className="text-slate-400 hover:text-blue-600 p-1.5 rounded-xl hover:bg-slate-200/50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isResettingBalance ? 'animate-spin text-blue-600' : ''}`} />
                  </button>
                ) : null}
              </div>
            </div>

            {/* Simulator Interactive Card */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-black text-[#0A1F44] flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-blue-600" />
                    Simulate API Waybill Creation
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Trigger a live request to <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-blue-700">POST /api/v1/waybills</code> without writing backend code first.
                  </p>
                </div>

                <div className="text-xs font-bold text-slate-500 bg-blue-50 text-blue-900 border border-blue-100 px-3 py-1 rounded-xl flex items-center gap-1.5 self-start sm:self-auto">
                  <span>Manifest Fee: ₦200 / call (deducted from test credit)</span>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleRunSimulator} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Sender Name</label>
                    <input
                      type="text"
                      value={simSenderName}
                      onChange={(e) => setSimSenderName(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Sender Phone</label>
                    <input
                      type="text"
                      value={simSenderPhone}
                      onChange={(e) => setSimSenderPhone(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Receiver Name</label>
                    <input
                      type="text"
                      value={simReceiverName}
                      onChange={(e) => setSimReceiverName(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Receiver Phone</label>
                    <input
                      type="text"
                      value={simReceiverPhone}
                      onChange={(e) => setSimReceiverPhone(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Origin Park</label>
                    <input
                      type="text"
                      value={simOriginPark}
                      onChange={(e) => setSimOriginPark(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Destination Park</label>
                    <input
                      type="text"
                      value={simDestinationPark}
                      onChange={(e) => setSimDestinationPark(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Parcel Description</label>
                    <input
                      type="text"
                      value={simItemDescription}
                      onChange={(e) => setSimItemDescription(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={isSendingRequest}
                    className="bg-[#0A1F44] text-white px-6 py-3 rounded-2xl font-black text-xs hover:bg-blue-900 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2 shadow-sm"
                  >
                    {isSendingRequest ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Creating Waybill...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-[#F2A93B]" />
                        <span>Execute API Call</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {apiError && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold">
                  {apiError}
                </div>
              )}

              {/* Response Output */}
              {apiResponse && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      HTTP 201 Created &bull; Waybill Pre-Booked
                    </span>
                    <a
                      href={`/?code=${encodeURIComponent(apiResponse.data?.tracking_code)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-black text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                    >
                      Track Shipment Live in Public UI <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Tracking Code</p>
                      <p className="text-sm font-black text-slate-900 mt-0.5">{apiResponse.data?.tracking_code}</p>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Pickup PIN</p>
                      <p className="text-sm font-black text-blue-700 mt-0.5">{apiResponse.data?.pickup_pin}</p>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Initial Status</p>
                      <p className="text-sm font-black text-amber-600 mt-0.5">pre_booked (Awaiting Park)</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-600 mb-1">Full JSON Response:</p>
                    <pre className="bg-slate-900 text-emerald-400 p-4 rounded-2xl text-[11px] font-mono overflow-x-auto leading-relaxed">
                      {JSON.stringify(apiResponse, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: GO-LIVE & WALLET (STREAMLINED MERGED DASHBOARD) */}
        {/* ========================================================================= */}
        {activeTab === 'golive' && (
          <DeveloperGoLiveTab
            devUser={devUser}
            onSwitchTab={setActiveTab}
            onLogout={handleLogout}
            onAccountUpdated={(updated) => {
              setDevUser(updated);
              localStorage.setItem('wb_dev_session', JSON.stringify(updated));
            }}
            onRequireAuth={(mode) => {
              setAuthMode(mode || 'register');
              setShowAuthModal(true);
            }}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB 3: API DOCS */}
        {/* ========================================================================= */}
        {activeTab === 'docs' && (
          <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <h2 className="text-xl font-black text-[#0A1F44]">API Endpoints Reference</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Base URL: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-800">https://waybilla.com.ng/api/v1</code>
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
                  {(['node', 'curl', 'python'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setCodeLang(lang)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                        codeLang === lang ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              {/* Endpoint 1: POST /api/v1/waybills */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-600 text-white font-mono text-xs font-black px-2 py-0.5 rounded-lg">POST</span>
                  <code className="font-mono text-xs font-black text-slate-900">/api/v1/waybills</code>
                </div>
                <p className="text-xs text-slate-600">
                  Creates an interstate waybill. Deducts ₦200 manifest fee and returns the <code>tracking_code</code> and <code>pickup_pin</code>.
                </p>

                <div className="bg-slate-950 rounded-2xl p-4 font-mono text-xs text-blue-300 overflow-x-auto">
                  {codeLang === 'node' && (
                    <pre>
{`const response = await fetch("https://waybilla.com.ng/api/v1/waybills", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${devUser?.has_live_key ? 'wb_live_your_key' : testKey}"
  },
  body: JSON.stringify({
    sender_name: "Apex Fulfillment",
    sender_phone: "08031234567",
    receiver_name: "Emeka Okonkwo",
    receiver_phone: "08129876543",
    item_description: "Electronics Merchandise",
    origin_park: "Nnewi Central Park",
    destination_park: "Enugu Holy Ghost Park",
    declared_value: 35000
  })
});
const data = await response.json();`}
                    </pre>
                  )}
                  {codeLang === 'curl' && (
                    <pre className="text-emerald-300">
{`curl -X POST https://waybilla.com.ng/api/v1/waybills \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${devUser?.has_live_key ? 'wb_live_your_key' : testKey}" \\
  -d '{
    "sender_name": "Apex Fulfillment",
    "sender_phone": "08031234567",
    "receiver_name": "Emeka Okonkwo",
    "receiver_phone": "08129876543",
    "item_description": "Electronics Merchandise",
    "origin_park": "Nnewi Central Park",
    "destination_park": "Enugu Holy Ghost Park",
    "declared_value": 35000
  }'`}
                    </pre>
                  )}
                  {codeLang === 'python' && (
                    <pre className="text-amber-300">
{`import requests

res = requests.post(
  "https://waybilla.com.ng/api/v1/waybills",
  headers={"Authorization": "Bearer ${devUser?.has_live_key ? 'wb_live_your_key' : testKey}"},
  json={
    "sender_name": "Apex Fulfillment",
    "sender_phone": "08031234567",
    "receiver_name": "Emeka Okonkwo",
    "receiver_phone": "08129876543",
    "item_description": "Electronics Merchandise",
    "origin_park": "Nnewi Central Park",
    "destination_park": "Enugu Holy Ghost Park",
    "declared_value": 35000
  }
)
print(res.json())`}
                    </pre>
                  )}
                </div>
              </div>

              {/* Endpoint 2: GET /api/v1/waybills/:tracking_code */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white font-mono text-xs font-black px-2 py-0.5 rounded-lg">GET</span>
                  <code className="font-mono text-xs font-black text-slate-900">/api/v1/waybills/:tracking_code</code>
                </div>
                <p className="text-xs text-slate-600">
                  Retrieves live transit progress, assigned bus number, and completed milestones for any waybill.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Auth Modal (Sign In / Register) */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-scaleUp border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-[#0A1F44]">
                  {authMode === 'register' ? 'Create Developer Workspace' : 'Developer Sign In'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {authMode === 'register' 
                    ? 'Register your company to generate live keys & fund wallet.' 
                    : 'Sign in to access your live keys and cargo wallet.'}
                </p>
              </div>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setAuthMode('register')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  authMode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 inline mr-1" />
                Register
              </button>
              <button
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  authMode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                <LogIn className="w-3.5 h-3.5 inline mr-1" />
                Sign In
              </button>
            </div>

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold">
                {authError}
              </div>
            )}

            {authMode === 'register' ? (
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Company / App Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Merchandise Ltd"
                    value={regMerchantName}
                    onChange={(e) => setRegMerchantName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Work Email</label>
                  <input
                    type="email"
                    required
                    placeholder="dev@company.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700">WhatsApp Phone Number</label>
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      💬 WhatsApp Required
                    </span>
                  </div>
                  <input
                    type="tel"
                    required
                    placeholder="08031234567 or +234..."
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Super Admin sends live KYC verification and API alerts to this WhatsApp number.
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingAuth}
                  className="w-full bg-[#0A1F44] hover:bg-blue-900 text-white font-black py-3 rounded-2xl text-xs cursor-pointer shadow-sm transition-all"
                >
                  {isSubmittingAuth ? 'Creating Workspace...' : 'Create Account & Continue'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="dev@company.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingAuth}
                  className="w-full bg-[#0A1F44] hover:bg-blue-900 text-white font-black py-3 rounded-2xl text-xs cursor-pointer shadow-sm transition-all"
                >
                  {isSubmittingAuth ? 'Signing In...' : 'Sign In to Workspace'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-6 px-4 text-center text-xs text-slate-500">
        <p className="font-bold">
          Waybilla API Infrastructure &bull; Automated Interstate Logistics &amp; Park Connectivity
        </p>
      </footer>
    </div>
  );
};
