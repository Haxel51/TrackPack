import { FormEvent, useEffect, useState } from 'react';
import { useAuthStore } from '../store';
import { Button, Input, Badge } from '../components/ui';
import { createWaybill, deleteWaybill, getCompanyById, getSenderManifest, markBusDeparted } from '../lib/api';
import { normalizeTo11Digits } from '../lib/helpers';
import { Waybill } from '../types';
import { Send, List, AlertTriangle, RefreshCw } from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function SenderView() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'create' | 'manifest'>('create');
  
  // Form State
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [busNumber, setBusNumber] = useState('');
  const [destinationPark, setDestinationPark] = useState('');
  const [parks, setParks] = useState<string[]>([]);
  const [manifest, setManifest] = useState<Waybill[]>([]);
  const [loading, setLoading] = useState(false);
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
        return true;
      }
    } catch (err) {
      console.error('Verify Payment Error:', err);
    }
    return false;
  };
  
  const [driverInfo, setDriverInfo] = useState<Record<string, {name: string, phone: string}>>({});

  useEffect(() => {
    // Dynamically listen to booking fee price settings from Firestore
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

  useEffect(() => {
    if (user?.companyId) {
      getCompanyById(user.companyId).then(comp => {
        if (!comp) {
          setCompanyStatusError("This transport company account has been removed by platform administration. Waybill booking is disabled.");
        } else if (comp.approved !== true || comp.status === 'suspended') {
          setCompanyStatusError("This transport company account is currently suspended or pending approval by platform administration. Waybill booking is disabled.");
        } else {
          setCompanyStatusError(null);
          setParks(comp.parks.filter(p => p !== user.park));
        }
      });
    }
    if (tab === 'manifest') {
      loadManifest();
    }
  }, [user?.park, tab]);

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

    verifyWaybillPayment(paymentDetails.waybillId, paymentDetails.reference);

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

  const loadManifest = async () => {
    if (user?.park) {
      const data = await getSenderManifest(user.park);
      setManifest(data);
    }
  };

  const generateTrackingCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreate = async (e: FormEvent) => {
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
      alert('Sender phone number must be exactly 11 digits (e.g. 08012345678).');
      setLoading(false);
      return;
    }

    if (normalizedReceiverPhone.length !== 11) {
      alert('Receiver phone number must be exactly 11 digits (e.g. 08012345678).');
      setLoading(false);
      return;
    }

    if (!destinationPark || !destinationPark.trim()) {
      alert('Please select a destination motor park.');
      setLoading(false);
      return;
    }

    if (user.park && destinationPark && user.park.trim().toLowerCase() === destinationPark.trim().toLowerCase()) {
      alert('Departure park and Destination park cannot be the same motor park! A waybill must travel to a different terminal.');
      setLoading(false);
      return;
    }
    
    try {
      // Always create as Draft with no tracking code yet
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
        paymentStatus: 'pending'
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
            alert(data.message || "Failed to generate payment virtual account.");
          }
        } catch (err) {
          console.error("Payment API Error:", err);
          alert("Failed to contact payment server.");
        }
      }
    } catch (err) {
      alert("Failed to create waybill.");
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
        setTab('create'); // Switch to create tab to show the payment screen
      } else {
        alert("Failed to generate payment virtual account.");
      }
    } catch (err) {
      console.error("Payment API Error:", err);
      alert("Failed to contact payment server.");
    } finally {
      setLoading(false);
    }
  };

  const handleDepart = async (busNo: string) => {
    if (!user?.park) return;
    const info = driverInfo[busNo] || { name: '', phone: '' };
    if (info.phone) {
      const normalizedDriverPhone = normalizeTo11Digits(info.phone);
      if (normalizedDriverPhone.length !== 11) {
        alert("Driver's phone number must be exactly 11 digits (e.g. 08012345678) if provided.");
        return;
      }
    }
    await markBusDeparted(busNo, user.park, info.name || '', info.phone ? normalizeTo11Digits(info.phone) : '');
    setDriverInfo(prev => {
      const next = { ...prev };
      delete next[busNo];
      return next;
    });
    loadManifest();
  };

  const groupedManifest = manifest.reduce((acc, wb) => {
    if (!acc[wb.busNumber]) acc[wb.busNumber] = [];
    acc[wb.busNumber].push(wb);
    return acc;
  }, {} as Record<string, Waybill[]>);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setTab('create')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-base font-medium rounded-lg transition-colors ${tab === 'create' ? 'bg-white shadow-sm text-navy' : 'text-gray-700 hover:text-navy'}`}
        >
          <Send className="w-4 h-4" /> Create Waybill
        </button>
        <button
          onClick={() => setTab('manifest')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-base font-medium rounded-lg transition-colors ${tab === 'manifest' ? 'bg-white shadow-sm text-navy' : 'text-gray-700 hover:text-navy'}`}
        >
          <List className="w-4 h-4" /> Manifests
        </button>
      </div>

      {tab === 'create' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200">
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
                  Your waybill is booked and ready. Share the tracking ID above with the sender or receiver to track the package in real-time.
                </p>
              </div>
              <Button onClick={() => { setCreatedCode(''); setPaymentDetails(null); }}>Create Another</Button>
            </div>
          ) : paymentDetails ? (
            <div className="text-center py-12 space-y-6">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Send className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-navy mb-2">Awaiting Payment</h3>
                <p className="text-gray-700 text-base max-w-sm mx-auto">
                  Please pay the ₦{bookingFee.toFixed(2)} booking fee to book this waybill and generate its tracking ID.
                </p>
              </div>

              {/* Clear How to Pay Instructions */}
              <div className="bg-emerald-50/80 border border-emerald-200 p-4 rounded-xl text-left max-w-sm mx-auto space-y-2.5">
                <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  💳 HOW TO COMPLETE PAYMENT (₦{(paymentDetails.amount / 100).toLocaleString()})
                </p>
                <ul className="list-disc list-inside text-xs text-emerald-950 space-y-2 leading-relaxed">
                  <li>
                    <strong>CUSTOMER MOBILE TRANSFER:</strong> Customer makes the <strong>BANK TRANSFER</strong> directly using their own mobile banking app on their phone.
                  </li>
                  <li>
                    <strong>CASH OR POS AT COUNTER:</strong> If the customer brings cash, hand the cash to the staff. Staff will use their phone or park POS terminal to perform the transfer.
                  </li>
                </ul>
                <p className="text-[11px] text-emerald-800 font-medium pt-1">
                  👇 Click the green button below to open Paystack Checkout and proceed with payment:
                </p>
              </div>

              {/* Serious Red Warning Box */}
              <div className="bg-red-50 border-2 border-red-500 p-4 rounded-xl text-left max-w-sm mx-auto flex items-start gap-3 shadow-xs">
                <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-black text-red-700 uppercase tracking-wider flex items-center gap-1">
                    ⚠️ CRITICAL PAYMENT WARNING ⚠️
                  </p>
                  <p className="text-xs font-black text-red-900 leading-snug">
                    NEVER EVER SAVE ANY BANK ACCOUNT DETAILS DISPLAYED ON PAYSTACK CHECKOUT!
                  </p>
                  <p className="text-[11px] text-red-800 leading-relaxed font-medium">
                    Every bank account number generated is for <strong>ONE-TIME USE ONLY</strong> for this specific waybill. If you save or transfer money to it again later, <strong>YOU WILL LOSE YOUR MONEY</strong> and TrackPack cannot recover or refund it!
                  </p>
                </div>
              </div>

              <div className="max-w-sm mx-auto space-y-3">
                {paymentDetails.authorizationUrl && (
                  <a
                    href={paymentDetails.authorizationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all text-sm cursor-pointer active:scale-98"
                  >
                    💳 Proceed to Payment via Paystack Checkout
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
                  className="w-full bg-navy hover:bg-navy-light text-white font-bold py-3 px-4 rounded-xl shadow-xs transition-all text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
                  {verifying ? 'Checking Paystack...' : 'I Have Paid — Verify Payment Now'}
                </button>
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
            <form onSubmit={handleCreate} className="space-y-4">
              {companyStatusError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-900 text-sm font-semibold">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                  <span>{companyStatusError}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base text-gray-700 mb-1">
                    Sender Name <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                  </label>
                  <Input value={senderName} placeholder="Optional" onChange={e => setSenderName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-base text-gray-700 mb-1">Sender Phone</label>
                  <Input required type="tel" value={senderPhone} onChange={e => setSenderPhone(e.target.value)} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base text-gray-700 mb-1">
                    Receiver Name <span className="text-gray-400 text-xs font-normal">(Optional)</span>
                  </label>
                  <Input value={receiverName} placeholder="Optional" onChange={e => setReceiverName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-base text-gray-700 mb-1">Receiver Phone</label>
                  <Input required type="tel" value={receiverPhone} onChange={e => setReceiverPhone(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-base text-gray-700 mb-1 font-bold">
                  📦 Parcel Details <span className="text-xs text-emerald-700 font-normal">(Wetin you dey send?)</span>
                </label>
                <Input required value={itemDescription} placeholder="E.g. Mama's hot egusi soup, designer shoe or laptop 🍲👟" onChange={e => setItemDescription(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base text-gray-700 mb-1">Bus/Vehicle Number</label>
                  <Input required value={busNumber} onChange={e => setBusNumber(e.target.value.toUpperCase())} className="uppercase" />
                </div>
                <div>
                  <label className="block text-base text-gray-700 mb-1">Destination Park</label>
                  <Input 
                    required
                    list="parks-list"
                    value={destinationPark} 
                    onChange={e => setDestinationPark(e.target.value)}
                    placeholder="Type or select park..."
                  />
                  <datalist id="parks-list">
                    {parks.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mt-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-4 w-4 h-4 mt-1 rounded-full bg-amber text-white flex items-center justify-center font-bold text-xs">₦</div>
                  <div>
                    <p className="font-bold text-amber-900 text-base">Booking Fee: ₦{bookingFee.toFixed(2)}</p>
                    <p className="text-sm text-amber-800 mt-1">
                      All waybills require a standard ₦{bookingFee} booking fee to generate a Tracking ID and enable live status tracking.
                    </p>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full mt-4" size="lg" disabled={loading}>
                {loading ? 'Creating...' : `Proceed to Payment (₦${bookingFee})`}
              </Button>
            </form>
          )}
        </div>
      )}

      {tab === 'manifest' && (
        <div className="space-y-4">
          {Object.keys(groupedManifest).length === 0 ? (
            <div className="text-center py-12 text-gray-700 bg-white rounded-2xl border border-gray-200">
              No booked waybills waiting for departure.
            </div>
          ) : (
            Object.entries(groupedManifest).map(([busNo, items]: [string, any]) => (
              <div key={busNo} className="bg-white p-6 rounded-2xl border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-navy">Bus: {busNo}</h3>
                    <p className="text-gray-700 text-base">Destination: {items[0].destinationPark} · {items.length} items</p>
                  </div>
                  <Button onClick={() => handleDepart(busNo)}>Mark as Departed</Button>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-base text-gray-700 mb-1">Driver Name (Optional)</label>
                    <Input 
                      placeholder="e.g. John Doe"
                      value={driverInfo[busNo]?.name || ''} 
                      onChange={e => setDriverInfo(prev => ({ ...prev, [busNo]: { name: e.target.value, phone: prev[busNo]?.phone || '' } }))} 
                    />
                  </div>
                  <div>
                    <label className="block text-base text-gray-700 mb-1">Driver Phone (Optional)</label>
                    <Input 
                      type="tel"
                      placeholder="e.g. 08012345678 (Optional)"
                      value={driverInfo[busNo]?.phone || ''} 
                      onChange={e => setDriverInfo(prev => ({ ...prev, [busNo]: { name: prev[busNo]?.name || '', phone: e.target.value } }))} 
                    />
                  </div>
                </div>

                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  {items.map(wb => (
                    <div key={wb.id} className="py-3 flex justify-between items-center">
                      <div>
                        <p className="font-mono text-lg font-bold text-navy">{wb.trackingCode || 'DRAFT'}</p>
                        <p className="text-sm text-gray-700">{wb.itemDescription}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {(wb.paymentStatus === 'pending' || wb.paymentStatus === 'expired') && (
                            <button 
                              onClick={() => handleRetryPayment(wb)}
                              className="text-xs text-amber font-semibold hover:underline"
                            >
                              Pay for Live Tracking
                            </button>
                          )}
                          {(wb.status === 'Draft' || wb.paymentStatus === 'pending') && (
                            deletingDraftId === wb.id ? (
                              <div className="inline-flex items-center gap-1.5 bg-red-100 p-1 rounded-lg border border-red-200 mt-1">
                                <span className="text-[10px] font-bold text-red-900 pl-1">Delete Draft?</span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await deleteWaybill(wb.id!);
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
                                onClick={() => setDeletingDraftId(wb.id!)}
                                className="text-xs text-red-600 hover:text-red-800 font-semibold"
                              >
                                Delete Draft
                              </button>
                            )
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge status={wb.status}>{wb.status}</Badge>
                        {wb.liveTrackingActive && (
                          <span className="text-xs font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                            Live Tracking
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
