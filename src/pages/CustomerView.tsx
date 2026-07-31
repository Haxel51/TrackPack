import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store';
import { registerPushNotification, sendTestPushNotification, deleteWaybill, getStoredRoutes } from '../lib/api';
import { Waybill } from '../types';
import { Badge } from '../components/ui';
import { Package, ArrowRight, Info, FileText, X, Phone, Trash2, CreditCard, AlertTriangle, RefreshCw, Bell, Share2 } from 'lucide-react';
import { getWarmerStatusPhrase } from '../components/CustomerNotificationListener';
import { DigitalWaybillReceipt } from '../components/DigitalWaybillReceipt';
import { PushNotificationTesterCard } from '../components/NotificationToast';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Button } from '../components/ui';
import { normalizeTo11Digits } from '../lib/helpers';

export function CustomerView() {
  const { user } = useAuthStore();
  const [waybills, setWaybills] = useState<Waybill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<Waybill | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [bookingFee] = useState<number>(200);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushActive, setPushActive] = useState(false);
  const [routeDistances, setRouteDistances] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadRoutes = async () => {
      try {
        const routes = await getStoredRoutes();
        const mapping: Record<string, number> = {};
        routes.forEach((r: any) => {
          if (r.originPark && r.destinationPark && r.distanceKm) {
            const cleanOrigin = r.originPark.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
            const cleanDest = r.destinationPark.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
            mapping[`${cleanOrigin}__to__${cleanDest}`] = r.distanceKm;
          }
        });
        setRouteDistances(mapping);
      } catch (err) {
        console.warn('Failed to load route distances in CustomerView:', err);
      }
    };
    loadRoutes();
  }, []);

  // Helper to verify payment status via server endpoint
  const verifyWaybillPayment = async (waybillId: string, reference?: string, paymentStatus?: string, forceVerify?: boolean) => {
    try {
      setVerifyingId(waybillId);
      const res = await fetch('/api/paystack/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waybillId, reference, paymentStatus, forceVerify })
      });
      const data = await res.json();
      if (data.status === 'success' && data.trackingCode) {
        setPaymentDetails(null);
        alert(`Payment verified successfully! Waybill is now active. Tracking Code: ${data.trackingCode}`);
        return true;
      }
    } catch (err) {
      console.error('Verify Payment Error:', err);
    } finally {
      setVerifyingId(null);
    }
    return false;
  };

  // Handle Paystack Redirect Callback (e.g. ?payment_status=cancelled or ?payment_status=completed)
  useEffect(() => {
    if (user?.phone) {
      const norm = normalizeTo11Digits(user.phone);
      if (localStorage.getItem(`push_pref_${norm}`) === 'true') {
        setPushActive(true);
      }
    }

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
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'completed' || paymentStatus === 'success' || reference || waybillId) {
      if (waybillId) {
        verifyWaybillPayment(waybillId, reference, paymentStatus || 'completed').finally(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        });
      } else {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    if (!user?.phone) {
      setLoading(false);
      return;
    }

    const normalizedPhone = normalizeTo11Digits(user.phone);

    // Real-time listener for customer waybills (sender or receiver)
    const unsub = onSnapshot(collection(db, 'waybills'), (snapshot) => {
      const list: Waybill[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Waybill;
        const w = { ...data, id: docSnap.id };
        if (
          normalizeTo11Digits(w.senderPhone || '') === normalizedPhone ||
          normalizeTo11Digits(w.receiverPhone || '') === normalizedPhone
        ) {
          list.push(w);
        }
      });
      list.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
      setWaybills(list);
      setLoading(false);
    }, (err) => {
      console.error("Error listening to customer waybills:", err);
      setLoading(false);
    });

    // Automatically register push notifications in background if available
    if ('Notification' in window && Notification.permission === 'granted') {
      registerPushNotification(user.phone).catch(() => {});
    }

    return () => unsub();
  }, [user?.phone]);

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
          setPaymentDetails(null);
        }
      }
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [paymentDetails?.waybillId, paymentDetails?.reference]);

  const handleDeleteDraft = async (id: string) => {
    try {
      await deleteWaybill(id);
      setDeletingDraftId(null);
    } catch (err) {
      console.error("Failed to delete draft:", err);
      alert("Failed to delete waybill.");
    }
  };

  const handlePayDraft = async (wb: Waybill) => {
    setLoading(true);
    try {
      const res = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `${user?.phone || 'customer'}@trackpack.example.com`,
          amount: bookingFee * 100,
          waybillId: wb.id
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setPaymentDetails({ ...data.data, waybillId: wb.id });
      } else {
        alert(data.message || "Failed to generate payment virtual account.");
      }
    } catch (err) {
      console.error("Payment API Error:", err);
      alert("Failed to contact payment server.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-700">Loading your waybills...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Your Digital Waybill History</h1>
          <p className="text-gray-700 mt-1">Complete paperless receipts, tracking codes, and pickup pass for all your shipments.</p>
        </div>
      </div>

      {/* Push Notification Bar Banner */}
      <PushNotificationTesterCard phone={user?.phone} />

      {/* Payment Modal for Drafts */}
      {paymentDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl my-8 bg-white p-6 rounded-2xl shadow-xl space-y-4">
            <button
              onClick={() => setPaymentDetails(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-navy font-bold"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-navy">Complete Waybill Payment</h3>
              <p className="text-sm text-gray-600">Pay ₦{bookingFee} booking fee to activate tracking.</p>
            </div>

            {/* Clear How to Pay Instructions */}
            <div className="bg-emerald-50/80 border border-emerald-200 p-4 rounded-xl text-left space-y-2.5">
              <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                💳 HOW TO COMPLETE PAYMENT (₦{bookingFee})
              </p>
              <ul className="list-disc list-inside text-xs text-emerald-950 space-y-2 leading-relaxed">
                <li>
                  <strong>CUSTOMER MOBILE TRANSFER:</strong> Customer makes the <strong>BANK TRANSFER</strong> directly using their own mobile banking app on their phone.
                </li>
                <li>
                  <strong>CASH OR POS AT COUNTER:</strong> If bringing cash, hand cash to staff. Staff will perform the transfer using their phone or park POS terminal.
                </li>
              </ul>
              <p className="text-[11px] text-emerald-800 font-medium pt-1">
                👇 Click the green button below to open Paystack Checkout and proceed with payment:
              </p>
            </div>

            {/* Serious Red Warning Box */}
            <div className="bg-red-50 border-2 border-red-500 p-4 rounded-xl text-left flex items-start gap-3 shadow-xs">
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
                  const ok = await verifyWaybillPayment(paymentDetails.waybillId, paymentDetails.reference, undefined, true);
                  if (!ok) {
                    alert("Payment not confirmed on Paystack yet. If you just transferred, please wait a few seconds and try again.");
                  }
                }
              }}
              disabled={verifyingId === paymentDetails?.waybillId}
              className="w-full bg-navy hover:bg-navy-light text-white font-bold py-3 px-4 rounded-xl shadow-xs transition-all text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${verifyingId === paymentDetails?.waybillId ? 'animate-spin' : ''}`} />
              {verifyingId === paymentDetails?.waybillId ? 'Checking Paystack...' : 'I Have Paid — Verify Payment Now'}
            </button>

            <Button variant="secondary" onClick={() => setPaymentDetails(null)} className="w-full">
              Close / Return
            </Button>
          </div>
        </div>
      )}

      {/* Modal for full Digital Waybill Receipt */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl my-8">
            <button
              onClick={() => setSelectedReceipt(null)}
              className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white text-navy font-bold shadow-lg flex items-center justify-center border border-gray-200 z-10 hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
            <DigitalWaybillReceipt waybill={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
          </div>
        </div>
      )}
      
      {waybills.length === 0 ? (
        <div className="text-center py-12 text-gray-700 bg-white rounded-2xl border border-gray-200">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p>No waybills found for {user?.phone}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {waybills.map(wb => {
            const isDraft = wb.status === 'Draft' || wb.paymentStatus === 'pending';
            return (
              <div key={wb.id} className="bg-white p-5 rounded-2xl border border-gray-200 hover:border-gray-400 transition-colors shadow-xs">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-mono font-bold text-lg text-navy">
                        {isDraft ? 'DRAFT (Unpaid)' : wb.trackingCode}
                      </h3>
                      {wb.senderPhone === user?.phone ? (
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                          You Sent
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-amber/20 text-amber-900 px-2 py-0.5 rounded-full border border-amber/30">
                          To Receive
                        </span>
                      )}
                    </div>
                    <p className="text-base font-semibold text-gray-800 mt-1">{wb.itemDescription}</p>
                  </div>
                  <Badge status={wb.status}>{isDraft ? 'Draft' : wb.status}</Badge>
                </div>
                
                <div className="flex items-center text-sm text-gray-700 bg-bg-light p-3 rounded-xl mb-3">
                  <span className="font-semibold truncate max-w-[120px]">{wb.originPark}</span>
                  <ArrowRight className="w-4 h-4 mx-2 text-gray-500 flex-shrink-0" />
                  <span className="font-semibold truncate max-w-[120px]">{wb.destinationPark}</span>
                </div>

                {isDraft ? (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl mb-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-amber-900">Awaiting Payment</p>
                      <p className="text-xs text-amber-800">You can pay now to activate tracking or delete this draft.</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto items-center">
                      {deletingDraftId === wb.id ? (
                        <div className="flex items-center gap-1.5 bg-red-100 p-1.5 rounded-lg border border-red-200">
                          <span className="text-[11px] font-bold text-red-900">Delete?</span>
                          <button
                            onClick={() => handleDeleteDraft(wb.id!)}
                            className="text-[11px] bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded transition"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeletingDraftId(null)}
                            className="text-[11px] bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-2.5 py-1 rounded transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handlePayDraft(wb)}
                            className="flex-1 sm:flex-none text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-lg flex items-center justify-center gap-1.5 transition"
                          >
                            <CreditCard className="w-4 h-4" /> Pay Now
                          </button>
                          <button
                            onClick={async () => {
                              if (wb.id) {
                                const ok = await verifyWaybillPayment(wb.id, wb.paystackReference, undefined, true);
                                if (!ok) {
                                  alert("Payment not confirmed on Paystack yet. If you paid, please wait a few seconds and try again.");
                                }
                              }
                            }}
                            disabled={verifyingId === wb.id}
                            className="flex-1 sm:flex-none text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-3.5 py-2 rounded-lg flex items-center justify-center gap-1.5 border border-blue-200 transition disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${verifyingId === wb.id ? 'animate-spin' : ''}`} />
                            {verifyingId === wb.id ? 'Verifying...' : 'Verify Payment'}
                          </button>
                          <button
                            onClick={() => setDeletingDraftId(wb.id!)}
                            className="flex-1 sm:flex-none text-xs bg-red-50 hover:bg-red-100 text-red-700 font-bold px-3.5 py-2 rounded-lg flex items-center justify-center gap-1.5 border border-red-200 transition"
                          >
                            <Trash2 className="w-4 h-4" /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {wb.receiverPhone === user?.phone ? (
                      <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-emerald-700" />
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Receiver Store Pickup ID</p>
                            <p className="text-xs text-gray-600">Provide this phone number at park store when collecting</p>
                          </div>
                        </div>
                        <span className="text-base font-mono font-extrabold text-emerald-700 tracking-wider bg-white px-3 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                          {wb.receiverPhone}
                        </span>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl mb-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Recipient Contact</p>
                            <p className="text-gray-700 font-semibold">{wb.receiverName}</p>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-navy bg-white px-3 py-1 rounded-lg border border-gray-200">
                          {wb.receiverPhone}
                        </span>
                      </div>
                    )}

                    {/* Warmer status language display in-line */}
                    <div className="text-xs font-semibold text-emerald-700 mb-4 flex items-center gap-1.5 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/50">
                      <Info className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>
                        {(() => {
                          const cleanOrigin = (wb.originPark || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
                          const cleanDest = (wb.destinationPark || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
                          const dist = routeDistances[`${cleanOrigin}__to__${cleanDest}`];
                          return getWarmerStatusPhrase(wb.status, wb, undefined, dist);
                        })()}
                      </span>
                    </div>
                  </>
                )}
                
                <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                  {!isDraft && (
                    <button
                      onClick={() => setSelectedReceipt(wb)}
                      className="text-xs bg-navy text-white hover:bg-navy-hover font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" /> Full Digital Receipt
                    </button>
                  )}

                  {!isDraft && wb.driverPhone && wb.status !== 'Collected' && wb.status !== 'Delivered' && (
                    <a
                      href={`tel:${wb.driverPhone}`}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer animate-pulse"
                    >
                      <Phone className="w-3.5 h-3.5" /> Call Driver ({wb.driverPhone})
                    </a>
                  )}

                  {!isDraft && (
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`*TrackPack Waybill Tracking*\nTracking Code: *${wb.trackingCode}*\nReceiver Phone: *${wb.receiverPhone}*\nItem: ${wb.itemDescription}\nRoute: ${wb.originPark} ➔ ${wb.destinationPark}\nStatus: ${wb.status}\n\nTrack real-time here: ${window.location.origin}/track/${wb.trackingCode}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" /> Share to Receiver
                    </a>
                  )}

                  {!isDraft && (
                    <Link
                      to={`/track/${wb.trackingCode}`}
                      className="text-xs font-bold text-gray-600 hover:text-navy flex items-center gap-1 ml-auto"
                    >
                      Live Tracking <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

