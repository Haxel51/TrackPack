import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Badge } from '../components/ui';
import { 
  ShieldCheck, 
  Users, 
  Building, 
  LogOut, 
  ArrowLeft, 
  Lock, 
  Mail, 
  CheckCircle2, 
  Settings, 
  AlertTriangle,
  FileText,
  TrendingUp,
  DollarSign,
  CreditCard,
  Download,
  RefreshCw,
  Search,
  Filter,
  Clock,
  Truck,
  Sliders,
  XCircle,
  Eye,
  EyeOff,
  MapPin,
  Briefcase
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getLeads, updateStaffStatus, deleteWaybill } from '../lib/api';
import { Lead, Company, Waybill, Staff, WaybillStatus } from '../types';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  isPlatformAdminSetup, 
  setupPlatformAdmin, 
  initiatePlatformAdminLogin, 
  verifyPlatformAdmin2FA, 
  verifyPlatformAdminSession, 
  logOutOfAllDevices, 
  getAllCompanies, 
  approveCompany, 
  declineCompany,
  toggleCompanyStatus,
  getAllWaybills,
  getAllStaffMembers,
  updateCompanyCommission,
  overrideWaybillStatus,
  getPlatformConfig,
  updatePlatformConfig
} from '../lib/platformAdminApi';

export function PlatformAdminDashboard() {
  const navigate = useNavigate();

  // Auth & Screen States
  const [isSetupNeeded, setIsSetupNeeded] = useState<boolean>(false);
  const [loadingCheck, setLoadingCheck] = useState<boolean>(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [currentScreen, setCurrentScreen] = useState<'login' | 'setup' | '2fa'>('login');
  
  // Setup Form State
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // 2FA State
  const [verificationCode, setVerificationCode] = useState('');

  // Password Visibility States
  const [showSetupPassword, setShowSetupPassword] = useState(false);
  const [showSetupConfirmPassword, setShowSetupConfirmPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showCode, setShowCode] = useState(false);

  // Error/Success Statuses
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Dashboard Data State
  const [activeTab, setActiveTab] = useState<'overview' | 'waybills' | 'finances' | 'companies' | 'staff' | 'leads' | 'security'>('overview');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [waybills, setWaybills] = useState<Waybill[]>([]);
  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Search & Filter States
  const [waybillSearch, setWaybillSearch] = useState('');
  const [waybillStatusFilter, setWaybillStatusFilter] = useState<'all' | WaybillStatus>('all');
  const [waybillParkFilter, setWaybillParkFilter] = useState('all');

  // Modal / Action States
  const [selectedWaybillForOverride, setSelectedWaybillForOverride] = useState<Waybill | null>(null);
  const [newStatusValue, setNewStatusValue] = useState<WaybillStatus>('Booked');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deletingWaybillId, setDeletingWaybillId] = useState<string | null>(null);
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState<boolean>(false);

  // Commission Edit State
  const [editingCommissionId, setEditingCommissionId] = useState<string | null>(null);
  const [commissionRateInput, setCommissionRateInput] = useState<number>(10);
  const [subaccountLoadingId, setSubaccountLoadingId] = useState<string | null>(null);

  // Dynamic booking/tracking fee price state
  const [bookingFeeSetting, setBookingFeeSetting] = useState<number>(200);
  const [updatingFee, setUpdatingFee] = useState<boolean>(false);
  const [feeSuccess, setFeeSuccess] = useState<string>('');

  // Paystack Live API Keys Configuration State
  const [paystackPublicKeyInput, setPaystackPublicKeyInput] = useState('');
  const [paystackSecretKeyInput, setPaystackSecretKeyInput] = useState('');
  const [paystackStatus, setPaystackStatus] = useState<{ isConfigured: boolean; isLive: boolean; isTest: boolean; secretKeyMasked: string; publicKey: string } | null>(null);
  const [savingPaystackKeys, setSavingPaystackKeys] = useState(false);
  const [paystackKeyMsg, setPaystackKeyMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPaystackKeyForm, setShowPaystackKeyForm] = useState(false);

  const loadPaystackKeysStatus = async () => {
    try {
      const res = await fetch('/api/admin/paystack-keys');
      const data = await res.json();
      if (data.status === 'success') {
        setPaystackStatus({
          isConfigured: data.isConfigured,
          isLive: data.isLive,
          isTest: data.isTest,
          secretKeyMasked: data.secretKeyMasked,
          publicKey: data.publicKey
        });
        if (data.publicKey && !paystackPublicKeyInput) {
          setPaystackPublicKeyInput(data.publicKey);
        }
      }
    } catch (err) {
      console.warn('Failed to load Paystack status:', err);
    }
  };

  const handleSavePaystackKeys = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPaystackKeys(true);
    setPaystackKeyMsg(null);
    try {
      const res = await fetch('/api/admin/paystack-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: paystackPublicKeyInput,
          secretKey: paystackSecretKeyInput
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setPaystackKeyMsg({ type: 'success', text: data.message });
        setPaystackSecretKeyInput('');
        loadPaystackKeysStatus();
      } else {
        setPaystackKeyMsg({ type: 'error', text: data.message || 'Failed to save Paystack keys.' });
      }
    } catch (err: any) {
      setPaystackKeyMsg({ type: 'error', text: err.message || 'Server error saving keys.' });
    } finally {
      setSavingPaystackKeys(false);
    }
  };

  // Document Viewer Lightbox State
  const [selectedDocumentView, setSelectedDocumentView] = useState<{ title: string; image: string; companyName: string } | null>(null);

  // Check auth and setup state on load
  useEffect(() => {
    checkSystemState();
  }, []);

  const checkSystemState = async () => {
    try {
      setLoadingCheck(true);
      setError('');
      const setup = await isPlatformAdminSetup();
      setIsSetupNeeded(!setup);
      if (!setup) {
        setCurrentScreen('setup');
      } else {
        // Check if there is an active session
        const storedEmail = localStorage.getItem('platform_admin_email');
        const storedRevId = localStorage.getItem('platform_admin_rev_id');
        if (storedEmail && storedRevId) {
          const isValid = await verifyPlatformAdminSession(storedRevId);
          if (isValid) {
            setIsLoggedIn(true);
            loadDashboardData();
          } else {
            handleLocalLogout();
          }
        }
      }
    } catch (err: any) {
      console.warn('Notice during admin state check:', err?.message || err);
    } finally {
      setLoadingCheck(false);
    }
  };

  const handleLocalLogout = () => {
    localStorage.removeItem('platform_admin_email');
    localStorage.removeItem('platform_admin_rev_id');
    setIsLoggedIn(false);
    setCurrentScreen('login');
  };

  const loadDashboardData = async () => {
    setLoadingData(true);
    try {
      loadPaystackKeysStatus();
      const [comps, lds, stf, config] = await Promise.all([
        getAllCompanies(),
        getLeads(),
        getAllStaffMembers(),
        getPlatformConfig()
      ]);
      setCompanies(comps);
      setLeads(lds);
      setStaffMembers(stf);
      if (config && typeof config.bookingFee === 'number') {
        setBookingFeeSetting(config.bookingFee);
      }
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    const unsub = onSnapshot(collection(db, 'waybills'), (snapshot) => {
      const list: Waybill[] = [];
      snapshot.forEach(docSnap => {
        list.push({ ...(docSnap.data() as Waybill), id: docSnap.id });
      });
      list.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
      setWaybills(list);
    }, (err) => {
      console.warn("PlatformAdminDashboard waybills snapshot error:", err);
    });
    return () => unsub();
  }, [isLoggedIn]);

  const handleUpdateBookingFee = async (e: FormEvent) => {
    e.preventDefault();
    setUpdatingFee(true);
    setFeeSuccess('');
    try {
      await updatePlatformConfig(bookingFeeSetting);
      setFeeSuccess(`Tracking fee successfully updated to ₦${bookingFeeSetting.toLocaleString()}`);
      setTimeout(() => setFeeSuccess(''), 4000);
    } catch (err: any) {
      console.error('Failed to update booking fee:', err);
      alert('Failed to update tracking fee: ' + (err.message || err));
    } finally {
      setUpdatingFee(false);
    }
  };

  // Setup Form Handler
  const handleSetupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!setupEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (setupPassword !== setupConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await setupPlatformAdmin(setupEmail, setupPassword);
      setSuccess('Platform Administrator setup completed! You can now log in.');
      setIsSetupNeeded(false);
      setCurrentScreen('login');
    } catch (err: any) {
      setError(err.message || 'Setup failed.');
    } finally {
      setLoading(false);
    }
  };

  // Login Form Handler
  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    setLoading(true);
    try {
      const res = await initiatePlatformAdminLogin(loginEmail, loginPassword);
      if (res.success) {
        setCurrentScreen('2fa');
      } else {
        setError(res.error || 'Invalid credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  // 2FA Form Handler
  const handle2FASubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    setLoading(true);
    try {
      const res = await verifyPlatformAdmin2FA(verificationCode);
      if (res.success && res.revocationId) {
        localStorage.setItem('platform_admin_email', loginEmail);
        localStorage.setItem('platform_admin_rev_id', res.revocationId);
        setIsLoggedIn(true);
        loadDashboardData();
        setSuccess('Logged in successfully!');
      } else {
        setError(res.error || 'Invalid code.');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // Company Approvals
  const handleApproveCompany = async (companyId: string) => {
    try {
      await approveCompany(companyId);
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, approved: true } : c));
    } catch (err) {
      console.error('Error approving company:', err);
    }
  };

  const handleDeclineCompany = async (companyId: string) => {
    try {
      await declineCompany(companyId);
      setCompanies(prev => prev.filter(c => c.id !== companyId));
      setDeletingCompanyId(null);
      setSuccess('Company removed successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error declining company:', err);
      setError('Failed to remove company. Please try again.');
    }
  };

  const handleToggleCompanyStatus = async (companyId: string, currentStatus?: string) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    try {
      await toggleCompanyStatus(companyId, newStatus);
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, status: newStatus } : c));
    } catch (err) {
      console.error('Error toggling company status:', err);
    }
  };

  // Save Company Commission Rate
  const handleSaveCommissionRate = async (companyId: string) => {
    try {
      await updateCompanyCommission(companyId, commissionRateInput);
      setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, commissionRate: commissionRateInput } : c));
      setEditingCommissionId(null);
    } catch (err) {
      console.error('Failed to update commission rate:', err);
    }
  };

  // Manually create / retry Paystack Subaccount
  const handleCreatePaystackSubaccount = async (companyId: string) => {
    if (window.confirm("Do you want to create or retry linking a Paystack Subaccount for this company? This will fetch their bank details and submit them to Paystack.")) {
      setSubaccountLoadingId(companyId);
      try {
        const response = await fetch('/api/company/generate-subaccount', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId })
        });
        const data = await response.json();
        if (response.ok && data.status === 'success') {
          alert(data.message || 'Paystack subaccount successfully created!');
          setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, paystackSubaccountCode: data.paystackSubaccountCode } : c));
        } else {
          alert(data.message || 'Failed to create subaccount. Please ensure Paystack keys are valid and the bank details are complete.');
        }
      } catch (err) {
        console.error('Failed to create Paystack subaccount:', err);
        alert('An error occurred while connecting to the server.');
      } finally {
        setSubaccountLoadingId(null);
      }
    }
  };

  // Toggle Staff Status
  const handleToggleStaffStatus = async (staffId: string, currentStatus: boolean | undefined) => {
    const newStatus = !(currentStatus ?? true);
    try {
      await updateStaffStatus(staffId, newStatus);
      setStaffMembers(prev => prev.map(s => s.id === staffId ? { ...s, isActive: newStatus } : s));
    } catch (err) {
      console.error('Failed to update staff status:', err);
    }
  };

  // Override Waybill Status
  const handleExecuteStatusOverride = async () => {
    if (!selectedWaybillForOverride || !selectedWaybillForOverride.id) return;
    setUpdatingStatus(true);
    try {
      await overrideWaybillStatus(selectedWaybillForOverride.id, newStatusValue);
      setWaybills(prev => prev.map(w => w.id === selectedWaybillForOverride.id ? { ...w, status: newStatusValue } : w));
      setSelectedWaybillForOverride(null);
    } catch (err) {
      console.error('Failed to override status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Log Out of All Devices Handler
  const handleRevokeAllSessions = async () => {
    setLoading(true);
    try {
      await logOutOfAllDevices();
      handleLocalLogout();
      setSuccess('All active devices have been successfully logged out. Please sign in again.');
    } catch (err) {
      setError('Failed to revoke sessions.');
    } finally {
      setLoading(false);
      setShowRevokeConfirm(false);
    }
  };

  // CSV Audit Export
  const exportFinancialAuditCSV = () => {
    const headers = ['Tracking Code', 'Date', 'Origin Park', 'Destination Park', 'Company', 'Sender', 'Receiver', 'Status', 'Delivery Fee (NGN)', 'Platform Fee (NGN)', 'Payment Method'];
    const rows = waybills.map(w => {
      const fee = w.deliveryFee || w.paymentVirtualAccount?.amount || 0;
      const comp = companies.find(c => c.name === w.companyName || c.id === w.companyId);
      const rate = comp?.commissionRate ?? 10;
      const platformFee = Math.round(fee * (rate / 100));
      return [
        w.trackingCode,
        new Date(w.createdTimestamp).toLocaleDateString(),
        `"${w.originPark}"`,
        `"${w.destinationPark}"`,
        `"${w.companyName || 'N/A'}"`,
        `"${w.senderName} (${w.senderPhone})"`,
        `"${w.receiverName} (${w.receiverPhone})"`,
        w.status,
        fee,
        platformFee,
        w.paymentMethod || 'cash_at_park'
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TrackPack_Financial_Audit_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Business Metrics Calculations
  const pendingCompanies = companies.filter(c => !c.approved && c.status !== 'suspended');
  const approvedCompanies = companies.filter(c => c.approved);

  const totalWaybillsCount = waybills.length;
  const bookedWaybills = waybills.filter(w => w.status === 'Booked');
  const departedWaybills = waybills.filter(w => w.status === 'Departed');
  const arrivedWaybills = waybills.filter(w => w.status === 'Arrived');
  const collectedWaybills = waybills.filter(w => w.status === 'Collected');

  const grossGMV = waybills.reduce((sum, w) => sum + (w.deliveryFee || w.paymentVirtualAccount?.amount || 0), 0);
  const netPlatformCommission = waybills.reduce((sum, w) => {
    const comp = companies.find(c => c.name === w.companyName || c.id === w.companyId);
    const rate = comp?.commissionRate ?? 10;
    const fee = w.deliveryFee || w.paymentVirtualAccount?.amount || 0;
    return sum + (fee * (rate / 100));
  }, 0);

  const onlinePaymentsGMV = waybills.filter(w => w.paymentMethod === 'paystack_online' || w.paymentStatus === 'success').reduce((sum, w) => sum + (w.deliveryFee || w.paymentVirtualAccount?.amount || 0), 0);
  const cashPaymentsGMV = grossGMV - onlinePaymentsGMV;

  // Filtered Waybills List
  const filteredWaybills = waybills.filter(w => {
    const matchesSearch = 
      w.trackingCode.toLowerCase().includes(waybillSearch.toLowerCase()) ||
      w.senderPhone.includes(waybillSearch) ||
      w.receiverPhone.includes(waybillSearch) ||
      w.itemDescription.toLowerCase().includes(waybillSearch.toLowerCase()) ||
      w.busNumber.toLowerCase().includes(waybillSearch.toLowerCase());

    const matchesStatus = waybillStatusFilter === 'all' || w.status === waybillStatusFilter;
    const matchesPark = waybillParkFilter === 'all' || w.originPark === waybillParkFilter || w.destinationPark === waybillParkFilter;

    return matchesSearch && matchesStatus && matchesPark;
  });

  // Unique list of parks for filtering
  const allParksList = Array.from(new Set(waybills.flatMap(w => [w.originPark, w.destinationPark]).filter(Boolean)));

  if (loadingCheck) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-12">
        <div className="animate-pulse space-y-4 text-center">
          <ShieldCheck className="w-12 h-12 text-navy mx-auto animate-bounce" />
          <p className="text-gray-600 font-medium">Verifying Administrative Safeguards...</p>
        </div>
      </div>
    );
  }

  // Render Login/Setup Pages
  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto py-12 px-4">
        <Link to="/" className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-navy mb-8">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Home
        </Link>

        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-6">
            <ShieldCheck className="w-6 h-6 text-red-600" />
          </div>

          {currentScreen === 'setup' ? (
            <>
              <h1 className="text-2xl font-bold text-navy mb-2">Set Up Admin Account</h1>
              <p className="text-gray-700 text-sm mb-6">
                No administrator exists yet. Create the single, secure credentials below.
              </p>

              <form onSubmit={handleSetupSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Secure Admin Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                    <Input 
                      required
                      type="email"
                      placeholder="admin@trackpack.com"
                      value={setupEmail}
                      onChange={e => setSetupEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Strong Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                    <Input 
                      required
                      type={showSetupPassword ? 'text' : 'password'}
                      placeholder="Min 10 characters"
                      value={setupPassword}
                      onChange={e => setSetupPassword(e.target.value)}
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSetupPassword(!showSetupPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-navy transition"
                      aria-label={showSetupPassword ? "Hide password" : "Show password"}
                    >
                      {showSetupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Requirements: At least 10 characters long, containing uppercase, lowercase, and numbers.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                    <Input 
                      required
                      type={showSetupConfirmPassword ? 'text' : 'password'}
                      placeholder="Repeat password"
                      value={setupConfirmPassword}
                      onChange={e => setSetupConfirmPassword(e.target.value)}
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSetupConfirmPassword(!showSetupConfirmPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-navy transition"
                      aria-label={showSetupConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showSetupConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs leading-relaxed font-medium">{error}</div>}
                
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? 'Creating Account...' : 'Initialize Administrator'}
                </Button>
              </form>
            </>
          ) : currentScreen === 'login' ? (
            <>
              <h1 className="text-2xl font-bold text-navy mb-2">Platform Administration</h1>
              <p className="text-gray-700 text-sm mb-6">Access control for authorized personnel only.</p>

              {success && <div className="p-3 mb-4 bg-green-50 border border-green-200 text-green-800 rounded-lg text-xs font-semibold">{success}</div>}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Administrator Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                    <Input 
                      required
                      type="email"
                      placeholder="admin@trackpack.com"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                    <Input 
                      required
                      type={showLoginPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-navy transition"
                      aria-label={showLoginPassword ? "Hide password" : "Show password"}
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium">{error}</div>}

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? 'Authenticating...' : 'Sign In to Console'}
                </Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-navy mb-2">Two-Factor Verification</h1>
              <p className="text-gray-700 text-sm mb-6">
                A verification security email with a 6-digit code has been sent directly to <strong>{loginEmail}</strong>.
              </p>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl mb-6 flex items-start gap-3">
                <Mail className="w-5 h-5 text-navy shrink-0 mt-0.5" />
                <div className="text-xs text-gray-700 leading-relaxed">
                  <span className="font-semibold text-navy block mb-0.5">Check Your Email Inbox</span>
                  The verification code was dispatched via backend mailer to <strong className="text-navy">{loginEmail}</strong>. Check your inbox or spam folder and enter the 6-digit code below.
                </div>
              </div>

              <form onSubmit={handle2FASubmit} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">6-Digit Verification Code</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowCode(!showCode)}
                        className="text-xs font-semibold text-navy hover:underline flex items-center gap-1"
                      >
                        {showCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {showCode ? 'Hide' : 'Show'}
                      </button>
                      <button 
                        type="button"
                        className="text-xs font-semibold text-navy hover:underline disabled:opacity-50"
                        disabled={loading}
                        onClick={async () => {
                          setError('');
                          setSuccess('');
                          try {
                            const res = await initiatePlatformAdminLogin(loginEmail, loginPassword);
                            if (res.success) {
                              setSuccess('A new 6-digit verification code was sent to your email.');
                            } else {
                              setError(res.error || 'Failed to resend code.');
                            }
                          } catch (err: any) {
                            setError('Failed to resend code.');
                          }
                        }}
                      >
                        Resend Code
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <Input 
                      required
                      type={showCode ? "text" : "password"}
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                      value={verificationCode}
                      onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      className="text-center font-mono text-2xl tracking-widest font-bold pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCode(!showCode)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-navy transition"
                      aria-label={showCode ? "Hide code" : "Show code"}
                    >
                      {showCode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium">{error}</div>}
                {success && <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-xs font-medium">{success}</div>}

                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="secondary" 
                    className="w-1/3"
                    onClick={() => {
                      setCurrentScreen('login');
                      setVerificationCode('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="w-2/3" size="lg" disabled={loading || verificationCode.length !== 6}>
                    {loading ? 'Verifying...' : 'Verify & Access'}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  // Render Logged-in Platform Admin Command Center
  return (
    <div className="space-y-8 max-w-7xl mx-auto py-6 px-4">
      {/* Top Header */}
      <div className="bg-navy text-white p-6 sm:p-8 rounded-3xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">TrackPack Central Executive Command</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">System Control & Financial Center</h1>
          <p className="text-gray-300 text-sm mt-1">Super Administrator: {localStorage.getItem('platform_admin_email')}</p>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <Button 
            variant="ghost" 
            onClick={loadDashboardData} 
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingData ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button 
            variant="ghost" 
            onClick={handleLocalLogout} 
            className="bg-transparent border border-white/20 text-white hover:bg-white hover:text-navy text-xs font-semibold"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" /> Logout
          </Button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex overflow-x-auto bg-gray-100 p-1.5 rounded-2xl gap-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 shrink-0 ${activeTab === 'overview' ? 'bg-white shadow-sm text-navy font-bold' : 'text-gray-600 hover:text-navy'}`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          Overview & Metrics
        </button>
        <button
          onClick={() => setActiveTab('waybills')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 shrink-0 ${activeTab === 'waybills' ? 'bg-white shadow-sm text-navy font-bold' : 'text-gray-600 hover:text-navy'}`}
        >
          <Truck className="w-4 h-4 text-blue-600" />
          Live Waybills ({totalWaybillsCount})
        </button>
        <button
          onClick={() => setActiveTab('finances')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 shrink-0 ${activeTab === 'finances' ? 'bg-white shadow-sm text-navy font-bold' : 'text-gray-600 hover:text-navy'}`}
        >
          <DollarSign className="w-4 h-4 text-emerald-600" />
          Financial Ledger
        </button>
        <button
          onClick={() => setActiveTab('companies')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 shrink-0 ${activeTab === 'companies' ? 'bg-white shadow-sm text-navy font-bold' : 'text-gray-600 hover:text-navy'}`}
        >
          <Building className="w-4 h-4 text-orange-600" />
          Companies ({companies.length})
          {pendingCompanies.length > 0 && (
            <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
              {pendingCompanies.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 shrink-0 ${activeTab === 'staff' ? 'bg-white shadow-sm text-navy font-bold' : 'text-gray-600 hover:text-navy'}`}
        >
          <Users className="w-4 h-4 text-purple-600" />
          Staff & Drivers ({staffMembers.length})
        </button>
        <button
          onClick={() => setActiveTab('leads')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 shrink-0 ${activeTab === 'leads' ? 'bg-white shadow-sm text-navy font-bold' : 'text-gray-600 hover:text-navy'}`}
        >
          <FileText className="w-4 h-4 text-gray-600" />
          Leads ({leads.length})
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 shrink-0 ${activeTab === 'security' ? 'bg-white shadow-sm text-navy font-bold' : 'text-gray-600 hover:text-navy'}`}
        >
          <Settings className="w-4 h-4 text-red-600" />
          Security Controls
        </button>
      </div>

      {/* Main Content Panels */}
      {loadingData ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <RefreshCw className="w-8 h-8 text-navy animate-spin mx-auto" />
          <p className="text-navy font-bold text-base">Synchronizing TrackPack Cloud Data...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* TAB 1: OVERVIEW & METRICS */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Paystack Live API Configuration Card */}
              <div className="bg-gradient-to-r from-slate-900 to-navy text-white p-6 rounded-3xl border border-slate-700 shadow-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-400/30">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-white">Paystack Live Payment Gateway</h3>
                        {paystackStatus?.isLive ? (
                          <span className="bg-emerald-500/20 text-emerald-300 text-xs font-black px-2.5 py-1 rounded-full border border-emerald-400/40 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            LIVE PAYSTACK ACTIVE
                          </span>
                        ) : paystackStatus?.isTest ? (
                          <span className="bg-amber-500/20 text-amber-300 text-xs font-black px-2.5 py-1 rounded-full border border-amber-400/40">
                            TEST MODE ENABLED
                          </span>
                        ) : (
                          <span className="bg-red-500/20 text-red-300 text-xs font-black px-2.5 py-1 rounded-full border border-red-400/40">
                            KEYS NOT CONFIGURED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-300 mt-1">
                        {paystackStatus?.isConfigured 
                          ? `Active Secret Key: ${paystackStatus.secretKeyMasked}`
                          : 'Configure your Live Paystack Public & Secret API keys below to accept real payments.'}
                      </p>
                    </div>
                  </div>

                  <Button 
                    variant="secondary"
                    onClick={() => setShowPaystackKeyForm(!showPaystackKeyForm)}
                    className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold shrink-0 text-xs"
                  >
                    {showPaystackKeyForm ? 'Hide Key Form' : '🔑 Enter / Update Live Keys'}
                  </Button>
                </div>

                {/* Form Dropdown */}
                {showPaystackKeyForm && (
                  <form onSubmit={handleSavePaystackKeys} className="mt-5 pt-5 border-t border-slate-700/80 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-extrabold text-gray-300 mb-1">
                          Live Public Key <span className="text-blue-400 font-mono">(pk_live_...)</span>
                        </label>
                        <Input 
                          placeholder="pk_live_xxxxxxxxxxxxxxxxxxxxxxxx"
                          value={paystackPublicKeyInput}
                          onChange={(e) => setPaystackPublicKeyInput(e.target.value)}
                          className="bg-slate-800 text-white border-slate-600 text-xs font-mono placeholder:text-gray-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-extrabold text-gray-300 mb-1">
                          Live Secret Key <span className="text-blue-400 font-mono">(sk_live_...)</span>
                        </label>
                        <Input 
                          type="password"
                          placeholder="sk_live_xxxxxxxxxxxxxxxxxxxxxxxx"
                          value={paystackSecretKeyInput}
                          onChange={(e) => setPaystackSecretKeyInput(e.target.value)}
                          className="bg-slate-800 text-white border-slate-600 text-xs font-mono placeholder:text-gray-500"
                          required
                        />
                      </div>
                    </div>

                    {paystackKeyMsg && (
                      <div className={`p-3 rounded-xl text-xs font-bold ${paystackKeyMsg.type === 'success' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'}`}>
                        {paystackKeyMsg.text}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-1">
                      <p className="text-[11px] text-gray-400">
                        💡 Your keys are saved directly to your TrackPack instance and take effect immediately.
                      </p>
                      <Button 
                        type="submit" 
                        disabled={savingPaystackKeys || !paystackSecretKeyInput}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shrink-0"
                      >
                        {savingPaystackKeys ? 'Saving Keys...' : 'Save & Activate Keys'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>

              {/* Executive Business Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Gross Delivery GMV</p>
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0 text-emerald-600">
                      <DollarSign className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-navy">₦{grossGMV.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">Total delivery freight processed</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Platform Fee Revenue</p>
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 text-blue-600">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600">₦{Math.round(netPlatformCommission).toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">TrackPack platform commission</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Total Waybills</p>
                    <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center shrink-0 text-orange-600">
                      <Truck className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-navy">{totalWaybillsCount}</p>
                  <p className="text-xs text-emerald-600 mt-2 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {collectedWaybills.length} Delivered & Collected
                  </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Transport Operators</p>
                    <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center shrink-0 text-purple-600">
                      <Building className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-navy">{approvedCompanies.length}</p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">
                    {pendingCompanies.length > 0 ? (
                      <span className="text-orange-600 font-bold">{pendingCompanies.length} awaiting verification</span>
                    ) : (
                      'All park offices verified'
                    )}
                  </p>
                </div>
              </div>

              {/* Waybill Status Lifecycle Pipeline */}
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-navy flex items-center gap-2">
                  <Truck className="w-5 h-5 text-navy" /> Real-time Waybill Pipeline Breakdown
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-100 text-center">
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Booked At Park</p>
                    <p className="text-2xl font-extrabold text-amber-900 mt-1">{bookedWaybills.length}</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">Awaiting Bus Dispatch</p>
                  </div>
                  <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 text-center">
                    <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">In-Transit (Departed)</p>
                    <p className="text-2xl font-extrabold text-blue-900 mt-1">{departedWaybills.length}</p>
                    <p className="text-[11px] text-blue-700 mt-0.5">On The Highway</p>
                  </div>
                  <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 text-center">
                    <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Arrived Destination</p>
                    <p className="text-2xl font-extrabold text-emerald-900 mt-1">{arrivedWaybills.length}</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">Ready for Receiver Pickup</p>
                  </div>
                  <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-100 text-center">
                    <p className="text-xs font-bold text-purple-800 uppercase tracking-wider">Collected / Completed</p>
                    <p className="text-2xl font-extrabold text-purple-900 mt-1">{collectedWaybills.length}</p>
                    <p className="text-[11px] text-purple-700 mt-0.5">Receiver Verified & Handed Over</p>
                  </div>
                </div>
              </div>

              {/* Quick Actions & Recent Waybills Feed */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Waybills Table */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col justify-between">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                      <h3 className="text-base font-bold text-navy">Recent Parcels Logged</h3>
                      <p className="text-xs text-gray-500">Live feed across all transport park networks</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('waybills')} className="text-xs text-navy font-bold">
                      View All ({waybills.length}) →
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-[11px] uppercase font-bold tracking-wider">
                          <th className="p-4 pl-6">Code</th>
                          <th className="p-4">Route</th>
                          <th className="p-4">Sender</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 pr-6">Fee</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {waybills.slice(0, 6).map(w => (
                          <tr key={w.id} className="hover:bg-gray-50/60 transition">
                            <td className="p-4 pl-6 font-mono font-bold text-navy text-xs">{w.trackingCode}</td>
                            <td className="p-4 text-xs font-medium text-gray-800">
                              {w.originPark} → {w.destinationPark}
                            </td>
                            <td className="p-4 text-xs text-gray-600">{w.senderName}</td>
                            <td className="p-4">
                              <Badge status={w.status}>{w.status}</Badge>
                            </td>
                            <td className="p-4 pr-6 font-bold text-xs text-navy">₦{(w.deliveryFee || w.paymentVirtualAccount?.amount || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                        {waybills.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-gray-500 text-xs">No waybills logged in the system yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Quick Audit & Health Card */}
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-navy mb-1 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" /> Platform Security & Audit
                    </h3>
                    <p className="text-xs text-gray-600 leading-relaxed mb-4">
                      All waybill transactions, SMS verification OTPs, and staff PIN activities are continuously authenticated against Firestore.
                    </p>

                    <div className="space-y-3">
                      <div className="p-3 bg-gray-50 rounded-2xl flex items-center justify-between text-xs font-medium">
                        <span className="text-gray-600">Pending Registrations</span>
                        <span className="font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">{pendingCompanies.length}</span>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-2xl flex items-center justify-between text-xs font-medium">
                        <span className="text-gray-600">Active Staff & Cashiers</span>
                        <span className="font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">{staffMembers.filter(s => s.isActive !== false).length}</span>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-2xl flex items-center justify-between text-xs font-medium">
                        <span className="text-gray-600">Online Payments GMV</span>
                        <span className="font-bold text-emerald-600">₦{onlinePaymentsGMV.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <Button onClick={exportFinancialAuditCSV} className="w-full bg-navy hover:bg-navy/90 font-bold text-xs">
                    <Download className="w-4 h-4 mr-2" /> Export Audit CSV Report
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE WAYBILLS OVERSIGHT */}
          {activeTab === 'waybills' && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden space-y-4 p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-navy">Global Waybills Inspection</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Search and oversee all parcels moving across national terminals.</p>
                </div>
                <Button onClick={exportFinancialAuditCSV} variant="secondary" size="sm" className="font-bold text-xs">
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Export List CSV
                </Button>
              </div>

              {/* Filters & Search */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Input 
                    placeholder="Search tracking #, phone, bus, item..."
                    value={waybillSearch}
                    onChange={e => setWaybillSearch(e.target.value)}
                    className="pl-9 text-xs"
                  />
                </div>

                <div>
                  <select
                    value={waybillStatusFilter}
                    onChange={e => setWaybillStatusFilter(e.target.value as any)}
                    className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-navy"
                  >
                    <option value="all">All Delivery Statuses</option>
                    <option value="Booked">Booked</option>
                    <option value="Departed">Departed</option>
                    <option value="Arrived">Arrived</option>
                    <option value="Collected">Collected</option>
                  </select>
                </div>

                <div>
                  <select
                    value={waybillParkFilter}
                    onChange={e => setWaybillParkFilter(e.target.value)}
                    className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-navy"
                  >
                    <option value="all">All Terminals / Parks</option>
                    {allParksList.map(park => (
                      <option key={park} value={park}>{park}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 font-bold uppercase tracking-wider text-gray-500">
                      <th className="p-3.5 pl-4">Tracking Code</th>
                      <th className="p-3.5">Route</th>
                      <th className="p-3.5">Item & Bus #</th>
                      <th className="p-3.5">Sender</th>
                      <th className="p-3.5">Receiver</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Fee</th>
                      <th className="p-3.5 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredWaybills.map(w => (
                      <tr key={w.id} className="hover:bg-gray-50/80 transition">
                        <td className="p-3.5 pl-4 font-mono font-bold text-navy">{w.trackingCode}</td>
                        <td className="p-3.5 font-medium text-gray-800">
                          {w.originPark} <span className="text-gray-400">→</span> {w.destinationPark}
                        </td>
                        <td className="p-3.5">
                          <p className="font-semibold text-gray-800">{w.itemDescription}</p>
                          <p className="text-[11px] text-gray-400">Bus: {w.busNumber || 'Unassigned'}</p>
                        </td>
                        <td className="p-3.5">
                          <p className="font-medium text-gray-800">{w.senderName}</p>
                          <p className="text-[11px] font-mono text-gray-500">{w.senderPhone}</p>
                        </td>
                        <td className="p-3.5">
                          <p className="font-medium text-gray-800">{w.receiverName}</p>
                          <p className="text-[11px] font-mono text-gray-500">{w.receiverPhone}</p>
                        </td>
                        <td className="p-3.5">
                          <Badge status={w.status}>{w.status}</Badge>
                        </td>
                        <td className="p-3.5 font-bold text-navy">₦{(w.deliveryFee || w.paymentVirtualAccount?.amount || 0).toLocaleString()}</td>
                        <td className="p-3.5 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                setSelectedWaybillForOverride(w);
                                setNewStatusValue(w.status);
                              }}
                              className="text-[11px] font-bold text-navy hover:bg-navy/10 px-2 py-1 h-auto"
                            >
                              <Sliders className="w-3 h-3 mr-1" /> Override Status
                            </Button>
                             {deletingWaybillId === w.id ? (
                               <div className="inline-flex items-center gap-1 bg-red-100 p-1 rounded-lg border border-red-200">
                                 <span className="text-[10px] font-bold text-red-900 pl-1">Delete?</span>
                                 <button
                                   type="button"
                                   onClick={async () => {
                                     try {
                                       if (!w.id) {
                                         alert("Error: Waybill ID is missing.");
                                         return;
                                       }
                                       await deleteWaybill(w.id);
                                       setDeletingWaybillId(null);
                                     } catch (err) {
                                       console.error("Failed to delete waybill:", err);
                                       alert("Failed to delete waybill. Please try again.");
                                     }
                                   }}
                                   className="text-[10px] bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-0.5 rounded transition"
                                 >
                                   Yes
                                 </button>
                                 <button
                                   type="button"
                                   onClick={() => setDeletingWaybillId(null)}
                                   className="text-[10px] bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-2 py-0.5 rounded transition"
                                 >
                                   No
                                 </button>
                               </div>
                             ) : (
                               <Button 
                                 variant="ghost" 
                                 size="sm" 
                                 onClick={() => setDeletingWaybillId(w.id!)}
                                 className="text-[11px] font-bold text-red-600 hover:bg-red-50 px-2 py-1 h-auto"
                               >
                                 Delete
                               </Button>
                             )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredWaybills.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-gray-500">No waybills matching search criteria.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: FINANCIAL LEDGER & REVENUE CONTROL */}
          {activeTab === 'finances' && (
            <div className="space-y-6">
              {/* Financial Metrics Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-navy to-slate-900 text-white p-6 rounded-3xl shadow-sm">
                  <p className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-1">Total Network Gross GMV</p>
                  <p className="text-3xl font-extrabold text-white">₦{grossGMV.toLocaleString()}</p>
                  <p className="text-xs text-gray-300 mt-2">Combined freight value across all transport companies</p>
                </div>

                <div className="bg-emerald-600 text-white p-6 rounded-3xl shadow-sm">
                  <p className="text-xs font-bold text-emerald-100 uppercase tracking-widest mb-1">TrackPack Platform Revenue</p>
                  <p className="text-3xl font-extrabold text-white">₦{Math.round(netPlatformCommission).toLocaleString()}</p>
                  <p className="text-xs text-emerald-100 mt-2">Earned from platform commission percentages</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Net Operator Owed Payout</p>
                  <p className="text-3xl font-extrabold text-navy">₦{Math.round(grossGMV - netPlatformCommission).toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-2">Remitted to transport company bank accounts</p>
                </div>
              </div>

              {/* Finances Controls and Breakdown Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left side: Payment Channel Breakdown */}
                <div className="lg:col-span-2 space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Payment Channel Volume</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-500">Paystack / Online Transfer GMV</p>
                          <p className="text-xl font-bold text-navy font-mono">₦{onlinePaymentsGMV.toLocaleString()}</p>
                        </div>
                      </div>
                      <Badge status="Arrived">Verified Online</Badge>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-gray-200 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                          <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-500">Cash At Origin Terminal GMV</p>
                          <p className="text-xl font-bold text-navy font-mono">₦{cashPaymentsGMV.toLocaleString()}</p>
                        </div>
                      </div>
                      <Badge status="Booked">Park Cashier</Badge>
                    </div>
                  </div>
                </div>

                {/* Right side: Global Price Settings */}
                <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm flex flex-col justify-between">
                  <form onSubmit={handleUpdateBookingFee} className="space-y-4 h-full flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Sliders className="w-4 h-4 text-navy" />
                        <h4 className="text-xs font-bold text-navy uppercase tracking-wider">Track Price Control</h4>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">
                        Configure the global Booking Fee price paid by customers to generate a live Tracking ID.
                      </p>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-700">Waybill Activation Fee (₦)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-400 text-sm font-bold">₦</span>
                          <Input
                            type="number"
                            min={0}
                            required
                            className="pl-7 font-bold font-mono text-navy text-sm h-9"
                            value={bookingFeeSetting}
                            onChange={(e) => setBookingFeeSetting(Math.max(0, parseInt(e.target.value) || 0))}
                            disabled={updatingFee}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      {feeSuccess && (
                        <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-xl text-center">
                          {feeSuccess}
                        </p>
                      )}
                      <Button
                        type="submit"
                        className="w-full bg-navy hover:bg-navy/90 text-white font-bold text-xs py-2 h-9"
                        disabled={updatingFee}
                      >
                        {updatingFee ? 'Saving...' : 'Save Track Price'}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Operator Commission Settlement Ledger */}
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-navy">Transport Operators Settlement Ledger</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Configure platform commission rate % and manage payouts per company.</p>
                  </div>
                  <Button onClick={exportFinancialAuditCSV} className="bg-navy hover:bg-navy/90 text-xs font-bold">
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Download Full Ledger
                  </Button>
                </div>

                <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 font-bold uppercase tracking-wider text-gray-500">
                        <th className="p-3.5 pl-4">Company Name</th>
                        <th className="p-3.5">Owner Contact</th>
                        <th className="p-3.5">Bank Details</th>
                        <th className="p-3.5">Commission Rate</th>
                        <th className="p-3.5">Total GMV</th>
                        <th className="p-3.5">Platform Fee</th>
                        <th className="p-3.5 pr-4 text-right">Net Owed Operator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {approvedCompanies.map(comp => {
                        const compWaybills = waybills.filter(w => w.companyName === comp.name || w.companyId === comp.id);
                        const compGMV = compWaybills.reduce((sum, w) => sum + (w.deliveryFee || 3500), 0);
                        const rate = comp.commissionRate ?? 70;
                        const compPlatformFee = compGMV * (rate / 100);
                        const netOwed = compGMV - compPlatformFee;

                        return (
                          <tr key={comp.id} className="hover:bg-gray-50/80 transition">
                            <td className="p-3.5 pl-4 font-bold text-navy">{comp.name}</td>
                            <td className="p-3.5 font-mono text-gray-700">{comp.ownerPhone}</td>
                            <td className="p-3.5 text-gray-600 font-mono text-[11px]">
                              <div>{comp.bankAccount || 'Not Provided'}</div>
                              {comp.paystackSubaccountCode ? (
                                <span className="inline-block mt-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                                  Paystack Split: {comp.paystackSubaccountCode}
                                </span>
                              ) : (
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  <span className="inline-block text-[10px] bg-amber-50 text-amber-800 font-medium px-1.5 py-0.5 rounded border border-amber-100">
                                    Direct Settlement
                                  </span>
                                  <button
                                    onClick={() => handleCreatePaystackSubaccount(comp.id!)}
                                    disabled={subaccountLoadingId === comp.id}
                                    className="text-[9px] bg-navy text-white hover:bg-navy/80 px-1.5 py-0.5 rounded font-bold transition disabled:opacity-50"
                                    title="Create a Paystack Subaccount for automated split payments"
                                  >
                                    {subaccountLoadingId === comp.id ? 'Creating...' : 'Link Paystack'}
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="p-3.5">
                              {editingCommissionId === comp.id ? (
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="number" 
                                    step="0.1" 
                                    value={commissionRateInput} 
                                    onChange={e => setCommissionRateInput(parseFloat(e.target.value) || 0)}
                                    className="w-16 px-2 py-1 border border-navy rounded text-xs font-bold"
                                  />
                                  <span className="text-xs font-bold">%</span>
                                  <Button size="sm" onClick={() => handleSaveCommissionRate(comp.id!)} className="px-2 py-0.5 text-[10px] font-bold">
                                    Save
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                    {rate}%
                                  </span>
                                  <button 
                                    onClick={() => {
                                      setEditingCommissionId(comp.id!);
                                      setCommissionRateInput(rate);
                                    }}
                                    className="text-[10px] text-navy underline font-bold hover:text-emerald-600"
                                  >
                                    Edit
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="p-3.5 font-bold text-navy">₦{compGMV.toLocaleString()}</td>
                            <td className="p-3.5 font-bold text-emerald-600">₦{Math.round(compPlatformFee).toLocaleString()}</td>
                            <td className="p-3.5 pr-4 text-right font-extrabold text-navy">₦{Math.round(netOwed).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                      {approvedCompanies.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-gray-500">No approved companies registered yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VERIFICATION & COMPANIES */}
          {activeTab === 'companies' && (
            <div className="space-y-6">
              {/* Pending Approvals Section */}
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-orange-50/50">
                  <h2 className="text-lg font-bold text-navy flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
                    Pending Company Verifications
                  </h2>
                  <p className="text-gray-700 text-sm mt-0.5">These operators require administrative review before logging in.</p>
                </div>

                <div className="divide-y divide-gray-100">
                  {pendingCompanies.map(comp => (
                    <div key={comp.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-gray-50/50">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg text-navy">{comp.name}</h3>
                          <Badge status="Booked">Pending Audit</Badge>
                        </div>
                        <p className="text-sm text-gray-700">Owner Contact: <span className="font-semibold font-mono">{comp.ownerPhone}</span></p>
                        {comp.parks && comp.parks.length > 0 && (
                          <p className="text-xs text-gray-500">Proposed Terminals: {comp.parks.join(', ')}</p>
                        )}
                        {comp.kycNumber && (
                          <p className="text-xs text-gray-500">KYC/CAC Registration #: <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded font-bold">{comp.kycNumber}</span></p>
                        )}
                        {comp.bankAccount && (
                          <p className="text-xs text-gray-500">Settlement Bank Account: <span className="font-mono text-navy font-semibold">{comp.bankAccount}</span></p>
                        )}

                        {/* Document inspection thumbnails */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {comp.cacDocumentUrl ? (
                            <button
                              type="button"
                              onClick={() => setSelectedDocumentView({
                                title: 'CAC Incorporation Certificate Photo',
                                image: comp.cacDocumentUrl!,
                                companyName: comp.name
                              })}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-semibold transition"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600" /> Inspect CAC Photo
                            </button>
                          ) : (
                            <span className="text-[11px] text-gray-400 italic">No CAC picture attached</span>
                          )}

                          {comp.kycDocumentUrl ? (
                            <button
                              type="button"
                              onClick={() => setSelectedDocumentView({
                                title: 'Director Identity Photo / KYC ID',
                                image: comp.kycDocumentUrl!,
                                companyName: comp.name
                              })}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-semibold transition"
                            >
                              <Eye className="w-3.5 h-3.5 text-emerald-600" /> Inspect Director ID Photo
                            </button>
                          ) : (
                            <span className="text-[11px] text-gray-400 italic">No Director ID picture attached</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button 
                          onClick={() => handleApproveCompany(comp.id!)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                        >
                          Verify & Approve Park Office
                        </Button>
                        {deletingCompanyId === comp.id ? (
                          <div className="inline-flex items-center gap-1.5 bg-red-100 p-1 rounded-xl border border-red-200">
                            <span className="text-xs font-bold text-red-900 pl-1">Decline?</span>
                            <button
                              type="button"
                              onClick={() => handleDeclineCompany(comp.id!)}
                              className="text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded-lg transition"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingCompanyId(null)}
                              className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-2.5 py-1 rounded-lg transition"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <Button 
                            variant="danger"
                            onClick={() => setDeletingCompanyId(comp.id!)}
                            className="font-semibold text-xs"
                          >
                            Decline
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {pendingCompanies.length === 0 && (
                    <div className="p-8 text-center text-gray-500 text-sm">No pending registrations awaiting approval.</div>
                  )}
                </div>
              </div>

              {/* Approved Companies Section */}
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-navy">Verified Transport Networks</h2>
                  <p className="text-gray-700 text-sm mt-0.5">Active transport operators logged on the platform.</p>
                </div>

                <div className="divide-y divide-gray-100">
                  {approvedCompanies.map(comp => (
                    <div key={comp.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-gray-50/50">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-navy text-base">{comp.name}</h3>
                          {comp.status === 'suspended' ? (
                            <Badge status="Failed">Suspended</Badge>
                          ) : (
                            <Badge status="Arrived">Verified Active</Badge>
                          )}
                          <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                            Commission: {comp.commissionRate ?? 70}%
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">Owner Contact: <span className="font-semibold font-mono">{comp.ownerPhone}</span></p>
                        {comp.parks && comp.parks.length > 0 && (
                          <p className="text-xs text-gray-500">Active Terminals: {comp.parks.join(', ')}</p>
                        )}
                        {comp.bankAccount && (
                          <p className="text-xs text-gray-500">Bank Account: <span className="font-mono text-gray-700">{comp.bankAccount}</span></p>
                        )}

                        {/* Document inspection thumbnails for approved company */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {comp.cacDocumentUrl && (
                            <button
                              type="button"
                              onClick={() => setSelectedDocumentView({
                                title: 'CAC Incorporation Certificate Photo',
                                image: comp.cacDocumentUrl!,
                                companyName: comp.name
                              })}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-semibold transition"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600" /> View CAC Certificate
                            </button>
                          )}

                          {comp.kycDocumentUrl && (
                            <button
                              type="button"
                              onClick={() => setSelectedDocumentView({
                                title: 'Director Identity Photo / KYC ID',
                                image: comp.kycDocumentUrl!,
                                companyName: comp.name
                              })}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-semibold transition"
                            >
                              <Eye className="w-3.5 h-3.5 text-emerald-600" /> View Director ID
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button 
                          variant="secondary"
                          onClick={() => handleToggleCompanyStatus(comp.id!, comp.status)}
                          size="sm"
                          className={`font-semibold text-xs ${comp.status === 'suspended' ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100' : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'}`}
                        >
                          {comp.status === 'suspended' ? 'Reactivate Operator' : 'Suspend Operator'}
                        </Button>
                        {deletingCompanyId === comp.id ? (
                          <div className="inline-flex items-center gap-1.5 bg-red-100 p-1 rounded-xl border border-red-200">
                            <span className="text-xs font-bold text-red-900 pl-1">Remove Operator?</span>
                            <button
                              type="button"
                              onClick={() => handleDeclineCompany(comp.id!)}
                              className="text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded-lg transition"
                            >
                              Yes, Remove
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingCompanyId(null)}
                              className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-2.5 py-1 rounded-lg transition"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <Button 
                            variant="danger"
                            onClick={() => setDeletingCompanyId(comp.id!)}
                            size="sm"
                            className="font-semibold text-xs opacity-80 hover:opacity-100"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {approvedCompanies.length === 0 && (
                    <div className="p-8 text-center text-gray-500 text-sm">No approved companies registered yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: STAFF & DRIVERS DIRECTORY */}
          {activeTab === 'staff' && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden p-6 space-y-4">
              <div className="border-b border-gray-100 pb-4">
                <h2 className="text-xl font-extrabold text-navy">Staff & Driver Verification Directory</h2>
                <p className="text-xs text-gray-500 mt-0.5">Inspect and manage park managers, cashiers, and bus drivers across all partner companies.</p>
              </div>

              <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 font-bold uppercase tracking-wider text-gray-500">
                      <th className="p-3.5 pl-4">Staff Name</th>
                      <th className="p-3.5">Assigned Park / Terminal</th>
                      <th className="p-3.5">Role</th>
                      <th className="p-3.5">Access PIN</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 pr-4 text-right">Access Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {staffMembers.map(stf => {
                      const isActive = stf.isActive !== false;
                      return (
                        <tr key={stf.id} className="hover:bg-gray-50/80 transition">
                          <td className="p-3.5 pl-4 font-bold text-navy">{stf.name}</td>
                          <td className="p-3.5 text-gray-800 font-medium">{stf.park}</td>
                          <td className="p-3.5 capitalize font-semibold text-gray-700">
                            {stf.role === 'sender' ? 'Dispatch Cashier' : 'Arrival Receiving Clerk'}
                          </td>
                          <td className="p-3.5 font-mono text-gray-500">••••</td>
                          <td className="p-3.5">
                            {isActive ? (
                              <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[11px]">Active</span>
                            ) : (
                              <span className="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full text-[11px]">Suspended</span>
                            )}
                          </td>
                          <td className="p-3.5 pr-4 text-right">
                            <Button
                              variant={isActive ? 'danger' : 'secondary'}
                              size="sm"
                              onClick={() => handleToggleStaffStatus(stf.id!, stf.isActive)}
                              className="text-[11px] font-bold px-2 py-1 h-auto"
                            >
                              {isActive ? 'Suspend Access' : 'Reactivate'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {staffMembers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-500">No staff members registered in the system yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: PARTNER LEADS */}
          {activeTab === 'leads' && (
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-navy">Callback Requests</h2>
                <p className="text-gray-700 text-sm mt-0.5">Prospects who completed the interest form on the partners page.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-700">
                      <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Date</th>
                      <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Name</th>
                      <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Phone</th>
                      <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Company</th>
                      <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leads.map(lead => (
                      <tr key={lead.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4 text-gray-700 whitespace-nowrap">
                          {new Date(lead.timestamp).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 font-bold text-navy">{lead.name}</td>
                        <td className="px-6 py-4 font-mono font-medium text-gray-700">{lead.phone}</td>
                        <td className="px-6 py-4 text-navy font-semibold">{lead.companyName}</td>
                        <td className="px-6 py-4 text-gray-700">{lead.parkLocation}</td>
                      </tr>
                    ))}
                    {leads.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-gray-700">No partner callback requests received yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: SECURITY SETUP */}
          {activeTab === 'security' && (
            <div className="max-w-2xl bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-navy">Administrative Safeguards</h2>
                <p className="text-gray-700 text-sm mt-0.5">Control session persistence and revoke devices immediately.</p>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-red-50 border border-red-200 p-5 rounded-2xl flex items-start gap-4">
                  <AlertTriangle className="w-8 h-8 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="font-bold text-red-800 text-base">Immediate Global Session Revocation</h3>
                    <p className="text-sm text-red-700 leading-relaxed">
                      If you suspect your credentials have been exposed or you have lost a physical device, 
                      you can click below. This will invalidate all active login sessions globally, immediately 
                      requiring anyone (including your current window) to log back in using the administrative email, password, and a fresh 2FA code.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-navy">Revocation Action Center</p>
                    <p className="text-xs text-gray-700">This operation generates a new cryptographic session salt in Firestore.</p>
                  </div>
                  {showRevokeConfirm ? (
                    <div className="flex items-center gap-2 bg-red-100 border border-red-200 p-2 rounded-2xl shrink-0">
                      <span className="text-xs font-bold text-red-900 px-1">Revoke all sessions?</span>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={handleRevokeAllSessions}
                        className="font-bold text-xs"
                        disabled={loading}
                      >
                        {loading ? 'Invalidating...' : 'Yes, Log Out All'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowRevokeConfirm(false)}
                        className="font-bold text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      variant="danger" 
                      size="lg"
                      onClick={() => setShowRevokeConfirm(true)}
                      className="font-bold px-6 shrink-0"
                      disabled={loading}
                    >
                      Log Out of All Devices
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Override Status Modal */}
      {selectedWaybillForOverride && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-extrabold text-navy">Override Waybill Status</h3>
                <p className="text-xs text-gray-500">Tracking Code: <span className="font-mono font-bold text-navy">{selectedWaybillForOverride.trackingCode}</span></p>
              </div>
              <button onClick={() => setSelectedWaybillForOverride(null)} className="text-gray-400 hover:text-navy">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 p-3 rounded-2xl space-y-1 text-xs">
              <p><span className="text-gray-500">Route:</span> <strong className="text-navy">{selectedWaybillForOverride.originPark} → {selectedWaybillForOverride.destinationPark}</strong></p>
              <p><span className="text-gray-500">Item:</span> <strong className="text-navy">{selectedWaybillForOverride.itemDescription}</strong></p>
              <p><span className="text-gray-500">Sender:</span> <strong>{selectedWaybillForOverride.senderName} ({selectedWaybillForOverride.senderPhone})</strong></p>
              <p><span className="text-gray-500">Current Status:</span> <Badge status={selectedWaybillForOverride.status}>{selectedWaybillForOverride.status}</Badge></p>
            </div>

            <div>
              <label className="block text-xs font-bold text-navy mb-1">Select Administrative Override Status</label>
              <select
                value={newStatusValue}
                onChange={e => setNewStatusValue(e.target.value as WaybillStatus)}
                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-navy"
              >
                <option value="Booked">Booked (At Origin Terminal)</option>
                <option value="Departed">Departed (In-Transit On Bus)</option>
                <option value="Arrived">Arrived (Destination Terminal)</option>
                <option value="Collected">Collected (Handed To Receiver)</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="secondary" onClick={() => setSelectedWaybillForOverride(null)} className="w-1/3 text-xs">
                Cancel
              </Button>
              <Button onClick={handleExecuteStatusOverride} disabled={updatingStatus} className="w-2/3 bg-navy text-xs font-bold">
                {updatingStatus ? 'Updating Status...' : 'Apply Status Override'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Document Inspection Lightbox Modal */}
      {selectedDocumentView && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div>
                <span className="text-xs font-bold text-amber bg-amber-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  {selectedDocumentView.companyName}
                </span>
                <h3 className="text-xl font-extrabold text-navy mt-1">{selectedDocumentView.title}</h3>
              </div>
              <button 
                onClick={() => setSelectedDocumentView(null)} 
                className="text-gray-400 hover:text-navy p-1 rounded-lg hover:bg-gray-100"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 flex items-center justify-center min-h-[300px] max-h-[500px]">
              <img 
                src={selectedDocumentView.image} 
                alt={selectedDocumentView.title} 
                referrerPolicy="no-referrer"
                className="max-h-[500px] w-auto object-contain"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <p className="text-xs text-gray-500">Official document submitted during online company registration.</p>
              <Button 
                onClick={() => setSelectedDocumentView(null)} 
                className="bg-navy font-bold text-xs px-6"
              >
                Close Document Viewer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
