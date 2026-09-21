import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Building2,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  Wallet,
  Zap,
  HelpCircle,
  FileText,
  AlertCircle
} from 'lucide-react';
import {
  getCompanyRemittanceStatus,
  initPaystackRemittance,
  verifyPaystackRemittance,
  submitTransferProof
} from '../../lib/api';

interface DailyRemittanceModalProps {
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onRemittanceSuccess?: () => void;
}

export const DailyRemittanceModal: React.FC<DailyRemittanceModalProps> = ({
  token,
  isOpen,
  onClose,
  onRemittanceSuccess
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'paystack' | 'manual_transfer' | 'ledger' | 'history'>('paystack');

  // Part A state
  const [paystackLoading, setPaystackLoading] = useState(false);
  const [paystackRef, setPaystackRef] = useState<string | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [verifySuccessMessage, setVerifySuccessMessage] = useState<string | null>(null);

  // Part B state
  const [bankName, setBankName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [transferRef, setTransferRef] = useState('');
  const [notes, setNotes] = useState('');
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofSubmittedMessage, setProofSubmittedMessage] = useState<string | null>(null);

  // Copy feedback
  const [copiedAcc, setCopiedAcc] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCompanyRemittanceStatus(token);
      if (res.success) {
        setData(res);
      } else {
        setError(res.error || 'Failed to load remittance status');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setVerifySuccessMessage(null);
      setProofSubmittedMessage(null);
      setPaystackRef(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyAccount = () => {
    const acc = data?.bank_details?.account_number || '1018899221';
    navigator.clipboard.writeText(acc);
    setCopiedAcc(true);
    setTimeout(() => setCopiedAcc(false), 2000);
  };

  // 1. Initialize Paystack Instant Checkout
  const handleStartPaystackCheckout = async () => {
    setPaystackLoading(true);
    setError(null);
    try {
      const res = await initPaystackRemittance(token);
      if (res.success && res.reference) {
        setPaystackRef(res.reference);
        if (res.authorization_url) {
          // Open Paystack popup/tab
          window.open(res.authorization_url, '_blank', 'noopener,noreferrer');
        }
      } else {
        setError(res.error || 'Could not start online payment session.');
      }
    } catch (err: any) {
      setError(err.message || 'Payment initialization error.');
    } finally {
      setPaystackLoading(false);
    }
  };

  // 2. Verify Paystack Payment
  const handleVerifyPaystack = async () => {
    if (!paystackRef) return;
    setVerifyingPayment(true);
    setError(null);
    try {
      const res = await verifyPaystackRemittance(token, paystackRef);
      if (res.success) {
        setVerifySuccessMessage(res.message || 'Payment confirmed! Terminal unlocked.');
        await fetchStatus();
        if (onRemittanceSuccess) onRemittanceSuccess();
      } else {
        setError(res.error || 'Payment not verified yet. Please try again in a few seconds.');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed.');
    } finally {
      setVerifyingPayment(false);
    }
  };

  // 3. Submit Manual Bank Transfer Proof
  const handleSubmitManualProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferRef && !senderName) {
      setError('Please enter your sender account name or bank transfer reference.');
      return;
    }
    setSubmittingProof(true);
    setError(null);
    try {
      const res = await submitTransferProof(token, {
        amount: data?.pending_debt || 0,
        bank_name: bankName || 'Bank Transfer',
        sender_account_name: senderName,
        transfer_reference: transferRef,
        notes
      });
      if (res.success) {
        setProofSubmittedMessage(res.message || 'Proof submitted successfully! Super Admin has been notified.');
        setBankName('');
        setSenderName('');
        setTransferRef('');
        setNotes('');
        await fetchStatus();
      } else {
        setError(res.error || 'Failed to submit proof.');
      }
    } catch (err: any) {
      setError(err.message || 'Submission error.');
    } finally {
      setSubmittingProof(false);
    }
  };

  const pendingDebt = data?.pending_debt || 0;
  const isSuspended = Boolean(data?.is_suspended);
  const totalCashCollected = data?.total_cash_in_drawer || 0;
  const companyProfitRetained = data?.company_profit_retained || 0;
  const cashCount = data?.cash_waybills_count || 0;

  // Format countdown
  const getDueStatusText = () => {
    if (isSuspended) {
      return {
        label: 'TERMINAL SUSPENDED',
        desc: 'Remittance is past due. Pay now to unlock instantly.',
        color: 'bg-red-600 text-white border-red-700'
      };
    }
    if (pendingDebt > 0 && data?.daily_grace_expires_at) {
      const expiresAt = new Date(data.daily_grace_expires_at).getTime();
      const diffHrs = Math.max(0, Math.round((expiresAt - Date.now()) / (1000 * 60 * 60)));
      return {
        label: `DUE IN ${diffHrs} HOURS`,
        desc: `Grace period active. Remit before cutoff to prevent terminal pauses.`,
        color: 'bg-amber-500 text-white border-amber-600'
      };
    }
    return {
      label: 'IN GOOD STANDING',
      desc: 'All cash remittances are settled.',
      color: 'bg-emerald-600 text-white border-emerald-700'
    };
  };

  const statusBadge = getDueStatusText();

  return (
    <div className="fixed inset-0 z-50 bg-[#091026]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in" id="daily-remittance-modal">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="bg-[#0A1F44] text-white px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  Daily Cash Remittance & Terminal Status
                </h2>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${statusBadge.color}`}>
                  {statusBadge.label}
                </span>
              </div>
              <p className="text-xs text-blue-200">
                {data?.company_name || 'Transport Park'} • 70/30 Tracking Fee Reconciliation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-start gap-3 text-xs">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-extrabold block">Notice</span>
                <p>{error}</p>
              </div>
            </div>
          )}

          {verifySuccessMessage && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-4 rounded-2xl flex items-start gap-3 text-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-extrabold block text-sm">Remittance Settled Successfully!</span>
                <p>{verifySuccessMessage}</p>
              </div>
            </div>
          )}

          {proofSubmittedMessage && (
            <div className="bg-blue-50 border border-blue-300 text-blue-900 p-4 rounded-2xl flex items-start gap-3 text-xs">
              <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-extrabold block text-sm">Proof Submitted</span>
                <p>{proofSubmittedMessage}</p>
              </div>
            </div>
          )}

          {/* Top Metric Cards (Cash in Drawer vs Retained Profit vs Due Remittance) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Total Collected */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Cash in Drawer
              </span>
              <div className="text-xl font-black text-slate-800 mt-1">
                ₦{totalCashCollected.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {cashCount} waybills booked with cash today
              </span>
            </div>

            {/* Park Retained Profit */}
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Park Retained Profit (30%)
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="text-xl font-black text-emerald-700 mt-1">
                ₦{companyProfitRetained.toLocaleString()}
              </div>
              <span className="text-[10px] text-emerald-700 font-medium mt-0.5 block">
                ₦60 per waybill kept by your park
              </span>
            </div>

            {/* Due to Remit (70%) */}
            <div className={`rounded-2xl p-4 border ${
              isSuspended
                ? 'bg-red-50 border-red-300 ring-2 ring-red-400'
                : pendingDebt > 0
                  ? 'bg-amber-50 border-amber-300'
                  : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${
                  isSuspended ? 'text-red-800' : pendingDebt > 0 ? 'text-amber-800' : 'text-blue-800'
                }`}>
                  Remittance Due (70%)
                </span>
                {isSuspended && (
                  <span className="text-[9px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded">
                    OVERDUE
                  </span>
                )}
              </div>
              <div className={`text-xl font-black mt-1 ${
                isSuspended ? 'text-red-700' : pendingDebt > 0 ? 'text-amber-800' : 'text-blue-900'
              }`}>
                ₦{pendingDebt.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-600 font-medium mt-0.5 block">
                ₦140 per waybill for Waybilla
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 text-xs font-bold gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('paystack')}
              className={`pb-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'paystack'
                  ? 'border-emerald-600 text-emerald-700 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Zap className="w-4 h-4 text-emerald-500" />
              <span>Part A: Instant Online Remit</span>
              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                Recommended
              </span>
            </button>

            <button
              onClick={() => setActiveTab('manual_transfer')}
              className={`pb-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'manual_transfer'
                  ? 'border-[#0A1F44] text-[#0A1F44] font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Part B: Bank Transfer Proof</span>
            </button>

            <button
              onClick={() => setActiveTab('ledger')}
              className={`pb-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'ledger'
                  ? 'border-[#0A1F44] text-[#0A1F44] font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Today's Cash Ledger ({data?.recent_cash_ledger?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`pb-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'history'
                  ? 'border-[#0A1F44] text-[#0A1F44] font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-slate-500" />
              <span>Settlement Receipts</span>
            </button>
          </div>

          {/* TAB 1: PART A - PAYSTACK (HIGHLY RECOMMENDED) */}
          {activeTab === 'paystack' && (
            <div className="space-y-5 animate-in fade-in">
              {/* Highlight Banner with Reasons */}
              <div className="bg-gradient-to-r from-emerald-900 to-[#0A1F44] text-white p-5 rounded-2xl shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-400 text-emerald-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    HIGHLY RECOMMENDED FOR SPEED
                  </span>
                  <span className="text-xs text-emerald-200 font-bold">Instant 10-Second Terminal Unlock</span>
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  Why Part A (Online Remittance) is Recommended:
                </h3>
                <ul className="text-xs text-blue-100 space-y-1.5 leading-relaxed font-normal">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Zero Human Delay:</strong> No waiting for Super Admin to wake up or check bank statement. Your terminal unlocks instantly even at 6:00 AM or midnight.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Works with ANY Nigerian Bank:</strong> Pay via your normal mobile banking app (GTBank, Access, Zenith, Kuda, Moniepoint, OPay, etc.) or debit card.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Automated Receipt:</strong> Generates instant verified receipt on both your park dashboard and Super Admin console.</span>
                  </li>
                </ul>
              </div>

              {/* Step-by-Step Low-Tech Guide */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-3">
                <h4 className="text-xs font-black text-[#0A1F44] uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-blue-600" />
                  Easy 3-Step Guide for Park Managers:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-[#0A1F44] font-black flex items-center justify-center mb-1 text-[11px]">1</span>
                    <p className="font-bold text-slate-800">Click Green Button</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Click "Pay ₦{pendingDebt} Now". Paystack opens with payment options.</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-[#0A1F44] font-black flex items-center justify-center mb-1 text-[11px]">2</span>
                    <p className="font-bold text-slate-800">Transfer from Bank App</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Transfer exact amount to the displayed account and tap "I have sent the money".</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center mb-1 text-[11px]">3</span>
                    <p className="font-bold text-slate-800">Terminal Unlocks</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Your staff can book waybills again immediately without delay.</p>
                  </div>
                </div>
              </div>

              {/* Action Box */}
              <div className="bg-white border border-emerald-200 rounded-2xl p-5 text-center space-y-4 shadow-xs">
                {pendingDebt <= 0 ? (
                  <div className="py-4 space-y-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                      <Check className="w-6 h-6" />
                    </div>
                    <h4 className="font-black text-slate-800 text-base">Your Account is Completely Settled!</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      There is no outstanding cash remittance balance due. Your park terminals are 100% active and in good standing.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="text-xs text-slate-500 font-bold block uppercase">Total Remittance Amount</span>
                      <div className="text-3xl font-black text-[#0A1F44] mt-1">
                        ₦{pendingDebt.toLocaleString()}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        (70% platform share of {cashCount} cash waybill{cashCount !== 1 ? 's' : ''})
                      </p>
                    </div>

                    {!paystackRef ? (
                      <button
                        onClick={handleStartPaystackCheckout}
                        disabled={paystackLoading}
                        className="w-full sm:w-auto min-w-[280px] bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 px-8 rounded-2xl text-sm transition-all cursor-pointer shadow-lg hover:shadow-emerald-600/20 flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
                        id="paystack-remit-checkout-btn"
                      >
                        {paystackLoading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Opening Payment Portal...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-5 h-5 text-emerald-200" />
                            <span>Pay ₦{pendingDebt.toLocaleString()} & Unlock Instantly</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-2xl space-y-3">
                        <p className="text-xs text-emerald-900 font-medium">
                          Payment initialized! If you just completed the transfer or card payment, click below to verify:
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                          <button
                            onClick={handleVerifyPaystack}
                            disabled={verifyingPayment}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold py-3 px-6 rounded-xl text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
                            id="verify-remittance-btn"
                          >
                            {verifyingPayment ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Checking Bank Confirmation...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>I Have Made the Payment — Verify & Unlock</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={handleStartPaystackCheckout}
                            className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-2 cursor-pointer"
                          >
                            Re-open Checkout Window
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PART B - MANUAL BANK TRANSFER (FALLBACK) */}
          {activeTab === 'manual_transfer' && (
            <div className="space-y-5 animate-in fade-in">
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex items-start gap-3 text-xs">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-extrabold block text-amber-900">Important Note on Manual Transfers</span>
                  Part B requires manual verification by Waybilla Super Admin before your terminal is unlocked. If you need immediate 10-second unlocking, please use <strong>Part A (Online Remit)</strong> above.
                </div>
              </div>

              {/* Waybilla Corporate Account Details */}
              <div className="border border-slate-200 bg-slate-50/70 rounded-2xl p-5 space-y-3">
                <h4 className="text-xs font-black text-[#0A1F44] uppercase tracking-wider">
                  Waybilla Official Corporate Bank Account
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Bank Name</span>
                    <span className="font-black text-slate-800 text-sm">
                      {data?.bank_details?.bank_name || 'Zenith Bank PLC / Moniepoint MFB'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Account Name</span>
                    <span className="font-black text-slate-800 text-sm">
                      {data?.bank_details?.account_name || 'Waybilla Logistics Technology Ltd'}
                    </span>
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between bg-white border border-slate-200 p-3 rounded-xl">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Account Number</span>
                      <span className="font-black text-xl text-[#0A1F44] tracking-widest">
                        {data?.bank_details?.account_number || '1018899221'}
                      </span>
                    </div>
                    <button
                      onClick={handleCopyAccount}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedAcc ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Account</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Proof Submission Form */}
              <form onSubmit={handleSubmitManualProof} className="space-y-4 border border-slate-200 rounded-2xl p-5">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Submit Transfer Proof for Super Admin Review
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Your Bank Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Access Bank / OPay / FirstBank"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      required
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-[#0A1F44] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Sender Account Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Emeka Transport Nig Ltd"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      required
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-[#0A1F44] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Transfer Reference / Session ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 09012398492040921"
                      value={transferRef}
                      onChange={(e) => setTransferRef(e.target.value)}
                      required
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-[#0A1F44] focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Additional Notes (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Nnewi Park daily remittance"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-[#0A1F44] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submittingProof}
                    className="w-full bg-[#0A1F44] hover:bg-blue-900 text-white font-extrabold py-3 px-6 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submittingProof ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Submitting Proof...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Submit Transfer Proof (₦{pendingDebt.toLocaleString()})</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: CASH LEDGER AUDIT */}
          {activeTab === 'ledger' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">
                  Individual ₦200 Cash Waybills Collected at Counter
                </span>
                <span className="text-slate-500">
                  Showing last {data?.recent_cash_ledger?.length || 0} entries
                </span>
              </div>

              {(!data?.recent_cash_ledger || data.recent_cash_ledger.length === 0) ? (
                <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                  No cash waybills recorded for this period yet.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Tracking Code</th>
                        <th className="p-3">Package</th>
                        <th className="p-3">Collected</th>
                        <th className="p-3">Your Profit</th>
                        <th className="p-3">Platform Due</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {data.recent_cash_ledger.map((item: any) => (
                        <tr key={item.id} className="hover:bg-slate-50/80">
                          <td className="p-3 font-bold text-[#0A1F44]">{item.tracking_code}</td>
                          <td className="p-3 text-slate-500 truncate max-w-[140px]">
                            {item.item_description || 'Waybill item'}
                          </td>
                          <td className="p-3 font-bold">₦{item.amount || 200}</td>
                          <td className="p-3 text-emerald-700 font-extrabold">+₦{item.company_share || 60}</td>
                          <td className="p-3 text-amber-800 font-extrabold">₦{item.platform_share || 140}</td>
                          <td className="p-3">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                              item.status === 'remitted'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {item.status === 'remitted' ? 'Settled' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SETTLEMENT RECEIPTS & CONFIRMATIONS */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-in fade-in">
              <span className="text-xs font-bold text-slate-700 block">
                Settled Remittance Receipts & Transaction Records
              </span>

              {(!data?.recent_remittances || data.recent_remittances.length === 0) ? (
                <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                  No previous remittance records found.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.recent_remittances.map((remit: any) => (
                    <div key={remit.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-[#0A1F44] text-sm">
                            ₦{(remit.amount || 0).toLocaleString()} Settled
                          </span>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                            Verified
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Method: <span className="font-bold text-slate-700">{remit.method === 'paystack' ? 'Paystack Instant' : 'Bank Transfer Approved'}</span> • Ref: {remit.reference}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-400">
                          {remit.confirmed_at ? new Date(remit.confirmed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Confirmed'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between shrink-0">
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>

          <button
            onClick={onClose}
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs py-2 px-5 rounded-xl cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
