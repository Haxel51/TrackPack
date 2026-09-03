import React, { useState, useEffect } from 'react';
import { getPaymentHistory } from '../api';
import {
  CreditCard,
  Loader2,
  AlertCircle,
  ShieldAlert,
  Calendar,
  Truck,
  User,
  Hash,
  DollarSign,
  CheckCircle2,
} from 'lucide-react';

interface PaymentHistoryViewProps {
  token: string;
  isCEO: boolean;
}

export const PaymentHistoryView: React.FC<PaymentHistoryViewProps> = ({ token, isCEO }) => {
  const [payments, setPayments] = useState<any[]>([]);
  const [totalCollected, setTotalCollected] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isCEO) {
      fetchHistory();
    } else {
      setIsLoading(false);
    }
  }, [token, isCEO]);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    const res = await getPaymentHistory(token);
    if (res.success) {
      setPayments(res.payments || []);
      setTotalCollected(res.total_collected || 0);
    } else {
      setError(res.error || 'Failed to load payment history');
    }
    setIsLoading(false);
  };

  if (!isCEO) {
    return (
      <div className="p-8 text-center bg-[#0b1329] border border-blue-950/60 rounded-3xl space-y-3 my-6">
        <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto" />
        <h3 className="text-base font-black text-white">Access Restricted</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Payment History and financial records are restricted exclusively to CEO/Owner roles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-blue-950/60 p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Fleet Payment History</h3>
            <p className="text-xs text-slate-400">Track all Paystack payments for trip activations and monthly plans</p>
          </div>
        </div>

        <div className="bg-[#070b19] border border-emerald-500/30 px-5 py-3 rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            ₦
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-400">Total Fees Paid</span>
            <div className="text-base font-black text-white">₦{totalCollected.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-300 text-xs font-medium">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 bg-[#0b1329] border border-blue-950/60 rounded-3xl">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-xs font-bold">Loading payment records...</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="py-16 text-center bg-[#0b1329] border border-blue-950/60 rounded-3xl space-y-3">
          <CreditCard className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-white">No Payment Records Yet</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Confirmed trip payments and monthly subscription renewals will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="bg-[#0b1329] border border-blue-950/60 rounded-3xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-blue-950/60 flex items-center justify-between">
            <span className="text-xs font-extrabold text-white uppercase tracking-wider">Transactions ({payments.length})</span>
            <span className="text-xs text-slate-400">Verified via Paystack API</span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {payments.map((payment) => {
              const isMonthly = payment.payment_plan === 'monthly';
              return (
                <div key={payment.id} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-[#070b19]/40 transition-colors">
                  <div className="flex items-start gap-3.5">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      isMonthly ? 'bg-orange-500/10 border border-orange-500/30 text-orange-400' : 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
                    }`}>
                      <CreditCard className="w-5 h-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-white">{payment.plate_number}</span>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                          isMonthly ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}>
                          {isMonthly ? 'Monthly Subscription (₦3,500)' : 'Per Trip (₦1,000)'}
                        </span>
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Confirmed</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-500" />
                          <span>Driver: {payment.driver_name}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>{new Date(payment.date).toLocaleString()}</span>
                        </span>
                        <span>•</span>
                        <span className="text-slate-500">Paid by: {payment.paid_by || 'Manager'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-blue-950/60">
                    <div className="text-base font-black text-emerald-400">
                      ₦{(payment.payment_amount || 0).toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Ref: {payment.payment_reference || 'N/A'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
