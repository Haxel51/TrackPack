import { FormEvent, useState, ChangeEvent } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { useAuthStore } from '../store';
import { Building, ArrowLeft, CheckCircle2, Upload, FileCheck, Image as ImageIcon, X, Eye, EyeOff, ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { normalizeTo11Digits } from '../lib/helpers';

export function LoginAdmin() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialMode = (location.state as any)?.mode || searchParams.get('mode');

  const [mode, setMode] = useState<'login' | 'register' | 'pending' | 'setup_password' | 'check_status'>(
    initialMode === 'register' ? 'register' : 'login'
  );
  
  // Login State
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register State
  const [companyName, setCompanyName] = useState('');
  const [parkLocation, setParkLocation] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [kycNumber, setKycNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  
  // Document Uploads
  const [cacDocumentUrl, setCacDocumentUrl] = useState<string>('');
  const [kycDocumentUrl, setKycDocumentUrl] = useState<string>('');

  // Status Check State
  const [statusCheckPhone, setStatusCheckPhone] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusResult, setStatusResult] = useState<{
    status: 'approved' | 'pending' | 'suspended' | 'declined' | 'not_found';
    companyName?: string;
    approvedAt?: string;
    submittedAt?: string;
    message?: string;
    kycStatus?: string;
    cacStatus?: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  // Query verification status from server
  const handleCheckStatus = async (phoneToQuery?: string) => {
    const rawPhone = phoneToQuery || statusCheckPhone || loginPhone || ownerPhone;
    const normalizedPhone = normalizeTo11Digits(rawPhone);
    if (normalizedPhone.length !== 11) {
      setError('Owner phone number must be exactly 11 digits (e.g. 08012345678).');
      return;
    }

    setCheckingStatus(true);
    setError('');
    setSuccessMsg('');

    try {
      const response = await fetch(`/api/company/verification-status?phone=${normalizedPhone}`);
      const data = await response.json();
      setStatusResult(data);

      if (data.status === 'approved') {
        setSuccessMsg(`Official Verification Confirmed! ${data.companyName} is approved and active.`);
      } else if (data.status === 'pending') {
        setSuccessMsg(`Application is under review by Super Admin.`);
      }
    } catch (err) {
      console.error('Check status error:', err);
      setError('Failed to query verification status from server. Please try again.');
    } finally {
      setCheckingStatus(false);
    }
  };

  // Helper to convert uploaded files to compressed data URL
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setter(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    const normalizedPhone = normalizeTo11Digits(loginPhone);
    if (normalizedPhone.length !== 11) {
      setError('Owner phone number must be exactly 11 digits (e.g. 08012345678).');
      return;
    }
    if (!loginPassword) {
      setError('Password is required.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const response = await fetch('/api/company/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone: normalizedPhone, password: loginPassword })
      });

      const data = await response.json();
      if (response.ok && data.status === 'success') {
        const company = data.company;
        login({
          role: 'admin',
          phone: company.ownerPhone,
          name: company.name,
          companyId: company.id
        });
        navigate('/admin');
      } else {
        if (data.code === 'MIGRATE_PASSWORD') {
          setError(data.message);
          setSuccessMsg('You can set up your secure password below.');
          setMode('setup_password');
        } else if (data.code === 'APPROVAL_PENDING') {
          setError(data.message || 'Your company registration is pending approval by the Super Admin.');
          // Query live status to populate tracker
          handleCheckStatus(normalizedPhone);
        } else if (data.code === 'ACCOUNT_SUSPENDED') {
          setError(data.message || 'Your company account has been suspended by the Super Admin.');
        } else {
          setError(data.message || 'Incorrect phone number or password.');
        }
      }
    } catch (err) {
      console.error('Company Login Error:', err);
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    const normalizedPhone = normalizeTo11Digits(ownerPhone);
    if (normalizedPhone.length !== 11) {
      setError('Owner phone number must be exactly 11 digits (e.g. 08012345678).');
      return;
    }
    if (!bankName.trim() || !accountNumber.trim() || !accountName.trim()) {
      setError('Settlement bank account details (Bank Name, Account Number, and Account Name) are required.');
      return;
    }
    if (accountNumber.trim().length < 8) {
      setError('Please enter a valid account number.');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    
    const formattedBankAccount = `${bankName.trim()} | Acc: ${accountNumber.trim()} | Name: ${accountName.trim()}`;

    try {
      const response = await fetch('/api/company/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: companyName,
          parks: [parkLocation],
          ownerPhone: normalizedPhone,
          kycNumber,
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
          bankAccount: formattedBankAccount,
          cacDocumentUrl: cacDocumentUrl || undefined,
          kycDocumentUrl: kycDocumentUrl || undefined,
          password: regPassword
        })
      });

      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setMode('pending');
      } else {
        setError(data.message || 'Failed to submit registration application.');
      }
    } catch (err) {
      console.error('Company Register Error:', err);
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupPassword = async (e: FormEvent) => {
    e.preventDefault();
    const normalizedPhone = normalizeTo11Digits(loginPhone);
    if (normalizedPhone.length !== 11) {
      setError('Owner phone number must be exactly 11 digits (e.g. 08012345678).');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const response = await fetch('/api/company/setup-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          password: regPassword,
          confirmPassword: regConfirmPassword
        })
      });

      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setSuccessMsg('Security password set successfully! You can now log in.');
        setMode('login');
        setLoginPassword(regPassword);
      } else {
        setError(data.message || 'Failed to set security password.');
      }
    } catch (err) {
      console.error('Setup Password Error:', err);
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'pending') {
    return (
      <div className="max-w-md mx-auto py-12 text-center px-4">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
          {statusResult?.status === 'approved' ? (
            <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-left mb-6">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <div className="inline-block bg-emerald-100 text-emerald-900 text-xs font-bold px-3 py-1 rounded-full mb-3">
                OFFICIALLY VERIFIED & APPROVED
              </div>
              <h2 className="text-xl font-bold text-emerald-950 mb-2">
                {statusResult.companyName || 'Transport Operator'}
              </h2>
              <p className="text-xs text-emerald-800 leading-relaxed mb-4">
                {statusResult.message}
              </p>
              <Button 
                onClick={() => {
                  setMode('login');
                  if (ownerPhone) setLoginPhone(ownerPhone);
                  setError('');
                  setSuccessMsg('Your account has been officially verified! Enter your security password to log in.');
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3"
              >
                Log In to Company Dashboard
              </Button>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-amber-600" />
              </div>
              <h1 className="text-2xl font-extrabold text-navy mb-2">Application Submitted</h1>
              <div className="inline-block bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold px-3 py-1 rounded-full mb-4">
                PENDING SUPER ADMIN APPROVAL
              </div>
              <p className="text-gray-700 text-sm mb-6 leading-relaxed text-left bg-gray-50 p-4 rounded-xl border border-gray-200">
                <strong className="text-navy block mb-1">Status Alert:</strong>
                Your transport operator registration and CAC / identity documents have been queued for Super Admin review.
                <br/><br/>
                Once verified and approved, you can immediately log in to access your company dashboard.
              </p>

              <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200 text-left space-y-2">
                <p className="text-xs font-bold text-navy uppercase tracking-wider">Live Verification Steps:</p>
                <div className="space-y-1.5 text-xs text-gray-700">
                  <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 1. Registration Submitted
                  </div>
                  <div className="flex items-center gap-2 text-amber-700 font-semibold">
                    <RefreshCw className="w-4 h-4 text-amber-600 animate-spin" /> 2. CAC & KYC Review (Underway)
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <ShieldCheck className="w-4 h-4" /> 3. Super Admin Active License (Pending)
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={() => handleCheckStatus(ownerPhone || loginPhone)} 
                  disabled={checkingStatus}
                  className="w-full font-bold text-xs py-2.5 bg-navy hover:bg-navy/90 text-white flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${checkingStatus ? 'animate-spin' : ''}`} />
                  {checkingStatus ? 'Checking Live Approval Status...' : 'Refresh Live Approval Status'}
                </Button>

                <Button 
                  onClick={() => { 
                    setMode('login'); 
                    setError(''); 
                    setSuccessMsg(''); 
                  }} 
                  variant="secondary" 
                  className="w-full font-bold text-xs py-2.5"
                >
                  Go to Login Page
                </Button>
                <Link to="/" className="block text-xs font-bold text-navy hover:underline pt-2">
                  ← Return to Homepage
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-12">
      <Link to="/" className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-navy mb-8">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Link>
      
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <Building className="w-6 h-6 text-navy" />
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-800 border border-red-200 p-3.5 rounded-xl text-sm mb-5 font-medium leading-relaxed">
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3.5 rounded-xl text-sm mb-5 font-medium leading-relaxed">
            ✅ {successMsg}
          </div>
        )}

        {mode === 'check_status' && (
          <>
            <h1 className="text-2xl font-bold text-navy mb-2">Check Approval Status</h1>
            <p className="text-gray-700 text-sm mb-6">Enter your owner phone number to check if Super Admin has approved your account.</p>

            <form onSubmit={(e) => { e.preventDefault(); handleCheckStatus(); }} className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner Phone Number</label>
                <Input 
                  type="tel"
                  placeholder="e.g. 08012345678" 
                  value={statusCheckPhone}
                  onChange={(e) => {
                    setStatusCheckPhone(e.target.value);
                    setError('');
                  }}
                  disabled={checkingStatus}
                />
              </div>
              <Button type="submit" disabled={checkingStatus || !statusCheckPhone} className="w-full font-bold" size="lg">
                {checkingStatus ? 'Checking Server Record...' : 'Verify Status'}
              </Button>
            </form>

            {statusResult && (
              <div className="p-4 rounded-xl border text-left mb-6 space-y-2 text-sm transition">
                {statusResult.status === 'approved' && (
                  <div className="bg-emerald-50 border-emerald-300 text-emerald-950 p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-2 font-bold text-emerald-800">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      OFFICIALLY VERIFIED & APPROVED
                    </div>
                    <p className="text-xs text-emerald-900 font-semibold mb-1">Company: {statusResult.companyName}</p>
                    <p className="text-xs text-emerald-800 leading-relaxed mb-3">{statusResult.message}</p>
                    <Button 
                      onClick={() => {
                        setMode('login');
                        setLoginPhone(statusCheckPhone);
                        setError('');
                        setSuccessMsg('Account is verified! Enter your security password to log in.');
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                    >
                      Proceed to Dashboard Login
                    </Button>
                  </div>
                )}

                {statusResult.status === 'pending' && (
                  <div className="bg-amber-50 border-amber-300 text-amber-950 p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-2 font-bold text-amber-800">
                      <RefreshCw className="w-5 h-5 text-amber-600 animate-spin" />
                      APPLICATION UNDER REVIEW
                    </div>
                    <p className="text-xs text-amber-900 font-semibold mb-1">Company: {statusResult.companyName}</p>
                    <p className="text-xs text-amber-800 leading-relaxed">{statusResult.message}</p>
                  </div>
                )}

                {statusResult.status === 'suspended' && (
                  <div className="bg-red-50 border-red-300 text-red-950 p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-2 font-bold text-red-800">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      ACCOUNT SUSPENDED
                    </div>
                    <p className="text-xs text-red-800 leading-relaxed">{statusResult.message}</p>
                  </div>
                )}

                {statusResult.status === 'not_found' && (
                  <div className="bg-gray-50 border-gray-300 text-gray-800 p-4 rounded-xl">
                    <p className="text-xs font-semibold">{statusResult.message}</p>
                  </div>
                )}
              </div>
            )}

            <Button onClick={() => setMode('login')} variant="secondary" className="w-full font-bold">
              Back to Owner Login
            </Button>
          </>
        )}

        {mode === 'login' && (
          <>
            <h1 className="text-2xl font-bold text-navy mb-2">Company Owner Login</h1>
            <p className="text-gray-700 text-sm mb-6">Manage your parks, staff, and waybills securely.</p>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner Phone Number</label>
                <Input 
                  type="tel"
                  placeholder="e.g. 08012345678" 
                  value={loginPhone}
                  onChange={(e) => {
                    setLoginPhone(e.target.value);
                    setError('');
                  }}
                  disabled={loading}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Security Password</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-navy hover:underline flex items-center gap-1 font-medium"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="relative">
                  <Input 
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••" 
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      setError('');
                    }}
                    className="pr-10"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-navy transition"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full font-bold" size="lg" disabled={loading || !loginPhone || !loginPassword}>
                {loading ? 'Entering...' : 'Login'}
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setMode('check_status');
                  if (loginPhone) setStatusCheckPhone(loginPhone);
                  setError('');
                  setSuccessMsg('');
                }}
                className="w-full text-xs font-bold text-navy hover:underline flex items-center justify-center gap-1.5 py-2.5 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-900 rounded-xl border border-emerald-200 transition"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Check Company Application Approval Status
              </button>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-700 mb-3">Want to register a new transport company?</p>
              <Button onClick={() => navigate('/partners')} variant="secondary" className="w-full">
                Apply for Owner Account
              </Button>
            </div>
          </>
        )}

        {mode === 'register' && (
          <>
            <h1 className="text-2xl font-bold text-navy mb-2">Register Park Office</h1>
            <p className="text-gray-700 text-sm mb-6">Apply to manage your transport company on our platform.</p>
            
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <Input 
                  required
                  placeholder="e.g. Fast Transit Ltd" 
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Park Location</label>
                <Input 
                  required
                  placeholder="e.g. Jibowu Terminal" 
                  value={parkLocation}
                  onChange={(e) => setParkLocation(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner Phone Number</label>
                <Input 
                  required
                  type="tel"
                  placeholder="e.g. 08012345678" 
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NIN or CAC Reg Number (KYC)</label>
                <Input 
                  required
                  placeholder="e.g. RC-123456 or NIN" 
                  value={kycNumber}
                  onChange={(e) => setKycNumber(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* CAC Document Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CAC Incorporation Certificate Photo / Image
                </label>
                {cacDocumentUrl ? (
                  <div className="relative border border-emerald-300 bg-emerald-50/50 p-2 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img src={cacDocumentUrl} alt="CAC Document" referrerPolicy="no-referrer" className="w-12 h-12 object-cover rounded-lg border border-emerald-200" />
                      <div>
                        <p className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                          <FileCheck className="w-3.5 h-3.5 text-emerald-600" /> CAC Document Uploaded
                        </p>
                        <p className="text-[11px] text-emerald-700">Ready for admin verification</p>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setCacDocumentUrl('')} 
                      className="p-1 hover:bg-emerald-200/50 rounded-lg text-emerald-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-gray-300 hover:border-navy bg-gray-50/50 rounded-xl p-3 text-center cursor-pointer flex flex-col items-center justify-center transition">
                    <Upload className="w-5 h-5 text-gray-400 mb-1" />
                    <span className="text-xs font-semibold text-navy">Upload CAC Certificate Picture</span>
                    <span className="text-[10px] text-gray-500">PNG, JPG or WEBP (Max 5MB)</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleFileUpload(e, setCacDocumentUrl)} 
                      className="hidden" 
                    />
                  </label>
                )}
              </div>

              {/* Director KYC Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Director Identification Photo (NIN, Driver License or Voters Card)
                </label>
                {kycDocumentUrl ? (
                  <div className="relative border border-emerald-300 bg-emerald-50/50 p-2 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img src={kycDocumentUrl} alt="Director ID" referrerPolicy="no-referrer" className="w-12 h-12 object-cover rounded-lg border border-emerald-200" />
                      <div>
                        <p className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                          <FileCheck className="w-3.5 h-3.5 text-emerald-600" /> Identity Document Uploaded
                        </p>
                        <p className="text-[11px] text-emerald-700">Ready for admin verification</p>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setKycDocumentUrl('')} 
                      className="p-1 hover:bg-emerald-200/50 rounded-lg text-emerald-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-gray-300 hover:border-navy bg-gray-50/50 rounded-xl p-3 text-center cursor-pointer flex flex-col items-center justify-center transition">
                    <Upload className="w-5 h-5 text-gray-400 mb-1" />
                    <span className="text-xs font-semibold text-navy">Upload Director Identity Card / Photo</span>
                    <span className="text-[10px] text-gray-500">PNG, JPG or WEBP (Max 5MB)</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleFileUpload(e, setKycDocumentUrl)} 
                      className="hidden" 
                    />
                  </label>
                )}
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                <label className="block text-sm font-bold text-navy flex items-center justify-between">
                  <span>Settlement Bank Account Details</span>
                  <span className="text-xs text-red-500 font-semibold">* Required</span>
                </label>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Bank Name</label>
                  <Input 
                    required
                    placeholder="e.g. GTBank, Access Bank, First Bank, Zenith Bank" 
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Account Number (10 Digits)</label>
                  <Input 
                    required
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="e.g. 0123456789" 
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Account Name</label>
                  <Input 
                    required
                    placeholder="e.g. Fast Transit Ltd Settlement Account" 
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Create Security Password</label>
                <div className="relative">
                  <Input 
                    required
                    type={showRegPassword ? 'text' : 'password'}
                    placeholder="Minimum 6 characters" 
                    value={regPassword}
                    onChange={(e) => {
                      setRegPassword(e.target.value);
                      setError('');
                    }}
                    className="pr-10"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-navy transition"
                    aria-label={showRegPassword ? "Hide password" : "Show password"}
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Security Password</label>
                <div className="relative">
                  <Input 
                    required
                    type={showRegConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter password" 
                    value={regConfirmPassword}
                    onChange={(e) => {
                      setRegConfirmPassword(e.target.value);
                      setError('');
                    }}
                    className="pr-10"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-navy transition"
                    aria-label={showRegConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full font-bold" size="lg" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Application'}
              </Button>
            </form>
            
            <div className="mt-6 pt-6 border-t border-gray-100 text-center space-y-4">
              <button 
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }} 
                className="text-sm font-medium text-amber hover:text-blue-800 hover:underline"
              >
                Already registered? Login here
              </button>

              <div className="bg-emerald-50/80 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-900 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span>Need help with registration? Call us directly:</span>
                <a href="tel:08143778304" className="font-bold text-emerald-900 hover:underline">
                  0814 377 8304
                </a>
              </div>
            </div>
          </>
        )}

        {mode === 'setup_password' && (
          <>
            <h1 className="text-2xl font-bold text-navy mb-2">Secure Your Account</h1>
            <p className="text-gray-700 text-sm mb-6">Create a security password for your company owner account.</p>

            <form onSubmit={handleSetupPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner Phone Number</label>
                <Input 
                  type="tel"
                  disabled
                  value={loginPhone}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Create Security Password</label>
                <div className="relative">
                  <Input 
                    required
                    type={showRegPassword ? 'text' : 'password'}
                    placeholder="Minimum 6 characters" 
                    value={regPassword}
                    onChange={(e) => {
                      setRegPassword(e.target.value);
                      setError('');
                    }}
                    className="pr-10"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-navy transition"
                    aria-label={showRegPassword ? "Hide password" : "Show password"}
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Security Password</label>
                <div className="relative">
                  <Input 
                    required
                    type={showRegConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-enter password" 
                    value={regConfirmPassword}
                    onChange={(e) => {
                      setRegConfirmPassword(e.target.value);
                      setError('');
                    }}
                    className="pr-10"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-navy transition"
                    aria-label={showRegConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full font-bold" size="lg" disabled={loading || !regPassword || !regConfirmPassword}>
                {loading ? 'Securing Account...' : 'Set Password & Login'}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <button onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }} className="text-sm font-medium text-navy hover:underline">
                Back to Login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
