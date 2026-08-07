import React, { useState, useEffect } from 'react';
import { getStaffHistory } from '../../lib/api';
import { Waybill } from '../../types';
import {
  Receipt,
  Search,
  ArrowLeft,
  Filter,
  Calendar,
  Truck,
  Phone,
  MapPin,
  Key,
  CheckCircle2,
  Printer,
  X,
  FileText,
  Sparkles,
  RefreshCw,
  User,
  ShieldCheck,
  Send,
  Inbox
} from 'lucide-react';

interface WaybillHistoryProps {
  token: string;
  originPark: string;
  onBackToMenu: () => void;
}

export const WaybillHistory: React.FC<WaybillHistoryProps> = ({ token, originPark, onBackToMenu }) => {
  const [waybills, setWaybills] = useState<Waybill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'sent' | 'received'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<Waybill | null>(null);

  const isSamePark = (p1?: string, p2?: string) => {
    const s1 = (p1 || '').toLowerCase().trim();
    const s2 = (p2 || '').toLowerCase().trim();
    if (!s1 || !s2) return false;
    return s1 === s2 || s1.includes(s2) || s2.includes(s1);
  };

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStaffHistory(token);
      if (res.success && Array.isArray(res.waybills)) {
        setWaybills(res.waybills);
      } else {
        setError(res.error || 'Failed to load waybill history.');
      }
    } catch (err) {
      console.error('Error fetching staff history:', err);
      setError('Network error while fetching waybill history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token]);

  // Filter logic
  const filteredWaybills = waybills.filter(w => {
    // Tab filter
    if (filterTab === 'sent') {
      if (!isSamePark(w.origin_park, originPark)) return false;
    } else if (filterTab === 'received') {
      if (!isSamePark(w.destination_park, originPark) && w.status !== 'collected') return false;
    }

    // Search term
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (w.tracking_code || '').toLowerCase().includes(term) ||
      (w.sender_name || '').toLowerCase().includes(term) ||
      (w.sender_phone || '').toLowerCase().includes(term) ||
      (w.receiver_name || '').toLowerCase().includes(term) ||
      (w.receiver_phone || '').toLowerCase().includes(term) ||
      (w.item_description || '').toLowerCase().includes(term) ||
      (w.bus_number || '').toLowerCase().includes(term)
    );
  });

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-NG', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToMenu}
            className="p-2.5 hover:bg-slate-100 rounded-2xl text-slate-500 transition-colors cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-[#0A1F44] flex items-center gap-2">
              <Receipt className="w-6 h-6 text-[#F2A93B]" />
              Waybill History & Receipts 🧾
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Complete transaction logs and digital receipts for terminal <span className="text-[#0A1F44] font-extrabold">{originPark}</span>
            </p>
          </div>
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh History
        </button>
      </div>

      {/* Controls: Search & Tabs */}
      <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl gap-1">
            <button
              onClick={() => setFilterTab('all')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-[#0A1F44] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Logs ({waybills.length})
            </button>
            <button
              onClick={() => setFilterTab('sent')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                filterTab === 'sent'
                  ? 'bg-[#0A1F44] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              Sent Outgoing
            </button>
            <button
              onClick={() => setFilterTab('received')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                filterTab === 'received'
                  ? 'bg-[#0A1F44] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              Received / Handed Over
            </button>
          </div>

          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Tracking Code, Phone, Name, or Item..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-[#0A1F44] rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold focus:outline-none transition-all placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center space-y-3 shadow-sm">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-bold text-slate-500">Loading waybill transaction records...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-center text-rose-800 space-y-2">
          <p className="text-sm font-bold">{error}</p>
          <button
            onClick={fetchHistory}
            className="bg-rose-600 text-white font-bold px-4 py-2 rounded-xl text-xs hover:bg-rose-700 transition-colors cursor-pointer"
          >
            Try Again
          </button>
        </div>
      ) : filteredWaybills.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center space-y-3 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto text-slate-400">
            <Receipt className="w-8 h-8" />
          </div>
          <h3 className="text-base font-extrabold text-[#0A1F44]">No Waybill History Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
            {searchTerm
              ? `No transactions match "${searchTerm}". Try a different search keyword.`
              : 'When waybills are issued, dispatched, or collected at your park, their receipts and records will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWaybills.map(waybill => {
            const isSent = isSamePark(waybill.origin_park, originPark);
            const isCollected = waybill.status === 'collected';
            const isArrived = waybill.status === 'arrived';
            const isDeparted = waybill.status === 'departed';

            return (
              <div
                key={`history-wb-${waybill.id}`}
                className="bg-white border border-slate-100 hover:border-slate-300 rounded-3xl p-5 shadow-xs transition-all hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left side: Route & Tracking Code */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-[#0A1F44] text-[#F2A93B] font-black text-xs px-3 py-1 rounded-xl tracking-wider uppercase shadow-2xs">
                      {waybill.tracking_code || waybill.id.slice(0, 8)}
                    </span>

                    {/* Status Badge */}
                    {isCollected ? (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Handed Over / Collected ✓
                      </span>
                    ) : isArrived ? (
                      <span className="bg-amber-100 text-amber-900 border border-amber-200 font-extrabold text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-amber-600" />
                        Arrived Destination Park
                      </span>
                    ) : isDeparted ? (
                      <span className="bg-blue-100 text-blue-900 border border-blue-200 font-extrabold text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-blue-600" />
                        In Transit
                      </span>
                    ) : (
                      <span className="bg-purple-100 text-purple-900 border border-purple-200 font-extrabold text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        Booked & Loading
                      </span>
                    )}

                    {/* Sent/Received Badge */}
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                      isSent ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {isSent ? 'OUTGOING (SENT)' : 'INCOMING (RECEIVED)'}
                    </span>
                  </div>

                  {/* Route & Item */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="font-extrabold text-[#0A1F44] flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      {waybill.origin_park} &rarr; {waybill.destination_park}
                    </span>
                    <span className="text-slate-500 font-semibold">
                      Package: <strong className="text-slate-800">{waybill.item_description}</strong>
                    </span>
                    <span className="text-slate-400 font-medium">
                      Bus: <strong className="text-slate-700">{waybill.bus_number || 'Unassigned'}</strong>
                    </span>
                  </div>

                  {/* Sender & Receiver Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 font-bold uppercase text-[9px] block">Sender</span>
                      <span className="font-extrabold text-slate-800">{waybill.sender_name}</span> ({waybill.sender_phone})
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold uppercase text-[9px] block">Receiver</span>
                      <span className="font-extrabold text-slate-800">{waybill.receiver_name}</span> ({waybill.receiver_phone})
                    </div>
                  </div>

                  {/* Date */}
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-medium pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Booked: {formatDateTime(waybill.created_at || waybill.booked_at)}
                    </span>
                  </div>
                </div>

                {/* Right side: Action button */}
                <div className="flex md:flex-col items-center justify-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <button
                    onClick={() => setSelectedReceipt(waybill)}
                    className="w-full md:w-auto bg-[#0A1F44] hover:bg-blue-900 text-white font-extrabold text-xs px-4 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Receipt className="w-4 h-4 text-[#F2A93B]" />
                    Print Receipt 🧾
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Digital Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-[#0A1F44]/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 space-y-6 relative border border-slate-100">
            {/* Close button */}
            <button
              onClick={() => setSelectedReceipt(null)}
              className="absolute top-5 right-5 p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Receipt Content Printable Area */}
            <div id="printable-staff-receipt" className="space-y-6">
              {/* Receipt Header */}
              <div className="text-center border-b border-slate-100 pb-5 space-y-2">
                <div className="w-12 h-12 bg-[#0A1F44] rounded-2xl mx-auto flex items-center justify-center text-[#F2A93B] shadow-md">
                  <Receipt className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-[#0A1F44]">Waybilla Logistics</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Official Staff Waybill Transaction Receipt</p>
                <div className="inline-block bg-blue-50 text-blue-800 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider mt-1 border border-blue-200">
                  Ref: {selectedReceipt.tracking_code || selectedReceipt.id}
                </div>
              </div>

              {/* Waybill Status Banner */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center justify-between text-xs">
                <span className="text-slate-500 font-bold uppercase text-[10px]">Current Status</span>
                <span className="font-extrabold text-[#0A1F44] capitalize">
                  {selectedReceipt.status === 'collected' ? '✓ Delivered & Collected' : selectedReceipt.status}
                </span>
              </div>

              {/* Transaction Overview Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block font-bold uppercase text-[10px]">Origin Park</span>
                  <span className="font-extrabold text-[#0A1F44] text-sm block mt-0.5">{selectedReceipt.origin_park}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold uppercase text-[10px]">Destination Park</span>
                  <span className="font-extrabold text-[#0A1F44] text-sm block mt-0.5">{selectedReceipt.destination_park}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200">
                  <span className="text-slate-400 block font-bold uppercase text-[10px]">Item Description</span>
                  <span className="font-bold text-slate-800 text-sm block mt-0.5">{selectedReceipt.item_description}</span>
                </div>
              </div>

              {/* Parties Involved */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50/60 space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Sender</span>
                  <p className="font-extrabold text-slate-800 text-sm">{selectedReceipt.sender_name}</p>
                  <p className="text-slate-500 font-medium flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" /> {selectedReceipt.sender_phone}
                  </p>
                </div>
                <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50/60 space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Receiver</span>
                  <p className="font-extrabold text-slate-800 text-sm">{selectedReceipt.receiver_name}</p>
                  <p className="text-slate-500 font-medium flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" /> {selectedReceipt.receiver_phone}
                  </p>
                </div>
              </div>

              {/* Bus details */}
              <div className="border border-slate-100 p-4 rounded-2xl bg-blue-50/40 space-y-1.5 text-xs">
                <span className="text-[10px] font-black text-blue-900 uppercase tracking-wider block">Vehicle Allocation</span>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-bold">Assigned Bus:</span>
                  <span className="font-black text-[#0A1F44]">{selectedReceipt.bus_number || 'N/A'}</span>
                </div>
              </div>

              {/* Audit Timestamps */}
              <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Timestamp Audit</span>
                <div className="flex justify-between items-center text-slate-600 font-medium">
                  <span>Created / Booked:</span>
                  <span className="font-bold text-slate-800">{formatDateTime(selectedReceipt.created_at || selectedReceipt.booked_at)}</span>
                </div>
                {selectedReceipt.departed_at && (
                  <div className="flex justify-between items-center text-slate-600 font-medium">
                    <span>Departed Origin:</span>
                    <span className="font-bold text-slate-800">{formatDateTime(selectedReceipt.departed_at)}</span>
                  </div>
                )}
                {selectedReceipt.collected_at && (
                  <div className="flex justify-between items-center text-emerald-800 font-medium">
                    <span>Handed Over & Collected:</span>
                    <span className="font-bold text-emerald-900">{formatDateTime(selectedReceipt.collected_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Receipt Footer & Action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                onClick={handlePrintReceipt}
                className="w-full sm:w-auto bg-[#0A1F44] hover:bg-blue-900 text-white font-extrabold text-xs px-5 py-3 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Printer className="w-4 h-4" />
                Print / Save Receipt
              </button>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-3 rounded-2xl transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
