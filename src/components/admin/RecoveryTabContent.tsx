import React, { useState } from 'react';
import {
  Search,
  Phone,
  Copy,
  Check,
  Building2,
  User,
  UserCheck,
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
  
  // New State: list of returned accounts from search
  const [searchResult, setSearchResult] = useState<any | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);

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
    setSearchResult(null);
    setSelectedAccount(null);
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
        setSearchResult(data);
        if (data.accounts && data.accounts.length > 0) {
          // Auto-select the first account
          setSelectedAccount(data.accounts[0]);
        }
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!selectedAccount) return;

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
          type: selectedAccount.type,
          id: selectedAccount.id
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
          <h3 className="text-lg font-black text-[#0A1F44]">
            Account Recovery Center
          </h3>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Search users, managers, staff, or company accounts by their phone number and generate recovery codes.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="flex gap-3 max-w-md">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
              <Phone className="w-4 h-4" />
            </span>
            <input
              type="tel"
              placeholder="Enter Phone Number (e.g. 080...)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={searching}
              className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-3.5 pl-11 pr-4 text-xs font-semibold placeholder-slate-400 outline-none transition-all disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="bg-[#0A1F44] hover:bg-[#07152e] text-white font-extrabold text-xs px-6 rounded-2xl transition-colors shrink-0 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
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

        {/* Search Results */}
        {searchResult && searchResult.accounts && searchResult.accounts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            
            {/* Accounts Found List */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                Matching Accounts Found ({searchResult.accounts.length})
              </h4>
              
              <div className="space-y-3">
                {searchResult.accounts.map((acc: any) => {
                  const isSelected = selectedAccount?.id === acc.id && selectedAccount?.type === acc.type;
                  
                  return (
                    <div
                      key={`${acc.type}-${acc.id}`}
                      onClick={() => {
                        setSelectedAccount(acc);
                        setGeneratedCode(null);
                      }}
                      className={`border p-4 rounded-2xl transition-all cursor-pointer text-left space-y-3 ${
                        isSelected
                          ? 'border-[#0A1F44] bg-[#0A1F44]/5 ring-1 ring-[#0A1F44]'
                          : 'border-slate-100 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            acc.type === 'customer' ? 'bg-indigo-50 text-indigo-600' :
                            acc.type === 'company' ? 'bg-emerald-50 text-emerald-600' :
                            acc.type === 'manager' ? 'bg-amber-50 text-amber-600' :
                            'bg-blue-50 text-blue-600'
                          }`}>
                            {acc.type === 'customer' ? <User className="w-4 h-4" /> :
                             acc.type === 'company' ? <Building2 className="w-4 h-4" /> :
                             acc.type === 'manager' ? <UserCheck className="w-4 h-4" /> :
                             <User className="w-4 h-4" />}
                          </div>
                          <div>
                            <h5 className="text-xs font-black text-[#0A1F44] truncate max-w-[150px]">
                              {acc.type === 'customer' ? 'Shipper/Receiver' : acc.name || acc.company_name}
                            </h5>
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                              {acc.phone_number}
                            </p>
                          </div>
                        </div>

                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                          acc.type === 'customer' ? 'bg-indigo-100 text-indigo-800' :
                          acc.type === 'company' ? 'bg-emerald-100 text-emerald-800' :
                          acc.type === 'manager' ? 'bg-amber-100 text-amber-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {acc.type === 'customer' ? 'Customer' :
                           acc.type === 'company' ? 'Company Owner' :
                           acc.type === 'manager' ? 'Park Manager' :
                           'Park Staff'}
                        </span>
                      </div>

                      {/* Metadata for selection */}
                      <div className="text-[11px] text-slate-500 font-medium pl-1 border-l-2 border-slate-200">
                        {acc.type === 'customer' && (
                          <div>
                            <span className="font-bold text-slate-400">Shipments Checked:</span>{' '}
                            <span className="font-extrabold text-[#0A1F44]">
                              {acc.tracking_codes?.length || 0} trackings
                            </span>
                          </div>
                        )}
                        {acc.type === 'company' && (
                          <div>
                            <span className="font-bold text-slate-400">Active Parks:</span>{' '}
                            <span className="font-extrabold text-[#0A1F44]">
                              {acc.parks?.length || 0} parks ({acc.parks?.join(', ') || 'none'})
                            </span>
                          </div>
                        )}
                        {(acc.type === 'manager' || acc.type === 'staff') && (
                          <div className="space-y-0.5">
                            <div>
                              <span className="font-bold text-slate-400">Company:</span>{' '}
                              <span className="font-extrabold text-[#0A1F44]">{acc.company_name}</span>
                            </div>
                            <div>
                              <span className="font-bold text-slate-400">Terminal Location:</span>{' '}
                              <span className="font-extrabold text-[#0A1F44]">{acc.park_location}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reset Code Generator Controls */}
            <div className="bg-[#FAFAFA] border border-slate-200/60 p-6 rounded-3xl flex flex-col justify-center items-center text-center space-y-4 self-start">
              {selectedAccount ? (
                <div className="w-full space-y-4">
                  <div className="bg-slate-100 border border-slate-200/50 p-4 rounded-2xl text-left">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      Selected Recovery Target
                    </p>
                    <p className="text-xs font-black text-[#0A1F44] mt-1">
                      {selectedAccount.type === 'customer' ? 'Customer Account' : selectedAccount.name || selectedAccount.company_name}
                    </p>
                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                      Role: <span className="font-extrabold capitalize text-indigo-600">{selectedAccount.type}</span> | Phone: {selectedAccount.phone_number}
                    </p>
                  </div>

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
                          Generate a unique 6-digit verification code. Share this code with the user over WhatsApp so they can set their new password or PIN.
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
                          href={`https://wa.me/${(selectedAccount.phone_number || '').replace(/\D/g, '')}?text=Hi,%20this%20is%20Waybilla%20Admin.%20Here%20is%20your%20temporary%20account%20recovery%20code:%20${generatedCode}.%20It%20expires%20in%2030%20minutes.%20You%20can%20reset%20your%20password/PIN%20here:%20https://waybilla.com.ng/reset-password`}
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
              ) : (
                <div className="text-slate-400 py-10 font-medium text-xs">
                  Select an account from the matches list to generate a reset code.
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
