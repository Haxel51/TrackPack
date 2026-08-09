import React, { useState } from 'react';
import {
  Search,
  Phone,
  Copy,
  Check,
  Building2,
  User,
  MapPin,
  FileText,
  AlertCircle,
  Loader2,
  ExternalLink
} from 'lucide-react';

interface RecoveryTabContentProps {
  token: string | null;
}

export const RecoveryTabContent: React.FC<RecoveryTabContentProps> = ({ token }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<any | null>(null);

  // Reset code states
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setError('Please enter a phone number to search.');
      return;
    }

    setSearching(true);
    setError(null);
    setAccount(null);
    setGeneratedCode(null);

    try {
      const res = await fetch(`/api/admin/recovery/search?phone_number=${encodeURIComponent(phoneNumber.trim())}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Account not found.');
      } else {
        setAccount(data);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!account) return;

    setGenerating(true);
    setError(null);
    setGeneratedCode(null);

    try {
      const res = await fetch('/api/admin/recovery/generate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: account.type,
          id: account.id
        })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to generate reset code.');
      } else {
        setGeneratedCode(data.code);
      }
    } catch (err) {
      console.error('Generate code error:', err);
      setError('Failed to generate reset code. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6" id="recovery-tab-content">
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
        
        {/* Header Title */}
        <div className="border-b border-slate-50 pb-3">
          <h3 className="text-sm font-extrabold text-[#0A1F44] uppercase tracking-wider flex items-center gap-1.5">
            <Phone className="w-4.5 h-4.5 text-[#F2A93B]" />
            <span>Customer & Company Account Recovery Panel</span>
          </h3>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Search for any registered customer or company owner account by phone number to assist in manual credential resets.
          </p>
        </div>

        {/* Search Bar Form */}
        <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <Phone className="w-4 h-4" />
            </span>
            <input
              type="tel"
              placeholder="Enter phone number (e.g. 08012345678)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-3 pl-12 pr-4 text-xs font-semibold placeholder-slate-400 outline-none transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="bg-[#0A1F44] hover:bg-[#143265] text-white font-extrabold px-5 py-3 rounded-2xl text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Search</span>
          </button>
        </form>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl text-xs font-bold flex items-center gap-2 max-w-md">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Account Found Details */}
        {account && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            
            {/* Account Metadata Card */}
            <div className="bg-slate-50/50 border border-slate-100 p-6 rounded-3xl space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  account.type === 'customer' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {account.type === 'customer' ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                </div>
                <div>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    account.type === 'customer' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {account.type === 'customer' ? 'Customer Account' : 'Company Owner'}
                  </span>
                  <h4 className="text-base font-black text-[#0A1F44] mt-1">
                    {account.type === 'customer' ? 'Registered Shipper/Receiver' : account.company_name}
                  </h4>
                </div>
              </div>

              <div className="space-y-2 text-xs pt-2">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-bold">Phone Number</span>
                  <span className="font-extrabold text-[#0A1F44]">{account.phone_number}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-bold">Registered Date</span>
                  <span className="font-extrabold text-[#0A1F44]">
                    {account.created_at ? new Date(account.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>

                {/* Customers recent waybills */}
                {account.type === 'customer' && (
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                      Recent Shipment Tracking Codes
                    </span>
                    {account.tracking_codes && account.tracking_codes.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {account.tracking_codes.map((code: string) => (
                          <span
                            key={code}
                            className="bg-white border border-slate-200 text-[#0A1F44] px-2.5 py-1 rounded-lg font-extrabold text-[11px] hover:border-[#0A1F44] transition-all cursor-default"
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 font-bold italic">
                        No recent waybills linked to this phone number.
                      </p>
                    )}
                  </div>
                )}

                {/* Companies active parks */}
                {account.type === 'company' && (
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                      Active Terminal Parks
                    </span>
                    {account.parks && account.parks.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {account.parks.map((park: string) => (
                          <span
                            key={park}
                            className="bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1"
                          >
                            <MapPin className="w-3 h-3 text-emerald-600" />
                            <span>{park}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 font-bold italic">
                        No registered parks found for this company.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Reset Code Generator Controls */}
            <div className="bg-[#FAFAFA] border border-slate-200/60 p-6 rounded-3xl flex flex-col justify-center items-center text-center space-y-4">
              {!generatedCode ? (
                <div className="space-y-3 w-full">
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-[#F2A93B]">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-[#0A1F44] uppercase tracking-wider">
                      Assisted PIN/Password Reset
                    </h5>
                    <p className="text-[11px] text-slate-400 font-semibold max-w-xs mx-auto mt-1 leading-relaxed">
                      Generate a unique 6-digit verification code. Share this code with the user over WhatsApp so they can set their new password.
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateCode}
                    disabled={generating}
                    className="w-full max-w-xs bg-[#F2A93B] hover:bg-[#d9922b] text-[#0A1F44] font-extrabold py-3 px-4 rounded-2xl text-xs transition-colors flex items-center justify-center gap-2 mx-auto cursor-pointer disabled:opacity-50"
                  >
                    {generating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Generate Reset Code</span>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4 w-full animate-fadeIn">
                  <div>
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full">
                      Code Active — Valid for 30 Mins
                    </span>
                    <h5 className="text-[11px] text-slate-400 font-bold uppercase mt-2">
                      Admin Recovery Code
                    </h5>
                  </div>

                  <div className="bg-white border border-slate-200 py-3.5 px-6 rounded-2xl flex items-center justify-center gap-4 max-w-xs mx-auto shadow-sm">
                    <span className="text-3xl font-black tracking-widest text-[#0A1F44] font-mono select-all">
                      {generatedCode}
                    </span>
                    <button
                      onClick={copyToClipboard}
                      className="text-slate-400 hover:text-[#0A1F44] transition-colors p-1 rounded-lg hover:bg-slate-50 cursor-pointer"
                      title="Copy Code"
                    >
                      {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>

                  <div className="space-y-2 max-w-xs mx-auto">
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                      Copy and message this code to the user via WhatsApp. The user must navigate to the **Reset Password** page, verify their phone and code, and input their new credentials.
                    </p>
                    
                    <a
                      href={`https://wa.me/${(account?.phone_number || account?.owner_phone || account?.phone || '').replace(/\D/g, '')}?text=Hi,%20this%20is%20Waybilla%20Admin.%20Here%20is%20your%20temporary%20account%20recovery%20code:%20${generatedCode}.%20It%20expires%20in%2030%20minutes.%20You%20can%20reset%20your%20password/PIN%20here:%20https://waybilla.com.ng/reset-password`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-[#25D366] hover:bg-[#20ba59] text-white font-extrabold text-xs py-2.5 px-4 rounded-xl transition-all shadow-sm cursor-pointer mt-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Message on WhatsApp</span>
                    </a>
                  </div>
                </div>
              )}

            </div>

          </div>
        )}

      </div>
    </div>
  );
};
