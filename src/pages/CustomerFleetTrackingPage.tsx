import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getPublicTripDetails } from '../modules/fleetTracking/api';
import { loadGoogleMaps } from '../modules/fleetTracking/utils/googleMapsLoader';
import { getHumanTripStatusBadge } from '../modules/fleetTracking/utils/statusFormatters';
import { Logo } from '../components/Logo';
import {
  Truck,
  Navigation,
  MapPin,
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Phone,
  Share2,
  Copy,
  Check,
  ShieldCheck,
  Package,
  Fuel,
  Bus,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Radio,
  Crosshair,
  Maximize2,
} from 'lucide-react';

export const CustomerFleetTrackingPage: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Map state
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const truckMarkerRef = useRef<google.maps.Marker | null>(null);
  const destMarkerRef = useRef<google.maps.Marker | null>(null);
  const destCircleRef = useRef<google.maps.Circle | null>(null);
  const originMarkerRef = useRef<google.maps.Marker | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!tripId) {
      setError('Invalid tracking link. Trip ID is missing.');
      setIsLoading(false);
      return;
    }

    // 1. Initial REST API load
    getPublicTripDetails(tripId)
      .then((res) => {
        if (res.success && res.trip) {
          setTrip(res.trip);
        } else {
          setError(res.error || 'Trip record not found or expired.');
        }
      })
      .catch((err) => {
        setError(err?.message || 'Error connecting to Waybilla tracking network.');
      })
      .finally(() => {
        setIsLoading(false);
      });

    // 2. Real-Time Firestore Live Listener
    const unsubscribe = onSnapshot(
      doc(db, 'fleetTracking_trips', tripId),
      (docSnap) => {
        if (docSnap.exists()) {
          const liveData = docSnap.data();
          setTrip((prev: any) => ({
            ...(prev || {}),
            id: docSnap.id,
            ...liveData,
          }));
        }
      },
      (err) => {
        console.warn('Firestore live listener notice:', err);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [tripId]);

  // Route state & live road directions
  const [liveRouteData, setLiveRouteData] = useState<{
    etaText?: string;
    durationText?: string;
    distanceText?: string;
  } | null>(null);

  // Helper functions for recentering map
  const handleRecenterTruck = () => {
    if (googleMapRef.current && trip?.last_known_lat && trip?.last_known_lng) {
      googleMapRef.current.panTo({ lat: trip.last_known_lat, lng: trip.last_known_lng });
      googleMapRef.current.setZoom(15);
    }
  };

  const handleRecenterDestination = () => {
    const destLat = trip?.redirect_destination?.lat || trip?.primary_destination_lat;
    const destLng = trip?.redirect_destination?.lng || trip?.primary_destination_lng;
    if (googleMapRef.current && destLat && destLng) {
      googleMapRef.current.panTo({ lat: destLat, lng: destLng });
      googleMapRef.current.setZoom(15);
    }
  };

  const handleFitFullRoute = () => {
    if (!googleMapRef.current || !window.google?.maps) return;
    const bounds = new window.google.maps.LatLngBounds();
    if (trip?.last_known_lat && trip?.last_known_lng) {
      bounds.extend({ lat: trip.last_known_lat, lng: trip.last_known_lng });
    }
    const destLat = trip?.redirect_destination?.lat || trip?.primary_destination_lat;
    const destLng = trip?.redirect_destination?.lng || trip?.primary_destination_lng;
    if (destLat && destLng) {
      bounds.extend({ lat: destLat, lng: destLng });
    }
    if (trip?.garage_lat && trip?.garage_lng) {
      bounds.extend({ lat: trip.garage_lat, lng: trip.garage_lng });
    }
    if (!bounds.isEmpty()) {
      googleMapRef.current.fitBounds(bounds, 60);
    }
  };

  // Draw true turn-by-turn road route
  const drawRoadRoute = async (
    googleMaps: typeof google.maps,
    map: google.maps.Map,
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
  ) => {
    // 1. Try server-side Google Routes v2 API
    try {
      const res = await fetch(
        `/api/fleet-tracking/route?originLat=${originLat}&originLng=${originLng}&destLat=${destLat}&destLng=${destLng}`
      );
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.success && Array.isArray(data.points) && data.points.length > 0) {
          const points = data.points.map((p: { lat: number; lng: number }) => new googleMaps.LatLng(p.lat, p.lng));
          if (routePolylineRef.current) {
            routePolylineRef.current.setMap(null);
          }
          routePolylineRef.current = new googleMaps.Polyline({
            path: points,
            geodesic: true,
            strokeColor: '#2563EB',
            strokeOpacity: 0.9,
            strokeWeight: 6,
            map: map,
          });

          if (data.etaText || data.durationText || data.distanceText) {
            setLiveRouteData({
              etaText: data.etaText,
              durationText: data.durationText,
              distanceText: data.distanceText,
            });
          }
          return;
        }
      }
    } catch (err) {
      console.warn('Backend route computation warning, trying client directions:', err);
    }

    // 2. Client-side DirectionsService fallback for guaranteed real road navigation
    try {
      const directionsService = new googleMaps.DirectionsService();
      directionsService.route(
        {
          origin: { lat: originLat, lng: originLng },
          destination: { lat: destLat, lng: destLng },
          travelMode: googleMaps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === googleMaps.DirectionsStatus.OK && result && result.routes[0]) {
            const route = result.routes[0];
            const leg = route.legs[0];
            if (routePolylineRef.current) {
              routePolylineRef.current.setMap(null);
            }
            routePolylineRef.current = new googleMaps.Polyline({
              path: route.overview_path,
              geodesic: true,
              strokeColor: '#2563EB',
              strokeOpacity: 0.9,
              strokeWeight: 6,
              map: map,
            });

            if (leg) {
              setLiveRouteData({
                etaText: leg.duration?.text ? `In ~${leg.duration.text}` : undefined,
                durationText: leg.duration?.text,
                distanceText: leg.distance?.text,
              });
            }
          }
        }
      );
    } catch (clientErr) {
      console.warn('Client directions service warning:', clientErr);
    }
  };

  // Initialize and update Google Map
  useEffect(() => {
    if (!trip || !mapContainerRef.current) return;

    let isCancelled = false;

    loadGoogleMaps()
      .then((googleMaps) => {
        if (isCancelled || !mapContainerRef.current) return;

        const defaultLat = trip.last_known_lat || trip.primary_destination_lat || 6.5244;
        const defaultLng = trip.last_known_lng || trip.primary_destination_lng || 3.3792;

        if (!googleMapRef.current) {
          googleMapRef.current = new googleMaps.Map(mapContainerRef.current, {
            center: { lat: defaultLat, lng: defaultLng },
            zoom: 12,
            mapTypeId: googleMaps.MapTypeId.ROADMAP,
            gestureHandling: 'greedy', // Enables smooth 1-finger / 1-hand drag and pan on mobile
            fullscreenControl: false,
            streetViewControl: false,
            mapTypeControl: false,
            zoomControl: false, // Cleaner UI with custom floating controls
            styles: [
              { featureType: 'poi', stylers: [{ visibility: 'off' }] },
              { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
            ],
          });
        }

        const map = googleMapRef.current;
        const bounds = new googleMaps.LatLngBounds();

        // Custom Truck Pin Icon
        const truckPinIcon = {
          url:
            'data:image/svg+xml;charset=UTF-8,' +
            encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="56" viewBox="0 0 52 60">
              <path d="M26 0C11.6 0 0 11.6 0 26C0 41 26 60 26 60C26 60 52 41 52 26C52 11.6 40.4 0 26 0Z" fill="#F7941D" stroke="#FFFFFF" stroke-width="3"/>
              <circle cx="26" cy="24" r="17" fill="#0A1F44"/>
              <path d="M18 19H30V29H18V19Z" fill="#F7941D"/>
              <path d="M30 22H34L37 25V29H30V22Z" fill="#F7941D"/>
              <circle cx="21" cy="30" r="3" fill="#FFFFFF" stroke="#0A1F44" stroke-width="1.5"/>
              <circle cx="33" cy="30" r="3" fill="#FFFFFF" stroke="#0A1F44" stroke-width="1.5"/>
            </svg>
          `),
          scaledSize: new googleMaps.Size(48, 56),
          anchor: new googleMaps.Point(24, 56),
        };

        // Custom Destination Pin Icon
        const destPinIcon = {
          url:
            'data:image/svg+xml;charset=UTF-8,' +
            encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="42" height="50" viewBox="0 0 44 52">
              <path d="M22 0C9.8 0 0 9.8 0 22C0 38.5 22 52 22 52C22 52 44 38.5 44 22C44 9.8 34.2 0 22 0Z" fill="${trip.redirect_destination ? '#9333EA' : '#16A34A'}" stroke="#FFFFFF" stroke-width="2.5"/>
              <circle cx="22" cy="20" r="13" fill="#FFFFFF"/>
              <path d="M15 15L29 20L22 23L19 29L15 15Z" fill="${trip.redirect_destination ? '#9333EA' : '#16A34A'}"/>
            </svg>
          `),
          scaledSize: new googleMaps.Size(42, 50),
          anchor: new googleMaps.Point(21, 50),
        };

        // 1. Origin Marker (Depot / Garage)
        const originLat = trip.garage_lat;
        const originLng = trip.garage_lng;
        if (originLat && originLng) {
          const originPos = new googleMaps.LatLng(originLat, originLng);
          bounds.extend(originPos);
          if (!originMarkerRef.current) {
            originMarkerRef.current = new googleMaps.Marker({
              position: originPos,
              map,
              title: 'Dispatch Origin Depot',
              icon: {
                path: googleMaps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: '#0A1F44',
                fillOpacity: 1,
                strokeColor: '#FFFFFF',
                strokeWeight: 2,
              },
            });
          } else {
            originMarkerRef.current.setPosition(originPos);
          }
        }

        // 2. Active Destination Marker & Geofence
        const destLat = trip.redirect_destination?.lat || trip.primary_destination_lat;
        const destLng = trip.redirect_destination?.lng || trip.primary_destination_lng;
        const destName = trip.redirect_destination?.name || trip.primary_destination_name || 'Destination Terminal';

        if (destLat && destLng) {
          const destPos = new googleMaps.LatLng(destLat, destLng);
          bounds.extend(destPos);
          if (!destMarkerRef.current) {
            destMarkerRef.current = new googleMaps.Marker({
              position: destPos,
              map,
              title: destName,
              icon: destPinIcon,
            });
          } else {
            destMarkerRef.current.setPosition(destPos);
            destMarkerRef.current.setIcon(destPinIcon);
          }

          // Render Destination Geofence Perimeter Circle
          const destRadius = Number(trip.redirect_destination?.geofence_radius || trip.primary_destination_geofence_radius || 200);
          if (!destCircleRef.current) {
            destCircleRef.current = new googleMaps.Circle({
              strokeColor: trip.redirect_destination ? '#9333EA' : '#16A34A',
              strokeOpacity: 0.8,
              strokeWeight: 2,
              fillColor: trip.redirect_destination ? '#9333EA' : '#16A34A',
              fillOpacity: 0.12,
              map,
              center: destPos,
              radius: destRadius,
              clickable: false,
            });
          } else {
            destCircleRef.current.setCenter(destPos);
            destCircleRef.current.setRadius(destRadius);
          }
        }

        // 3. Truck Real-Time Position Marker
        const truckLat = trip.last_known_lat || originLat;
        const truckLng = trip.last_known_lng || originLng;

        if (truckLat && truckLng) {
          const truckPos = new googleMaps.LatLng(truckLat, truckLng);
          bounds.extend(truckPos);

          if (!truckMarkerRef.current) {
            truckMarkerRef.current = new googleMaps.Marker({
              position: truckPos,
              map,
              title: `Truck ${trip.plate_number}`,
              icon: truckPinIcon,
              zIndex: 10,
            });
          } else {
            truckMarkerRef.current.setPosition(truckPos);
          }

          // Draw real turn-by-turn road route to destination
          if (destLat && destLng) {
            drawRoadRoute(googleMaps, map, truckLat, truckLng, destLat, destLng);
          }
        }

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, 60);
        }
      })
      .catch((err) => {
        console.warn('Google maps load warning:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [trip]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleShareWhatsApp = () => {
    if (!trip) return;
    const text = `🚛 Track your Waybilla cargo delivery in real-time!\n\nWaybill: ${trip.waybill_number || trip.plate_number}\nStatus: ${trip.trip_status}\nDestination: ${trip.redirect_destination?.name || trip.primary_destination_name}\n\nLive GPS Link: ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const getCargoIcon = (type?: string) => {
    const lower = (type || '').toLowerCase();
    if (lower.includes('fuel') || lower.includes('gas') || lower.includes('pms') || lower.includes('ago') || lower.includes('petroleum')) {
      return Fuel;
    }
    if (lower.includes('passenger') || lower.includes('transit') || lower.includes('bus')) {
      return Bus;
    }
    if (lower.includes('container')) {
      return Truck;
    }
    return Package;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A1F44] flex flex-col items-center justify-center p-4 text-white">
        <div className="w-16 h-16 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center text-[#F7941D] animate-bounce shadow-2xl mb-4">
          <Truck className="w-8 h-8" />
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-[#F7941D] mb-2" />
        <p className="text-sm font-bold text-slate-200">Connecting to Waybilla Live Fleet Telemetry...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-slate-900">Trip Tracking Not Available</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {error || 'This live tracking link may have expired or the trip ID is incorrect.'}
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-[#0A1F44] text-[#F7941D] font-black text-xs hover:bg-[#15346A] transition-all shadow-md"
          >
            <span>Go to Waybilla Homepage</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const statusBadge = getHumanTripStatusBadge(trip.trip_status, !!trip.redirect_destination);
  const CargoIconComponent = getCargoIcon(trip.cargo_type);
  const isRedirected = !!trip.redirect_destination;
  const activeDestName = trip.redirect_destination?.name || trip.primary_destination_name || 'Destination Terminal';

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 overflow-hidden select-none">
      {/* Top Signature Navigation Bar */}
      <header className="bg-[#0A1F44] text-white border-b border-[#15346A] z-40 shadow-lg shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="hover:opacity-90 transition-opacity flex items-center gap-1">
              <Logo size="md" />
            </Link>
            <div className="hidden sm:block h-5 w-px bg-white/20" />
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-black text-white tracking-wide">Customer Live Dispatch Tracker</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#F7941D]/20 text-[#F7941D] border border-[#F7941D]/30 flex items-center gap-1">
                <Radio className="w-2.5 h-2.5 animate-pulse text-[#F7941D]" />
                <span>REAL-TIME SATELLITE</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {trip.driver_phone && (
              <a
                href={`tel:${trip.driver_phone}`}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                title="Call Driver"
              >
                <Phone className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Call Driver</span>
              </a>
            )}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Share on WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="bg-[#15346A] hover:bg-[#1E4388] text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              title="Copy link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#F7941D]" />}
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Expansive Viewport Canvas with Big Map */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        
        {/* Full Interactive Google Map filling 100% viewport */}
        <div ref={mapContainerRef} className="w-full h-full bg-slate-800" />

        {/* 1. TOP FLOATING TELEMETRY STATUS PILLS (Glassmorphic) */}
        <div className="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 z-20 pointer-events-none flex flex-wrap gap-2 items-start justify-between">
          
          {/* Left: Vehicle Plate & Operator Badge */}
          <div className="pointer-events-auto bg-[#0A1F44]/95 backdrop-blur-md text-white border border-[#15346A] px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2.5 max-w-[95vw] sm:max-w-md">
            <div className="w-8 h-8 rounded-xl bg-[#F7941D] text-[#0A1F44] flex items-center justify-center font-black shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm text-white tracking-tight">{trip.plate_number}</span>
                <span className={`px-2 py-0.2 rounded-full text-[9px] font-extrabold border ${statusBadge.bg}`}>
                  {statusBadge.label}
                </span>
              </div>
              <div className="text-[10px] text-slate-300 font-medium truncate mt-0.5">
                Operated by <strong className="text-amber-400">{trip.company_name || 'Waybilla Fleet Logistics'}</strong>
              </div>
            </div>
          </div>

          {/* Right: Destination & Live Traffic ETA Pill */}
          <div className="pointer-events-auto flex flex-wrap gap-2">
            <div className="bg-white/95 backdrop-blur-md text-slate-900 border border-slate-200/90 px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2 max-w-[90vw] truncate">
              <MapPin className={`w-4 h-4 ${isRedirected ? 'text-purple-600' : 'text-emerald-600'} shrink-0`} />
              <div className="text-xs font-black truncate">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-extrabold">Destination</span>
                <span>{activeDestName}</span>
              </div>
            </div>

            {(liveRouteData?.etaText || trip.estimated_arrival_time) && (
              <div className="bg-[#0b1329]/95 backdrop-blur-md text-white border border-blue-900/70 px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#F7941D] shrink-0 animate-pulse" />
                <div className="text-xs">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">ETA</span>
                  <span className="font-black text-[#F7941D]">{liveRouteData?.etaText || trip.estimated_arrival_time}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. FLOATING MAP CONTROLS (Right side recentering like Uber / Fleet Manager) */}
        <div className="absolute right-3 sm:right-5 top-28 sm:top-32 z-30 flex flex-col gap-2 pointer-events-none">
          <button
            type="button"
            onClick={handleRecenterTruck}
            title="Center on Truck"
            className="pointer-events-auto w-11 h-11 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-slate-200 hover:bg-white text-slate-700 hover:text-[#0A1F44] flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Navigation className="w-5 h-5 text-[#F7941D]" />
          </button>

          <button
            type="button"
            onClick={handleRecenterDestination}
            title="Center on Destination"
            className="pointer-events-auto w-11 h-11 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-slate-200 hover:bg-white text-slate-700 hover:text-[#0A1F44] flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Building2 className="w-5 h-5 text-emerald-600" />
          </button>

          <button
            type="button"
            onClick={handleFitFullRoute}
            title="Fit Full Route"
            className="pointer-events-auto w-11 h-11 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-slate-200 hover:bg-white text-slate-700 hover:text-[#0A1F44] flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Crosshair className="w-5 h-5 text-blue-600" />
          </button>
        </div>

        {/* 3. SLIDE-UP BOTTOM DETAILS SHEET (Collapsible / Expandable) */}
        <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-6 sm:right-6 max-w-3xl mx-auto z-30">
          <div className="bg-white/98 backdrop-blur-xl border border-slate-200 rounded-3xl shadow-2xl transition-all duration-300 overflow-hidden max-h-[75vh] flex flex-col">
            
            {/* Quick Metrics & Toggle Header */}
            <div
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-3.5 sm:p-4 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100/90 transition-colors select-none shrink-0"
              id="toggle-customer-trip-details"
            >
              {/* Quick ETA / Distance summary bar */}
              <div className="grid grid-cols-3 gap-2 flex-1 mr-3 text-center">
                <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-xs">
                  <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Arrival</span>
                  <span className="text-xs sm:text-sm font-black text-[#0A1F44] truncate block">
                    {liveRouteData?.etaText || trip.estimated_arrival_time || 'In Transit'}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-xs">
                  <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Duration</span>
                  <span className="text-xs sm:text-sm font-black text-slate-800 truncate block">
                    {liveRouteData?.durationText || trip.estimated_duration_text || 'En Route'}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-xs">
                  <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Remaining</span>
                  <span className="text-xs sm:text-sm font-black text-[#F7941D] truncate block">
                    {liveRouteData?.distanceText || (trip.remaining_distance_km ? `${trip.remaining_distance_km} km` : 'Active')}
                  </span>
                </div>
              </div>

              {/* Expand / Collapse Button */}
              <button
                type="button"
                className="bg-[#0A1F44] text-[#F7941D] hover:bg-[#15346A] px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all shrink-0"
              >
                <span>{isExpanded ? 'Hide' : 'Manifest & e-POD'}</span>
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>

            {/* EXPANDABLE CARGO & MANIFEST CONTENT */}
            {isExpanded && (
              <div className="p-4 sm:p-6 overflow-y-auto space-y-4 max-h-[55vh]">
                
                {/* Official e-POD Delivery Certificate Banner */}
                {trip.pod_record && (
                  <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl space-y-2.5 text-xs animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                      <span className="font-black text-emerald-900 flex items-center gap-1.5 uppercase text-[10px]">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>e-POD Delivery Certified</span>
                      </span>
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[10px]">
                        {trip.pod_record.pod_reference || 'CERTIFIED'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 block font-bold">Received By</span>
                        <span className="font-black text-slate-900">{trip.pod_record.recipient_name}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block font-bold">Condition</span>
                        <span className="font-extrabold text-emerald-700">
                          {trip.pod_record.goods_condition === 'intact' ? '✅ 100% Sound' : trip.pod_record.goods_condition}
                        </span>
                      </div>
                    </div>

                    {trip.pod_record.seal_number && (
                      <div className="text-[10px] text-slate-600 bg-white/80 p-2 rounded-xl border border-emerald-200 flex items-center justify-between">
                        <span>Security Seal #{trip.pod_record.seal_number}</span>
                        <span className="font-bold text-emerald-700">Verified Intact</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Cargo & Waybill Details */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <CargoIconComponent className="w-4 h-4 text-[#F7941D]" />
                      <span className="text-xs font-black text-slate-900">Waybill & Cargo Manifest</span>
                    </div>
                    <span className="text-xs font-mono font-black px-2 py-0.5 rounded bg-[#0A1F44] text-[#F7941D]">
                      {trip.waybill_number || `WB-${trip.id.substring(0, 6).toUpperCase()}`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Cargo Type</span>
                      <span className="font-black text-slate-800">{trip.cargo_type || 'General Freight'}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Quantity</span>
                      <span className="font-black text-[#0A1F44]">{trip.cargo_quantity || 'Standard Load'}</span>
                    </div>
                  </div>

                  {trip.seal_number && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <div>
                          <span className="text-[10px] font-bold text-emerald-800 block uppercase">Security Seal #</span>
                          <span className="font-mono font-black text-emerald-900">{trip.seal_number}</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        LOCKED
                      </span>
                    </div>
                  )}

                  {/* Route & Hubs */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <Building2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase block">Primary Terminal</span>
                        <span className="font-bold text-slate-900">{trip.primary_destination_name}</span>
                      </div>
                    </div>

                    {isRedirected && trip.redirect_destination && (
                      <div className="flex items-start gap-2 pt-2 border-t border-slate-200">
                        <Navigation className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[10px] font-bold text-purple-700 uppercase block">Redirected Destination 🔀</span>
                          <span className="font-black text-purple-950">{trip.redirect_destination.name}</span>
                          <p className="text-[10px] text-slate-500">{trip.redirect_destination.address}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Designated Consignee */}
                  {trip.customer_contact_name && (
                    <div className="p-3 bg-amber-50/60 border border-[#F7941D]/30 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-[#0A1F44] block">Designated Receiver</span>
                        <span className="font-black text-slate-900">{trip.customer_contact_name}</span>
                      </div>
                      {trip.customer_contact_phone && (
                        <a
                          href={`tel:${trip.customer_contact_phone}`}
                          className="text-[#0A1F44] font-black flex items-center gap-1 hover:underline text-xs"
                        >
                          <Phone className="w-3.5 h-3.5 text-[#F7941D]" />
                          <span>{trip.customer_contact_phone}</span>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Milestone Progress Timeline */}
                  {Array.isArray(trip.status_history) && trip.status_history.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Milestone Audit Log</span>
                      <div className="space-y-2">
                        {trip.status_history.map((entry: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-2 text-xs bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <div className="w-2 h-2 rounded-full bg-[#F7941D] mt-1 shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                                <span className="uppercase text-[#0A1F44] font-black">{entry.status?.replace(/_/g, ' ')}</span>
                                <span>{entry.triggered_at ? new Date(entry.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                              </div>
                              <p className="text-[11px] text-slate-700 mt-0.5">{entry.note || 'Milestone verified.'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};

