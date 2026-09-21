import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Building2,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Zap,
  Download,
  Filter,
  SlidersHorizontal,
  FileText,
  Clock,
  Send,
  HelpCircle
} from 'lucide-react';
import { DeveloperSession } from '../pages/DeveloperPortal';

export interface WalletTransaction {
  id: string;
  developer_id?: string;
  type: 'credit' | 'debit' | 'refund';
  amount: number;
  balance_before: number;
  balance_after: number;
  currency: string;
  reference: string;
  channel: string;
  description: string;
  tracking_code?: string;
  created_at: string;
}

export interface SavedCardInfo {
  is_saved: boolean;
  brand?: string;
  last4?: string;
  exp_month?: string;
  exp_year?: string;
  cardholder_name?: string;
  bank?: string;
  created_at?: string;
}

export interface AutoReloadSettings {
  enabled: boolean;
  trigger_threshold: number;
  reload_amount: number;
}

export interface WalletDetails {
  developer_id: string;
  merchant_name: string;
  balance: number;
  currency: string;
  status: 'active' | 'low_balance' | 'depleted' | 'inactive';
  manifest_fee_per_waybill: number;
  available_live_waybills: number;
  total_manifests_billed: number;
  total_cargo_wallet_spent: number;
  auto_topup_threshold: number;
  step_c_qualified: boolean;
  saved_card?: SavedCardInfo;
  auto_reload?: AutoReloadSettings;
  virtual_account: {
    bank_name: string;
    account_number: string;
    account_name: string;
    settlement_type: string;
    instructions: string;
  };
  recent_transactions: WalletTransaction[];
}

interface DeveloperCargoWalletTabProps {
  devUser: DeveloperSession | null;
  onSwitchTab: (tab: 'overview' | 'simulator' | 'keys' | 'compliance' | 'wallet' | 'docs') => void;
  onAccountUpdated: (user: DeveloperSession) => void;
}

export const DeveloperCargoWalletTab: React.FC<DeveloperCargoWalletTabProps> = ({
  devUser,
  onSwitchTab,
  onAccountUpdated
}) => {
  const [wallet, setWallet] = useState<WalletDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Top-Up Modal State
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState<number>(10000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'paystack' | 'saved_card'>('bank_transfer');
  const [isProcessingTopup, setIsProcessingTopup] = useState(false);

  // Save Card Modal State
  const [showSaveCardModal, setShowSaveCardModal] = useState(false);
  const [cardHolderInput, setCardHolderInput] = useState(devUser?.merchant_name || 'Enterprise Merchant');
  const [cardNumberInput, setCardNumberInput] = useState('5399 4100 2938 4242');
  const [cardExpiryInput, setCardExpiryInput] = useState('12/28');
  const [cardCvvInput, setCardCvvInput] = useState('883');
  const [isSavingCard, setIsSavingCard] = useState(false);

  // Merchant Auto-Reload Config State
  const [autoReloadEnabled, setAutoReloadEnabled] = useState(false);
  const [autoReloadThreshold, setAutoReloadThreshold] = useState<number>(2000);
  const [customThresholdInput, setCustomThresholdInput] = useState<string>('');
  const [autoReloadAmount, setAutoReloadAmount] = useState<number>(10000);
  const [customReloadAmountInput, setCustomReloadAmountInput] = useState<string>('');
  const [isUpdatingAutoReload, setIsUpdatingAutoReload] = useState(false);
  const [isChargingSavedCard, setIsChargingSavedCard] = useState(false);

  // Inbound NIP Simulation Modal State
  const [showNipSimModal, setShowNipSimModal] = useState(false);
  const [simNipAmount, setSimNipAmount] = useState<number>(10000);
  const [simSenderName, setSimSenderName] = useState<string>(devUser?.merchant_name || 'Enterprise Logistics Ltd');
  const [simSenderBank, setSimSenderBank] = useState<string>('Access Bank Plc');
  const [isSimulatingNip, setIsSimulatingNip] = useState(false);

  // Transaction Filters
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Settings
  const [thresholdInput, setThresholdInput] = useState<number>(2000);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const fetchWalletData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/developer/wallet', {
        headers: {
          Authorization: devUser?.token ? `Bearer ${devUser.token}` : ''
        }
      });
      const json = await res.json();
      if (json.status && json.data) {
        setWallet(json.data);
        setThresholdInput(json.data.auto_topup_threshold || 2000);
        setAutoReloadEnabled(json.data.auto_reload?.enabled ?? false);
        setAutoReloadThreshold(json.data.auto_reload?.trigger_threshold ?? 2000);
        setAutoReloadAmount(json.data.auto_reload?.reload_amount ?? 10000);

        if (devUser && typeof json.data.balance === 'number') {
          const updatedUser: DeveloperSession = {
            ...devUser,
            cargo_wallet_balance: json.data.balance,
            cargo_wallet_status: json.data.status,
            virtual_account_bank: json.data.virtual_account?.bank_name,
            virtual_account_number: json.data.virtual_account?.account_number,
            virtual_account_name: json.data.virtual_account?.account_name
          };
          onAccountUpdated(updatedUser);
        }
      } else {
        setErrorMsg(json.error || 'Failed to load cargo wallet data.');
      }
    } catch {
      setErrorMsg('Network error connecting to cargo billing service.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, [devUser?.id]);

  const handleCopyAccount = () => {
    if (!wallet?.virtual_account?.account_number) return;
    navigator.clipboard.writeText(wallet.virtual_account.account_number);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2500);
  };

  const handleTopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = customAmount ? Number(customAmount) : topupAmount;
    if (!finalAmount || finalAmount < 500) {
      setErrorMsg('Minimum deposit amount is ₦500.');
      return;
    }

    setIsProcessingTopup(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/developer/wallet/topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: devUser?.token ? `Bearer ${devUser.token}` : ''
        },
        body: JSON.stringify({
          developer_id: devUser?.id,
          amount: finalAmount,
          payment_method: paymentMethod
        })
      });

      const json = await res.json();
      if (json.status) {
        setSuccessMsg(`Successfully funded ₦${finalAmount.toLocaleString()} to your Cargo Wallet!`);
        setShowTopupModal(false);
        setCustomAmount('');
        await fetchWalletData();
      } else {
        setErrorMsg(json.error || 'Failed to process wallet top-up.');
      }
    } catch {
      setErrorMsg('Network error during wallet funding.');
    } finally {
      setIsProcessingTopup(false);
    }
  };

  const handleSimulateInboundTransfer = async () => {
    setIsSimulatingNip(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/developer/wallet/virtual-transfer-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developer_id: devUser?.id,
          amount: simNipAmount,
          sender_name: simSenderName,
          sender_bank: simSenderBank
        })
      });

      const json = await res.json();
      if (json.status) {
        setSuccessMsg(`Inbound NIP transfer simulated successfully! Credited ₦${simNipAmount.toLocaleString()} to wallet.`);
        setShowNipSimModal(false);
        await fetchWalletData();
      } else {
        setErrorMsg(json.error || 'Simulation failed.');
      }
    } catch {
      setErrorMsg('Network error during bank transfer simulation.');
    } finally {
      setIsSimulatingNip(false);
    }
  };

  const handleSaveCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumberInput.trim() || !cardHolderInput.trim()) {
      setErrorMsg('Please enter valid card details.');
      return;
    }

    setIsSavingCard(true);
    setErrorMsg(null);

    try {
      const [expM, expY] = cardExpiryInput.split('/');
      const res = await fetch('/api/v1/developer/wallet/save-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: devUser?.token ? `Bearer ${devUser.token}` : ''
        },
        body: JSON.stringify({
          developer_id: devUser?.id,
          card_number: cardNumberInput,
          cardholder_name: cardHolderInput,
          expiry_month: expM || '12',
          expiry_year: expY || '28',
          cvv: cardCvvInput,
          auto_reload_enabled: true,
          auto_reload_threshold: autoReloadThreshold,
          auto_reload_amount: autoReloadAmount
        })
      });

      const json = await res.json();
      if (json.status) {
        setSuccessMsg('Debit card tokenized and linked securely. Auto-reload is now configured.');
        setShowSaveCardModal(false);
        await fetchWalletData();
      } else {
        setErrorMsg(json.error || 'Failed to save card.');
      }
    } catch {
      setErrorMsg('Network error saving debit card.');
    } finally {
      setIsSavingCard(false);
    }
  };

  const handleRemoveCard = async () => {
    if (!confirm('Are you sure you want to disconnect this saved card? Automated auto-reload will be disabled.')) return;
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/developer/wallet/remove-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: devUser?.token ? `Bearer ${devUser.token}` : ''
        },
        body: JSON.stringify({ developer_id: devUser?.id })
      });
      const json = await res.json();
      if (json.status) {
        setSuccessMsg('Card removed successfully. Auto-reload disabled.');
        await fetchWalletData();
      }
    } catch {
      setErrorMsg('Failed to remove card.');
    }
  };

  const handleUpdateAutoReload = async (enabledOverride?: boolean, thresholdOverride?: number, amountOverride?: number) => {
    setIsUpdatingAutoReload(true);
    setErrorMsg(null);

    const isEnabled = enabledOverride !== undefined ? enabledOverride : autoReloadEnabled;
    const targetThreshold = thresholdOverride !== undefined ? thresholdOverride : (customThresholdInput ? Number(customThresholdInput) : autoReloadThreshold);
    const targetAmount = amountOverride !== undefined ? amountOverride : (customReloadAmountInput ? Number(customReloadAmountInput) : autoReloadAmount);

    try {
      const res = await fetch('/api/v1/developer/wallet/auto-reload-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: devUser?.token ? `Bearer ${devUser.token}` : ''
        },
        body: JSON.stringify({
          developer_id: devUser?.id,
          enabled: isEnabled,
          trigger_threshold: targetThreshold,
          reload_amount: targetAmount
        })
      });

      const json = await res.json();
      if (json.status) {
        setSuccessMsg(json.message || 'Auto-reload settings updated successfully.');
        setAutoReloadEnabled(isEnabled);
        setAutoReloadThreshold(targetThreshold);
        setAutoReloadAmount(targetAmount);
        setCustomThresholdInput('');
        setCustomReloadAmountInput('');
        await fetchWalletData();
      } else {
        setErrorMsg(json.error || 'Failed to update auto-reload settings.');
      }
    } catch {
      setErrorMsg('Network error updating auto-reload settings.');
    } finally {
      setIsUpdatingAutoReload(false);
    }
  };

  const handleChargeSavedCard = async (amountToCharge?: number) => {
    setIsChargingSavedCard(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/developer/wallet/charge-saved-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: devUser?.token ? `Bearer ${devUser.token}` : ''
        },
        body: JSON.stringify({
          developer_id: devUser?.id,
          amount: amountToCharge || autoReloadAmount || 10000
        })
      });

      const json = await res.json();
      if (json.status) {
        setSuccessMsg(json.message || 'Saved card charged successfully!');
        if (showTopupModal) setShowTopupModal(false);
        await fetchWalletData();
      } else {
        setErrorMsg(json.error || 'Failed to charge saved card.');
      }
    } catch {
      setErrorMsg('Network error charging saved card.');
    } finally {
      setIsChargingSavedCard(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/developer/wallet/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: devUser?.token ? `Bearer ${devUser.token}` : ''
        },
        body: JSON.stringify({
          developer_id: devUser?.id,
          auto_topup_threshold: thresholdInput
        })
      });
      const json = await res.json();
      if (json.status) {
        setSuccessMsg('Low-balance notification threshold saved.');
        await fetchWalletData();
      }
    } catch {
      setErrorMsg('Could not save threshold settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const isStepBApproved = devUser?.live_status === 'approved';
  const balance = wallet?.balance ?? 0;
  const availableWaybills = wallet?.available_live_waybills ?? Math.floor(balance / 200);

  // Filter transactions
  const filteredTransactions = (wallet?.recent_transactions || []).filter(tx => {
    if (filterType !== 'all' && tx.type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (tx.reference || '').toLowerCase().includes(q) ||
        (tx.description || '').toLowerCase().includes(q) ||
        (tx.tracking_code || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const exportCSV = () => {
    if (!wallet?.recent_transactions?.length) return;
    const headers = ['Date', 'Reference', 'Type', 'Amount', 'Balance Before', 'Balance After', 'Channel', 'Description', 'Tracking Code'];
    const rows = wallet.recent_transactions.map(tx => [
      new Date(tx.created_at).toISOString(),
      tx.reference,
      tx.type,
      tx.amount,
      tx.balance_before,
      tx.balance_after,
      tx.channel,
      `"${(tx.description || '').replace(/"/g, '""')}"`,
      tx.tracking_code || ''
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Waybilla_Cargo_Wallet_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fadeIn w-full max-w-full">
      {/* 4-Step Milestone Progress Bar */}
      <div className="bg-white border border-slate-100 rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
              Production Gateway &bull; Step C
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-[#0A1F44] mt-1.5 flex items-center gap-2">
              <Wallet className="w-6 h-6 text-blue-600" />
              Pre-Funded API Cargo Billing Wallet
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchWalletData}
              disabled={isLoading}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Refresh wallet balance"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {balance >= 200 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Wallet Funded &bull; Ready for Live Dispatch
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                Deposit Required (Min ₦1,000)
              </span>
            )}
          </div>
        </div>

        {/* Milestone Steps Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2">
          {/* Step A */}
          <div className="p-3 bg-emerald-50/90 border border-emerald-200 rounded-2xl flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
              ✓
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black text-emerald-950 truncate">Step A: Sandbox</p>
              <p className="text-[10px] text-emerald-700 truncate">Isolated Keys &bull; Passed</p>
            </div>
          </div>

          {/* Step B */}
          <div
            onClick={() => onSwitchTab('compliance')}
            className={`p-3 rounded-2xl flex items-center gap-2.5 border cursor-pointer transition-all ${
              isStepBApproved
                ? 'bg-emerald-50/90 border-emerald-200 hover:border-emerald-300'
                : 'bg-amber-50 border-amber-300 hover:border-amber-400'
            }`}
          >
            <div className={`w-6 h-6 rounded-full font-black text-xs flex items-center justify-center shrink-0 ${
              isStepBApproved ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
            }`}>
              {isStepBApproved ? '✓' : 'B'}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black text-slate-900 truncate">Step B: Business KYC</p>
              <p className="text-[10px] text-slate-600 truncate">
                {isStepBApproved ? 'CAC Verified ✓' : 'Under Review / Submit'}
              </p>
            </div>
          </div>

          {/* Step C (Current) */}
          <div className="p-3 bg-blue-50 border-2 border-blue-500 rounded-2xl flex items-center gap-2.5 text-blue-950 shadow-xs">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
              {balance >= 200 ? '✓' : 'C'}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black truncate">Step C: Cargo Wallet</p>
              <p className="text-[10px] text-blue-700 truncate font-bold">
                {balance >= 200 ? `Funded (₦${balance.toLocaleString()})` : 'Active Configuration'}
              </p>
            </div>
          </div>

          {/* Step D */}
          <div
            onClick={() => {
              if (isStepBApproved && balance >= 1000) {
                onSwitchTab('keys');
              }
            }}
            className={`p-3 rounded-2xl flex items-center gap-2.5 border transition-all ${
              isStepBApproved && balance >= 1000
                ? 'bg-purple-50 border-purple-200 text-purple-950 cursor-pointer hover:border-purple-300'
                : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <div className={`w-6 h-6 rounded-full font-black text-xs flex items-center justify-center shrink-0 ${
              isStepBApproved && balance >= 1000 ? 'bg-purple-600 text-white' : 'bg-slate-300 text-slate-600'
            }`}>
              D
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black truncate">Step D: Live Key Reveal</p>
              <p className="text-[10px] truncate">
                {isStepBApproved && balance >= 1000 ? 'Unlocked & Ready!' : 'Locked Until Step B & C'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Step B Prerequisite Notice if not yet approved */}
      {!isStepBApproved && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-amber-900">Step B Compliance Required for Live Dispatch</p>
              <p className="text-amber-800 text-[11px] mt-0.5">
                While you can test wallet top-ups and virtual account transfers in sandbox preview, production live dispatch keys are strictly unlocked after CAC Business Verification is certified.
              </p>
            </div>
          </div>
          <button
            onClick={() => onSwitchTab('compliance')}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl transition-colors shrink-0 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            Complete Step B Verification <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Alerts */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Notice</p>
            <p className="text-rose-700">{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-start gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Success</p>
            <p className="text-emerald-700">{successMsg}</p>
          </div>
        </div>
      )}

      {/* TOP ROW: HERO BALANCE CARD + VIRTUAL NUBAN CARD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 1. Hero Balance & Capacity Card (7 cols) */}
        <div className="lg:col-span-7 bg-gradient-to-br from-[#0A1F44] via-[#0E2A5C] to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-blue-900/60 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-blue-300 bg-blue-500/20 px-2.5 py-1 rounded-full border border-blue-400/30">
                  Nigerian Naira &bull; Dedicated Ledger
                </span>
              </div>
              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                balance >= 2000
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                  : balance >= 200
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
              }`}>
                {balance >= 2000 ? '● Active Capacity' : balance >= 200 ? '● Low Balance' : '● Depleted'}
              </span>
            </div>

            <div>
              <p className="text-xs text-slate-300">Live Cargo Wallet Balance</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
                  ₦{balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Capacity</span>
                <p className="text-base font-black text-emerald-400 mt-0.5">
                  {availableWaybills} <span className="text-xs font-normal text-slate-300">Waybills</span>
                </p>
                <span className="text-[9px] text-slate-400">At ₦200 manifest fee</span>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Total Billed</span>
                <p className="text-base font-black text-white mt-0.5">
                  {wallet?.total_manifests_billed ?? 0} <span className="text-xs font-normal text-slate-300">Shipments</span>
                </p>
                <span className="text-[9px] text-slate-400">
                  ₦{(wallet?.total_cargo_wallet_spent ?? 0).toLocaleString()} spent
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={() => setShowTopupModal(true)}
              className="w-full sm:w-auto flex-1 bg-[#F2A93B] hover:bg-amber-400 text-slate-950 font-black text-xs py-3.5 px-5 rounded-2xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              Fund Cargo Wallet
            </button>

            <button
              onClick={() => setShowNipSimModal(true)}
              className="w-full sm:w-auto bg-white/10 hover:bg-white/15 text-white font-black text-xs py-3.5 px-4 rounded-2xl transition-all cursor-pointer border border-white/10 flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              Simulate Bank Transfer (NIP)
            </button>
          </div>
        </div>

        {/* 2. Virtual Bank Account Card (5 cols) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-800 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black tracking-wide text-white">Dedicated Virtual NUBAN</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Instant Settlement
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Transfer directly from GTBank, Zenith, Access, Kuda, Moniepoint, OPay or any Nigerian banking app.
            </p>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2.5">
                <span className="text-[11px] text-slate-400 font-mono">Bank Name</span>
                <span className="text-xs font-bold text-white">
                  {wallet?.virtual_account?.bank_name || 'Providus Bank / Wema NUBAN'}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-700/60 pb-2.5">
                <span className="text-[11px] text-slate-400 font-mono">Account Number</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-black text-amber-300 tracking-wider">
                    {wallet?.virtual_account?.account_number || '7820194821'}
                  </span>
                  <button
                    onClick={handleCopyAccount}
                    className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors cursor-pointer"
                    title="Copy account number"
                  >
                    {copiedAccount ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-mono">Beneficiary Name</span>
                <span className="text-xs font-bold text-white truncate max-w-[180px]">
                  {wallet?.virtual_account?.account_name || `Waybilla - ${devUser?.merchant_name || 'Merchant'}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Automated webhook updates your cargo wallet within 3 seconds of bank transfer.</span>
          </div>
        </div>
      </div>

      {/* MANIFEST CLEARANCE RATE CARD (Step C Rules) */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Transparent Pricing</span>
            <h3 className="text-lg font-black text-[#0A1F44]">
              Automated Manifest Clearance Fee Structure
            </h3>
          </div>
          <div className="text-right self-start sm:self-auto">
            <span className="text-2xl font-black text-[#0A1F44]">₦200</span>
            <span className="text-xs text-slate-500 font-bold block sm:inline sm:ml-1">/ live waybill</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
            <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
              1
            </div>
            <h4 className="text-xs font-bold text-slate-900">Motor Park Loading Manifest</h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Registers parcel on union driver departure logs across verified Nigerian motor parks.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
            <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
              2
            </div>
            <h4 className="text-xs font-bold text-slate-900">Recipient SMS &amp; PIN Dispatch</h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Instant carrier SMS with secure 6-digit pickup PIN dispatched to customer phone automatically.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
            <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">
              3
            </div>
            <h4 className="text-xs font-bold text-slate-900">Digital GPS Milestone Tracking</h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Live tracking URL generated for e-commerce order confirmation &amp; real-time recipient status.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
            <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
              4
            </div>
            <h4 className="text-xs font-bold text-slate-900">Zero Monthly Subscription</h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Pay purely as you dispatch. Unused wallet credit never expires and carries over permanently.
            </p>
          </div>
        </div>

        {/* Protection policy callout */}
        <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-start gap-3 text-xs text-blue-950">
          <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-blue-900">Automated Balance Guard (Zero Loophole Guarantee)</p>
            <p className="text-blue-800 text-[11px] leading-relaxed">
              Calls to <code>POST /api/v1/waybills</code> verify wallet balance in an atomic transaction. If balance falls below ₦200, the API safely responds with <code>402 Payment Required</code> without disrupting existing parcels, protecting your integration from unpaid park dispatch liabilities.
            </p>
          </div>
        </div>
      </div>

      {/* SAVED DEBIT CARD & MERCHANT-CONTROLLED AUTO-RELOAD SECTION */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-black text-[#0A1F44]">
                Saved Debit Card &amp; Automated Auto-Reload
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                Optional
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Connect a debit card so your e-commerce platform automatically re-funds your cargo wallet when balance drops below your chosen threshold.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => handleUpdateAutoReload(!autoReloadEnabled)}
              disabled={isUpdatingAutoReload || !wallet?.saved_card?.is_saved}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                autoReloadEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  : wallet?.saved_card?.is_saved
                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${autoReloadEnabled ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
              {autoReloadEnabled ? 'Auto-Reload ON' : 'Auto-Reload OFF'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Linked Card Visual or Setup Card (5 cols) */}
          <div className="lg:col-span-5 space-y-3.5">
            <label className="text-xs font-black text-slate-900 block">Payment Method Status</label>
            {wallet?.saved_card?.is_saved ? (
              <div className="relative overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0A1F44] text-white rounded-3xl p-6 shadow-lg border border-slate-700 space-y-5">
                {/* Chip Graphic and Brand */}
                <div className="flex items-center justify-between">
                  <div className="w-10 h-7 rounded-md bg-amber-400/80 border border-amber-300 flex items-center justify-center">
                    <div className="w-8 h-5 border border-amber-600/40 rounded-sm grid grid-cols-2 gap-0.5 p-0.5">
                      <div className="bg-amber-500/50 rounded-xs" />
                      <div className="bg-amber-500/50 rounded-xs" />
                    </div>
                  </div>
                  <span className="text-sm font-black italic tracking-wider text-white uppercase">
                    {wallet.saved_card.brand || 'Mastercard'}
                  </span>
                </div>

                {/* Card Number Mask */}
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-mono">Linked Card</span>
                  <p className="text-lg font-mono font-bold tracking-widest text-slate-100 mt-0.5">
                    •••• •••• •••• {wallet.saved_card.last4 || '4242'}
                  </p>
                </div>

                {/* Cardholder & Expiry */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-700/60">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase block font-mono">Cardholder</span>
                    <span className="font-bold text-slate-200 truncate max-w-[150px] block">
                      {wallet.saved_card.cardholder_name || devUser?.merchant_name || 'Enterprise Merchant'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 uppercase block font-mono">Expires</span>
                    <span className="font-bold font-mono text-slate-200">
                      {wallet.saved_card.exp_month || '12'}/{wallet.saved_card.exp_year || '28'}
                    </span>
                  </div>
                </div>

                {/* Issuing Bank & Actions */}
                <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-700/40">
                  <span className="text-[10px] text-slate-400 truncate">
                    {wallet.saved_card.bank || 'Guaranty Trust Bank (GTBank)'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleChargeSavedCard(5000)}
                      disabled={isChargingSavedCard}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      title="Charge ₦5,000 from saved card"
                    >
                      {isChargingSavedCard ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Zap className="w-2.5 h-2.5 fill-slate-950" />}
                      Test Charge ₦5k
                    </button>
                    <button
                      onClick={handleRemoveCard}
                      className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-3xl p-6 text-center space-y-3 bg-slate-50/50">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">No Debit Card Linked</h4>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-0.5">
                    Link your Visa, Mastercard, or Verve card to enable automated low-balance renewals.
                  </p>
                </div>
                <button
                  onClick={() => setShowSaveCardModal(true)}
                  className="bg-[#0A1F44] hover:bg-blue-900 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  + Link Debit Card
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Merchant Configuration (Threshold & Reload Amount) (7 cols) */}
          <div className="lg:col-span-7 bg-slate-50/80 border border-slate-200/80 rounded-3xl p-5 sm:p-6 space-y-5">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                Merchant-Controlled Rules
              </span>
              <h4 className="text-sm font-black text-[#0A1F44] mt-1.5">
                Configure Your Automatic Renewal Triggers
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                You decide exactly when your card should charge and how much credit to add each time.
              </p>
            </div>

            {/* 1. Low-Balance Trigger Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800">
                  1. Trigger Threshold (When balance drops below):
                </label>
                <span className="text-xs font-black text-blue-700 font-mono">
                  ₦{autoReloadThreshold.toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[1000, 2000, 5000, 10000].map((th) => (
                  <button
                    key={th}
                    type="button"
                    onClick={() => {
                      setAutoReloadThreshold(th);
                      setCustomThresholdInput('');
                    }}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                      !customThresholdInput && autoReloadThreshold === th
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ₦{th.toLocaleString()}
                  </button>
                ))}
              </div>
              <div className="relative pt-1">
                <span className="absolute left-3 top-1/2 font-bold text-slate-400 text-xs">₦</span>
                <input
                  type="number"
                  min={500}
                  step={500}
                  placeholder="Or enter custom trigger threshold (e.g. 3500)"
                  value={customThresholdInput}
                  onChange={(e) => {
                    setCustomThresholdInput(e.target.value);
                    if (e.target.value) setAutoReloadThreshold(Number(e.target.value));
                  }}
                  className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 2. Top-Up Reload Amount */}
            <div className="space-y-2 pt-1 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800">
                  2. Reload Amount (Charge saved card for):
                </label>
                <span className="text-xs font-black text-emerald-700 font-mono">
                  ₦{autoReloadAmount.toLocaleString()} ({Math.floor(autoReloadAmount / 200)} waybills)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { amt: 5000, waybills: 25 },
                  { amt: 10000, waybills: 50 },
                  { amt: 25000, waybills: 125 },
                  { amt: 50000, waybills: 250 }
                ].map((item) => (
                  <button
                    key={item.amt}
                    type="button"
                    onClick={() => {
                      setAutoReloadAmount(item.amt);
                      setCustomReloadAmountInput('');
                    }}
                    className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                      !customReloadAmountInput && autoReloadAmount === item.amt
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <p className="text-xs font-black">₦{item.amt.toLocaleString()}</p>
                    <p className={`text-[9px] ${!customReloadAmountInput && autoReloadAmount === item.amt ? 'text-emerald-100' : 'text-slate-500'}`}>
                      {item.waybills} waybills
                    </p>
                  </button>
                ))}
              </div>
              <div className="relative pt-1">
                <span className="absolute left-3 top-1/2 font-bold text-slate-400 text-xs">₦</span>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  placeholder="Or enter custom reload amount (e.g. 15000)"
                  value={customReloadAmountInput}
                  onChange={(e) => {
                    setCustomReloadAmountInput(e.target.value);
                    if (e.target.value) setAutoReloadAmount(Number(e.target.value));
                  }}
                  className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Summary explanation */}
            <div className="p-3 bg-white rounded-2xl border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
              <span className="font-bold text-slate-900">Summary: </span>
              {autoReloadEnabled && wallet?.saved_card?.is_saved ? (
                <>
                  When your wallet drops below <strong className="text-blue-700">₦{autoReloadThreshold.toLocaleString()}</strong>, your linked {wallet.saved_card.brand || 'debit'} card will automatically charge <strong className="text-emerald-700">₦{autoReloadAmount.toLocaleString()}</strong> ({Math.floor(autoReloadAmount / 200)} live waybills). Your API calls will never experience <code>402</code> interruptions.
                </>
              ) : (
                <>
                  Auto-reload is currently inactive. You can top up your wallet manually using your virtual bank account (<code>{wallet?.virtual_account?.account_number || '7820194821'}</code>) or debit card.
                </>
              )}
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={() => handleUpdateAutoReload()}
                disabled={isUpdatingAutoReload}
                className="bg-[#0A1F44] hover:bg-blue-900 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                {isUpdatingAutoReload ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save Auto-Reload Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* LEDGER TRANSACTIONS HISTORY TABLE */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-black text-[#0A1F44]">
              Immutable Cargo Wallet Ledger
            </h3>
            <p className="text-xs text-slate-500">
              Complete auditable record of all credits, top-ups, and automated manifest deductions.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={exportCSV}
              disabled={!wallet?.recent_transactions?.length}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              Download Statement (.CSV)
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterType === 'all' ? 'bg-white text-[#0A1F44] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Transactions
            </button>
            <button
              onClick={() => setFilterType('credit')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterType === 'credit' ? 'bg-white text-[#0A1F44] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Credits (Top-ups)
            </button>
            <button
              onClick={() => setFilterType('debit')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterType === 'debit' ? 'bg-white text-[#0A1F44] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Debits (Manifest Fees)
            </button>
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Search reference, tracking code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-mono uppercase tracking-wider text-[10px]">
                <th className="py-3 px-2">Date &amp; Time</th>
                <th className="py-3 px-2">Reference</th>
                <th className="py-3 px-2">Type</th>
                <th className="py-3 px-2">Description</th>
                <th className="py-3 px-2 text-right">Amount</th>
                <th className="py-3 px-2 text-right">Balance After</th>
                <th className="py-3 px-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                    No transactions found in ledger. Top up your wallet to record your first credit.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isCredit = tx.type === 'credit';
                  return (
                    <tr key={tx.id || tx.reference} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-2 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3.5 px-2 font-mono text-[11px] text-slate-900 font-bold whitespace-nowrap">
                        {tx.reference}
                      </td>
                      <td className="py-3.5 px-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          isCredit
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {isCredit ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-slate-700 max-w-xs truncate">
                        {tx.description}
                        {tx.tracking_code && (
                          <span className="ml-1 font-mono text-blue-600 font-bold">[{tx.tracking_code}]</span>
                        )}
                      </td>
                      <td className={`py-3.5 px-2 text-right font-black whitespace-nowrap ${
                        isCredit ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isCredit ? '+' : '-'}₦{Number(tx.amount || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-2 text-right font-mono text-slate-600 whitespace-nowrap">
                        ₦{Number(tx.balance_after || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-2 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Settled
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* THRESHOLD & ALERT SETTINGS */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-7 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-black text-[#0A1F44]">Low-Balance Dispatch Alert Threshold</h3>
        </div>
        <p className="text-xs text-slate-600">
          Receive proactive email alerts when your cargo wallet balance drops below this amount so your automated e-commerce dispatches never encounter <code>402 Payment Required</code> interruptions.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          <div className="relative w-full sm:w-72">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">₦</span>
            <input
              type="number"
              min={1000}
              step={500}
              value={thresholdInput}
              onChange={(e) => setThresholdInput(Number(e.target.value))}
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={isSavingSettings}
            className="w-full sm:w-auto bg-[#0A1F44] hover:bg-blue-900 text-white font-black text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            {isSavingSettings ? 'Saving...' : 'Save Notification Threshold'}
          </button>
        </div>
      </div>

      {/* TOP-UP MODAL */}
      {showTopupModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl border border-slate-100 my-auto max-h-[90vh] flex flex-col animate-scaleUp">
            {/* Header (Sticky / Top) */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Instant Wallet Top-Up
                </span>
                <h3 className="text-base sm:text-lg font-black text-[#0A1F44] mt-1">
                  Fund API Cargo Billing Wallet
                </h3>
              </div>
              <button
                onClick={() => setShowTopupModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleTopupSubmit} className="overflow-y-auto space-y-5 pr-1 pt-4 flex-1">
              {/* Presets */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-slate-900 block">Select Top-Up Amount</label>
                  <span className="text-[11px] font-bold text-slate-500 font-mono">
                    Rate: ₦200 / waybill
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { amount: 5000, waybills: 25, label: '₦5,000' },
                    { amount: 10000, waybills: 50, label: '₦10,000 (Recommended)' },
                    { amount: 25000, waybills: 125, label: '₦25,000' },
                    { amount: 50000, waybills: 250, label: '₦50,000' }
                  ].map((preset) => (
                    <button
                      key={preset.amount}
                      type="button"
                      onClick={() => {
                        setTopupAmount(preset.amount);
                        setCustomAmount('');
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        !customAmount && topupAmount === preset.amount
                          ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-xs font-black text-[#0A1F44]">{preset.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{preset.waybills} live waybills</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom amount */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Or enter custom amount (Min ₦500)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">₦</span>
                  <input
                    type="number"
                    min={500}
                    step={100}
                    placeholder="e.g. 15000"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Payment Methods (Clearly Explained with 3 distinct options) */}
              <div>
                <label className="text-xs font-black text-slate-900 block mb-1">
                  Choose How You Want to Pay:
                </label>
                <p className="text-[11px] text-slate-500 mb-2.5">
                  Select one of the 3 payment channels below:
                </p>

                <div className="space-y-2.5">
                  {/* Method 1: Saved Debit Card (Only if linked) */}
                  {wallet?.saved_card?.is_saved && (
                    <label className={`block p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      paymentMethod === 'saved_card'
                        ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="payment_method"
                          checked={paymentMethod === 'saved_card'}
                          onChange={() => setPaymentMethod('saved_card')}
                          className="text-amber-600 mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900">
                              Method 1: Saved {wallet.saved_card.brand || 'Card'} (•••• {wallet.saved_card.last4 || '4242'})
                            </span>
                            <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-md">
                              ⚡ 1-Click
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            <strong>Instant charge:</strong> Debits your linked {wallet.saved_card.brand} token immediately without typing card numbers or waiting for an OTP.
                          </p>
                        </div>
                      </div>
                    </label>
                  )}

                  {/* Method 2: Dedicated Virtual Bank Transfer (NIP) */}
                  <label className={`block p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    paymentMethod === 'bank_transfer'
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="payment_method"
                        checked={paymentMethod === 'bank_transfer'}
                        onChange={() => setPaymentMethod('bank_transfer')}
                        className="text-blue-600 mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-900">
                            {wallet?.saved_card?.is_saved ? 'Method 2:' : 'Method 1:'} Direct Bank Transfer (NIP)
                          </span>
                          <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                            🏦 Mobile App
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          <strong>Transfer from your Bank App:</strong> Transfer funds directly to your dedicated Waybilla virtual NUBAN account. Automatically credits in seconds.
                        </p>

                        {/* Interactive Bank Details if selected */}
                        {paymentMethod === 'bank_transfer' && (
                          <div className="mt-3 p-3 bg-white rounded-xl border border-blue-200 text-xs space-y-1.5 shadow-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 text-[11px]">Bank:</span>
                              <span className="font-bold text-slate-900">{wallet?.virtual_account?.bank_name || 'Providus Bank / Wema Bank'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 text-[11px]">Account No:</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-black text-blue-700 text-sm tracking-wide">
                                  {wallet?.virtual_account?.account_number || '7820194821'}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    navigator.clipboard.writeText(wallet?.virtual_account?.account_number || '7820194821');
                                    setCopiedAccount(true);
                                    setTimeout(() => setCopiedAccount(false), 2000);
                                  }}
                                  className="px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-[10px] font-bold cursor-pointer"
                                >
                                  {copiedAccount ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 text-[11px]">Account Name:</span>
                              <span className="font-bold text-slate-800 text-[11px]">
                                {wallet?.virtual_account?.account_name || 'WAYBILLA - Sandbox'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </label>

                  {/* Method 3: Paystack / Nigerian Debit Card */}
                  <label className={`block p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    paymentMethod === 'paystack'
                      ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="payment_method"
                        checked={paymentMethod === 'paystack'}
                        onChange={() => setPaymentMethod('paystack')}
                        className="text-emerald-600 mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-900">
                            {wallet?.saved_card?.is_saved ? 'Method 3:' : 'Method 2:'} Paystack Gateway (Card / USSD / QR)
                          </span>
                          <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                            💳 Checkout
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          <strong>One-Time Checkout:</strong> Pay with any new Mastercard, Visa, Verve card, or bank USSD code (*737#, *894#, *901#) via standard Paystack modal.
                        </p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Buttons (Fixed / Visible at bottom) */}
              <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowTopupModal(false)}
                  className="w-1/2 py-3 rounded-xl border border-slate-200 text-xs font-black text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingTopup}
                  className="w-1/2 py-3 rounded-xl bg-[#F2A93B] hover:bg-amber-400 text-slate-950 text-xs font-black transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                >
                  {isProcessingTopup ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Confirm &bull; ₦{Number(customAmount ? Number(customAmount) : (topupAmount || 0)).toLocaleString()}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SAVE / LINK DEBIT CARD MODAL */}
      {showSaveCardModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-7 shadow-2xl border border-slate-100 my-auto max-h-[90vh] flex flex-col animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  Secure Tokenization
                </span>
                <h3 className="text-base font-black text-[#0A1F44] mt-1">
                  Link Nigerian Debit Card
                </h3>
              </div>
              <button
                onClick={() => setShowSaveCardModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 pt-3 flex-1">
              <p className="text-xs text-slate-600 leading-relaxed">
                Your card is tokenized via Paystack PCI-DSS Level 1 compliant gateway. Card credentials are never stored in plaintext on our servers.
              </p>

              <form onSubmit={handleSaveCardSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Cardholder Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chukwudi Okafor Enterprise"
                    value={cardHolderInput}
                    onChange={(e) => setCardHolderInput(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Card Number (Mastercard / Visa / Verve)</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      maxLength={19}
                      placeholder="5399 •••• •••• ••••"
                      value={cardNumberInput}
                      onChange={(e) => setCardNumberInput(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-800 block mb-1">Expiry (MM/YY)</label>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      placeholder="12/28"
                      value={cardExpiryInput}
                      onChange={(e) => setCardExpiryInput(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-800 block mb-1">CVV / CVC</label>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        maxLength={4}
                        placeholder="•••"
                        value={cardCvvInput}
                        onChange={(e) => setCardCvvInput(e.target.value)}
                        className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                {/* Auto-Reload Preference note */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2 text-[11px] text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Linking will activate Auto-Reload at your specified threshold (₦{Number(autoReloadThreshold || 0).toLocaleString()}) to reload ₦{Number(autoReloadAmount || 0).toLocaleString()} automatically.
                  </span>
                </div>

                <div className="pt-2 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowSaveCardModal(false)}
                    className="w-1/2 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingCard}
                    className="w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1"
                  >
                    {isSavingCard ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Save & Link Card'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SIMULATE INBOUND NIP MODAL (Testing Tool) */}
      {showNipSimModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-7 shadow-2xl border border-slate-100 my-auto max-h-[90vh] flex flex-col space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Sandbox Testing Tool
                </span>
                <h3 className="text-base font-black text-[#0A1F44] mt-1">
                  Simulate Inbound NIP Bank Transfer
                </h3>
              </div>
              <button
                onClick={() => setShowNipSimModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-3.5 pr-1 flex-1">
              <p className="text-xs text-slate-600 leading-relaxed">
                This triggers the simulated NIBSS switch webhook hitting your dedicated virtual account (<code>{wallet?.virtual_account?.account_number || '7820194821'}</code>).
              </p>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Transfer Amount (₦)</label>
                  <input
                    type="number"
                    value={simNipAmount}
                    onChange={(e) => setSimNipAmount(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Originating Sender Name</label>
                  <input
                    type="text"
                    value={simSenderName}
                    onChange={(e) => setSimSenderName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Originating Bank</label>
                  <select
                    value={simSenderBank}
                    onChange={(e) => setSimSenderBank(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Access Bank Plc</option>
                    <option>Guaranty Trust Bank (GTBank)</option>
                    <option>Zenith Bank Plc</option>
                    <option>Kuda Microfinance Bank</option>
                    <option>Moniepoint Microfinance Bank</option>
                    <option>OPay Digital Services</option>
                    <option>First Bank of Nigeria</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowNipSimModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSimulateInboundTransfer}
                  disabled={isSimulatingNip}
                  className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1"
                >
                  {isSimulatingNip ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Simulate Transfer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
