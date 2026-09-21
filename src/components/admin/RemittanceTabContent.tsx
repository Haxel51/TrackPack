import React, { useState, useEffect } from 'react';
import {
  Wallet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Building2,
  Clock,
  Check,
  X,
  FileText,
  DollarSign,
  ArrowRight,
  Loader2,
  ShieldAlert,
  Search,
  Lock,
  Unlock
} from 'lucide-react';
import {
  getAdminPendingRemittances,
  approveAdminRemittance,
  rejectAdminRemittance
} from '../../lib/api';

interface RemittanceTabContentProps {
  token: string | null;
}

export const RemittanceTabContent: React.FC<RemittanceTabContentProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [companiesHealth, setCompaniesHealth] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Processing action state
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Filter / Search
  const [searchQuery, setSearchQuery] = useState('');

  const loadRemittances = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminPendingRemittances(token);
      if (res && res.success) {
        setSubmissions(res.pending_remittances || []);
        setCompaniesHealth(res.all_companies_remittance_health || []);
      } else {
        setError(res?.error || 'Failed to load remittance records');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching remittances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRemittances();
  }, [token]);

  const handleApprove = async (id: string, companyName: string, amount: number) => {
    if (!token) return;
    setProcessingId(id);
    setError(null);
    setActionSuccess(null);
    try {
      const res = await approveAdminRemittance(token, id);
      if (res && res.success) {
        setActionSuccess(`✓ Approved ₦${amount.toLocaleString()} for "${companyName}". Terminal unlocked immediately!`);
        await loadRemittances();
      } else {
        setError(res?.error || 'Failed to approve remittance');
      }
    } catch (err: any) {
      setError(err.message || 'Error processing approval');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!token) return;
    setProcessingId(id);
    setError(null);
    setActionSuccess(null);
    try {
      const res = await rejectAdminRemittance(token, id, rejectReason || 'Transfer proof could not be verified on bank statement');
      if (res && res.success) {
        setActionSuccess(`Proof rejected. Transport company has been notified to re-submit or pay online.`);
        setRejectingId(null);
        setRejectReason('');
        await loadRemittances();
      } else {
        setError(res?.error || 'Failed to reject remittance');
      }
    } catch (err: any) {
      setError(err.message || 'Error processing rejection');
    } finally {
      setProcessingId(null);
    }
  };

  // Quick unlock company directly
  const handleDirectUnlock = async (companyId: string, companyName: string) => {
    if (!token) return;
    setProcessingId(`unlock-${companyId}`);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/unlock-terminal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setActionSuccess(`Terminal for "${companyName}" unlocked manually!`);
        await loadRemittances();
      } else {
        setError(data.error || 'Failed to unlock company');
      }
    } catch (err: any) {
      setError(err.message || 'Error unlocking terminal');
    } finally {
      setProcessingId(null);
    }
  };

  const totalPendingProofs = submissions.length;
  const totalOutstandingDebt = companiesHealth.reduce((acc, c) => acc + (Number(c.pending_cash_remittance_debt) || 0), 0);
  const totalSuspendedCompanies = companiesHealth.filter(c => c.is_suspended).length;

  const filteredCompanies = companiesHealth.filter(c => 
    (c.company_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.park_location || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in" id="remittance-tab-content">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#0A1F44] to-indigo-950 text-white rounded-3xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-indigo-900/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-400" />
              Daily Cash Remittance Subsystem (70/30 Split)
            </h2>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
              Financial Control
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Verify manual corporate bank transfer proofs (Part B), monitor transport park debt collection, and manage automatic terminal locks across all partner parks.
          </p>
        </div>

        <button
          onClick={loadRemittances}
          disabled={loading}
          className="bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Pending Proofs */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-black uppercase tracking-wider">Pending Bank Proofs</span>
            <FileText className={`w-4 h-4 ${totalPendingProofs > 0 ? 'text-orange-500 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div className="text-3xl font-black text-[#0A1F44]">
            {totalPendingProofs}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Manual transfers awaiting bank statement review
          </p>
        </div>

        {/* Total Platform Debt Due */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-black uppercase tracking-wider">Total Platform Share Due</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-emerald-700">
            ₦{totalOutstandingDebt.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            70% tracking fee balance accumulated across parks
          </p>
        </div>

        {/* Suspended Terminals */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-black uppercase tracking-wider">Suspended Terminals</span>
            <ShieldAlert className={`w-4 h-4 ${totalSuspendedCompanies > 0 ? 'text-red-500' : 'text-slate-400'}`} />
          </div>
          <div className={`text-3xl font-black ${totalSuspendedCompanies > 0 ? 'text-red-600' : 'text-[#0A1F44]'}`}>
            {totalSuspendedCompanies}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Parks past 24-hour cutoff awaiting settlement
          </p>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl flex items-center gap-3 text-xs font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-3 text-xs font-bold">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SECTION 1: PENDING MANUAL BANK TRANSFER PROOFS */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-[#0A1F44]">
              Pending Bank Transfer Verifications (Part B)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review transfer references against corporate Zenith/Moniepoint statements before approving.
            </p>
          </div>
          <span className="text-xs font-extrabold bg-orange-100 text-orange-900 px-3 py-1 rounded-full">
            {totalPendingProofs} Pending
          </span>
        </div>

        {submissions.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="font-bold text-slate-700 text-sm">All Clear! No Pending Transfer Submissions.</p>
            <p className="text-[11px] text-slate-400">All transport companies are settled or remitting instantly via Part A Paystack.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((sub: any) => (
              <div
                key={sub.id}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:border-blue-300 transition-colors"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-base text-[#0A1F44]">
                      {sub.company_name || 'Transport Park'}
                    </span>
                    <span className="text-xs font-black bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full">
                      ₦{(sub.amount || 0).toLocaleString()} Due
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Bank Used</span>
                      <span className="font-extrabold text-slate-800">{sub.bank_name || 'Bank Transfer'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Sender Account Name</span>
                      <span className="font-extrabold text-slate-800">{sub.sender_account_name || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Transfer Reference / Session ID</span>
                      <span className="font-black text-[#0A1F44] font-mono tracking-wider">{sub.transfer_reference}</span>
                    </div>
                  </div>

                  {sub.notes && (
                    <p className="text-[11px] text-slate-500 bg-white p-2 rounded-lg border border-slate-200">
                      <strong>Notes:</strong> {sub.notes}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2.5 w-full lg:w-auto shrink-0">
                  {rejectingId === sub.id ? (
                    <div className="flex items-center gap-2 w-full lg:w-auto">
                      <input
                        type="text"
                        placeholder="Rejection reason..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-red-500 w-full sm:w-48"
                      />
                      <button
                        onClick={() => handleReject(sub.id)}
                        disabled={processingId === sub.id}
                        className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs px-3 py-2 rounded-xl cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectReason('');
                        }}
                        className="text-xs text-slate-500 hover:text-slate-700 p-2 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setRejectingId(sub.id)}
                        disabled={processingId === sub.id}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(sub.id, sub.company_name, sub.amount)}
                        disabled={processingId === sub.id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {processingId === sub.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Unlocking...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve & Unlock Terminal</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: TRANSPORT COMPANIES CASH DEBT & TERMINAL STATUS */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-[#0A1F44]">
              Transport Park Terminal Status & Ledger
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live debt balance, retained profits, and automated lock indicators.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search park or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0A1F44]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px]">
              <tr>
                <th className="p-3">Company / Park</th>
                <th className="p-3">Pending Remittance (70%)</th>
                <th className="p-3">Park Retained Profit (30%)</th>
                <th className="p-3">Grace Expiry</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Terminal Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredCompanies.map((c: any) => {
                const debt = Number(c.pending_cash_remittance_debt) || 0;
                const isSusp = Boolean(c.is_suspended);
                return (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="p-3">
                      <div className="font-extrabold text-[#0A1F44]">{c.company_name}</div>
                      <span className="text-[11px] text-slate-400">{c.park_location || 'Branch'} • {c.owner_phone || ''}</span>
                    </td>
                    <td className="p-3 font-black text-sm">
                      <span className={debt > 0 ? 'text-orange-800' : 'text-slate-500'}>
                        ₦{debt.toLocaleString()}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-emerald-700">
                      ₦{(Number(c.company_profit_retained) || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-[11px] text-slate-500">
                      {c.daily_grace_expires_at ? new Date(c.daily_grace_expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="p-3">
                      {isSusp ? (
                        <span className="bg-red-100 text-red-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                          <Lock className="w-3 h-3 text-red-600" />
                          SUSPENDED
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                          <Unlock className="w-3 h-3 text-emerald-600" />
                          ACTIVE
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {isSusp ? (
                        <button
                          onClick={() => handleDirectUnlock(c.id, c.company_name)}
                          disabled={processingId === `unlock-${c.id}`}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {processingId === `unlock-${c.id}` ? 'Unlocking...' : 'Unlock Terminal'}
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-normal">Unlocked</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
