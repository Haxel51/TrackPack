import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Truck,
  MapPin,
  RefreshCw,
  X,
  Clock,
  Radio,
  Navigation,
  ShieldCheck,
  Building2,
  Phone,
  AlertCircle,
  Copy,
  Check,
  MessageSquare,
  Compass,
  Layers,
  ChevronDown
} from 'lucide-react';
import { pingFleetTruckLocation } from '../../lib/api';

// Fix Leaflet default icon issues in bundled React environments
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Truck Marker Icon with Pulse
const createTruckIcon = (truckNumber: string) => {
  return L.divIcon({
    className: 'custom-truck-pin',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="background-color: #F2A93B; color: #0A1F44; font-weight: 900; font-size: 11px; padding: 3px 10px; border-radius: 9999px; border: 2px solid #FFFFFF; box-shadow: 0 4px 10px rgba(0,0,0,0.4); white-space: nowrap; margin-bottom: 5px; font-family: ui-monospace, monospace; letter-spacing: 0.5px;">
          🚚 ${truckNumber}
        </div>
        <div style="width: 38px; height: 38px; background: #0A1F44; border: 3px solid #F2A93B; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 14px rgba(0,0,0,0.5); position: relative;">
          <span style="font-size: 18px;">🚛</span>
          <div style="position: absolute; inset: -7px; border: 2px solid #F2A93B; border-radius: 50%; opacity: 0.8; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        </div>
      </div>
    `,
    iconSize: [100, 70],
    iconAnchor: [50, 58],
    popupAnchor: [0, -50]
  });
};

interface LiveTruckMapModalProps {
  token: string;
  truckId: string;
  truckNumber: string;
  onClose: () => void;
}

export const LiveTruckMapModal: React.FC<LiveTruckMapModalProps> = ({
  token,
  truckId,
  truckNumber,
  onClose
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationData, setLocationData] = useState<any>(null);
  const [tripData, setTripData] = useState<any>(null);
  const [driverData, setDriverData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [mobileTab, setMobileTab] = useState<'map' | 'details'>('map');

  const fetchLiveLocation = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await pingFleetTruckLocation(token, truckId);
      if (!res.success) {
        throw new Error(res.error || 'Unable to retrieve location.');
      }

      setLocationData(res.location);
      setTripData(res.trip);
      setDriverData(res.driver);
      setHistory(res.location_history || []);

      updateMap(res.location, res.location_history || [], res.truck?.truck_number || truckNumber);
    } catch (err: any) {
      setError(err.message || 'Could not ping driver location.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateMap = (currentLoc: any, trailHistory: any[], truckPlate: string) => {
    if (!mapContainerRef.current) return;

    const lat = typeof currentLoc?.latitude === 'number' ? currentLoc.latitude : 6.5244;
    const lng = typeof currentLoc?.longitude === 'number' ? currentLoc.longitude : 3.3792;
    const accuracy = typeof currentLoc?.accuracy === 'number' ? currentLoc.accuracy : 20;

    // Initialize Map if not already created
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 14,
        zoomControl: true,
        scrollWheelZoom: true
      });

      // Free OpenStreetMap Tiles (Zero API cost)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    map.setView([lat, lng], Math.max(map.getZoom(), 14));

    // Update or create truck marker
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      markerRef.current.setIcon(createTruckIcon(truckPlate));
    } else {
      const marker = L.marker([lat, lng], {
        icon: createTruckIcon(truckPlate)
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; font-size: 12px; padding: 4px; min-width: 140px;">
          <div style="color: #0A1F44; font-size: 13px; font-weight: 800; margin-bottom: 2px;">🚚 ${truckPlate}</div>
          <div style="color: #475569; font-size: 11px;">Driver: <strong>${driverData?.name || 'Assigned Driver'}</strong></div>
          <div style="color: #16a34a; font-weight: 800; font-size: 11px; margin-top: 4px;">🟢 Live GPS Active</div>
        </div>
      `);
      markerRef.current = marker;
    }

    // Accuracy Circle
    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]);
      circleRef.current.setRadius(accuracy);
    } else {
      const circle = L.circle([lat, lng], {
        radius: accuracy,
        color: '#F2A93B',
        fillColor: '#F2A93B',
        fillOpacity: 0.15,
        weight: 1.5
      }).addTo(map);
      circleRef.current = circle;
    }

    // Draw breadcrumb trail of past pings
    if (trailHistory && trailHistory.length > 1) {
      const points: [number, number][] = trailHistory
        .filter(p => typeof p.latitude === 'number' && typeof p.longitude === 'number')
        .map(p => [p.latitude, p.longitude]);

      if (polylineRef.current) {
        polylineRef.current.setLatLngs(points);
      } else {
        const polyline = L.polyline(points, {
          color: '#3B82F6',
          weight: 4,
          opacity: 0.75,
          dashArray: '6, 8'
        }).addTo(map);
        polylineRef.current = polyline;
      }
    }

    // Invalidate map size to handle responsive layout changes
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);
  };

  const centerOnTruck = () => {
    if (mapInstanceRef.current && locationData) {
      const lat = locationData.latitude || 6.5244;
      const lng = locationData.longitude || 3.3792;
      mapInstanceRef.current.setView([lat, lng], 15, { animate: true });
    }
  };

  const copyCoordinates = () => {
    if (locationData?.latitude && locationData?.longitude) {
      navigator.clipboard.writeText(`${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}`);
      setCopiedCoords(true);
      setTimeout(() => setCopiedCoords(false), 2500);
    }
  };

  useEffect(() => {
    fetchLiveLocation(false);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [truckId]);

  // Re-trigger map resize when tab changes on mobile
  useEffect(() => {
    if (mobileTab === 'map' && mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
    }
  }, [mobileTab]);

  const whatsappUrl = driverData?.phone_number
    ? `https://wa.me/234${driverData.phone_number.replace(/^0+/, '')}?text=Hello%20${encodeURIComponent(
        driverData.name || 'Driver'
      )},%20checking%20status%20on%20Truck%20${encodeURIComponent(truckNumber)}.`
    : null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl h-[94vh] max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* RESPONSIVE HEADER */}
        <div className="bg-[#0A1F44] border-b border-slate-800/90 px-4 py-3.5 sm:px-6 sm:py-4 shrink-0">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Title & Icon */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-white tracking-tight whitespace-nowrap">
                    Live Truck GPS
                  </h2>
                  <span className="bg-amber-400 text-slate-950 font-mono text-xs px-2.5 py-0.5 rounded-lg font-black shrink-0 shadow-xs">
                    {truckNumber}
                  </span>
                  <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    Active Trip
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5 hidden sm:block">
                  Silent on-demand GPS tracking via OpenStreetMap (Zero API cost)
                </p>
              </div>
            </div>

            {/* Actions: Refresh & Close */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => fetchLiveLocation(true)}
                disabled={refreshing || loading}
                className="bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700/80 font-bold px-3 py-2 sm:px-4 sm:py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 min-h-[40px]"
                title="Silent Re-ping"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
                <span className="hidden sm:inline">Re-Ping GPS</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mobile Tab Switcher */}
          <div className="flex sm:hidden mt-3 pt-2.5 border-t border-slate-800/80 gap-2">
            <button
              type="button"
              onClick={() => setMobileTab('map')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mobileTab === 'map'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Map View</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('details')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mobileTab === 'details'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Telemetry &amp; Details</span>
              {history.length > 0 && (
                <span className="bg-slate-950/40 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {history.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* MAIN BODY: Split on Desktop / Tabbed or Scroll on Mobile */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          
          {/* MAP AREA */}
          <div
            className={`flex-1 min-h-[280px] md:min-h-0 bg-slate-950 relative ${
              mobileTab === 'details' ? 'hidden sm:block' : 'block'
            }`}
          >
            <div ref={mapContainerRef} className="w-full h-full min-h-[280px] md:min-h-full z-0" />

            {/* Recenter floating control */}
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
              <button
                type="button"
                onClick={centerOnTruck}
                className="bg-slate-900/90 hover:bg-slate-800 text-amber-300 border border-amber-400/40 p-2.5 rounded-2xl shadow-xl backdrop-blur-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                title="Center map on truck"
              >
                <Compass className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Center Truck</span>
              </button>
            </div>

            {/* Current Place Floating Pill on Map */}
            {locationData && (locationData.place_name || locationData.address) && (
              <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md z-10">
                <div className="bg-slate-950/90 border border-slate-800/90 p-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      Current Location
                    </p>
                    <p className="text-xs font-extrabold text-amber-300 truncate leading-snug">
                      {locationData.place_name || locationData.address}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading Overlay */}
            {loading && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 z-20 space-y-3 text-center">
                <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-extrabold text-white">Silently pinging driver phone... 📡</p>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Retrieving GPS coordinates from the device silently in the background.
                </p>
              </div>
            )}

            {/* Error Overlay */}
            {error && (
              <div className="absolute inset-x-4 top-4 bg-rose-950/95 border border-rose-500/60 text-rose-200 p-4 rounded-2xl z-20 flex items-start gap-3 shadow-2xl">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-sm text-rose-300">Location Unavailable</p>
                  <p className="leading-relaxed">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* TELEMETRY & DETAILS SIDEBAR (Smooth Full Scroll on Mobile & Desktop) */}
          <div
            className={`w-full md:w-[380px] bg-slate-900/95 border-t md:border-t-0 md:border-l border-slate-800/90 flex flex-col overflow-y-auto ${
              mobileTab === 'map' ? 'hidden sm:flex' : 'flex'
            } flex-1 md:flex-initial`}
          >
            <div className="p-4 sm:p-5 space-y-4 pb-12 sm:pb-8">
              
              {/* Place Name Banner */}
              {locationData && (locationData.place_name || locationData.address) && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Live Area Location
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-black text-amber-200 leading-snug">
                    {locationData.place_name || locationData.address}
                  </p>
                </div>
              )}

              {/* Driver & Trip Information */}
              <div className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Assigned Driver
                  </span>
                  <span className="text-xs font-black text-slate-100">
                    {driverData?.name || 'Driver'}
                  </span>
                </div>

                {driverData?.phone_number && (
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/60">
                    <span className="text-slate-400">Driver Phone</span>
                    <span className="font-mono text-amber-300 font-bold">{driverData.phone_number}</span>
                  </div>
                )}

                {/* Driver Action Buttons */}
                {driverData?.phone_number && (
                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href={`tel:${driverData.phone_number}`}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call Driver</span>
                    </a>
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Trip Origin & Destination Route */}
              <div className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Origin Garage:</span>
                  <span className="font-bold text-slate-200 truncate max-w-[180px]">
                    {tripData?.origin_park || 'Company Garage'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Destination:</span>
                  <span className="font-bold text-amber-300 truncate max-w-[180px]">
                    {tripData?.supplier_name || 'Destination Depot'}
                  </span>
                </div>
                {tripData?.self_learned_eta?.display && (
                  <div className="pt-2 border-t border-slate-800/60 flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>{tripData.self_learned_eta.display}</span>
                  </div>
                )}
              </div>

              {/* GPS Telemetry Specs */}
              {locationData && (
                <div className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl space-y-3 shadow-sm text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-blue-400" />
                      GPS Coordinates
                    </span>
                    <button
                      type="button"
                      onClick={copyCoordinates}
                      className="font-mono text-slate-200 hover:text-amber-300 font-bold flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 transition-colors cursor-pointer"
                      title="Click to copy coordinates"
                    >
                      <span>
                        {locationData.latitude?.toFixed(5)}, {locationData.longitude?.toFixed(5)}
                      </span>
                      {copiedCoords ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      GPS Accuracy
                    </span>
                    <span className="font-extrabold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md">
                      ±{Math.round(locationData.accuracy || 15)} meters
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Last GPS Ping
                    </span>
                    <span className="text-slate-300 font-bold">
                      {locationData.timestamp
                        ? new Date(locationData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : 'Just now'}
                    </span>
                  </div>
                </div>
              )}

              {/* Location Trail History */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ping Audit Trail ({history.length})</span>
                  </h4>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {history.length === 0 ? (
                    <div className="p-3 bg-slate-950/40 rounded-xl text-center text-xs text-slate-500 italic border border-slate-800/40">
                      No previous pings recorded yet for this trip.
                    </div>
                  ) : (
                    history.slice().reverse().map((entry, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950/70 border border-slate-800/80 p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xs"
                      >
                        <div className="min-w-0">
                          <p className="text-slate-200 font-medium truncate">
                            {entry.place_name || entry.note || 'Location Ping'}
                          </p>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {entry.latitude?.toFixed(4)}, {entry.longitude?.toFixed(4)}
                          </span>
                        </div>
                        <span className="text-slate-400 font-mono text-[10px] shrink-0 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                          {entry.timestamp
                            ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Bottom Notice */}
              <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 leading-relaxed">
                🔒 <strong>Silent &amp; Confidential:</strong> Driver device is queried silently in the background without disturbing the driver.
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTruckMapModal;
