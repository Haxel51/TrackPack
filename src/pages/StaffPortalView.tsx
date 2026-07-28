import { FormEvent, useEffect, useState } from 'react';
import { useAuthStore } from '../store';
import { Button, Input, Badge } from '../components/ui';
import {
  createWaybill,
  deleteWaybill,
  getCompanyById,
  getSenderManifest,
  markBusDeparted,
  getIncomingBuses,
  markBusArrived,
  getArrivedWaybillsForPark,
  markWaybillCollectedByStaff
} from '../lib/api';
import { normalizeTo11Digits } from '../lib/helpers';
import { Waybill } from '../types';
import {
  Send,
  List,
  Truck,
  Package,
  Search,
  CheckCircle2,
  Phone,
  Check,
  LogOut,
  Info,
  AlertTriangle,
  RefreshCw,
  FileText,
  Trash2,
  CreditCard,
  HelpCircle
} from 'lucide-react';
import { doc, onSnapshot, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function StaffPortalView() {
  const { user, logout } = useAuthStore();
  
  // Navigation State
  const [mainTab, setMainTab] = useState<'outgoing' | 'incoming'>('outgoing');
  const [subTab, setSubTab] = useState<'create' | 'dispatch' | 'drafts' | 'store' | 'incoming-buses'>('create');
  const [showStaffGuide, setShowStaffGuide] = useState(false);

  // Common State
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // OUTGOING - Create Waybill State
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [busNumber, setBusNumber] = useState('');
  const [destinationPark, setDestinationPark] = useState('');
  const [parks, setParks] = useState<string[]>([]);
  const [createdCode, setCreatedCode] = useState('');
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [bookingFee, setBookingFee] = useState<number>(200);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Helper to verify payment status via server endpoint
  const verifyWaybillPayment = async (waybillId: string, reference?: string, paymentStatus?: string, forceVerify?: boolean) => {
    try {
      const res = await fetch('/api/paystack/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waybillId, reference, paymentStatus, forceVerify })
      });
      const data = await res.json();
      if (data.status === 'success' && data.trackingCode) {
        setCreatedCode(data.trackingCode);
        setPaymentDetails(null);
        setSuccessMsg(`Payment completed! Tracking Code generated: ${data.trackingCode}`);
        return true;
      }
    } catch (err) {
      console.error('Verify Payment Error:', err);
    }
    return false;
  };

  // OUTGOING - Dispatch Manifest State
  const [outgoingManifest, setOutgoingManifest] = useState<Waybill[]>([]);
  const [draftWaybills, setDraftWaybills] = useState<Waybill[]>([]);
  const [driverInfo, setDriverInfo] = useState<Record<string, { name: string; phone: string }>>({});

  // INCOMING - Buses State
  const [incomingBuses, setIncomingBuses] = useState<Record<string, Waybill[]>>({});

  // INCOMING - Store Waybills State
  const [storeWaybills, setStoreWaybills] = useState<Waybill[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [phoneInputs, setPhoneInputs] = useState<Record<string, string>>({});
  const [phoneErrorMsgs, setPhoneErrorMsgs] = useState<Record<string, string>>({});

  // Listen to platform booking fee settings
  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'settings', 'platform_config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (typeof data.bookingFee === 'number') {
          const validFee = Math.max(200, data.bookingFee);
          setBookingFee(validFee);
          if (data.bookingFee < 200) {
            setDoc(doc(db, 'settings', 'platform_config'), { bookingFee: 200 }, { merge: true });
          }
        }
      }
    });
    return () => unsubConfig();
  }, []);

  const [companyStatusError, setCompanyStatusError] = useState<string | null>(null);

  // Fetch Destination Parks for the Company & Verify Company Status
  useEffect(() => {
    if (user?.companyId) {
      getCompanyById(user.companyId).then((comp) => {
        if (!comp) {
          setCompanyStatusError("This transport company account has been removed by platform administration. Operations are disabled.");
        } else if (comp.approved !== true || comp.status === 'suspended') {
          setCompanyStatusError("This transport company account is suspended or unapproved by platform administration. Operations are disabled.");
        } else {
          setCompanyStatusError(null);
          setParks(comp.parks.filter((p) => p !== user.park));
        }
      });
    }
  }, [user?.companyId, user?.park]);

  // Load relevant data based on subTab
  const loadData = async () => {
    if (!user?.park) return;
    setLoading(true);
    try {
      if (subTab === 'dispatch') {
        const data = await getSenderManifest(user.park);
        setOutgoingManifest(data);
      } else if (subTab === 'incoming-buses') {
        const busData = await getIncomingBuses(user.park);
        const groupedBuses = busData.reduce((acc, wb) => {
          if (!acc[wb.busNumber]) acc[wb.busNumber] = [];
          acc[wb.busNumber].push(wb);
          return acc;
        }, {} as Record<string, Waybill[]>);
        setIncomingBuses(groupedBuses);
      } else if (subTab === 'store') {
        const storeData = await getArrivedWaybillsForPark(user.park);
        setStoreWaybills(storeData);
      }

      // Always load park drafts if on create, dispatch or drafts
      if (subTab === 'drafts' || subTab === 'create' || subTab === 'dispatch') {
        const qDraft = query(
          collection(db, 'waybills'),
          where('originPark', '==', user.park)
        );
        const draftSnap = await getDocs(qDraft);
        const drafts = draftSnap.docs
          .map(doc => ({ ...doc.data(), id: doc.id } as Waybill))
          .filter(w => w.status === 'Draft' || w.paymentStatus === 'pending')
          .sort((a, b) => (b.createdTimestamp || 0) - (a.createdTimestamp || 0));
        setDraftWaybills(drafts);
      }
    } catch (err) {
      console.error('Error loading data for staff portal:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.park, subTab]);

  // Handle Paystack Redirect Callback (e.g. ?payment_status=cancelled or ?payment_status=completed)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawStatus = params.get('payment_status') || params.get('status') || '';
    const paymentStatus = rawStatus.split('?')[0].split('&')[0];

    const rawWaybillId = params.get('waybillId') || '';
    const waybillId = rawWaybillId.split('?')[0].split('&')[0];
    const reference = params.get('reference') || params.get('trxref') || '';

    if (paymentStatus === 'cancelled' || params.has('cancelled')) {
      if (waybillId) {
        deleteWaybill(waybillId).catch(console.error);
      }
      setErrorMsg('Payment was cancelled on Paystack. The draft waybill has been cancelled.');
      setPaymentDetails(null);
      setLoading(false);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'completed' || paymentStatus === 'success' || reference || waybillId) {
      if (waybillId) {
        setLoading(true);
        verifyWaybillPayment(waybillId, reference, paymentStatus || 'completed').finally(() => {
          setLoading(false);
          window.history.replaceState({}, document.title, window.location.pathname);
        });
      } else {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Paystack verification poller & listener during Draft creation
  useEffect(() => {
    if (!paymentDetails?.waybillId) return;

    // Immediately check once
    verifyWaybillPayment(paymentDetails.waybillId, paymentDetails.reference);

    // Poll every 4 seconds
    const interval = setInterval(() => {
      verifyWaybillPayment(paymentDetails.waybillId, paymentDetails.reference);
    }, 4000);

    const unsub = onSnapshot(doc(db, 'waybills', paymentDetails.waybillId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.paymentStatus === 'success' && data.trackingCode) {
          setCreatedCode(data.trackingCode);
          setPaymentDetails(null); // Clear payment details to show success screen
        }
      }
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [paymentDetails?.waybillId, paymentDetails?.reference]);

  // Handle Main Tab Switch
  const handleMainTabChange = (tab: 'outgoing' | 'incoming') => {
    setMainTab(tab);
    if (tab === 'outgoing') {
      setSubTab('create');
    } else {
      setSubTab('store');
    }
    setSuccessMsg('');
    setErrorMsg('');
  };

  // Submit new Waybill
  const handleCreateWaybill = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.park) return;
    if (companyStatusError) {
      alert(companyStatusError);
      return;
    }

    setLoading(true);
    const normalizedSenderPhone = normalizeTo11Digits(senderPhone);
    const normalizedReceiverPhone = normalizeTo11Digits(receiverPhone);

    if (normalizedSenderPhone.length !== 11) {
      setErrorMsg('Sender phone number must be exactly 11 digits (e.g. 08012345678).');
      setLoading(false);
      return;
    }

    if (normalizedReceiverPhone.length !== 11) {
      setErrorMsg('Receiver phone number must be exactly 11 digits (e.g. 08012345678).');
      setLoading(false);
      return;
    }

    try {
      const waybillResult = await createWaybill({
        trackingCode: '',
        senderName: senderName.trim() || 'Sender',
        senderPhone: normalizedSenderPhone,
        receiverName: receiverName.trim() || 'Receiver',
        receiverPhone: normalizedReceiverPhone,
        itemDescription,
        busNumber,
        originPark: user.park,
        destinationPark,
        status: 'Draft',
        createdTimestamp: Date.now(),
        pickupCode: Math.floor(1000 + Math.random() * 9000).toString(),
        liveTrackingActive: false,
        paymentStatus: 'pending',
        companyId: user.companyId
      });

      const waybillId = waybillResult.id;

      if (waybillId) {
        try {
          const res = await fetch('/api/paystack/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: `${normalizedSenderPhone}@trackpack.example.com`,
              amount: bookingFee * 100,
              waybillId: waybillId
            })
          });
          const data = await res.json();
          if (data.status === 'success') {
            setPaymentDetails({ ...data.data, waybillId });
            setSenderName('');
            setSenderPhone('');
            setReceiverName('');
            setReceiverPhone('');
            setItemDescription('');
          } else {
            alert(data.message || 'Failed to generate payment virtual account.');
          }
        } catch (err) {
          console.error('Payment API Error:', err);
          alert('Failed to contact payment server.');
        }
      }
    } catch (err) {
      alert('Failed to create waybill.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryPayment = async (wb: Waybill) => {
    setLoading(true);
    try {
      const res = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `${wb.senderPhone.replace(/[^0-9]/g, '')}@trackpack.example.com`,
          amount: bookingFee * 100,
          waybillId: wb.id
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setPaymentDetails({ ...data.data, waybillId: wb.id });
        if (wb.trackingCode) {
          setCreatedCode(wb.trackingCode);
        } else {
          setCreatedCode('');
        }
        setMainTab('outgoing');
        setSubTab('create');
      } else {
        alert('Failed to generate payment virtual account.');
      }
    } catch (err) {
      console.error('Payment API Error:', err);
      alert('Failed to contact payment server.');
    } finally {
      setLoading(false);
    }
  };

  // Dispatch / Depart Bus
  const handleDepartBus = async (busNo: string) => {
    if (!user?.park) return;
    const info = driverInfo[busNo] || { name: '', phone: '' };
    if (!info.phone || !info.phone.trim()) {
      alert("Driver's phone number is REQUIRED before dispatching the bus so customers can call the driver during transit.");
      return;
    }
    const normalizedDriverPhone = normalizeTo11Digits(info.phone);
    if (normalizedDriverPhone.length !== 11) {
      alert("Driver's phone number must be a valid 11-digit Nigerian phone number (e.g. 08012345678).");
      return;
    }
    await markBusDeparted(busNo, user.park, info.name?.trim() || 'Bus Driver', normalizedDriverPhone);
    setDriverInfo((prev) => {
      const next = { ...prev };
      delete next[busNo];
      return next;
    });
    setSuccessMsg(`Bus ${busNo} departed! Driver phone (${normalizedDriverPhone}) saved and customers notified.`);
    setTimeout(() => setSuccessMsg(''), 4000);
    loadData();
  };

  // Mark Incoming Bus as Arrived
  const handleArriveBus = async (busNo: string) => {
    if (!user?.park) return;
    await markBusArrived(busNo, user.park);
    setSuccessMsg(`Bus ${busNo} marked as arrived! All packages are safely in the park store.`);
    setTimeout(() => setSuccessMsg(''), 4000);
    loadData();
  };

  // Receiver Phone Verification Handover
  const handleVerifyPhoneHandover = async (wb: Waybill) => {
    if (!wb.id) return;
    const typedPhone = phoneInputs[wb.id] || '';
    if (!typedPhone.trim()) {
      setPhoneErrorMsgs((prev) => ({ ...prev, [wb.id!]: 'Please type the receiver phone number to verify.' }));
      return;
    }

    const normalizedTyped = normalizeTo11Digits(typedPhone);
    const normalizedRecorded = normalizeTo11Digits(wb.receiverPhone);

    if (normalizedTyped !== normalizedRecorded && !normalizedRecorded.endsWith(normalizedTyped.slice(-10))) {
      setPhoneErrorMsgs((prev) => ({
        ...prev,
        [wb.id!]: `Phone mismatch! You typed "${typedPhone}", but on-record receiver phone is "${wb.receiverPhone}".`
      }));
      return;
    }

    setPhoneErrorMsgs((prev) => ({ ...prev, [wb.id!]: '' }));
    await markWaybillCollectedByStaff(
      wb.id,
      `Receiver phone verified (${typedPhone}) by station staff ${user?.name || user?.phone || 'officer'}`
    );
    setSuccessMsg(`Package handed over! Waybill #${wb.trackingCode} marked as collected after verifying receiver phone.`);
    setTimeout(() => setSuccessMsg(''), 4000);
    loadData();
  };

  // Filter Store Waybills by query
  const filteredStoreWaybills = storeWaybills.filter((wb) => {
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

  // Outgoing manifest grouped by bus number
  const groupedManifest = outgoingManifest.reduce((acc, wb) => {
    if (!acc[wb.busNumber]) acc[wb.busNumber] = [];
    acc[wb.busNumber].push(wb);
    return acc;
  }, {} as Record<string, Waybill[]>);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Professional Portal Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-navy">Motor Park Waybill & Load Manager 🚌</h1>
            <span className="text-xs font-bold text-navy bg-amber/20 px-3 py-1 rounded-full border border-amber/40">
              Send & Receive Station 🔄
            </span>
          </div>
          <p className="text-gray-700 text-sm mt-1">
            Active Park Station: <strong className="text-navy">{user?.park}</strong> | Staff member:{' '}
            <strong className="text-navy">{user?.name || 'Officer'}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            onClick={() => setShowStaffGuide(!showStaffGuide)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-navy bg-amber/20 hover:bg-amber/30 rounded-xl transition border border-amber/40"
          >
            <HelpCircle className="w-4 h-4 text-navy" /> {showStaffGuide ? 'Hide Staff Guide' : '📖 Operating Guide'}
          </button>
          <button
            onClick={logout}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition border border-red-200"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>

      {/* Interactive Staff Operating Guide Checklist */}
      {showStaffGuide && (
        <div className="bg-navy text-white p-6 rounded-2xl border border-navy/30 shadow-lg space-y-4 animate-fadeIn">
          <div className="flex justify-between items-center pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-lg text-white">Park Station Staff Operating Guide</h3>
            </div>
            <button
              onClick={() => setShowStaffGuide(false)}
              className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-lg font-bold transition"
            >
              Close Guide ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-200">
            <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-1.5">
              <div className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
                <span>1️⃣</span> Book Outgoing Package
              </div>
              <p className="leading-relaxed text-gray-300">
                Fill parcel details, sender/receiver phones, and bus number. Generate Paystack Virtual Account or collect booking fee to activate tracking ID.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-1.5">
              <div className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
                <span>2️⃣</span> Draft & Unpaid Recovery
              </div>
              <p className="leading-relaxed text-gray-300">
                If payment is delayed or left uncompleted, the booking stays safely saved under <strong>Drafts</strong>. Open <em>3. Drafts / Pending Payment</em> anytime to resume and complete payment.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-1.5">
              <div className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
                <span>3️⃣</span> Dispatch Bus (Mark Departed)
              </div>
              <p className="leading-relaxed text-gray-300">
                When the loaded bus leaves, enter the <strong>REQUIRED Driver Phone Number</strong> and click <em>Dispatch Bus & Notify Customers</em>. This moves packages to <strong>In Transit</strong> and enables the Call Driver button for customers.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-1.5">
              <div className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
                <span>4️⃣</span> Receive Bus & Hand Over
              </div>
              <p className="leading-relaxed text-gray-300">
                When an incoming bus arrives at your park, click <em>Incoming Shipments ➔ Incoming Buses</em> and click <em>Mark Bus as Arrived</em>. When the receiver comes to collect, search their phone number and click <em>Hand Over Package</em>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm font-semibold flex items-center gap-2.5 animate-fadeIn shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Mode Segmented Controller (Outgoing vs Incoming) */}
      <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
        <button
          onClick={() => handleMainTabChange('outgoing')}
          className={`py-3.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2.5 transition-all ${
            mainTab === 'outgoing'
              ? 'bg-white shadow-sm text-navy'
              : 'text-gray-600 hover:text-navy hover:bg-gray-50'
          }`}
        >
          <Send className="w-4 h-4 text-navy" />
          Outgoing Shipments (Sending)
        </button>
        <button
          onClick={() => handleMainTabChange('incoming')}
          className={`py-3.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2.5 transition-all ${
            mainTab === 'incoming'
              ? 'bg-white shadow-sm text-navy'
              : 'text-gray-600 hover:text-navy hover:bg-gray-50'
          }`}
        >
          <Package className="w-4 h-4 text-emerald-600" />
          Incoming Shipments (Receiving)
        </button>
      </div>

      {/* Outgoing Segment sub-dashboard */}
      {mainTab === 'outgoing' && (
        <div className="space-y-6">
          {/* Sub-tabs Row */}
          <div className="flex gap-2 border-b border-gray-200 pb-3">
            <button
              onClick={() => setSubTab('create')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition ${
                subTab === 'create'
                  ? 'bg-navy text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-navy'
              }`}
            >
              1. Create Waybill
            </button>
            <button
              onClick={() => setSubTab('dispatch')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition flex items-center gap-2 ${
                subTab === 'dispatch'
                  ? 'bg-navy text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-navy'
              }`}
            >
              2. Dispatch & Departures
              {outgoingManifest.length > 0 && (
                <span className="bg-amber text-navy text-xs px-1.5 py-0.5 rounded-full font-bold">
                  {outgoingManifest.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setSubTab('drafts')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition flex items-center gap-2 ${
                subTab === 'drafts'
                  ? 'bg-navy text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-navy'
              }`}
            >
              3. Drafts / Pending Payment
              {draftWaybills.length > 0 && (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs px-2 py-0.5 rounded-full font-bold">
                  {draftWaybills.length}
                </span>
              )}
            </button>
          </div>

          {/* Sub-tab 1: Create Waybill */}
          {subTab === 'create' && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
              {createdCode ? (
                <div className="text-center py-12 space-y-6">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                    <Send className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-gray-700 mb-2">Waybill Created Successfully</p>
                    <div className="text-4xl font-bold tracking-widest text-navy font-mono bg-bg-light py-4 rounded-xl border border-gray-200 mb-6">
                      {createdCode}
                    </div>
                    <p className="text-gray-700 max-w-sm mx-auto">
                      Your waybill is booked and ready. Share this tracking ID with the sender or receiver to track the package in real-time.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setCreatedCode('');
                      setPaymentDetails(null);
                    }}
                  >
                    Create Another
                  </Button>
                </div>
              ) : paymentDetails ? (
                <div className="text-center py-12 space-y-6">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <Send className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-navy mb-2">Awaiting Payment</h3>
                    <p className="text-gray-700 text-base max-w-sm mx-auto">
                      Please pay the ₦{bookingFee.toLocaleString()} booking fee to book this waybill and generate its tracking ID.
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl text-left max-w-sm mx-auto space-y-4">
                    {paymentDetails.authorizationUrl && (
                      <a
                        href={paymentDetails.authorizationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all text-sm"
                      >
                        💳 Pay Online via Paystack Checkout
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={async () => {
                        if (paymentDetails?.waybillId) {
                          setVerifying(true);
                          const ok = await verifyWaybillPayment(paymentDetails.waybillId, paymentDetails.reference, undefined, true);
                          setVerifying(false);
                          if (!ok) {
                            alert("Payment not confirmed on Paystack yet. If you just transferred, please wait a few seconds and try again.");
                          }
                        }
                      }}
                      disabled={verifying}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
                      {verifying ? 'Checking Paystack...' : 'I Have Paid — Verify Payment Now'}
                    </button>

                    <p className="text-sm font-bold text-blue-900 uppercase tracking-wider pt-2">
                      Paystack Virtual Account
                    </p>
                    <p className="text-sm text-blue-800 mb-2">
                      Transfer <strong>₦{(paymentDetails.amount / 100).toLocaleString()}</strong> to activate:
                    </p>

                    <div className="space-y-3 mt-4">
                      <div>
                        <p className="text-xs text-blue-700 uppercase">Bank Name</p>
                        <p className="font-bold text-lg text-blue-900">{paymentDetails.bankName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-700 uppercase">Account Number</p>
                        <p className="font-bold text-2xl font-mono text-blue-900 tracking-wider">
                          {paymentDetails.accountNumber}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-700 uppercase">Account Name</p>
                        <p className="font-bold text-base text-blue-900">{paymentDetails.accountName}</p>
                      </div>
                    </div>

                    <p className="text-xs text-blue-800 mt-6 bg-blue-100 p-3 rounded-lg">
                      Expires at: {new Date(paymentDetails.expiresAt).toLocaleString()}
                    </p>
                  </div>

                  {/* Sound Warning Box */}
                  <div className="bg-red-50 border-2 border-red-500 p-4 rounded-xl text-left max-w-sm mx-auto flex items-start gap-3 shadow-xs">
                    <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-red-700 uppercase tracking-wider">⚠️ SOUND WARNING</p>
                      <p className="text-xs font-black text-red-900 mt-1 leading-snug">
                        NEVER EVER SAVE THIS BANK ACCOUNT NUMBER!
                      </p>
                      <p className="text-[11px] text-red-800 mt-1 leading-tight font-medium">
                        This account is generated dynamically ONLY for this specific waybill payment. If you save or transfer money to it later, <strong>YOU WILL LOSE YOUR MONEY!</strong>
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-left max-w-sm mx-auto space-y-2">
                    <p className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                      How to Complete Payment:
                    </p>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-2">
                      <li>
                        <strong>Direct Bank Transfer:</strong> Transfer ₦
                        {(paymentDetails.amount / 100).toLocaleString()} from your mobile banking app to the virtual
                        account shown above.
                      </li>
                      <li>
                        <strong>Cash at Counter:</strong> Hand ₦{(paymentDetails.amount / 100).toLocaleString()} cash
                        to the staff. The staff will perform the transfer or use a POS machine on your behalf.
                      </li>
                    </ul>
                  </div>

                  <div className="flex flex-col items-center gap-3 justify-center text-sm text-gray-500 font-medium">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                      </span>
                      <span>Waiting for transfer detection...</span>
                    </div>
                    <span className="text-xs text-gray-400 max-w-xs leading-normal">
                      Our system is listening to the bank. As soon as you transfer, the tracking ID will be generated and shown instantly.
                    </span>
                  </div>

                  <div className="pt-4">
                    <Button 
                      variant="secondary" 
                      onClick={async () => {
                        if (paymentDetails?.waybillId) {
                          await deleteWaybill(paymentDetails.waybillId);
                        }
                        setPaymentDetails(null);
                        setLoading(false);
                      }}
                      className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold"
                    >
                      🚫 Cancel Payment & Go Back
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateWaybill} className="space-y-4">
                  {companyStatusError && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-900 text-sm font-semibold">
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                      <span>{companyStatusError}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Sender Name <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                      </label>
                      <Input value={senderName} placeholder="Optional" onChange={(e) => setSenderName(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Sender Phone</label>
                      <Input
                        required
                        type="tel"
                        value={senderPhone}
                        onChange={(e) => setSenderPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Receiver Name <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                      </label>
                      <Input value={receiverName} placeholder="Optional" onChange={(e) => setReceiverName(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Receiver Phone</label>
                      <Input
                        required
                        type="tel"
                        value={receiverPhone}
                        onChange={(e) => setReceiverPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1 font-bold">
                      📦 Parcel Details <span className="text-xs text-emerald-700 font-normal">(Wetin you dey send?)</span>
                    </label>
                    <Input required value={itemDescription} placeholder="E.g. Mama's hot egusi soup, designer shoe or laptop 🍲👟" onChange={(e) => setItemDescription(e.target.value)} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Bus/Vehicle Number</label>
                      <Input
                        required
                        value={busNumber}
                        onChange={(e) => setBusNumber(e.target.value.toUpperCase())}
                        className="uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Destination Park</label>
                      <Input
                        required
                        list="parks-list"
                        value={destinationPark}
                        onChange={(e) => setDestinationPark(e.target.value)}
                        placeholder="Type or select park..."
                      />
                      <datalist id="parks-list">
                        {parks.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <Button type="submit" className="w-full mt-4" disabled={loading}>
                    {loading ? 'Creating...' : `Book Shipment (₦${bookingFee.toLocaleString()})`}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Sub-tab 2: Dispatch Manifest */}
          {subTab === 'dispatch' && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-6">
              <div>
                <h3 className="text-lg font-bold text-navy">Pending Bus Dispatches</h3>
                <p className="text-gray-600 text-sm">
                  Waybills booked at your park waiting to leave. Enter driver info and mark the bus as departed.
                </p>
              </div>

              {Object.keys(groupedManifest).length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="font-semibold">All quiet right now</p>
                  <p className="text-sm text-gray-500 mt-1">There are no pending waybill dispatches booked today.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {(Object.entries(groupedManifest) as [string, Waybill[]][]).map(([busNo, items]) => {
                    const currentDriver = driverInfo[busNo] || { name: '', phone: '' };
                    return (
                      <div key={busNo} className="border border-gray-200 rounded-2xl p-5 space-y-4 shadow-2xs">
                        <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                          <div>
                            <span className="text-xs uppercase tracking-wider text-gray-600 font-bold block">
                              VEHICLE / BUS NUMBER
                            </span>
                            <span className="text-xl font-mono font-bold text-navy">{busNo}</span>
                          </div>
                          <Badge status="Booked">{items.length} Packages Booked</Badge>
                        </div>

                        {/* Items listed on this bus */}
                        <div className="space-y-2 bg-bg-light p-3.5 rounded-xl border border-gray-150">
                          <p className="text-xs font-bold uppercase tracking-wider text-gray-600">Package Details</p>
                          <ul className="divide-y divide-gray-200 text-sm text-gray-700">
                            {items.map((it) => (
                              <li key={it.id} className="py-2 flex justify-between items-center">
                                <div>
                                  <span className="font-bold text-navy block">{it.itemDescription}</span>
                                  <span className="text-xs text-gray-600">
                                    To: {it.receiverName} ({it.destinationPark})
                                  </span>
                                  {(it.status === 'Draft' || it.paymentStatus === 'pending') && (
                                    deletingDraftId === it.id ? (
                                      <div className="inline-flex items-center gap-1.5 bg-red-100 p-1 rounded-lg border border-red-200 mt-1">
                                        <span className="text-[10px] font-bold text-red-900 pl-1">Delete Draft?</span>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            try {
                                              await deleteWaybill(it.id!);
                                              setDeletingDraftId(null);
                                            } catch (err) {
                                              console.error("Failed to delete draft:", err);
                                              alert("Failed to delete waybill.");
                                            }
                                          }}
                                          className="text-[10px] bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-0.5 rounded transition"
                                        >
                                          Yes
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setDeletingDraftId(null)}
                                          className="text-[10px] bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-2 py-0.5 rounded transition"
                                        >
                                          No
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setDeletingDraftId(it.id!)}
                                        className="text-xs text-red-600 hover:text-red-800 font-semibold mt-0.5 block"
                                      >
                                        Delete Draft
                                      </button>
                                    )
                                  )}
                                </div>
                                <span className="font-mono text-xs font-semibold bg-white border border-gray-200 px-2 py-0.5 rounded">
                                  {it.paymentStatus === 'success' ? 'PAID' : 'PENDING'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Driver details inputs for departure */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
                              Driver's Full Name (Optional)
                            </label>
                            <Input
                              value={currentDriver.name}
                              placeholder="E.g., Chidi Okafor (Optional)"
                              onChange={(e) =>
                                setDriverInfo((prev) => ({
                                  ...prev,
                                  [busNo]: { ...currentDriver, name: e.target.value }
                                }))
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1">
                              Driver's Phone Number (REQUIRED)
                            </label>
                            <Input
                              type="tel"
                              value={currentDriver.phone}
                              placeholder="E.g., 08012345678 (Required for Call Button)"
                              onChange={(e) =>
                                setDriverInfo((prev) => ({
                                  ...prev,
                                  [busNo]: { ...currentDriver, phone: e.target.value }
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="pt-2">
                          <Button onClick={() => handleDepartBus(busNo)} className="w-full">
                            Dispatch Bus & Notify Customers
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sub-tab 3: Drafts & Pending Payment History */}
          {subTab === 'drafts' && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-6">
              <div>
                <h3 className="text-lg font-bold text-navy flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-600" />
                  Draft & Pending Payment Waybills
                </h3>
                <p className="text-gray-600 text-sm">
                  Waybills booked at this park station where payment was interrupted or pending. Staff can resume and complete payment anytime.
                </p>
              </div>

              {draftWaybills.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-bg-light rounded-xl border border-gray-200">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <p className="font-semibold text-gray-800">No pending drafts!</p>
                  <p className="text-sm text-gray-500">All waybills booked at this station have been paid and activated.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {draftWaybills.map((wb) => (
                    <div key={wb.id} className="border border-amber-200 bg-amber-50/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold bg-amber-200 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
                            DRAFT / UNPAID
                          </span>
                          <span className="text-xs text-gray-500 font-mono">
                            {new Date(wb.createdTimestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="font-bold text-navy mt-1 text-base">{wb.itemDescription}</p>
                        <div className="text-xs text-gray-700 mt-1 space-y-0.5">
                          <p>
                            <strong>Sender:</strong> {wb.senderName || 'Sender'} ({wb.senderPhone})
                          </p>
                          <p>
                            <strong>Receiver:</strong> {wb.receiverName || 'Receiver'} ({wb.receiverPhone})
                          </p>
                          <p>
                            <strong>Route:</strong> {wb.originPark} ➔ {wb.destinationPark} (Bus {wb.busNumber})
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                        <button
                          type="button"
                          onClick={() => handleRetryPayment(wb)}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CreditCard className="w-4 h-4" /> Resume & Pay
                        </button>
                        {deletingDraftId === wb.id ? (
                          <div className="flex items-center gap-1.5 bg-red-100 p-1 rounded-lg border border-red-200">
                            <span className="text-xs font-bold text-red-900 pl-1">Delete?</span>
                            <button
                              type="button"
                              onClick={async () => {
                                if (wb.id) {
                                  await deleteWaybill(wb.id);
                                  setDeletingDraftId(null);
                                  loadData();
                                }
                              }}
                              className="text-xs bg-red-600 text-white font-bold px-2 py-1 rounded"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingDraftId(null)}
                              className="text-xs bg-gray-200 text-gray-800 font-bold px-2 py-1 rounded"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeletingDraftId(wb.id!)}
                            className="px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete Draft
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Incoming Segment sub-dashboard */}
      {mainTab === 'incoming' && (
        <div className="space-y-6">
          {/* Sub-tabs Row */}
          <div className="flex gap-2 border-b border-gray-200 pb-3">
            <button
              onClick={() => setSubTab('store')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition ${
                subTab === 'store'
                  ? 'bg-navy text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-navy'
              }`}
            >
              1. Waybill Store & Pickup ({storeWaybills.length})
            </button>
            <button
              onClick={() => setSubTab('incoming-buses')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition flex items-center gap-2 ${
                subTab === 'incoming-buses'
                  ? 'bg-navy text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-navy'
              }`}
            >
              2. Incoming Buses
              {Object.keys(incomingBuses).length > 0 && (
                <span className="bg-amber text-navy text-xs px-1.5 py-0.5 rounded-full font-bold">
                  {Object.keys(incomingBuses).length}
                </span>
              )}
            </button>
          </div>

          {/* Sub-tab 1: Waybill Store & Pickup */}
          {subTab === 'store' && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-6">
              <div>
                <h3 className="text-lg font-bold text-navy">Waybill Store Counter</h3>
                <p className="text-gray-600 text-sm">
                  Packages currently stored at your park counter. Verify recipient credentials to complete handover.
                </p>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                <Input
                  className="pl-10"
                  placeholder="Search by receiver name, phone, description, or tracking code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {filteredStoreWaybills.length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="font-semibold">No packages found</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {searchQuery ? 'Try adjusting your search terms.' : 'No arrived packages in store at the moment.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredStoreWaybills.map((wb) => {
                    const phoneVal = phoneInputs[wb.id!] || '';
                    const phoneErrVal = phoneErrorMsgs[wb.id!] || '';
                    return (
                      <div
                        key={wb.id}
                        className="p-5 border border-gray-200 rounded-2xl bg-white shadow-2xs grid gap-4 md:grid-cols-2 items-start"
                      >
                        {/* Package Info */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-mono font-bold text-navy">{wb.trackingCode}</span>
                            <Badge status="Arrived">In Store</Badge>
                          </div>
                          <div>
                            <span className="text-sm font-bold text-navy block">{wb.itemDescription}</span>
                            <span className="text-xs text-gray-600 block">
                              Sender: {wb.senderName} ({wb.senderPhone})
                            </span>
                            <span className="text-xs text-gray-600 block">
                              Origin Park: {wb.originPark}
                            </span>
                          </div>
                          <div className="bg-bg-light p-3 rounded-xl border border-gray-100 space-y-1 mt-2">
                            <p className="text-xs font-bold uppercase text-gray-600">Recipient Contact Info</p>
                            <p className="text-sm font-semibold text-navy">Name: {wb.receiverName}</p>
                            <p className="text-sm font-mono text-emerald-700 flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-emerald-600" />
                              {wb.receiverPhone}
                            </p>
                          </div>
                        </div>

                        {/* Handover Section: Receiver Phone Verification */}
                        <div className="border-t md:border-t-0 md:border-l border-gray-150 pt-4 md:pt-0 md:pl-5 space-y-3">
                          <p className="text-xs font-bold uppercase text-gray-600 tracking-wider">
                            Package Collection Verification
                          </p>

                          <div className="space-y-2.5 bg-emerald-50/70 p-4 rounded-xl border border-emerald-200">
                            <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                              <Phone className="w-4 h-4 text-emerald-600 shrink-0" /> Verify Receiver Phone Number
                            </p>
                            <p className="text-xs text-gray-600 leading-tight">
                              Ask customer for receiver's phone number and type it here to verify before handing over the package.
                            </p>
                            <div className="flex gap-2">
                              <Input
                                type="tel"
                                placeholder="Type receiver phone number..."
                                value={phoneVal}
                                className="text-xs font-mono bg-white h-10 flex-1 border-emerald-300 focus:border-emerald-600"
                                onChange={(e) =>
                                  setPhoneInputs((prev) => ({
                                    ...prev,
                                    [wb.id!]: e.target.value
                                  }))
                                }
                              />
                              <Button
                                size="sm"
                                className="h-10 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shrink-0 px-3"
                                disabled={!phoneVal.trim()}
                                onClick={() => handleVerifyPhoneHandover(wb)}
                              >
                                Verify & Hand Over
                              </Button>
                            </div>
                            {phoneErrVal && <p className="text-red-600 text-xs font-semibold leading-tight mt-1">{phoneErrVal}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sub-tab 2: Incoming Buses */}
          {subTab === 'incoming-buses' && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-6">
              <div>
                <h3 className="text-lg font-bold text-navy flex items-center gap-2">
                  <Truck className="w-5 h-5 text-navy" /> Bus Dey Road! (Travelling To Your Park) 🚌💨
                </h3>
                <p className="text-gray-600 text-sm">
                  Buses that have departed from other motor parks heading straight towards <strong className="text-navy">{user?.park}</strong>.
                </p>
              </div>

              {Object.keys(incomingBuses).length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3 animate-pulse" />
                  <p className="font-semibold">No bus currently on the road for {user?.park}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    When another park sends a bus heading to your park, it will show here automatically!
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {(Object.entries(incomingBuses) as [string, Waybill[]][]).map(([busNo, items]) => (
                    <div key={busNo} className="border border-gray-200 rounded-2xl p-5 space-y-4 shadow-2xs">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                        <div>
                          <span className="text-xs uppercase tracking-wider text-gray-600 font-bold block">
                            VEHICLE / BUS NUMBER
                          </span>
                          <span className="text-xl font-mono font-bold text-navy">{busNo}</span>
                        </div>
                        <Badge status="Departed">En Route ({items.length} Packages)</Badge>
                      </div>

                      {/* Driver Details */}
                      {items[0].driverPhone && (
                        <div className="flex justify-between items-center bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-sm text-blue-900">
                          <div>
                            <span className="text-xs font-bold text-blue-800 uppercase block">DRIVER CONTACT</span>
                            <span className="font-semibold">
                              {items[0].driverName || 'Not Specifed'} ({items[0].driverPhone})
                            </span>
                          </div>
                          <a
                            href={`tel:${items[0].driverPhone}`}
                            className="bg-white text-blue-800 font-semibold text-xs px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition"
                          >
                            Call Driver
                          </a>
                        </div>
                      )}

                      {/* Packages Details list */}
                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-600">
                          Shipment Packages list
                        </p>
                        <div className="max-h-40 overflow-y-auto divide-y divide-gray-100 bg-gray-50 rounded-xl p-3 border border-gray-200">
                          {items.map((it) => (
                            <div key={it.id} className="py-2 flex justify-between text-xs text-gray-700">
                              <div>
                                <span className="font-bold text-navy block">{it.itemDescription}</span>
                                <span className="text-gray-600">Origin: {it.originPark}</span>
                              </div>
                              <span className="font-mono text-[10px] text-gray-600 bg-white border px-1.5 py-0.5 rounded">
                                {it.trackingCode}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Confirm Arrival Action */}
                      <div className="pt-2">
                        <Button onClick={() => handleArriveBus(busNo)} className="w-full">
                          Mark Bus as Arrived & Move to Store
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
