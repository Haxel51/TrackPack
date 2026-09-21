import React, { useState } from 'react';
import {
  Key,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  Wallet,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Shield,
  Zap,
  Server,
  FileCode,
  Layers,
  ChevronRight,
  Info,
  Sparkles
} from 'lucide-react';
import { DeveloperSession } from '../pages/DeveloperPortal';

interface DeveloperLiveKeyTabProps {
  devUser: DeveloperSession | null;
  onSwitchTab: (tab: 'overview' | 'simulator' | 'keys' | 'compliance' | 'wallet' | 'docs' | 'live-key') => void;
  onAccountUpdated: (user: DeveloperSession) => void;
}

export const DeveloperLiveKeyTab: React.FC<DeveloperLiveKeyTabProps> = ({
  devUser,
  onSwitchTab,
  onAccountUpdated
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);

  // Prerequisites check
  const isKycApproved = devUser?.live_status === 'approved';
  const walletBalance = Number(devUser?.cargo_wallet_balance ?? 0);
  const isWalletFunded = walletBalance >= 1000;
  const isStepDUnlocked = isKycApproved && isWalletFunded;
  const hasGeneratedKey = !!(devUser?.live_key || devUser?.has_live_key);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Generate Live Key
  const handleGenerateKey = async () => {
    if (!devUser) {
      setErrorMsg('Please register or sign in first.');
      return;
    }
    if (!isKycApproved) {
      setErrorMsg('Business KYC (Step B) approval is required first.');
      return;
    }
    if (!isWalletFunded) {
      setErrorMsg('Cargo Wallet pre-funding of at least ₦1,000 (Step C) is required.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/v1/developer/generate-live-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(devUser.token ? { Authorization: `Bearer ${devUser.token}` } : {})
        },
        body: JSON.stringify({ developer_id: devUser.id })
      });
      const data = await res.json();
      if (!res.ok || !data.status) {
        throw new Error(data.error || 'Failed to generate live API key.');
      }

      const generatedKey = data.data.live_key;
      const masked = data.data.live_key_masked;
      setRevealedKey(generatedKey);
      setShowSecretModal(true);

      const updated: DeveloperSession = {
        ...devUser,
        live_key: generatedKey,
        live_key_masked: masked,
        has_live_key: true,
        live_key_unlocked: true
      };
      onAccountUpdated(updated);
      setSuccessMsg('Production Live API Key generated successfully! Be sure to copy and store it safely.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not generate live API key.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Rotate Live Key
  const handleRotateKey = async () => {
    if (!devUser?.id) return;
    setIsRotating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/v1/developer/rotate-live-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(devUser.token ? { Authorization: `Bearer ${devUser.token}` } : {})
        },
        body: JSON.stringify({ developer_id: devUser.id })
      });
      const data = await res.json();
      if (!res.ok || !data.status) {
        throw new Error(data.error || 'Failed to rotate live key.');
      }

      const generatedKey = data.data.live_key;
      const masked = data.data.live_key_masked;
      setRevealedKey(generatedKey);
      setShowSecretModal(true);
      setRotateConfirmOpen(false);

      const updated: DeveloperSession = {
        ...devUser,
        live_key: generatedKey,
        live_key_masked: masked,
        has_live_key: true
      };
      onAccountUpdated(updated);
      setSuccessMsg('Production Live Key rotated! Old credentials have been immediately revoked.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not rotate live key.');
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">&times;</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-700 hover:text-rose-900 font-bold">&times;</button>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                Step D &bull; Production Activation
              </span>
              {isStepDUnlocked ? (
                <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Ready to Activate
                </span>
              ) : (
                <span className="text-[10px] font-extrabold bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3 text-orange-600" /> Prerequisites Required
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#0A1F44] mt-2 flex items-center gap-2">
              <Key className="w-6 h-6 text-emerald-600" />
              Live API Key Generation &amp; Dispatch Activation
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Generate your production secret key to dispatch real interstate cargo across Nigerian motor parks. API calls made with this key will debit ₦200 manifest fees from your Cargo Wallet in real-time.
            </p>
          </div>

          <button
            onClick={() => onSwitchTab('docs')}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 shrink-0 self-start sm:self-auto bg-blue-50 px-3.5 py-2 rounded-xl border border-blue-100 transition-colors"
          >
            <FileCode className="w-3.5 h-3.5" />
            View API Docs &rarr;
          </button>
        </div>

        {/* Live Key Prerequisites Stepper Checklist */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Step D Activation Prerequisites Checklist
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Step A Status */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${devUser ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-600'}`}>
                {devUser ? <Check className="w-4 h-4 text-emerald-700" /> : 'A'}
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-black text-slate-900">Step A: Sandbox Profile</h4>
                  {devUser && <span className="text-[10px] font-bold text-emerald-600">Passed</span>}
                </div>
                <p className="text-[11px] text-slate-500">
                  {devUser ? `Active for ${devUser.merchant_name}` : 'Developer sign up required'}
                </p>
              </div>
            </div>

            {/* Step B Status */}
            <div className={`border rounded-2xl p-4 flex items-start gap-3 transition-colors ${
              isKycApproved
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : devUser?.live_status === 'pending_verification'
                ? 'bg-orange-50/70 border-orange-200 text-orange-950'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}>
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                isKycApproved
                  ? 'bg-emerald-200 text-emerald-900'
                  : devUser?.live_status === 'pending_verification'
                  ? 'bg-orange-200 text-orange-900'
                  : 'bg-slate-200 text-slate-600'
              }`}>
                {isKycApproved ? <Check className="w-4 h-4 text-emerald-800" /> : 'B'}
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black">Step B: Business KYC</h4>
                  <span className={`text-[10px] font-black uppercase ${
                    isKycApproved ? 'text-emerald-700' : devUser?.live_status === 'pending_verification' ? 'text-orange-700' : 'text-slate-500'
                  }`}>
                    {isKycApproved ? 'Approved' : devUser?.live_status === 'pending_verification' ? 'Under Review' : 'Pending'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  {isKycApproved ? 'CAC & Director identity verified' : 'Submit CAC & Director ID'}
                </p>
                {!isKycApproved && (
                  <button
                    onClick={() => onSwitchTab('compliance')}
                    className="text-[11px] font-black text-blue-700 hover:underline flex items-center gap-1 pt-1"
                  >
                    Go to Step B KYC &rarr;
                  </button>
                )}
              </div>
            </div>

            {/* Step C Status */}
            <div className={`border rounded-2xl p-4 flex items-start gap-3 transition-colors ${
              isWalletFunded
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}>
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                isWalletFunded
                  ? 'bg-emerald-200 text-emerald-900'
                  : 'bg-slate-200 text-slate-600'
              }`}>
                {isWalletFunded ? <Check className="w-4 h-4 text-emerald-800" /> : 'C'}
              </div>
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black">Step C: Cargo Wallet</h4>
                  <span className={`text-[10px] font-black uppercase ${
                    isWalletFunded ? 'text-emerald-700' : 'text-slate-500'
                  }`}>
                    {isWalletFunded ? `₦${walletBalance.toLocaleString()}` : 'Min ₦1,000'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  {isWalletFunded ? `${Math.floor(walletBalance / 200)} live manifests available` : 'Pre-fund wallet for manifest billing'}
                </p>
                {!isWalletFunded && (
                  <button
                    onClick={() => onSwitchTab('wallet')}
                    className="text-[11px] font-black text-blue-700 hover:underline flex items-center gap-1 pt-1"
                  >
                    Fund Wallet (Step C) &rarr;
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STEP D KEY CONSOLE CARD */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 text-white border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Server className="w-4 h-4" />
              </div>
              <h3 className="text-base font-black text-white">Production Live Secret Key</h3>
              {hasGeneratedKey ? (
                <span className="text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Live &bull; Active
                </span>
              ) : isStepDUnlocked ? (
                <span className="text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Unlock className="w-3 h-3 text-blue-400" /> Unlocked &bull; Ready to Generate
                </span>
              ) : (
                <span className="text-[10px] font-extrabold bg-orange-500/20 text-orange-300 border border-orange-400/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Lock className="w-3 h-3 text-orange-400" /> Locked (Complete Steps B &amp; C)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Use this key in your backend servers (<code className="text-emerald-300">Authorization: Bearer wb_live_...</code>) to book live physical waybills across all 36 Nigerian states.
            </p>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            {isStepDUnlocked ? (
              hasGeneratedKey ? (
                <>
                  <button
                    onClick={() => setRotateConfirmOpen(true)}
                    disabled={isRotating}
                    className="text-xs font-bold text-slate-300 hover:text-white px-3.5 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
                    Rotate Key
                  </button>
                  <button
                    onClick={handleGenerateKey}
                    disabled={isGenerating}
                    className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5" />
                    {isGenerating ? 'Regenerating...' : 'Regenerate Key'}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleGenerateKey}
                  disabled={isGenerating}
                  className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  <Key className="w-4 h-4" />
                  {isGenerating ? 'Generating Live Key...' : 'Generate Production Live Key'}
                </button>
              )
            ) : !isKycApproved ? (
              <button
                onClick={() => onSwitchTab('compliance')}
                className="bg-[#F7941D] hover:bg-orange-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Shield className="w-3.5 h-3.5" />
                Complete Step B KYC
              </button>
            ) : (
              <button
                onClick={() => onSwitchTab('wallet')}
                className="bg-[#F7941D] hover:bg-orange-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Wallet className="w-3.5 h-3.5" />
                Fund Step C Cargo Wallet (Min ₦1,000)
              </button>
            )}
          </div>
        </div>

        {/* Live Key String Display */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold">Live API Secret Key</span>
            {hasGeneratedKey && (
              <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Ready for Production API Traffic
              </span>
            )}
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs overflow-x-auto">
            <div className="text-emerald-400 select-all break-all">
              {revealedKey ? (
                <span>{revealedKey}</span>
              ) : devUser?.live_key ? (
                <span>{devUser.live_key}</span>
              ) : devUser?.live_key_masked ? (
                <span className="text-slate-400">{devUser.live_key_masked}</span>
              ) : (
                <span className="text-slate-500">wb_live_••••••••••••••••••••••••••••••••</span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {(revealedKey || devUser?.live_key) && (
                <button
                  onClick={() => handleCopy(revealedKey || devUser?.live_key || '', 'live_tab')}
                  className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedField === 'live_tab' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Key</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Environment Details Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase">Live Manifest Fee</p>
            <p className="text-sm font-black text-white mt-0.5">₦200 <span className="text-xs font-normal text-slate-400">/ waybill</span></p>
            <p className="text-[10px] text-slate-400 mt-1">Deducted from Cargo Wallet in real-time</p>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase">Available Live Dispatches</p>
            <p className="text-sm font-black text-emerald-400 mt-0.5">
              {Math.floor(walletBalance / 200)} <span className="text-xs font-normal text-slate-400">Waybills remaining</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Based on ₦{walletBalance.toLocaleString()} balance</p>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase">Endpoint URL</p>
            <p className="text-xs font-mono font-bold text-blue-300 mt-1 truncate select-all">
              https://waybilla.com.ng/api/v1
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Secure HTTPS connection required</p>
          </div>
        </div>

        {/* Security & Integration Best Practices */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-2 leading-relaxed">
          <div className="flex items-center gap-2 text-orange-400 font-bold">
            <ShieldAlert className="w-4 h-4" />
            <span>Production Security Standards</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
            <li>Store this secret key strictly in server environment variables (e.g. <code className="text-emerald-300">process.env.WAYBILLA_LIVE_SECRET_KEY</code>).</li>
            <li>Never expose live secret keys in React/Vue/mobile frontends or public GitHub repositories.</li>
            <li>If your key is compromised, use the <strong>Rotate Key</strong> feature above to immediately invalidate the old secret and generate a replacement.</li>
          </ul>
        </div>
      </div>

      {/* Interactive Live Request Preview Code Snippet */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-black text-[#0A1F44]">Production Request Example</h3>
            <p className="text-xs text-slate-500">Ready-to-copy Node.js implementation with your live key header</p>
          </div>

          <button
            onClick={() => {
              const code = `// Node.js Production Waybill Dispatch
const response = await fetch("https://waybilla.com.ng/api/v1/waybills", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${devUser?.live_key || 'wb_live_your_secret_key'}"
  },
  body: JSON.stringify({
    sender_name: "${devUser?.merchant_name || 'Apex Fulfillment Dispatch'}",
    sender_phone: "08031234567",
    receiver_name: "Emeka Okonkwo",
    receiver_phone: "08129876543",
    item_description: "Order #84920 - Electronics & Accessories",
    origin_park: "Nnewi Central Park",
    destination_park: "Enugu Holy Ghost Park",
    declared_value: 45000
  })
});

const waybill = await response.json();
console.log("Tracking Code:", waybill.data.tracking_code);
console.log("Pickup PIN:", waybill.data.pickup_pin);`;
              handleCopy(code, 'node_live_snippet');
            }}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
          >
            {copiedField === 'node_live_snippet' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">Copied Code</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        <pre className="bg-slate-950 text-emerald-400 p-4 sm:p-5 rounded-2xl text-[11px] sm:text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
{`// 🚀 Production Live Waybill Creation
const response = await fetch("https://waybilla.com.ng/api/v1/waybills", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${devUser?.live_key || 'wb_live_your_secret_key'}"
  },
  body: JSON.stringify({
    sender_name: "${devUser?.merchant_name || 'Apex Fulfillment Dispatch'}",
    sender_phone: "08031234567",
    receiver_name: "Emeka Okonkwo",
    receiver_phone: "08129876543",
    item_description: "Customer Parcel: Fashion & Electronics",
    origin_park: "Nnewi Central Park",
    destination_park: "Enugu Holy Ghost Park",
    declared_value: 45000
  })
});

const waybill = await response.json();
console.log("Manifest Tracking Code:", waybill.data.tracking_code);
console.log("Recipient Pickup PIN:", waybill.data.pickup_pin);`}
        </pre>
      </div>

      {/* ONE-TIME LIVE KEY SECRET MODAL */}
      {showSecretModal && revealedKey && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 text-white animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Save Your Live Secret Key</h3>
                  <p className="text-xs text-slate-400">Step D Live Production API Key Generated</p>
                </div>
              </div>
              <button
                onClick={() => setShowSecretModal(false)}
                className="text-slate-400 hover:text-white text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-xs text-orange-200 flex items-start gap-2.5 leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 text-orange-400 mt-0.5" />
              <span>
                <strong>Important Security Notice:</strong> Please copy and store this API key safely in your backend environment (e.g., <code>.env</code>). For security purposes, this secret key will not be displayed again in full.
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Live API Key</label>
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl font-mono text-xs text-emerald-400 break-all select-all flex items-center justify-between gap-3">
                <span>{revealedKey}</span>
                <button
                  onClick={() => handleCopy(revealedKey, 'modal_live_key')}
                  className="shrink-0 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedField === 'modal_live_key' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowSecretModal(false)}
                className="w-full py-3 bg-[#F7941D] hover:bg-orange-400 text-slate-950 font-black text-sm rounded-2xl transition-colors shadow-sm cursor-pointer text-center"
              >
                I Have Safely Saved My Secret Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROTATION CONFIRMATION MODAL */}
      {rotateConfirmOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 text-white animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Rotate Live Secret Key?</h3>
                <p className="text-xs text-slate-400">Immediate token revocation</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Rotating your Live Secret Key will <strong>instantly invalidate your current live key</strong>. Any server or application using the old key will fail until updated with the new one.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRotateConfirmOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleRotateKey}
                disabled={isRotating}
                className="px-4 py-2 text-xs font-black bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-colors flex items-center gap-1.5"
              >
                {isRotating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                Yes, Rotate Key Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
