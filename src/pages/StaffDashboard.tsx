import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Briefcase, MapPin, Shield, Plus, Truck, FileText, AlertTriangle, Bell, ArrowRight, HelpCircle, X, CheckCircle2, Phone, Sparkles, Receipt } from 'lucide-react';
import { WaybillForm } from '../components/staff/WaybillForm';
import { BusForm } from '../components/staff/BusForm';
import { OutgoingBuses } from '../components/staff/OutgoingBuses';
import { IncomingBuses } from '../components/staff/IncomingBuses';
import { WaybillHistory } from '../components/staff/WaybillHistory';
import { getOutgoingBuses, getIncomingBuses } from '../lib/api';

type StaffScreen = 'menu' | 'create_waybill' | 'create_bus' | 'outgoing' | 'incoming' | 'history';

export const StaffDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [screen, setScreen] = useState<StaffScreen>('menu');
  const [showStaffGuideModal, setShowStaffGuideModal] = useState<boolean>(false);
  
  // Operational alert counts
  const [outgoingCount, setOutgoingCount] = useState<number>(0);
  const [incomingInTransitCount, setIncomingInTransitCount] = useState<number>(0);
  const [pendingPickupCount, setPendingPickupCount] = useState<number>(0);

  const originPark = user?.park_location || 'Nnewi';

  const fetchCounts = async () => {
    if (!token) return;
    try {
      const [outRes, incRes] = await Promise.all([
        getOutgoingBuses(token),
        getIncomingBuses(token)
      ]);

      if (outRes.success && outRes.buses) {
        // Outgoing count is any bus where status is 'loading'
        const loadingBuses = outRes.buses.filter((b: any) => b.status === 'loading');
        setOutgoingCount(loadingBuses.length);
      }

      if (incRes.success && incRes.buses) {
        // Incoming in transit is any bus where status is 'departed'
        const inTransitBuses = incRes.buses.filter((b: any) => b.status === 'departed');
        setIncomingInTransitCount(inTransitBuses.length);

        // Pending pickups are waybills inside incoming buses where waybill status is 'arrived'
        let pickups = 0;
        incRes.buses.forEach((b: any) => {
          if (b.waybills) {
            b.waybills.forEach((wb: any) => {
              if (wb.status === 'arrived') {
                pickups++;
              }
            });
          }
        });
        setPendingPickupCount(pickups);
      }
    } catch (err) {
      console.error('Error fetching staff counts:', err);
    }
  };

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 15000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (screen === 'menu') {
      fetchCounts();
    }
  }, [screen]);

  const hasJobs = outgoingCount > 0 || incomingInTransitCount > 0 || pendingPickupCount > 0;

  const renderScreen = () => {
    if (!token) return null;

    switch (screen) {
      case 'create_waybill':
        return (
          <WaybillForm
            token={token}
            originPark={originPark}
            onBackToMenu={() => setScreen('menu')}
            onCreateNewBus={() => setScreen('create_bus')}
          />
        );
      case 'create_bus':
        return (
          <BusForm
            token={token}
            originPark={originPark}
            onSuccess={() => setScreen('create_waybill')}
            onCancel={() => setScreen('create_waybill')}
          />
        );
      case 'outgoing':
        return (
          <OutgoingBuses
            token={token}
            onBackToMenu={() => setScreen('menu')}
          />
        );
      case 'incoming':
        return (
          <IncomingBuses
            token={token}
            onBackToMenu={() => setScreen('menu')}
          />
        );
      case 'history':
        return (
          <WaybillHistory
            token={token}
            originPark={originPark}
            onBackToMenu={() => setScreen('menu')}
          />
        );
      case 'menu':
      default:
        return (
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Header info block */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0">
                  <Briefcase className="w-6 h-6 text-[#0A1F44]" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-[#0A1F44]">
                    Hello, {user?.name || 'Staff Member'}
                  </h2>
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-[#F2A93B]" />
                    <span>Active Terminal Assigned: <strong>{originPark}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                <button
                  onClick={() => setShowStaffGuideModal(true)}
                  className="bg-amber-100 hover:bg-amber-200 text-[#0A1F44] border border-amber-300 font-extrabold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <HelpCircle className="w-4 h-4 text-[#F2A93B]" />
                  <span>📖 Staff Operating Guide</span>
                </button>
              </div>
            </div>

            {/* Blinking Red Alert Panel if there is any pending job to do */}
            {hasJobs && (
              <div className="bg-rose-50/70 border-2 border-red-500 rounded-3xl p-5 md:p-6 shadow-md transition-all animate-pulse duration-1000" id="staff-pending-jobs-alert">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-lg animate-bounce">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="space-y-3 flex-grow">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                        </span>
                        <h3 className="text-sm font-black text-red-950 uppercase tracking-wide">
                          ⚠️ ACTION REQUIRED: Outstanding Terminal Jobs
                        </h3>
                      </div>
                      <p className="text-xs text-rose-800 font-bold mt-1">
                        Please complete the following operations immediately to ensure prompt logistics services:
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      {outgoingCount > 0 && (
                        <button
                          onClick={() => setScreen('outgoing')}
                          className="bg-white hover:bg-rose-100/50 border border-red-200 p-3.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between min-h-[90px] shadow-xs hover:border-red-400 group"
                        >
                          <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest block">Outgoing Manifests</span>
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-lg font-black text-red-700">{outgoingCount}</span>
                            <span className="text-[11px] text-rose-800 font-bold">Needs Dispatch</span>
                          </div>
                          <span className="text-[9px] font-extrabold text-red-600 underline mt-1.5 inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                            Open Outgoing &rarr;
                          </span>
                        </button>
                      )}

                      {incomingInTransitCount > 0 && (
                        <button
                          onClick={() => setScreen('incoming')}
                          className="bg-white hover:bg-rose-100/50 border border-red-200 p-3.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between min-h-[90px] shadow-xs hover:border-red-400 group"
                        >
                          <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest block">Inbound Transits</span>
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-lg font-black text-red-700">{incomingInTransitCount}</span>
                            <span className="text-[11px] text-rose-800 font-bold">In-Transit Buses</span>
                          </div>
                          <span className="text-[9px] font-extrabold text-red-600 underline mt-1.5 inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                            Confirm Arrivals &rarr;
                          </span>
                        </button>
                      )}

                      {pendingPickupCount > 0 && (
                        <button
                          onClick={() => setScreen('incoming')}
                          className="bg-white hover:bg-rose-100/50 border border-red-200 p-3.5 rounded-2xl text-left transition-all cursor-pointer flex flex-col justify-between min-h-[90px] shadow-xs hover:border-red-400 group"
                        >
                          <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest block">Customer Pickups</span>
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-lg font-black text-red-700">{pendingPickupCount}</span>
                            <span className="text-[11px] text-rose-800 font-bold">Ready for Collection</span>
                          </div>
                          <span className="text-[9px] font-extrabold text-red-600 underline mt-1.5 inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                            Verify PIN & Handover &rarr;
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Action Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Card 1: Create Waybill */}
              <button
                id="staff-create-waybill-btn"
                onClick={() => setScreen('create_waybill')}
                className="bg-[#0A1F44] text-white rounded-3xl p-6 hover:bg-blue-900 transition-all text-left space-y-4 group cursor-pointer shadow-md hover:shadow-lg flex flex-col justify-between min-h-[180px]"
              >
                <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#F2A93B]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base flex items-center gap-1.5">
                    Create New Waybill
                    <span className="text-[#F2A93B] group-hover:translate-x-1 transition-transform">&rarr;</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 font-medium">
                    Register sender, receiver, and load waybills onto a departure bus manifest.
                  </p>
                </div>
              </button>

              {/* Card 2: Outgoing Buses */}
              <button
                id="staff-outgoing-buses-tab"
                onClick={() => setScreen('outgoing')}
                className={`bg-white border rounded-3xl p-6 hover:bg-slate-50 transition-all text-left space-y-4 group cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between min-h-[180px] ${
                  outgoingCount > 0 ? 'border-red-200 hover:border-red-300 bg-red-50/5' : 'border-slate-100'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <Truck className="w-5 h-5 text-blue-700" />
                  </div>
                  {outgoingCount > 0 && (
                    <span className="bg-red-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full animate-bounce">
                      {outgoingCount} PENDING
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#0A1F44] flex items-center gap-1.5">
                    Outgoing Buses
                    <span className="text-[#F2A93B] group-hover:translate-x-1 transition-transform">&rarr;</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Manage active loading manifests at this park and mark them as departed.
                  </p>
                </div>
              </button>

              {/* Card 3: Incoming Buses */}
              <button
                id="staff-incoming-buses-tab"
                onClick={() => setScreen('incoming')}
                className={`bg-white border rounded-3xl p-6 hover:bg-slate-50 transition-all text-left space-y-4 group cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between min-h-[180px] ${
                  (incomingInTransitCount > 0 || pendingPickupCount > 0) ? 'border-red-200 hover:border-red-300 bg-red-50/5' : 'border-slate-100'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <Truck className="w-5 h-5 text-emerald-600" />
                  </div>
                  {(incomingInTransitCount > 0 || pendingPickupCount > 0) && (
                    <span className="bg-red-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full animate-bounce">
                      {incomingInTransitCount + pendingPickupCount} PENDING
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#0A1F44] flex items-center gap-1.5">
                    Incoming Buses
                    <span className="text-[#F2A93B] group-hover:translate-x-1 transition-transform">&rarr;</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Track inbound dispatches, mark arrivals, and manage individual waybill collections.
                  </p>
                </div>
              </button>

              {/* Card 4: History & Receipts */}
              <button
                id="staff-waybill-history-tab"
                onClick={() => setScreen('history')}
                className="bg-white border border-slate-100 rounded-3xl p-6 hover:bg-slate-50 transition-all text-left space-y-4 group cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between min-h-[180px]"
              >
                <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-[#F2A93B]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#0A1F44] flex items-center gap-1.5">
                    Waybill History 🧾
                    <span className="text-[#F2A93B] group-hover:translate-x-1 transition-transform">&rarr;</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    View, search, or print receipts for every successful waybill sent or received.
                  </p>
                </div>
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
      {/* Navbar */}
      <header className="bg-[#0A1F44] text-white px-6 py-4 shadow-md">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Truck className="text-[#F2A93B] w-6 h-6" />
            <div className="flex items-center gap-2 font-extrabold text-lg tracking-wider">
              <span>Waybilla</span>
              <span className="inline-flex items-center shadow-xs rounded overflow-hidden border border-white/20" title="Nigeria">
                <svg className="w-5 h-3.5" viewBox="0 0 3 2">
                  <rect width="1" height="2" x="0" fill="#008751" />
                  <rect width="1" height="2" x="1" fill="#FFFFFF" />
                  <rect width="1" height="2" x="2" fill="#008751" />
                </svg>
              </span>
              <span className="text-slate-300 font-normal text-sm ml-1 flex items-center gap-1.5">
                Staff
                {hasJobs && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {hasJobs && (
              <div className="hidden sm:flex items-center gap-2 bg-red-500/15 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                <span>{outgoingCount + incomingInTransitCount + pendingPickupCount} Tasks Required</span>
              </div>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-2 bg-[#F2A93B] hover:bg-[#d9922b] text-[#0A1F44] font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-grow p-6 md:p-8">
        {renderScreen()}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-100 bg-white">
        &copy; {new Date().getFullYear()} Waybilla Operations Hub. All rights reserved.
      </footer>

      {/* Staff Operations Guide Modal */}
      {showStaffGuideModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-[#0A1F44] flex items-center justify-center font-black text-lg">
                  📖
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#0A1F44]">Park Staff Operating Manual</h3>
                  <p className="text-xs text-slate-500">Step-by-step workflow guide — No hard English! 🤣</p>
                </div>
              </div>
              <button
                onClick={() => setShowStaffGuideModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2 text-slate-700 text-xs">
              {/* Step 1 */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 space-y-2">
                <div className="font-extrabold text-[#0A1F44] text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#0A1F44] text-white flex items-center justify-center text-xs font-black">1</span>
                  <span>Step 1: Register an Active Loading Bus 🚌</span>
                </div>
                <p className="leading-relaxed">
                  Before issuing any waybill for payment, ensure a bus is created for that destination!
                  Click <strong>Register New Bus</strong>, choose the bus number, driver name, and driver phone number.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-2">
                <div className="font-extrabold text-amber-950 text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-black">2</span>
                  <span>Step 2: Create Waybill & Take Payment 💳</span>
                </div>
                <p className="leading-relaxed">
                  Click <strong>Create New Waybill</strong>. Enter the Sender & Receiver <strong>11-digit phone numbers</strong> accurately. Pick the destination park and assign it to the loading bus. Open the secure Paystack checkout portal so the customer can choose their preferred payment method (Bank Transfer, Card, USSD, or Bank Account) to complete payment.
                </p>
                <div className="bg-white/80 p-2 rounded-xl text-[11px] font-bold text-amber-900 border border-amber-200">
                  💡 Tip: The customer will receive an SMS containing their Waybill Tracking Code and 6-digit Secret Pickup PIN.
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-2">
                <div className="font-extrabold text-emerald-950 text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black">3</span>
                  <span>Step 3: ⚠️ Mark Bus as Departed 🚀</span>
                </div>
                <p className="leading-relaxed">
                  When the driver loads all waybills and the bus leaves your station, open <strong>Outgoing Buses</strong> and click <strong>"Mark Bus as Departed"</strong>.
                </p>
                <div className="bg-rose-100 border border-rose-300 p-2 rounded-xl text-[11px] text-rose-950 font-bold">
                  ⚠️ <strong>SERIOUS WARNING:</strong> Staff MUST click Departed when bus moves! If you forget, tracking will stay stuck on "Booked" and customers will be calling your line non-stop!
                </div>
              </div>

              {/* Step 4 */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 space-y-2">
                <div className="font-extrabold text-indigo-950 text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">4</span>
                  <span>Step 4: ⚠️ Mark Bus as Arrived 📍</span>
                </div>
                <p className="leading-relaxed">
                  When a bus arrives at your station from another park, open <strong>Incoming Buses</strong> and click <strong>"Mark Bus as Arrived"</strong>.
                  This updates the waybill status to ARRIVED AT PARK so receiver knows it is ready for collection!
                </p>
              </div>

              {/* Step 5 */}
              <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 space-y-2">
                <div className="font-extrabold text-purple-950 text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-black">5</span>
                  <span>Step 5: Verify Receiver & Mark Collected 🎁</span>
                </div>
                <p className="leading-relaxed">
                  When the receiver comes to collect their waybill:
                </p>
                <ol className="list-disc pl-5 space-y-1 text-[11px] font-semibold text-slate-700">
                  <li>Ask receiver for their <strong>Receiver Phone Number</strong> OR <strong>6-digit Secret Pickup PIN</strong>.</li>
                  <li>Verify the waybill details on your screen under Incoming Waybills.</li>
                  <li>Click <strong>Mark Collected</strong> and hand over the waybill! 🎁</li>
                </ol>
                <div className="bg-white/80 p-2 rounded-xl text-[11px] font-bold text-purple-900 border border-purple-200">
                  🤣 Simple as ABC! Flexible verification with zero friction or stress!
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowStaffGuideModal(false)}
              className="w-full bg-[#0A1F44] text-white font-bold py-3.5 rounded-2xl text-sm hover:bg-blue-900 transition-colors cursor-pointer"
            >
              Close Manual & Continue Operations
            </button>
          </div>
        </div>
      )}


    </div>
  );
};
