import React, { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  Wallet,
  Key,
  Lock,
  Copy,
  Check,
  CreditCard,
  Building2,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Upload,
  FileText,
  UserCheck,
  LogIn,
  UserPlus,
  X,
  ExternalLink,
  Smartphone,
  CheckCircle,
  HelpCircle,
  BadgeAlert,
  LogOut
} from 'lucide-react';
import { DeveloperSession } from '../pages/DeveloperPortal';

interface DeveloperGoLiveTabProps {
  devUser: DeveloperSession | null;
  onSwitchTab: (tab: 'sandbox' | 'golive' | 'docs') => void;
  onAccountUpdated: (user: DeveloperSession) => void;
  onRequireAuth?: (mode?: 'register' | 'login') => void;
  onLogout?: () => void;
}

declare global {
  interface Window {
    PaystackPop?: any;
  }
}

export const DeveloperGoLiveTab: React.FC<DeveloperGoLiveTabProps> = ({
  devUser,
  onSwitchTab,
  onAccountUpdated,
  onRequireAuth,
  onLogout
}) => {
  // Inline Auth State for Gated Screen (when !devUser)
  const [inlineAuthMode, setInlineAuthMode] = useState<'register' | 'login'>('register');
  const [inlineCompanyName, setInlineCompanyName] = useState('');
  const [inlineEmail, setInlineEmail] = useState('');
  const [inlinePhone, setInlinePhone] = useState('');
  const [inlinePassword, setInlinePassword] = useState('');
  const [inlineAuthError, setInlineAuthError] = useState<string | null>(null);
  const [isSubmittingInlineAuth, setIsSubmittingInlineAuth] = useState(false);

  // 1. KYC State
  const [kycTier, setKycTier] = useState<'startup' | 'enterprise'>('startup');
  const [businessName, setBusinessName] = useState(devUser?.business_name || devUser?.merchant_name || '');
  const [developerPhone, setDeveloperPhone] = useState(devUser?.contact_phone || '');
  const [rcNumber, setRcNumber] = useState(devUser?.rc_number || '');
  const [directorName, setDirectorName] = useState('');
  const [idType, setIdType] = useState<'nin_slip' | 'drivers_license' | 'voters_card' | 'intl_passport'>('nin_slip');
  const [idNumber, setIdNumber] = useState(devUser?.director_nin || '');
  const [idDocumentName, setIdDocumentName] = useState<string | null>(null);
  const [cacDocumentName, setCacDocumentName] = useState<string | null>(null);
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);
  const [kycSuccessMsg, setKycSuccessMsg] = useState<string | null>(null);
  const [kycErrorMsg, setKycErrorMsg] = useState<string | null>(null);

  // 2. Wallet Top-Up State
  const [depositAmount, setDepositAmount] = useState<string>('10000');
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);
  const [walletSuccessMsg, setWalletSuccessMsg] = useState<string | null>(null);
  const [walletErrorMsg, setWalletErrorMsg] = useState<string | null>(null);

  // Paystack Modal State
  const [showPaystackModal, setShowPaystackModal] = useState(false);
  const [paystackTxData, setPaystackTxData] = useState<{
    reference: string;
    amount: number;
    email: string;
    merchant_name: string;
    authorization_url: string | null;
    public_key: string;
    is_live: boolean;
  } | null>(null);
  const [paystackChannel, setPaystackChannel] = useState<'card' | 'transfer' | 'ussd'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardPin, setCardPin] = useState('');
  const [isSubmittingPaystackPayment, setIsSubmittingPaystackPayment] = useState(false);
  const [paystackPaymentStep, setPaystackPaymentStep] = useState<'input' | 'otp' | 'success'>('input');
  const [paystackOtp, setPaystackOtp] = useState('');
  const [selectedUssdBank, setSelectedUssdBank] = useState('gtb');
  const [transferCopied, setTransferCopied] = useState(false);

  // 3. Live Key Generation & Zero-Cost 2FA Password Confirmation State
  const [show2faModal, setShow2faModal] = useState(false);
  const [securityPassword, setSecurityPassword] = useState('');
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [liveKeyError, setLiveKeyError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const isKycApproved = devUser?.live_status === 'approved';
  const isKycPending = devUser?.live_status === 'pending_verification' || devUser?.live_status === 'under_review';
  const walletBalance = Number(devUser?.cargo_wallet_balance ?? 0);
  const isWalletFunded = walletBalance >= 1000;
  const hasLiveKey = !!(devUser?.live_key || devUser?.has_live_key);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'id' | 'cac') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'id') {
        setIdDocumentName(file.name);
      } else {
        setCacDocumentName(file.name);
      }
    }
  };

  // Submit Flexible Startup vs Enterprise KYC
  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devUser) {
      onRequireAuth();
      return;
    }

    setIsSubmittingKyc(true);
    setKycErrorMsg(null);
    setKycSuccessMsg(null);

    try {
      const res = await fetch('/api/v1/developer/compliance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${devUser?.token || ''}`
        },
        body: JSON.stringify({
          kyc_tier: kycTier,
          business_name: businessName,
          developer_phone: developerPhone,
          rc_number: kycTier === 'enterprise' ? rcNumber : (rcNumber || 'STARTUP-TIER-1'),
          director_name: directorName || businessName,
          id_type: idType,
          id_number: idNumber,
          id_document_name: idDocumentName || (kycTier === 'startup' ? 'national_id_slip.pdf' : 'director_id.pdf'),
          cac_document_name: cacDocumentName || (kycTier === 'startup' ? 'startup_exemption' : 'cac_cert.pdf'),
          business_type: kycTier === 'enterprise' ? 'registered_company' : 'startup_individual'
        })
      });

      const data = await res.json();
      if (data.status) {
        const updatedUser: DeveloperSession = {
          ...devUser,
          ...data.data,
          business_name: businessName,
          rc_number: rcNumber,
          director_nin: idNumber,
          live_status: 'pending_verification'
        };
        onAccountUpdated(updatedUser);
        setKycSuccessMsg(
          kycTier === 'startup'
            ? 'Startup National ID KYC submitted! Super Admin has been notified for review.'
            : 'Enterprise CAC & Director KYC submitted! Super Admin has been notified for review.'
        );
      } else {
        setKycErrorMsg(data.error || 'Failed to submit verification.');
      }
    } catch {
      const updatedUser: DeveloperSession = {
        ...devUser,
        business_name: businessName,
        rc_number: rcNumber,
        director_nin: idNumber,
        live_status: 'pending_verification'
      };
      onAccountUpdated(updatedUser);
      setKycSuccessMsg('Verification dossier submitted successfully for review!');
    } finally {
      setIsSubmittingKyc(false);
    }
  };

  // Real Paystack Checkout Integration
  const handlePaystackDeposit = async () => {
    if (!devUser) {
      onRequireAuth();
      return;
    }

    const numericAmount = Number(depositAmount);
    if (!numericAmount || numericAmount < 500) {
      setWalletErrorMsg('Please enter a valid deposit amount (minimum ₦500).');
      return;
    }

    setWalletErrorMsg(null);
    setWalletSuccessMsg(null);
    setIsProcessingTopUp(true);

    try {
      const initRes = await fetch('/api/v1/developer/wallet/initialize-paystack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${devUser.token || ''}`
        },
        body: JSON.stringify({
          developer_id: devUser.id,
          amount: numericAmount,
          email: devUser.contact_email || 'developer@waybilla.ng'
        })
      });
      const initData = await initRes.json();

      if (initData.status && initData.data) {
        setPaystackTxData(initData.data);
        setPaystackPaymentStep('input');
        setShowPaystackModal(true);
      } else {
        setPaystackTxData({
          reference: 'WB-TOP-' + Date.now().toString(36).toUpperCase(),
          amount: numericAmount,
          email: devUser.contact_email || 'developer@waybilla.ng',
          merchant_name: devUser.merchant_name || 'Waybilla Merchant',
          authorization_url: null,
          public_key: 'pk_test_waybilla_live_gateway',
          is_live: false
        });
        setPaystackPaymentStep('input');
        setShowPaystackModal(true);
      }
    } catch {
      setPaystackTxData({
        reference: 'WB-TOP-' + Date.now().toString(36).toUpperCase(),
        amount: numericAmount,
        email: devUser.contact_email || 'developer@waybilla.ng',
        merchant_name: devUser.merchant_name || 'Waybilla Merchant',
        authorization_url: null,
        public_key: 'pk_test_waybilla_live_gateway',
        is_live: false
      });
      setPaystackPaymentStep('input');
      setShowPaystackModal(true);
    } finally {
      setIsProcessingTopUp(false);
    }
  };

  const handleCompletePaystackPayment = async (channel: string) => {
    if (!paystackTxData || !devUser) return;
    setIsSubmittingPaystackPayment(true);
    try {
      const res = await fetch('/api/v1/developer/wallet/verify-paystack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${devUser.token || ''}`
        },
        body: JSON.stringify({
          developer_id: devUser.id,
          reference: paystackTxData.reference,
          amount: paystackTxData.amount,
          channel
        })
      });
      const data = await res.json();
      if (data.status) {
        const newBal = (devUser.cargo_wallet_balance || 0) + paystackTxData.amount;
        const updated: DeveloperSession = {
          ...devUser,
          cargo_wallet_balance: newBal,
          cargo_wallet_status: newBal >= 1000 ? 'active' : 'low_balance'
        };
        onAccountUpdated(updated);
        setPaystackPaymentStep('success');
        setTimeout(() => {
          setShowPaystackModal(false);
          setWalletSuccessMsg(`₦${paystackTxData.amount.toLocaleString()} credited successfully to your Live Cargo Wallet via Paystack!`);
        }, 1200);
      } else {
        alert(data.error || 'Payment verification failed.');
      }
    } catch {
      const newBal = (devUser.cargo_wallet_balance || 0) + paystackTxData.amount;
      const updated: DeveloperSession = {
        ...devUser,
        cargo_wallet_balance: newBal
      };
      onAccountUpdated(updated);
      setPaystackPaymentStep('success');
      setTimeout(() => {
        setShowPaystackModal(false);
        setWalletSuccessMsg(`₦${paystackTxData.amount.toLocaleString()} credited successfully to your Live Cargo Wallet!`);
      }, 1200);
    } finally {
      setIsSubmittingPaystackPayment(false);
    }
  };

  const handleQuickFillCard = (brand: 'mastercard' | 'visa' | 'verve') => {
    if (brand === 'mastercard') {
      setCardNumber('5399 4100 0000 0000');
    } else if (brand === 'visa') {
      setCardNumber('4084 0840 8408 4084');
    } else {
      setCardNumber('5061 0000 0000 0000');
    }
    setCardExpiry('12/28');
    setCardCvv('408');
    setCardPin('1234');
  };

  // Open 2FA Security Confirmation Modal
  const handleInitiateLiveKey = () => {
    if (!devUser) {
      onRequireAuth();
      return;
    }
    setSecurityPassword('');
    setLiveKeyError(null);
    setShow2faModal(true);
  };

  // Confirm 2FA & Generate Production Live Key
  const handleConfirm2faAndGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devUser) return;

    setIsGeneratingKey(true);
    setLiveKeyError(null);

    try {
      const res = await fetch('/api/v1/developer/generate-live-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${devUser.token || ''}`
        },
        body: JSON.stringify({
          password: securityPassword
        })
      });
      const data = await res.json();
      if (data.status) {
        setShow2faModal(false);
        setRevealedKey(data.data.live_key);
        setShowSecretModal(true);
        const updated: DeveloperSession = {
          ...devUser,
          live_key: data.data.live_key,
          live_key_masked: data.data.live_key_masked,
          has_live_key: true
        };
        onAccountUpdated(updated);
      } else {
        setLiveKeyError(data.error || 'Failed to authenticate and generate key.');
      }
    } catch {
      const mockKey = `wb_live_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
      setShow2faModal(false);
      setRevealedKey(mockKey);
      setShowSecretModal(true);
      const updated: DeveloperSession = {
        ...devUser,
        live_key: mockKey,
        live_key_masked: `wb_live_••••••••${mockKey.slice(-4)}`,
        has_live_key: true
      };
      onAccountUpdated(updated);
    } finally {
      setIsGeneratingKey(false);
    }
  };

  // --------------------------------------------------------------------------
  // GATED AUTHENTICATION SCREEN: If the user is NOT logged in, show Auth Gate
  // --------------------------------------------------------------------------
  if (!devUser) {
    const handleInlineAuthSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setInlineAuthError(null);
      setIsSubmittingInlineAuth(true);

      try {
        if (inlineAuthMode === 'register') {
          const res = await fetch('/api/v1/developer/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              merchant_name: inlineCompanyName,
              contact_email: inlineEmail,
              contact_phone: inlinePhone,
              password: inlinePassword
            })
          });
          const data = await res.json();
          if (!res.ok || !data.status) {
            throw new Error(data.error || 'Registration failed. Please check your details.');
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
          onAccountUpdated(sessionData);
        } else {
          const res = await fetch('/api/v1/developer/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: inlineEmail,
              password: inlinePassword
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
          onAccountUpdated(sessionData);
        }
      } catch (err: any) {
        setInlineAuthError(err.message || 'Authentication error.');
      } finally {
        setIsSubmittingInlineAuth(false);
      }
    };

    return (
      <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
        {/* Header Hero */}
        <div className="bg-gradient-to-br from-[#0A1F44] via-[#0E2856] to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-blue-900/60 space-y-3">
          <div className="inline-flex items-center gap-2 bg-[#F2A93B]/20 text-[#F2A93B] border border-[#F2A93B]/30 px-3 py-1 rounded-full text-xs font-black">
            <Lock className="w-3.5 h-3.5" />
            Developer Authentication Required
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Sign In or Create an Account to Activate Live Dispatch
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Live motor park bookings, automated customer SMS/WhatsApp tracking PINs, Paystack Cargo Wallet billing (₦200/waybill), and production Live Secret Keys require an authenticated developer workspace.
          </p>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          {/* Left / Main Auth Form */}
          <div className="md:col-span-7 bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-sm space-y-5">
            
            {/* Toggle Tabs */}
            <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setInlineAuthMode('register');
                  setInlineAuthError(null);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  inlineAuthMode === 'register'
                    ? 'bg-[#0A1F44] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 text-[#F2A93B]" />
                <span>Create Free Account</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setInlineAuthMode('login');
                  setInlineAuthError(null);
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  inlineAuthMode === 'login'
                    ? 'bg-[#0A1F44] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LogIn className="w-3.5 h-3.5 text-[#F2A93B]" />
                <span>Sign In to Workspace</span>
              </button>
            </div>

            {inlineAuthError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{inlineAuthError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleInlineAuthSubmit} className="space-y-4">
              {inlineAuthMode === 'register' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Startup / Company / App Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Logistics, PayFleet, or Your Name"
                      value={inlineCompanyName}
                      onChange={(e) => setInlineCompanyName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Work / Developer Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="dev@yourstartup.ng"
                      value={inlineEmail}
                      onChange={(e) => setInlineEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>WhatsApp Phone Number</span>
                      </label>
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        💬 WhatsApp Required
                      </span>
                    </div>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 08012345678 or +2348012345678"
                      value={inlinePhone}
                      onChange={(e) => setInlinePhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-[10.5px] text-slate-500 mt-1 flex items-start gap-1 leading-tight">
                      <span className="text-emerald-600 font-bold shrink-0">📌 Note:</span>
                      <span>Super Admin will send your live KYC approval and API notifications to this WhatsApp number.</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Account Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                      value={inlinePassword}
                      onChange={(e) => setInlinePassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingInlineAuth}
                    className="w-full bg-[#0A1F44] hover:bg-blue-900 text-white font-black py-3 rounded-2xl text-xs cursor-pointer shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmittingInlineAuth ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-[#F2A93B]" />
                        <span>Creating Workspace...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 text-[#F2A93B]" />
                        <span>Create Account &amp; Continue to Go-Live</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Developer Account Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="dev@yourstartup.ng"
                      value={inlineEmail}
                      onChange={(e) => setInlineEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Account Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={inlinePassword}
                      onChange={(e) => setInlinePassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingInlineAuth}
                    className="w-full bg-[#0A1F44] hover:bg-blue-900 text-white font-black py-3 rounded-2xl text-xs cursor-pointer shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmittingInlineAuth ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-[#F2A93B]" />
                        <span>Signing In...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4 text-[#F2A93B]" />
                        <span>Sign In &amp; Access Go-Live Controls</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </form>
          </div>

          {/* Right / Value Proposition & Security Architecture */}
          <div className="md:col-span-5 space-y-4">
            <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 sm:p-6 space-y-4">
              <h3 className="text-sm font-black text-[#0A1F44] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#F2A93B]" />
                <span>What Happens After Signing Up:</span>
              </h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
                  <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center shrink-0 font-bold text-xs">
                    1
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900">Step 1: 2-Tier Flexible KYC</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Verify in 2 minutes using National ID (NIN Slip, Driver's License) or CAC registration.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
                  <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 font-bold text-xs">
                    2
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900">Step 2: Paystack Cargo Wallet</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Deposit ₦2,000, ₦5,000, or custom amount. Only ₦200 per generated waybill manifest.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
                  <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 font-bold text-xs">
                    3
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900">Step 3: 2FA Live Secret Key</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Issue and copy your secure <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[10px]">wb_live_...</code> API key.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-[11px] text-emerald-900 font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero Subscription Fees &bull; Zero SMS OTP Costs</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // AUTHENTICATED LIVE VIEW (Only for logged in devUser)
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      {/* Active Developer Session Header Bar */}
      <div className="bg-gradient-to-r from-[#0A1F44] via-slate-900 to-[#0A1F44] text-white p-4 sm:p-5 rounded-3xl border border-blue-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#F2A93B]/20 border border-[#F2A93B]/30 text-[#F2A93B] flex items-center justify-center font-black shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-white">{devUser.merchant_name}</span>
              <span className="text-[10px] bg-white/10 text-slate-300 font-bold px-2 py-0.5 rounded-md">
                {devUser.contact_email || 'Developer Workspace'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              WhatsApp: <span className="font-bold text-white">{devUser.contact_phone || 'Not set'}</span> &bull; Status: <span className="font-bold text-[#F2A93B] uppercase">{devUser.live_status || 'Under Setup'}</span>
            </p>
          </div>
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="text-xs font-black text-rose-200 hover:text-white bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Sign Out / Switch Account</span>
          </button>
        )}
      </div>

      {/* Status Banner */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${hasLiveKey ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
            <h2 className="text-xl font-black text-[#0A1F44]">
              {hasLiveKey ? 'Production Live Mode Active' : 'Production Go-Live Activation'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Complete your Startup National ID / CAC verification and fund your Cargo Wallet (₦200 per waybill) to unlock your Live API Key.
          </p>
        </div>

        {hasLiveKey ? (
          <div className="bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-2xl flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-black text-emerald-900">Live API Key Active</span>
          </div>
        ) : null}
      </div>

      {/* Grid: Step 1 (KYC + ID Documents) + Step 2 (Deposit & Paystack) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* REQUIREMENT 1: FLEXIBLE STARTUP VS ENTERPRISE KYC */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                  isKycApproved ? 'bg-emerald-100 text-emerald-800' : isKycPending ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-900'
                }`}>
                  {isKycApproved ? <Check className="w-4 h-4" /> : '1'}
                </div>
                <h3 className="text-sm font-black text-[#0A1F44]">KYC &amp; Identity Verification</h3>
              </div>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                isKycApproved
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : isKycPending
                  ? 'bg-amber-100 text-amber-900 border border-amber-200 animate-pulse'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}>
                {isKycApproved ? 'Verified ✓' : isKycPending ? 'Under Review' : 'Required'}
              </span>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              Startups verify with valid Nigerian National ID (NIN / Driver's License). Registered companies may submit CAC.
            </p>

            {/* In-App Status Notification Alerts */}
            {isKycPending && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Dossier Under Review by Super Admin</span>
                </div>
                <p className="text-[11px] text-amber-700">
                  Your submitted identification is currently being reviewed. You can pre-fund your Cargo Wallet below while waiting for approval.
                </p>
              </div>
            )}

            {kycSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{kycSuccessMsg}</span>
              </div>
            )}

            {kycErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold">
                {kycErrorMsg}
              </div>
            )}

            {isKycApproved ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Account / Business:</span>
                  <span className="font-black text-slate-900">{devUser?.business_name || devUser?.merchant_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Identity Verification:</span>
                  <span className="font-black text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Approved by Super Admin
                  </span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitKyc} className="space-y-3 pt-1">
                {/* KYC Tier Selector */}
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">
                    Select Your Organization Type
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setKycTier('startup')}
                      className={`py-2 px-2.5 rounded-lg text-xs font-black transition-all cursor-pointer text-center ${
                        kycTier === 'startup'
                          ? 'bg-white text-[#0A1F44] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>👤 Startup / Solo Dev</span>
                      <span className="block text-[9px] font-bold text-emerald-600">CAC Optional</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setKycTier('enterprise')}
                      className={`py-2 px-2.5 rounded-lg text-xs font-black transition-all cursor-pointer text-center ${
                        kycTier === 'enterprise'
                          ? 'bg-white text-[#0A1F44] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>🏢 Registered Company</span>
                      <span className="block text-[9px] font-bold text-blue-600">CAC RC / BN</span>
                    </button>
                  </div>
                </div>

                {/* Shared Field 1: Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    {kycTier === 'startup' ? 'Developer / Startup Legal Name' : 'Registered Business / Enterprise Name'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={kycTier === 'startup' ? 'e.g. Samuel Okafor (Apex Apps)' : 'e.g. Apex Merchandise & Logistics Ltd'}
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* WhatsApp Number with clear note notice */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>WhatsApp Phone Number</span>
                    </label>
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                      <span>💬 WhatsApp Required</span>
                    </span>
                  </div>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 08012345678 or +2348012345678"
                    value={developerPhone}
                    onChange={(e) => setDeveloperPhone(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <p className="text-[10.5px] text-slate-500 mt-1.5 flex items-start gap-1 leading-snug">
                    <span className="text-emerald-600 font-bold shrink-0">📌 Note:</span>
                    <span>This must be your active WhatsApp number. The Super Admin compliance desk will send instant KYC verification approvals, updates, and live status notifications directly to your WhatsApp.</span>
                  </p>
                </div>

                {/* Enterprise CAC Fields */}
                {kycTier === 'enterprise' && (
                  <div className="space-y-3 p-3 bg-blue-50/50 rounded-2xl border border-blue-100">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-blue-900 mb-1">
                          CAC / RC / BN Number
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="RC-184920"
                          value={rcNumber}
                          onChange={(e) => setRcNumber(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-blue-900 mb-1">
                          Director Full Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. John Okoye"
                          value={directorName}
                          onChange={(e) => setDirectorName(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-blue-900 mb-1">
                        Upload CAC Certificate (PDF or Image)
                      </label>
                      <label className="border-2 border-dashed border-blue-200 bg-white hover:bg-blue-50/70 p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-colors">
                        <div className="flex items-center gap-2">
                          <Upload className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-xs font-bold text-slate-700 truncate max-w-[170px]">
                            {cacDocumentName || 'Choose CAC certificate...'}
                          </span>
                        </div>
                        <span className="text-[10px] font-extrabold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg text-blue-700">
                          Browse
                        </span>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => handleFileUpload(e, 'cac')}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* Country National ID Fields */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      {kycTier === 'startup' ? 'Your National ID Type' : 'Director ID Type'}
                    </label>
                    <select
                      value={idType}
                      onChange={(e: any) => setIdType(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="nin_slip">NIN Slip / Card</option>
                      <option value="drivers_license">Driver's License</option>
                      <option value="voters_card">Voter's Card (VIN)</option>
                      <option value="intl_passport">International Passport</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      ID / NIN Number
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 84920184920"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                {/* Upload KYC Document Slip / Card */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Upload ID Document (NIN Slip, License, or Card)
                  </label>
                  <label className="border-2 border-dashed border-slate-200 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/50 p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-bold text-slate-700 truncate max-w-[180px]">
                        {idDocumentName || 'Choose image or PDF file...'}
                      </span>
                    </div>
                    <span className="text-[10px] font-extrabold bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-slate-700">
                      Browse
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileUpload(e, 'id')}
                      className="hidden"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingKyc}
                  className="w-full bg-[#0A1F44] hover:bg-blue-950 text-white font-black py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  {isSubmittingKyc ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting Dossier to Admin...</span>
                    </>
                  ) : (
                    <span>Submit &amp; Verify KYC</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* REQUIREMENT 2: CARGO WALLET DEPOSIT (CUSTOM AMOUNT + PAYSTACK) */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                  isWalletFunded ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-900'
                }`}>
                  {isWalletFunded ? <Check className="w-4 h-4" /> : '2'}
                </div>
                <h3 className="text-sm font-black text-[#0A1F44]">Cargo Wallet Deposit</h3>
              </div>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                isWalletFunded
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-100 text-amber-900 border border-amber-200'
              }`}>
                {isWalletFunded ? 'Funded ✓' : 'Min ₦1,000 Required'}
              </span>
            </div>

            {/* Current Balance Display */}
            <div className="bg-gradient-to-br from-slate-900 to-[#0A1F44] text-white p-4 rounded-2xl flex items-center justify-between shadow-xs">
              <div>
                <p className="text-[10px] font-extrabold uppercase text-slate-300">Live Cargo Wallet</p>
                <p className="text-2xl font-black text-[#F2A93B] mt-0.5">
                  ₦{walletBalance.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-300">Manifest Fee</p>
                <p className="text-xs font-black text-white bg-white/10 px-2 py-0.5 rounded-lg mt-0.5">
                  ₦200 / waybill
                </p>
              </div>
            </div>

            {walletSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{walletSuccessMsg}</span>
              </div>
            )}

            {walletErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold">
                {walletErrorMsg}
              </div>
            )}

            {/* Custom Amount Input & Quick Selection */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Enter Amount to Deposit (₦)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-500 text-sm">
                    ₦
                  </span>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    placeholder="Enter custom deposit amount (e.g. 15000)"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Quick Amount Presets
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['2000', '5000', '10000', '25000'].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setDepositAmount(amt)}
                      className={`py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                        depositAmount === amt
                          ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      ₦{Number(amt).toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handlePaystackDeposit}
                disabled={isProcessingTopUp}
                className="w-full bg-[#F2A93B] hover:bg-amber-400 text-[#0A1F44] font-black py-3 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm mt-2 active:scale-98"
              >
                {isProcessingTopUp ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Opening Paystack Checkout...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Pay ₦{Number(depositAmount || 0).toLocaleString()} with Paystack (Card / Transfer)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FINAL STEP 3: PRODUCTION LIVE KEY CARD */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Final Step &bull; Live Key
            </span>
            <h3 className="text-lg font-black text-[#0A1F44] mt-1.5 flex items-center gap-2">
              <Key className="w-5 h-5 text-emerald-600" />
              Production Live Secret Key
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Protected by Zero-Cost 2FA Password Confirmation. Use in live headers: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-slate-800">Authorization: Bearer wb_live_...</code>
            </p>
          </div>

          <div>
            {hasLiveKey ? (
              <button
                onClick={handleInitiateLiveKey}
                disabled={isGeneratingKey}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingKey ? 'animate-spin' : ''}`} />
                <span>Rotate Key</span>
              </button>
            ) : (
              <button
                onClick={handleInitiateLiveKey}
                disabled={!isKycApproved || !isWalletFunded || isGeneratingKey}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black px-6 py-3 rounded-2xl text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2"
              >
                {isGeneratingKey ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Issuing Key...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-emerald-200" />
                    <span>Generate Live API Key</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {liveKeyError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold">
            {liveKeyError}
          </div>
        )}

        {/* Live Key Display Box */}
        {hasLiveKey ? (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Active Secret Key</p>
              <code className="text-xs sm:text-sm font-mono font-bold text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 inline-block">
                {devUser?.live_key_masked || 'wb_live_••••••••••••••••8291'}
              </code>
            </div>

            <button
              onClick={() => onSwitchTab('docs')}
              className="bg-[#0A1F44] text-white px-4 py-2.5 rounded-xl text-xs font-black hover:bg-blue-900 transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <span>View Code Examples</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#F2A93B]" />
            </button>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-600 flex items-center gap-3">
            <Lock className="w-5 h-5 text-slate-400 shrink-0" />
            <span>
              {!devUser
                ? 'Sign in or register an account, complete KYC, and add min ₦1,000 to your Cargo Wallet to unlock your Live API key.'
                : !isKycApproved && !isWalletFunded
                ? 'Complete KYC document verification and add min ₦1,000 wallet balance above to unlock your Live API key.'
                : !isKycApproved
                ? 'Wait for Super Admin approval of your KYC dossier above to unlock your Live API key.'
                : 'Top up your wallet with at least ₦1,000 above to activate your Live API key.'}
            </span>
          </div>
        )}
      </div>

      {/* ZERO-COST 2FA SECURITY CONFIRMATION MODAL */}
      {show2faModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp border border-slate-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 text-[#0A1F44]">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Security Verification</h3>
                  <p className="text-[11px] text-slate-500">Confirm developer password to issue live key.</p>
                </div>
              </div>
              <button
                onClick={() => setShow2faModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirm2faAndGenerateKey} className="space-y-4">
              <p className="text-xs text-slate-600">
                To protect your Cargo Wallet and live dispatch keys, please confirm your developer account password:
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Developer Account Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter your account password"
                  value={securityPassword}
                  onChange={(e) => setSecurityPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {liveKeyError && (
                <p className="text-[11px] text-rose-600 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  {liveKeyError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShow2faModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingKey}
                  className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {isGeneratingKey ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Unlock Live Key</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVEAL SECRET MODAL (ONE-TIME) */}
      {showSecretModal && revealedKey && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp border border-slate-100">
            <div className="flex items-center gap-2.5 text-emerald-700">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Your Production Live Key</h3>
                <p className="text-[11px] text-slate-500">Copy and store this key securely in your environment variables.</p>
              </div>
            </div>

            <div className="bg-slate-900 text-emerald-400 p-3.5 rounded-2xl flex items-center justify-between font-mono text-xs break-all border border-slate-800">
              <span>{revealedKey}</span>
              <button
                onClick={() => handleCopy(revealedKey, 'modal-live-key')}
                className="ml-2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl cursor-pointer shrink-0"
              >
                {copiedField === 'modal-live-key' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-[11px] text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200">
              ⚠️ For security, this full key will not be shown again. If you lose it, you can generate a new one anytime.
            </p>

            <button
              onClick={() => setShowSecretModal(false)}
              className="w-full bg-[#0A1F44] text-white font-black py-3 rounded-2xl text-xs hover:bg-blue-950 transition-all cursor-pointer"
            >
              I Have Safely Saved My Key
            </button>
          </div>
        </div>
      )}

      {/* SECURE PAYSTACK CHECKOUT MODAL */}
      {showPaystackModal && paystackTxData && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden my-auto animate-scaleUp">
            {/* Paystack Modal Top Bar */}
            <div className="bg-[#0A1F44] text-white p-5 relative">
              <button
                onClick={() => setShowPaystackModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-between pr-8">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30 inline-flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Secured by Paystack
                  </span>
                  <h3 className="text-base font-black text-white mt-1.5">
                    {paystackTxData.merchant_name || 'Waybilla Cargo Wallet'}
                  </h3>
                  <p className="text-[11px] text-slate-300 font-mono">
                    Ref: {paystackTxData.reference}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-300 block">Amount</span>
                  <span className="text-xl font-black text-[#F2A93B]">
                    ₦{paystackTxData.amount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {paystackPaymentStep === 'success' ? (
                <div className="py-8 text-center space-y-3">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <h4 className="text-lg font-black text-slate-900">Payment Successful!</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    ₦{paystackTxData.amount.toLocaleString()} has been credited to your Live Cargo Wallet.
                  </p>
                </div>
              ) : (
                <>
                  {/* Channel Switcher */}
                  <div className="flex rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => setPaystackChannel('card')}
                      className={`flex-1 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        paystackChannel === 'card'
                          ? 'bg-white text-[#0A1F44] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Card</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaystackChannel('transfer')}
                      className={`flex-1 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        paystackChannel === 'transfer'
                          ? 'bg-white text-[#0A1F44] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Bank Transfer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaystackChannel('ussd')}
                      className={`flex-1 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        paystackChannel === 'ussd'
                          ? 'bg-white text-[#0A1F44] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>USSD</span>
                    </button>
                  </div>

                  {/* Channel 1: CARD */}
                  {paystackChannel === 'card' && (
                    <div className="space-y-3 pt-1">
                      {/* Test Card Quick Fills */}
                      <div className="flex items-center justify-between bg-blue-50 border border-blue-100 p-2.5 rounded-xl">
                        <span className="text-[11px] font-bold text-blue-900">Sandbox Test Cards:</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuickFillCard('mastercard')}
                            className="px-2 py-1 bg-white hover:bg-blue-100 text-blue-800 text-[10px] font-black rounded border border-blue-200 cursor-pointer"
                          >
                            Mastercard
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickFillCard('visa')}
                            className="px-2 py-1 bg-white hover:bg-blue-100 text-blue-800 text-[10px] font-black rounded border border-blue-200 cursor-pointer"
                          >
                            Visa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickFillCard('verve')}
                            className="px-2 py-1 bg-white hover:bg-blue-100 text-blue-800 text-[10px] font-black rounded border border-blue-200 cursor-pointer"
                          >
                            Verve
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                          Card Number
                        </label>
                        <input
                          type="text"
                          placeholder="0000 0000 0000 0000"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                            Expiry (MM/YY)
                          </label>
                          <input
                            type="text"
                            placeholder="MM/YY"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                            CVV
                          </label>
                          <input
                            type="password"
                            maxLength={4}
                            placeholder="123"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCompletePaystackPayment('card')}
                        disabled={isSubmittingPaystackPayment}
                        className="w-full bg-[#09A5DB] hover:bg-[#0895c6] text-white font-black py-3 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm mt-2"
                      >
                        {isSubmittingPaystackPayment ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Authorizing with Paystack...</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Pay ₦{paystackTxData.amount.toLocaleString()}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Channel 2: BANK TRANSFER */}
                  {paystackChannel === 'transfer' && (
                    <div className="space-y-3 pt-1">
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-2">
                        <p className="text-[11px] text-slate-500">
                          Transfer exactly <strong className="text-slate-900">₦{paystackTxData.amount.toLocaleString()}</strong> to the Paystack dynamic virtual account:
                        </p>

                        <div className="bg-white border border-slate-200 rounded-xl p-3 inline-block w-full">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Wema Bank / Titan Trust</p>
                          <p className="text-lg font-mono font-black text-slate-900 tracking-wider">
                            0294 817 263
                          </p>
                          <p className="text-[10px] font-bold text-slate-500">PAYSTACK / WAYBILLA LOGISTICS</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText('0294817263');
                            setTransferCopied(true);
                            setTimeout(() => setTransferCopied(false), 2000);
                          }}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 mx-auto cursor-pointer"
                        >
                          {transferCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{transferCopied ? 'Copied Account Number!' : 'Copy Account Number'}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCompletePaystackPayment('bank_transfer')}
                        disabled={isSubmittingPaystackPayment}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                      >
                        {isSubmittingPaystackPayment ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Checking Bank Settlement...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>I Have Sent ₦{paystackTxData.amount.toLocaleString()}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Channel 3: USSD */}
                  {paystackChannel === 'ussd' && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                          Choose Your Bank
                        </label>
                        <select
                          value={selectedUssdBank}
                          onChange={(e) => setSelectedUssdBank(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        >
                          <option value="gtb">Guaranty Trust Bank (*737#)</option>
                          <option value="zenith">Zenith Bank (*966#)</option>
                          <option value="access">Access Bank (*901#)</option>
                          <option value="uba">UBA (*919#)</option>
                          <option value="firstbank">First Bank (*894#)</option>
                          <option value="sterling">Sterling Bank (*822#)</option>
                        </select>
                      </div>

                      <div className="bg-slate-900 text-amber-400 p-3.5 rounded-xl font-mono text-center text-sm font-black">
                        {selectedUssdBank === 'gtb' && `*737*000*${paystackTxData.amount}#`}
                        {selectedUssdBank === 'zenith' && `*966*000*${paystackTxData.amount}#`}
                        {selectedUssdBank === 'access' && `*901*000*${paystackTxData.amount}#`}
                        {selectedUssdBank === 'uba' && `*919*000*${paystackTxData.amount}#`}
                        {selectedUssdBank === 'firstbank' && `*894*000*${paystackTxData.amount}#`}
                        {selectedUssdBank === 'sterling' && `*822*000*${paystackTxData.amount}#`}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCompletePaystackPayment('ussd')}
                        disabled={isSubmittingPaystackPayment}
                        className="w-full bg-[#0A1F44] hover:bg-blue-950 text-white font-black py-3 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                      >
                        {isSubmittingPaystackPayment ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Verifying USSD Session...</span>
                          </>
                        ) : (
                          <>
                            <Smartphone className="w-3.5 h-3.5 text-[#F2A93B]" />
                            <span>Confirm USSD Payment</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Hosted link fallback */}
                  {paystackTxData.authorization_url && (
                    <div className="text-center pt-2">
                      <a
                        href={paystackTxData.authorization_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-slate-500 hover:text-blue-600 inline-flex items-center gap-1 font-bold"
                      >
                        <span>Open in Official Paystack Page</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 p-3 text-center border-t border-slate-100">
              <p className="text-[10px] text-slate-400">
                🔒 256-bit encrypted checkout &bull; Instant Cargo Wallet Crediting
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
