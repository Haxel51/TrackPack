import { FormEvent, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getWaybillByTracking, markWaybillCollected, markWaybillCollectedByStaff, registerPushNotification, sendTestPushNotification } from '../lib/api';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Waybill } from '../types';
import { Badge, Button, Input } from '../components/ui';
import { formatTimestamp, normalizeTo11Digits } from '../lib/helpers';
import { Package, ArrowLeft, CheckCircle2, Circle, MapPin, Truck, ShieldCheck, HelpCircle, Info, FileText, KeyRound, X, Phone, Bell, Share2, Copy, Check } from 'lucide-react';
import { useAuthStore } from '../store';
import { calculateTransitAnalysis, getRouteTransitInfo } from '../lib/eta';
import { getWarmerStatusPhrase } from '../components/CustomerNotificationListener';
import { DigitalWaybillReceipt } from '../components/DigitalWaybillReceipt';
import { PushNotificationTesterCard } from '../components/NotificationToast';
import { cn } from '../lib/utils';

export function PublicTrackView() {
  const { code } = useParams<{ code: string }>();
  const [waybill, setWaybill] = useState<Waybill | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);
  
  const { user } = useAuthStore();
  const [pickupCodeInput, setPickupCodeInput] = useState('');
  const [pickupError, setPickupError] = useState('');
  const [pickupSuccess, setPickupSuccess] = useState(false);
  
  // Historical average transit time state calculated from actual completed user waybills
  const [historicalAverageHours, setHistoricalAverageHours] = useState<number | undefined>(undefined);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | undefined>(undefined);
  const [hasHistoricalData, setHasHistoricalData] = useState<boolean>(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushActive, setPushActive] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const loadData = async () => {
    if (code) {
      setLoading(true);
      const data = await getWaybillByTracking(code.toUpperCase());
      setWaybill(data);
      
      if (data) {
        // Auto-register push subscription for receiver/sender if permission is already granted
        const phoneToRegister = user?.phone || data.receiverPhone || data.senderPhone;
        if (phoneToRegister) {
          const norm = normalizeTo11Digits(phoneToRegister);
          if (localStorage.getItem(`push_pref_${norm}`) === 'true') {
            setPushActive(true);
          }
          registerPushNotification(phoneToRegister).then(ok => { if (ok) setPushActive(true); }).catch(() => {});
        }
        try {
          const cleanOrigin = (data.originPark || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
          const cleanDest = (data.destinationPark || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
          const routeDocId = `${cleanOrigin}__to__${cleanDest}`;
          const routeSnap = await getDoc(doc(db, 'routes', routeDocId));
          if (routeSnap.exists()) {
            const rData = routeSnap.data();
            const dist = rData.distanceKm || undefined;
            setRouteDistanceKm(dist);
            
            const routeInfo = getRouteTransitInfo(
              data.originPark,
              data.destinationPark,
              undefined,
              dist,
              rData.completedTrips || [],
              rData.initialEstimateHours
            );
            setHistoricalAverageHours(routeInfo.durationHours);
            setHasHistoricalData(routeInfo.isSelfLearned);
          } else {
            const routeInfo = getRouteTransitInfo(data.originPark, data.destinationPark);
            setRouteDistanceKm(routeInfo.distanceKm);
            setHistoricalAverageHours(routeInfo.durationHours);
            setHasHistoricalData(false);
          }
        } catch (routeErr) {
          console.warn('Could not load saved route information from Firestore:', routeErr);
        }
      }
      
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [code]);

  const handleStaffHandover = async () => {
    if (!waybill?.id) return;
    setPickupError('');
    const success = await markWaybillCollectedByStaff(waybill.id, `Verified at store desk for receiver ${waybill.receiverPhone}`);
    if (success) {
      setPickupSuccess(true);
      loadData();
    } else {
      setPickupError('Unable to update waybill status.');
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-700">Searching...</div>;

  if (!waybill) return (
    <div className="max-w-md mx-auto py-12 text-center">
      <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-navy mb-2">Waybill Not Found</h2>
      <p className="text-gray-700 mb-6">Please check the tracking code and try again.</p>
      <Link to="/">
        <Button variant="secondary">Go Back</Button>
      </Link>
    </div>
  );

  const isStaffOrAdmin = user?.role === 'admin' || user?.role === 'sender' || user?.role === 'receiver';
  const isCustomerLinked = user?.phone === waybill.senderPhone || user?.phone === waybill.receiverPhone;
  const isDepartedOrLater = waybill.status !== 'Booked';
  const canViewDriver = waybill.driverPhone && (isStaffOrAdmin || (isCustomerLinked && isDepartedOrLater));

  const stageOrder = ['Booked', 'Departed', 'Arrived', 'Collected'];
  const effectiveStatus = waybill.status === 'In Transit' ? 'Departed' : waybill.status;
  const currentStageIndex = stageOrder.indexOf(effectiveStatus);

  const progress = calculateTransitAnalysis(
    waybill.originPark,
    waybill.destinationPark,
    waybill.departedTimestamp,
    waybill.status,
    historicalAverageHours,
    routeDistanceKm
  );

  const displayStatus = waybill.status === 'Departed' ? 'In Transit' : waybill.status;

  let progressPercent = 10;
  let ProgressIcon = Package;

  if (waybill.status === 'Booked') {
    progressPercent = 10;
    ProgressIcon = Package;
  } else if (waybill.status === 'Departed') {
    const transitPct = progress?.progressPercent ?? 50;
    progressPercent = 25 + (transitPct * 0.5); // ranges 25% - 75%
    ProgressIcon = Truck;
  } else if (waybill.status === 'Arrived') {
    progressPercent = 88;
    ProgressIcon = Package;
  } else if (waybill.status === 'Collected') {
    progressPercent = 100;
    ProgressIcon = CheckCircle2;
  }

  return (
    <div className="max-w-lg mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <Link to="/" className="inline-flex items-center text-base font-medium text-gray-700 hover:text-navy">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Link>

        <button
          onClick={() => setShowReceipt(true)}
          className="bg-navy hover:bg-navy-hover text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition"
        >
          <FileText className="w-4 h-4" /> Full Digital Receipt
        </button>
      </div>

      {/* Full Digital Receipt Modal */}
      {showReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl my-8">
            <button
              onClick={() => setShowReceipt(false)}
              className="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white text-navy font-bold shadow-lg flex items-center justify-center border border-gray-200 z-10 hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
            <DigitalWaybillReceipt waybill={waybill} onClose={() => setShowReceipt(false)} />
          </div>
        </div>
      )}
      
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-base text-gray-700 mb-1">TRACKING CODE</p>
            <h1 className="text-3xl font-mono font-bold text-navy">{waybill.trackingCode}</h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge status={waybill.status}>{displayStatus}</Badge>
            {waybill.liveTrackingActive && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-900">
                <Truck className="w-3 h-3" /> Live Tracking
              </span>
            )}
          </div>
        </div>
        
        <div className="bg-bg-light p-4 rounded-xl mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-bold text-navy text-base">{waybill.itemDescription}</p>
            <p className="text-xs text-gray-600 mt-0.5">Vehicle / Bus Number: <strong>{waybill.busNumber}</strong></p>
            {waybill.driverName && (
              <p className="text-xs text-gray-600">Driver: <strong>{waybill.driverName}</strong></p>
            )}
          </div>
          {waybill.driverPhone && waybill.status !== 'Collected' && waybill.status !== 'Delivered' && (
            <a
              href={`tel:${waybill.driverPhone}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition animate-pulse shrink-0"
            >
              <Phone className="w-4 h-4" /> Call Driver ({waybill.driverPhone})
            </a>
          )}
        </div>

        {/* Receiver Phone Verification Banner */}
        {user?.phone === waybill.senderPhone ? (
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Phone className="w-5 h-5 text-navy flex-shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Recipient Contact Number</p>
                <p className="text-xs text-gray-600">The package is addressed to {waybill.receiverName}</p>
              </div>
            </div>
            <span className="text-base font-mono font-extrabold text-navy tracking-wider bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-2xs">
              {waybill.receiverPhone}
            </span>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Phone className="w-5 h-5 text-emerald-700 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Receiver Store Pickup ID</p>
                <p className="text-xs text-gray-600">Provide this phone number at the park store counter to collect</p>
              </div>
            </div>
            <span className="text-base font-mono font-extrabold text-emerald-700 tracking-wider bg-white px-3 py-1 rounded-lg border border-emerald-200 shadow-2xs">
              {waybill.receiverPhone}
            </span>
          </div>
        )}

        {/* Share Tracking Code & Link with Receiver / Others */}
        <div className="flex flex-col sm:flex-row gap-2.5 mb-6">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`*TrackPack Digital Waybill*\nTracking Code: *${waybill.trackingCode}*\nReceiver Phone: *${waybill.receiverPhone}*\nItem: ${waybill.itemDescription}\nRoute: ${waybill.originPark} ➔ ${waybill.destinationPark}\nStatus: ${waybill.status}\n\nTrack real-time here: ${window.location.origin}/track/${waybill.trackingCode}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
          >
            <Share2 className="w-4 h-4" /> Share Tracking via WhatsApp
          </a>

          <Button
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/track/${waybill.trackingCode}`);
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 2000);
            }}
            className="py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-1.5 border border-gray-300 text-navy bg-white hover:bg-gray-50 cursor-pointer"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copiedLink ? 'Link Copied!' : 'Copy Tracking Link'}
          </Button>
        </div>

        {/* Live Background Push Notifications Card */}
        <div className="mb-6">
          <PushNotificationTesterCard 
            phone={user?.phone || waybill.receiverPhone || waybill.senderPhone}
            trackingCode={waybill.trackingCode}
          />
        </div>

        {/* Warmer Current Status Announcement Banner */}
        <div className="bg-emerald-50 border border-emerald-100/80 p-4 rounded-xl mb-6 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <Info className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <p className="text-xs text-emerald-800 uppercase tracking-wider font-bold">Latest Shipment Update</p>
            <p className="font-semibold text-navy text-sm mt-0.5">
              {getWarmerStatusPhrase(waybill.status === 'Departed' ? 'In Transit' : waybill.status, waybill, historicalAverageHours, routeDistanceKm)}
            </p>
          </div>
        </div>

        {/* Sincere Terminal-to-Terminal Route Information */}
        {progress && (
          <div className="bg-bg-light rounded-xl p-5 border border-gray-200 mb-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-navy">Verified Terminal Tracking</p>
                  <p className="text-xs text-gray-500 font-medium">Physical checkpoint scans only</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                100% Genuine Data
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-white p-3 rounded-lg border border-gray-100 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Interstate Distance</p>
                  <p className="text-lg font-extrabold text-navy mt-0.5">{progress.route.distanceKm} km</p>
                </div>
                <p className="text-[9px] text-gray-500 bg-gray-50 border border-gray-100 rounded-md py-0.5 font-medium mt-1">
                  Terminal to Terminal
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-100 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Standard Duration</p>
                  <p className="text-lg font-extrabold text-navy mt-0.5">{progress.route.durationHours} hrs</p>
                </div>
                {hasHistoricalData && (
                  <p className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md py-0.5 font-bold mt-1">
                    ⚡ Live Route Average
                  </p>
                )}
              </div>
            </div>


          </div>
        )}

        {/* Visual Horizontal Progress Journey */}
        <div className="py-4 px-2 border-t border-gray-100">
          <h3 className="font-bold text-navy mb-6 text-xs uppercase tracking-wider">Shipment Progress Journey</h3>
          
          <div className="relative mb-8 px-4">
            {/* Progress track background */}
            <div className="h-2 w-full bg-gray-100 rounded-full relative">
              {/* Dynamic Progress fill line */}
              <div 
                className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-in-out"
                style={{ width: `${progressPercent}%` }}
              />
              
              {/* Milestone Dots */}
              {/* Booked / Origin at 10% */}
              <div className={cn(
                "absolute -top-1 w-4 h-4 rounded-full border-2 bg-white -ml-2 transition-all duration-500",
                progressPercent >= 10 ? "border-emerald-500 bg-emerald-500" : "border-gray-300"
              )} style={{ left: '10%' }} title="Booked at Origin" />

              {/* Departed / In Transit at 50% */}
              <div className={cn(
                "absolute -top-1 w-4 h-4 rounded-full border-2 bg-white -ml-2 transition-all duration-500",
                progressPercent >= 50 ? "border-emerald-500 bg-emerald-500" : "border-gray-300"
              )} style={{ left: '50%' }} title="Departed / In Transit" />

              {/* Arrived at 85% */}
              <div className={cn(
                "absolute -top-1 w-4 h-4 rounded-full border-2 bg-white -ml-2 transition-all duration-500",
                progressPercent >= 85 ? "border-emerald-500 bg-emerald-500" : "border-gray-300"
              )} style={{ left: '85%' }} title="Arrived at Destination" />

              {/* Collected / Delivered at 100% */}
              <div className={cn(
                "absolute -top-1 w-4 h-4 rounded-full border-2 bg-white -ml-2 transition-all duration-500",
                progressPercent >= 100 ? "border-emerald-500 bg-emerald-500" : "border-gray-300"
              )} style={{ left: '100%' }} title="Delivered safely" />

              {/* Sliding Progress Bus/Package Icon */}
              <div 
                className="absolute -top-4 w-10 h-10 rounded-full bg-navy text-white shadow-lg flex items-center justify-center -ml-5 transition-all duration-1000 ease-in-out"
                style={{ left: `${progressPercent}%` }}
              >
                <ProgressIcon className="w-5 h-5 animate-pulse" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-gray-500 mb-6">
            <div>
              <p className="text-gray-400 uppercase tracking-wider text-[10px]">Origin Park</p>
              <p className="text-navy text-sm font-bold truncate mt-0.5">{waybill.originPark}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 uppercase tracking-wider text-[10px]">Destination Park</p>
              <p className="text-navy text-sm font-bold truncate mt-0.5">{waybill.destinationPark}</p>
            </div>
          </div>

          {/* Clean List of Status Timestamps & Human Phrasing */}
          <div className="border-t border-gray-100 pt-5 mt-6 space-y-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">History Updates</h4>
            
            {waybill.createdTimestamp && (
              <div className="flex justify-between items-start text-sm">
                <div className="flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-navy">{getWarmerStatusPhrase('Booked', waybill, undefined, routeDistanceKm)}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-400 font-medium whitespace-nowrap ml-4">
                  {formatTimestamp(waybill.createdTimestamp)}
                </span>
              </div>
            )}
            
            {waybill.departedTimestamp && (
              <div className="flex justify-between items-start text-sm">
                <div className="flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-navy">{getWarmerStatusPhrase('Departed', waybill, historicalAverageHours, routeDistanceKm)}</p>
                    {waybill.status === 'Departed' && (
                      <p className="text-xs text-emerald-600 font-bold mt-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 inline-block">
                        {getWarmerStatusPhrase('In Transit', waybill, historicalAverageHours, routeDistanceKm)}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400 font-medium whitespace-nowrap ml-4">
                  {formatTimestamp(waybill.departedTimestamp)}
                </span>
              </div>
            )}
            
            {waybill.arrivedTimestamp && (
              <div className="flex justify-between items-start text-sm">
                <div className="flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-navy">{getWarmerStatusPhrase('Arrived', waybill, undefined, routeDistanceKm)}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-400 font-medium whitespace-nowrap ml-4">
                  {formatTimestamp(waybill.arrivedTimestamp)}
                </span>
              </div>
            )}
            
            {waybill.collectedTimestamp && (
              <div className="flex justify-between items-start text-sm">
                <div className="flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-navy">{getWarmerStatusPhrase('Collected', waybill, undefined, routeDistanceKm)}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-400 font-medium whitespace-nowrap ml-4">
                  {formatTimestamp(waybill.collectedTimestamp)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {canViewDriver && waybill.driverPhone && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-base text-blue-900 font-medium">Driver Contact</p>
            {waybill.driverName && <p className="text-base text-blue-800">{waybill.driverName}</p>}
          </div>
          <a href={`tel:${waybill.driverPhone}`} className="inline-flex items-center justify-center bg-amber hover:bg-amber-hover text-navy px-4 py-2 rounded-xl text-base font-medium transition-colors">
            Call Driver
          </a>
        </div>
      )}

      {waybill.status === 'Arrived' && (user?.phone === waybill.receiverPhone || ((user?.role === 'receiver' || user?.role === 'sender') && user?.park === waybill.destinationPark) || user?.role === 'admin') && (
        <div className="bg-green-50 border border-green-200 p-6 rounded-2xl space-y-3">
          <h3 className="font-bold text-green-900 text-lg">Ready for Collection</h3>
          <p className="text-green-800 text-sm leading-relaxed">
            This waybill has arrived at <strong>{waybill.destinationPark}</strong>. Simply go to the park store counter and provide the Receiver Phone Number: <strong className="font-mono text-navy">{waybill.receiverPhone}</strong> to identify and collect your item.
          </p>
          {(user?.role === 'receiver' || user?.role === 'sender' || user?.role === 'admin') && (
            <div className="pt-2">
              {pickupSuccess ? (
                <div className="bg-green-100 text-green-800 p-3 rounded-xl text-center font-bold text-sm">
                  Collection Confirmed!
                </div>
              ) : (
                <Button onClick={handleStaffHandover} className="w-full py-2.5">
                  Confirm Handover & Mark Collected
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
