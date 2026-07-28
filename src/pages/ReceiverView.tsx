import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import { Button, Badge, Input } from '../components/ui';
import { getIncomingBuses, markBusArrived, getArrivedWaybillsForPark, markWaybillCollectedByStaff } from '../lib/api';
import { Waybill } from '../types';
import { formatTimestamp } from '../lib/helpers';
import { Truck, Package, Search, CheckCircle2, UserCheck, ShieldCheck, Phone, Check } from 'lucide-react';

export function ReceiverView() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'buses' | 'store'>('store');
  
  // Incoming Buses State
  const [buses, setBuses] = useState<Record<string, Waybill[]>>({});
  
  // Waybill Store State
  const [storeWaybills, setStoreWaybills] = useState<Waybill[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Success Notification
  const [successMsg, setSuccessMsg] = useState<string>('');

  const loadAllData = async () => {
    if (!user?.park) return;
    setLoading(true);

    try {
      // 1. Load En Route Buses
      const busData = await getIncomingBuses(user.park);
      const groupedBuses = busData.reduce((acc, wb) => {
        if (!acc[wb.busNumber]) acc[wb.busNumber] = [];
        acc[wb.busNumber].push(wb);
        return acc;
      }, {} as Record<string, Waybill[]>);
      setBuses(groupedBuses);

      // 2. Load Arrived Waybills sitting in Park Store
      const storeData = await getArrivedWaybillsForPark(user.park);
      setStoreWaybills(storeData);
    } catch (err) {
      console.error("Error loading receiver data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [user?.park]);

  const handleArriveBus = async (busNo: string) => {
    if (!user?.park) return;
    await markBusArrived(busNo, user.park);
    setSuccessMsg(`Bus ${busNo} marked as arrived! All items moved to Waybill Store.`);
    setTimeout(() => setSuccessMsg(''), 4000);
    loadAllData();
  };

  // Handover Confirmation State
  const [handoverConfirmWaybill, setHandoverConfirmWaybill] = useState<Waybill | null>(null);

  // Direct Receiver Phone Verification Handover
  const executeHandover = async (wb: Waybill) => {
    if (!wb.id) return;
    try {
      await markWaybillCollectedByStaff(wb.id, `Verified at store desk by staff ${user?.name || user?.phone || 'officer'}`);
      setSuccessMsg(`Package handed over! Waybill #${wb.trackingCode} marked as collected.`);
      setHandoverConfirmWaybill(null);
      setTimeout(() => setSuccessMsg(''), 4000);
      loadAllData();
    } catch (err) {
      console.error("Handover error:", err);
      alert("Failed to complete package handover.");
    }
  };

  // Filter Store Waybills by Search Query (Receiver Phone, Receiver Name, Tracking Code)
  const filteredStoreWaybills = storeWaybills.filter(wb => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      wb.receiverPhone.toLowerCase().includes(q) ||
      wb.receiverName.toLowerCase().includes(q) ||
      wb.trackingCode.toLowerCase().includes(q) ||
      wb.senderPhone.toLowerCase().includes(q) ||
      wb.itemDescription.toLowerCase().includes(q)
    );
  });

  if (loading) return <div className="text-center py-12 text-gray-700 font-medium">Loading park terminal records...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Park Terminal Operations</h1>
          <p className="text-gray-700 text-sm">Managing arrival and receiver package handovers at <strong className="text-navy">{user?.park}</strong>.</p>
        </div>
        <Badge status="Arrived">{user?.park || 'Park Terminal'}</Badge>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm font-semibold flex items-center gap-2.5 animate-fadeIn shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-200">
        <button
          onClick={() => setActiveTab('store')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'store'
              ? 'bg-white shadow-xs text-navy'
              : 'text-gray-600 hover:text-navy'
          }`}
        >
          <Package className="w-4 h-4 text-emerald-600" />
          Waybill Store & Receiver Pickup ({storeWaybills.length})
        </button>

        <button
          onClick={() => setActiveTab('buses')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'buses'
              ? 'bg-white shadow-xs text-navy'
              : 'text-gray-600 hover:text-navy'
          }`}
        >
          <Truck className="w-4 h-4 text-navy" />
          Incoming Buses ({Object.keys(buses).length})
        </button>
      </div>

      {/* TAB 1: PARK WAYBILL STORE & RECEIVER PICKUP */}
      {activeTab === 'store' && (
        <div className="space-y-4">
          {/* Receiver Lookup Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-navy">
              Receiver Lookup (Digital Store Counter)
            </label>
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Type Receiver Phone (e.g., 08012345678), Name, or Tracking Code..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-bg-light border border-gray-200 rounded-xl text-navy font-medium placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber focus:border-transparent text-sm"
              />
            </div>
            <p className="text-xs text-gray-500">
              When a receiver arrives at the waybill store, simply enter the phone number tagged on the package to locate their item immediately.
            </p>
          </div>

          {/* List of Arrived Packages in Park Store */}
          {filteredStoreWaybills.length === 0 ? (
            <div className="text-center py-12 text-gray-600 bg-white rounded-2xl border border-gray-200 p-6">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="font-bold text-navy text-base">No Arrived Packages Found</p>
              <p className="text-sm text-gray-500 mt-1">
                {searchQuery
                  ? `No packages in store matching "${searchQuery}".`
                  : `There are currently no packages sitting in the ${user?.park} store waiting for collection.`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredStoreWaybills.map(wb => (
                <div key={wb.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
                  {/* Top Header */}
                  <div className="flex flex-wrap justify-between items-start gap-2 border-b border-gray-100 pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">TRACKING CODE</span>
                      <h3 className="text-xl font-mono font-bold text-navy">{wb.trackingCode}</h3>
                    </div>
                    <div className="text-right">
                      <Badge status={wb.status}>Arrived in Store</Badge>
                      <p className="text-xs text-gray-400 mt-1">Bus: <strong className="text-navy">{wb.busNumber}</strong></p>
                    </div>
                  </div>

                  {/* Receiver & Sender Party Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-bg-light p-3.5 rounded-xl text-xs">
                    <div className="space-y-1">
                      <p className="font-bold text-emerald-800 uppercase tracking-wider text-[10px]">RECEIVER (COLLECTOR)</p>
                      <p className="font-bold text-navy text-sm">{wb.receiverName}</p>
                      <a href={`tel:${wb.receiverPhone}`} className="text-navy font-mono font-semibold flex items-center gap-1 hover:underline">
                        <Phone className="w-3 h-3 text-emerald-600" /> {wb.receiverPhone}
                      </a>
                    </div>

                    <div className="space-y-1 sm:border-l sm:border-gray-200 sm:pl-3">
                      <p className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">SENDER & ITEM</p>
                      <p className="font-bold text-navy text-sm">{wb.itemDescription}</p>
                      <p className="text-gray-600">From: <strong>{wb.originPark}</strong> ({wb.senderName})</p>
                    </div>
                  </div>

                  {/* Streamlined Receiver Phone Verification & Handover */}
                  <div className="bg-emerald-50/80 border border-emerald-200 p-4 rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Receiver Phone Verification
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Verify that the person at the counter holds or states phone: <strong className="font-mono text-navy text-sm">{wb.receiverPhone}</strong>
                        </p>
                      </div>

                      <button
                        onClick={() => setHandoverConfirmWaybill(wb)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-xs flex-shrink-0"
                      >
                        <UserCheck className="w-4 h-4" /> Confirm Phone & Hand Over Package
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INCOMING BUSES (EN ROUTE) */}
      {activeTab === 'buses' && (
        <div className="space-y-4">
          {Object.keys(buses).length === 0 ? (
            <div className="text-center py-12 text-gray-600 bg-white rounded-2xl border border-gray-200 p-6">
              <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="font-bold text-navy text-base">No Incoming Buses En Route</p>
              <p className="text-sm text-gray-500 mt-1">There are currently no buses departed for {user?.park}.</p>
            </div>
          ) : (
            Object.entries(buses).map(([busNo, items]: [string, any]) => (
              <div key={busNo} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="text-xl font-bold text-navy">Bus: {busNo}</h3>
                    <p className="text-gray-600 text-sm">
                      Origin: <strong className="text-navy">{items[0].originPark}</strong> • {items.length} waybill items aboard
                    </p>
                  </div>
                  <Button onClick={() => handleArriveBus(busNo)} variant="primary">
                    Mark Bus Arrived
                  </Button>
                </div>

                <div className="divide-y divide-gray-100">
                  {items.map((wb: Waybill) => (
                    <div key={wb.id} className="py-3 flex justify-between items-center text-sm">
                      <div>
                        <p className="font-mono font-bold text-navy">{wb.trackingCode}</p>
                        <p className="text-gray-700">{wb.itemDescription}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Receiver: {wb.receiverName} ({wb.receiverPhone})</p>
                      </div>
                      <Badge status={wb.status}>{wb.status === 'Departed' ? 'In Transit' : wb.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Handover Confirmation Modal */}
      {handoverConfirmWaybill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-gray-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
              <div className="p-2.5 bg-emerald-100 rounded-2xl text-emerald-700">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-navy">Confirm Package Handover</h3>
                <p className="text-xs text-gray-500">Store Desk Package Release</p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl space-y-2 text-sm border border-gray-100">
              <p><strong className="text-gray-600">Receiver Name:</strong> <span className="font-semibold text-navy">{handoverConfirmWaybill.receiverName}</span></p>
              <p><strong className="text-gray-600">Verified Phone:</strong> <span className="font-mono font-bold text-emerald-800">{handoverConfirmWaybill.receiverPhone}</span></p>
              <p><strong className="text-gray-600">Item Description:</strong> <span className="text-gray-800">{handoverConfirmWaybill.itemDescription}</span></p>
              <p><strong className="text-gray-600">Tracking Code:</strong> <span className="font-mono text-gray-700">{handoverConfirmWaybill.trackingCode}</span></p>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Have you verified the receiver's phone number or identity document at the store counter?
            </p>

            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setHandoverConfirmWaybill(null)}
                className="w-1/2"
              >
                Cancel
              </Button>
              <Button
                onClick={() => executeHandover(handoverConfirmWaybill)}
                className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                Confirm Release
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
