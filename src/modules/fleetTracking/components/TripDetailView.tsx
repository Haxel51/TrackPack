import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { TripRecord, TripStatusHistoryEntry } from '../types';
import { loadGoogleMaps } from '../utils/googleMapsLoader';
import { getFleetRole, FleetPermissions } from '../utils/permissions';
import {
  getGarageLocation,
  updateTripStatus,
  acknowledgeStoppedAlert,
} from '../api';
import { RedirectTripModal } from './RedirectTripModal';
import mapsConfig from '../../../config/maps.config';
import {
  ArrowLeft,
  Phone,
  Truck,
  Navigation,
  MapPin,
  Building2,
  AlertCircle,
  Loader2,
  CreditCard,
  Radio,
  ChevronUp,
  ChevronDown,
  Clock,
  History,
  Play,
  PackageCheck,
  Flag,
  AlertTriangle,
  Crosshair,
} from 'lucide-react';

// Helper to calculate distance in km between two lat/lng coordinates
function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface TripDetailViewProps {
  trip: TripRecord;
  token: string;
  role?: string;
  user?: any;
  onBack: () => void;
  onTripUpdated?: () => void;
}

export const TripDetailView: React.FC<TripDetailViewProps> = ({
  trip: initialTrip,
  token,
  role,
  user,
  onBack,
  onTripUpdated,
}) => {
  const [trip, setTrip] = useState<TripRecord>(initialTrip);
  const [garageCoords, setGarageCoords] = useState<{ lat: number; lng: number }>({
    lat: initialTrip.garage_lat || 6.5244,
    lng: initialTrip.garage_lng || 3.3792,
  });
  const [truckLocation, setTruckLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isAwaitingLocation, setIsAwaitingLocation] = useState<boolean>(true);

  const [isLoadingMap, setIsLoadingMap] = useState<boolean>(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isRedirectModalOpen, setIsRedirectModalOpen] = useState<boolean>(false);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState<boolean>(false);

  // Collapsible panel state — false by default so map takes up >90% of screen
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Map DOM Container
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  // Google Maps Refs
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const googleMapsRef = useRef<any>(null);
  const garageMarkerRef = useRef<google.maps.Marker | null>(null);
  const destMarkerRef = useRef<google.maps.Marker | null>(null);
  const redirectMarkerRef = useRef<google.maps.Marker | null>(null);
  const truckMarkerRef = useRef<google.maps.Marker | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // User permissions
  const fleetRole = getFleetRole(user, role);
  const canConfirmDeparture = FleetPermissions.canConfirmDeparture(fleetRole);
  const canRedirect = FleetPermissions.canRedirect(fleetRole);
  const canMarkLoaded = FleetPermissions.canMarkLoaded(fleetRole);
  const isManagerOrCEO = fleetRole === 'manager' || fleetRole === 'ceo';
  const isCompletedOrCancelled = trip.trip_status === 'completed' || trip.trip_status === 'cancelled';

  // 1. Determine Active Destination
  const getActiveDestination = useCallback(() => {
    if (trip.redirect_destination) {
      return {
        name: trip.redirect_destination.name,
        address: trip.redirect_destination.address,
        lat: trip.redirect_destination.lat || 6.5244,
        lng: trip.redirect_destination.lng || 3.3792,
        isRedirect: true,
      };
    }
    return {
      name: trip.primary_destination_name,
      address: 'Primary Supplier Location',
      lat: trip.primary_destination_lat || 6.5244,
      lng: trip.primary_destination_lng || 3.3792,
      isRedirect: false,
    };
  }, [trip]);

  // 2. Fetch Garage Coordinates if missing
  useEffect(() => {
    if (initialTrip.garage_lat && initialTrip.garage_lng) {
      setGarageCoords({ lat: initialTrip.garage_lat, lng: initialTrip.garage_lng });
    } else {
      getGarageLocation(token).then((res) => {
        if (res.success && res.garage && res.garage.lat && res.garage.lng) {
          setGarageCoords({ lat: res.garage.lat, lng: res.garage.lng });
        }
      });
    }
  }, [initialTrip, token]);

  // 3. Real-Time Firestore Listener for Live Truck Location & Status
  useEffect(() => {
    if (!trip.id) return;

    const tripDocRef = doc(db, 'fleetTracking_trips', trip.id);
    const unsubscribe = onSnapshot(
      tripDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const updatedRecord: TripRecord = {
            id: docSnap.id,
            company_id: data.company_id || trip.company_id,
            truck_id: data.truck_id || trip.truck_id,
            plate_number: data.plate_number || trip.plate_number,
            driver_name: data.driver_name || trip.driver_name,
            driver_phone: data.driver_phone || trip.driver_phone,
            primary_destination_type: data.primary_destination_type || trip.primary_destination_type,
            primary_destination_id: data.primary_destination_id || trip.primary_destination_id,
            primary_destination_name: data.primary_destination_name || trip.primary_destination_name,
            primary_destination_lat: data.primary_destination_lat ?? trip.primary_destination_lat,
            primary_destination_lng: data.primary_destination_lng ?? trip.primary_destination_lng,
            redirect_destination: data.redirect_destination ?? trip.redirect_destination,
            payment_plan: data.payment_plan || trip.payment_plan,
            payment_status: data.payment_status || trip.payment_status,
            payment_amount: data.payment_amount ?? trip.payment_amount,
            trip_status: data.trip_status || trip.trip_status,
            status_history: data.status_history || trip.status_history || [],
            last_known_lat: data.last_known_lat ?? trip.last_known_lat,
            last_known_lng: data.last_known_lng ?? trip.last_known_lng,
            last_movement_at: data.last_movement_at || trip.last_movement_at,
            stopped_warning_sent: data.stopped_warning_sent ?? trip.stopped_warning_sent,
            stopped_alert_sent: data.stopped_alert_sent ?? trip.stopped_alert_sent,
            stopped_acknowledged: data.stopped_acknowledged ?? trip.stopped_acknowledged,
            created_by: data.created_by || trip.created_by,
            created_at: data.created_at || trip.created_at,
            garage_lat: data.garage_lat ?? trip.garage_lat,
            garage_lng: data.garage_lng ?? trip.garage_lng,
          };

          setTrip(updatedRecord);

          // Check live location
          let parsedLat: number | null = null;
          let parsedLng: number | null = null;

          if (data.location) {
            if (typeof data.location.lat === 'number' && typeof data.location.lng === 'number') {
              parsedLat = data.location.lat;
              parsedLng = data.location.lng;
            } else if (typeof data.location.latitude === 'number' && typeof data.location.longitude === 'number') {
              parsedLat = data.location.latitude;
              parsedLng = data.location.longitude;
            }
          } else if (typeof data.last_known_lat === 'number' && typeof data.last_known_lng === 'number') {
            parsedLat = data.last_known_lat;
            parsedLng = data.last_known_lng;
          }

          if (parsedLat !== null && parsedLng !== null) {
            const newLoc = { lat: parsedLat, lng: parsedLng };
            setTruckLocation(newLoc);
            setIsAwaitingLocation(false);
          } else {
            setIsAwaitingLocation(true);
          }
        }
      },
      (err) => {
        console.warn('Realtime trip snapshot error:', err);
      }
    );

    return () => unsubscribe();
  }, [trip.id]);

  // Helper to calculate and render real-world road directions
  const calculateAndDisplayRoute = useCallback(
    (originLat: number, originLng: number, destLat: number, destLng: number) => {
      fetch(
        `/api/fleet-tracking/route/osrm?origin_lat=${originLat}&origin_lng=${originLng}&dest_lat=${destLat}&dest_lng=${destLng}`
      )
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && Array.isArray(data.coordinates) && data.coordinates.length > 0) {
            if (googleMapsRef.current && googleMapRef.current) {
              const googleMaps = googleMapsRef.current;
              const map = googleMapRef.current;
              if (!routePolylineRef.current) {
                routePolylineRef.current = new googleMaps.Polyline({
                  map,
                  strokeColor: '#1A73E8',
                  strokeWeight: 6,
                  strokeOpacity: 0.9,
                });
              } else {
                routePolylineRef.current.setMap(map);
              }
              const roadPath = data.coordinates.map((pt: [number, number]) => ({
                lat: pt[1],
                lng: pt[0],
              }));
              routePolylineRef.current.setPath(roadPath);
            }
          }
        })
        .catch((err) => {
          console.warn('Road route rendering warning:', err);
        });
    },
    []
  );

  // ----------------------------------------------------
  // 4. MAIN GOOGLE MAP INITIALIZER
  // ----------------------------------------------------
  const initMap = useCallback(async () => {
    try {
      setIsLoadingMap(true);
      setMapError(null);

      // Load Google Maps SDK with the bundled key
      const googleMaps = await loadGoogleMaps(mapsConfig.apiKey);
      googleMapsRef.current = googleMaps;

      if (!mapContainerRef.current) return;
      mapContainerRef.current.innerHTML = '';

      const dest = getActiveDestination();
      const initialTruckPos = truckLocation || garageCoords;

      const isValidCoord = (p?: { lat: number; lng: number } | null) => {
        return !!p && typeof p.lat === 'number' && typeof p.lng === 'number' && (p.lat !== 0 || p.lng !== 0);
      };

      const initialCenter = isValidCoord(truckLocation)
        ? truckLocation!
        : isValidCoord(garageCoords)
          ? garageCoords
          : { lat: 6.5244, lng: 3.3792 };

      const map = new googleMaps.Map(mapContainerRef.current, {
        zoom: 15,
        center: initialCenter,
        zoomControl: true,
        scrollwheel: true,
        gestureHandling: 'greedy',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        mapTypeId: googleMaps.MapTypeId?.ROADMAP || 'roadmap',
      });

      googleMapRef.current = map;
      infoWindowRef.current = new googleMaps.InfoWindow();

      const garagePinIcon = {
        url:
          'data:image/svg+xml;charset=UTF-8,' +
          encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="42" height="50" viewBox="0 0 42 50">
            <path d="M21 0C9.4 0 0 9.4 0 21C0 36.8 21 50 21 50C21 50 42 36.8 42 21C42 9.4 32.6 0 21 0Z" fill="#2563EB" stroke="#FFFFFF" stroke-width="2.5"/>
            <circle cx="21" cy="19" r="11" fill="#1E40AF"/>
            <path d="M14 23V17L21 12L28 17V23H23V19H19V23H14Z" fill="#FFFFFF"/>
          </svg>
        `),
        scaledSize: new googleMaps.Size(42, 50),
        anchor: new googleMaps.Point(21, 50),
      };

      const destPinIcon = {
        url:
          'data:image/svg+xml;charset=UTF-8,' +
          encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="42" height="50" viewBox="0 0 42 50">
            <path d="M21 0C9.4 0 0 9.4 0 21C0 36.8 21 50 21 50C21 50 42 36.8 42 21C42 9.4 32.6 0 21 0Z" fill="#10B981" stroke="#FFFFFF" stroke-width="2.5"/>
            <circle cx="21" cy="19" r="11" fill="#047857"/>
            <circle cx="21" cy="19" r="5" fill="#FFFFFF"/>
          </svg>
        `),
        scaledSize: new googleMaps.Size(42, 50),
        anchor: new googleMaps.Point(21, 50),
      };

      const truckPinIcon = {
        url:
          'data:image/svg+xml;charset=UTF-8,' +
          encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="22" fill="#F59E0B" stroke="#FFFFFF" stroke-width="3"/>
            <g fill="#0F172A">
              <path d="M12 17H25V26H12V17Z"/>
              <path d="M26 20H32L35 23V26H26V20Z"/>
              <circle cx="16" cy="27" r="3" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
              <circle cx="29" cy="27" r="3" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
            </g>
          </svg>
        `),
        scaledSize: new googleMaps.Size(48, 48),
        anchor: new googleMaps.Point(24, 24),
      };

      const primaryPos = {
        lat: trip.primary_destination_lat || 6.5244,
        lng: trip.primary_destination_lng || 3.3792,
      };
      const primaryName = trip.primary_destination_name || 'Primary Supplier';
      const hasRedirect = !!trip.redirect_destination;

      // 🔵 Pin 1: Garage
      const gMarker = new googleMaps.Marker({
        position: garageCoords,
        map,
        title: 'Garage Base',
        icon: garagePinIcon,
      });
      garageMarkerRef.current = gMarker;

      // 🟢 Pin 2: Original Supplier Destination
      const dMarker = new googleMaps.Marker({
        position: primaryPos,
        map,
        title: `Supplier: ${primaryName}`,
        icon: destPinIcon,
        opacity: hasRedirect ? 0.4 : 1.0,
      });
      destMarkerRef.current = dMarker;

      // 🔴 Pin 2b: Active Redirect Customer Destination Pin
      if (hasRedirect && trip.redirect_destination) {
        const redirectLat = trip.redirect_destination.lat || 6.5244;
        const redirectLng = trip.redirect_destination.lng || 3.3792;
        const redirectCustomerName = trip.redirect_destination.name;

        const redirectPinIcon = {
          url:
            'data:image/svg+xml;charset=UTF-8,' +
            encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52">
              <path d="M22 0C9.8 0 0 9.8 0 22C0 38.5 22 52 22 52C22 52 44 38.5 44 22C44 9.8 34.2 0 22 0Z" fill="#E65100" stroke="#FFFFFF" stroke-width="2.5"/>
              <circle cx="22" cy="20" r="13" fill="#993300"/>
              <path d="M13 13.5H31L32 16.5H12L13 13.5Z" fill="#FFFFFF"/>
              <path d="M12 16.5H32V18.5H12V16.5Z" fill="#FF9800"/>
              <path d="M13 18.5H31V27H13V18.5Z" fill="#FFFFFF"/>
              <rect x="16" y="21.5" width="4.5" height="5.5" fill="#E65100"/>
              <rect x="23.5" y="21.5" width="4.5" height="3.5" fill="#E65100"/>
            </svg>
          `),
          scaledSize: new googleMaps.Size(44, 52),
          anchor: new googleMaps.Point(22, 52),
        };

        const rMarker = new googleMaps.Marker({
          position: { lat: redirectLat, lng: redirectLng },
          map,
          icon: redirectPinIcon,
          title: redirectCustomerName,
          zIndex: 3,
        });

        rMarker.addListener('click', () => {
          if (!infoWindowRef.current) {
            infoWindowRef.current = new googleMaps.InfoWindow();
          }
          infoWindowRef.current.setContent(
            `<div style="font-family: sans-serif; padding: 6px 10px; font-weight: bold; color: #0f172a; font-size: 13px;">
              <span style="color: #E65100;">↪️ Redirected to:</span> ${redirectCustomerName}
             </div>`
          );
          infoWindowRef.current.open(map, rMarker);
        });

        redirectMarkerRef.current = rMarker;
      } else {
        redirectMarkerRef.current = null;
      }

      // 🚛 Pin 3: Truck Pin
      const tMarker = new googleMaps.Marker({
        position: initialTruckPos,
        map,
        title: `Truck: ${trip.plate_number}`,
        icon: truckPinIcon,
      });
      truckMarkerRef.current = tMarker;

      const originPos = isValidCoord(truckLocation) ? truckLocation! : garageCoords;
      if (isValidCoord(originPos) && dest && isValidCoord({ lat: dest.lat, lng: dest.lng })) {
        calculateAndDisplayRoute(originPos.lat, originPos.lng, dest.lat, dest.lng);
      }

      // Active pins calculation
      const rawPins: Array<{ lat: number; lng: number }> = [];
      if (isValidCoord(garageCoords)) rawPins.push(garageCoords);
      if (isValidCoord(primaryPos)) rawPins.push(primaryPos);
      if (hasRedirect && trip.redirect_destination) {
        const rPos = {
          lat: trip.redirect_destination.lat || 6.5244,
          lng: trip.redirect_destination.lng || 3.3792,
        };
        if (isValidCoord(rPos)) rawPins.push(rPos);
      }
      if (isValidCoord(initialTruckPos)) rawPins.push(initialTruckPos);

      const nonDefaultPins = rawPins.filter(
        (p) => getDistanceInKm(p.lat, p.lng, 6.5244, 3.3792) > 50
      );
      let activePins = rawPins;
      if (nonDefaultPins.length > 0) {
        activePins = rawPins.filter((p) => !(Math.abs(p.lat - 6.5244) < 0.01 && Math.abs(p.lng - 3.3792) < 0.01));
      }

      googleMaps.event.addListenerOnce(map, 'idle', () => {
        if (activePins.length > 1) {
          const bounds = new googleMaps.LatLngBounds();
          activePins.forEach((p) => bounds.extend(p));
          map.fitBounds(bounds, { top: 80, bottom: 80, left: 80, right: 80 } as any);
        }
        map.setOptions({ minZoom: null });
      });

      setIsLoadingMap(false);
    } catch (err: any) {
      console.error('Google Map initialization error:', err);
      setMapError(err?.message || 'Failed to initialize Google Maps');
      setIsLoadingMap(false);
    }
  }, [calculateAndDisplayRoute, garageCoords, getActiveDestination, trip.plate_number, trip.primary_destination_lat, trip.primary_destination_lng, trip.primary_destination_name, trip.redirect_destination, truckLocation]);

  useEffect(() => {
    let timer = setTimeout(() => {
      initMap();
    }, 150);
    return () => clearTimeout(timer);
  }, [garageCoords.lat, garageCoords.lng, initMap]);

  // Update Truck Pin smoothly and recalculate directions route in real time as truck moves
  useEffect(() => {
    const activePos = truckLocation || garageCoords;
    const dest = getActiveDestination();

    if (googleMapRef.current && truckMarkerRef.current) {
      truckMarkerRef.current.setPosition(activePos);
      if (
        activePos &&
        typeof activePos.lat === 'number' &&
        typeof activePos.lng === 'number' &&
        dest &&
        typeof dest.lat === 'number' &&
        typeof dest.lng === 'number'
      ) {
        calculateAndDisplayRoute(activePos.lat, activePos.lng, dest.lat, dest.lng);
      }
    }
  }, [truckLocation, garageCoords, getActiveDestination, calculateAndDisplayRoute]);

  // Stage 5 Action Handlers
  const handleManualStatusChange = async (newStatus: string, note?: string) => {
    try {
      setIsSubmittingStatus(true);
      const res = await updateTripStatus(token, trip.id, newStatus, note);
      if (!res.success) {
        alert(res.error || 'Failed to update trip status');
      } else if (res.trip) {
        setTrip(res.trip);
        if (onTripUpdated) onTripUpdated();
      }
    } catch (err: any) {
      alert(err?.message || 'Error updating trip status');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const handleAcknowledgeAlert = async () => {
    try {
      setIsSubmittingStatus(true);
      setTrip((prev) => ({
        ...prev,
        stopped_acknowledged: true,
        stopped_warning_sent: false,
        stopped_alert_sent: false,
      }));
      const res = await acknowledgeStoppedAlert(token, trip.id);
      if (!res.success) {
        alert(res.error || 'Failed to acknowledge alert');
      } else if (res.trip) {
        setTrip(res.trip);
        if (onTripUpdated) onTripUpdated();
      }
    } catch (err: any) {
      alert(err?.message || 'Error acknowledging alert');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Helper formatting for timestamps
  const formatIsoTimestamp = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoStr;
    }
  };

  // Status Badge Logic
  const getStatusBadge = (status: string, _hasRedirect: boolean) => {
    const s = (status || 'created').toLowerCase();
    switch (s) {
      case 'completed':
        return { label: 'Completed ✅', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      case 'cancelled':
        return { label: 'Cancelled ❌', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
      case 'departed':
        return { label: 'Departed 🏁', bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
      case 'in_progress':
        return { label: 'In Progress 🚚', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
      case 'arrived_at_supplier':
        return { label: 'Arrived at Supplier 🏭', bg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' };
      case 'loaded':
        return { label: 'Loaded 📦', bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
      case 'arrived_at_destination':
        return { label: 'Arrived at Customer 🎯', bg: 'bg-teal-500/20 text-teal-300 border-teal-500/40' };
      case 'returning':
        return { label: 'Returning to Base 🏠', bg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
      case 'stopped_warning':
        return { label: 'Stopped Warning ⚠️', bg: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' };
      case 'stopped_alert':
        return { label: 'Stopped Alert 🔴', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };
      case 'stopped':
        return { label: 'Stopped 🛑', bg: 'bg-orange-500/20 text-orange-300 border-orange-500/40' };
      default:
        return { label: 'Created 🆕', bg: 'bg-slate-700/60 text-slate-300 border-slate-600' };
    }
  };

  const activeDest = getActiveDestination();
  const statusBadge = getStatusBadge(trip.trip_status, !!trip.redirect_destination);
  const statusHistory = trip.status_history || [];

  // Recentering Handlers on Google Maps
  const handleRecenterTruck = useCallback(() => {
    const pos = truckLocation || garageCoords;
    if (pos && typeof pos.lat === 'number' && typeof pos.lng === 'number' && (pos.lat !== 0 || pos.lng !== 0)) {
      if (googleMapRef.current) {
        googleMapRef.current.panTo(pos);
        googleMapRef.current.setZoom(16);
      }
    }
  }, [truckLocation, garageCoords]);

  const handleRecenterDestination = useCallback(() => {
    const dest = getActiveDestination();
    if (dest && typeof dest.lat === 'number' && typeof dest.lng === 'number' && (dest.lat !== 0 || dest.lng !== 0)) {
      if (googleMapRef.current) {
        googleMapRef.current.panTo({ lat: dest.lat, lng: dest.lng });
        googleMapRef.current.setZoom(16);
      }
    }
  }, [getActiveDestination]);

  const handleFitFullRoute = useCallback(() => {
    const dest = getActiveDestination();

    if (googleMapRef.current && window.google?.maps) {
      const bounds = new window.google.maps.LatLngBounds();
      let count = 0;
      if (garageCoords && (garageCoords.lat !== 0 || garageCoords.lng !== 0)) {
        bounds.extend(garageCoords);
        count++;
      }
      if (dest && (dest.lat !== 0 || dest.lng !== 0)) {
        bounds.extend({ lat: dest.lat, lng: dest.lng });
        count++;
      }
      if (truckLocation && (truckLocation.lat !== 0 || truckLocation.lng !== 0)) {
        bounds.extend(truckLocation);
        count++;
      }
      if (count > 0) {
        googleMapRef.current.fitBounds(bounds, { top: 100, bottom: 130, left: 60, right: 60 } as any);
      }
    }
  }, [garageCoords, getActiveDestination, truckLocation]);

  const isStoppedWarningOrAlert =
    !trip.stopped_acknowledged &&
    (trip.stopped_warning_sent ||
      trip.stopped_alert_sent ||
      trip.trip_status === 'stopped_warning' ||
      trip.trip_status === 'stopped_alert');

  return (
    <div className="fixed inset-0 z-50 w-full h-[100dvh] bg-slate-950 flex flex-col overflow-hidden animate-fadeIn select-none">
      
      {/* 1. FULL SCREEN GOOGLE MAP SURFACE */}
      <div className="absolute inset-0 w-full h-full bg-slate-900 z-0">
        <div ref={mapContainerRef} className="w-full h-full" id="trip-detail-live-map" />

        {/* Map Loading Overlay */}
        {isLoadingMap && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10 text-white">
            <Loader2 className="w-9 h-9 animate-spin text-amber-400" />
            <p className="text-xs font-black tracking-wide">Loading Google Maps Route & Live Tracking...</p>
          </div>
        )}

        {/* Map Error Overlay */}
        {mapError && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center text-rose-300 gap-3 z-10">
            <AlertCircle className="w-8 h-8 text-rose-400" />
            <p className="text-xs font-bold max-w-md">{mapError}</p>
            <button
              onClick={initMap}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-black cursor-pointer"
            >
              Retry Loading Map
            </button>
          </div>
        )}
      </div>

      {/* 2. FLOATING TOP BAR */}
      <div className="absolute top-4 inset-x-4 z-30 flex items-center justify-between pointer-events-none">
        <button
          type="button"
          onClick={onBack}
          className="pointer-events-auto bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md text-white border border-slate-700/80 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 font-black text-xs transition-all cursor-pointer hover:scale-105 active:scale-95"
          id="trip-detail-back-btn"
        >
          <ArrowLeft className="w-4 h-4 text-amber-400 stroke-[3]" />
          <span>Back to Trip List</span>
        </button>

        {/* Top Right Live GPS Status Pill */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Live GPS Ping Status */}
          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3.5 py-2 rounded-2xl text-[11px] font-bold text-slate-200 shadow-xl">
            <Radio className={`w-3.5 h-3.5 ${isAwaitingLocation ? 'text-amber-400 animate-pulse' : 'text-emerald-400 animate-ping'}`} />
            <span>{isAwaitingLocation ? 'Awaiting location...' : 'Live GPS Tracked'}</span>
          </div>
        </div>
      </div>

      {/* 2b. FLOATING LOCATION BADGE PILL */}
      <div className="absolute top-16 sm:top-18 left-4 right-4 z-20 pointer-events-none flex items-center justify-start">
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md text-slate-900 border border-slate-200/90 px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2 max-w-[90vw] truncate">
          <MapPin className="w-4 h-4 text-[#F2A93B] shrink-0" />
          <span className="text-xs font-black truncate">{activeDest.name || 'Trip Destination'}</span>
          {activeDest.address && (
            <span className="text-[11px] text-slate-500 font-medium truncate hidden sm:inline">• {activeDest.address}</span>
          )}
        </div>
      </div>

      {/* 2c. FLOATING QUICK ACTION CONTROLS (Right-Hand Side GPS & Recentering) */}
      <div className="absolute right-3 sm:right-6 bottom-32 sm:bottom-36 z-30 flex flex-col gap-2.5 pointer-events-none">
        <button
          type="button"
          onClick={handleRecenterTruck}
          title="Center on Live Truck Location"
          className="pointer-events-auto w-12 h-12 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-slate-200 hover:bg-white text-slate-700 hover:text-[#0A1F44] flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Navigation className="w-5 h-5 text-[#F2A93B]" />
        </button>

        <button
          type="button"
          onClick={handleRecenterDestination}
          title="Center on Destination Pin"
          className="pointer-events-auto w-12 h-12 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-slate-200 hover:bg-white text-slate-700 hover:text-[#0A1F44] flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Building2 className="w-5 h-5 text-emerald-600" />
        </button>

        <button
          type="button"
          onClick={handleFitFullRoute}
          title="Fit map to full trip route"
          className="pointer-events-auto w-12 h-12 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-slate-200 hover:bg-white text-slate-700 hover:text-[#0A1F44] flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Crosshair className="w-5 h-5 text-blue-600" />
        </button>
      </div>

      {/* 3. TRIP DETAILS PANEL (Collapsible Bottom Sheet) */}
      <div className="absolute bottom-4 left-4 right-4 md:left-6 md:right-6 max-w-4xl mx-auto z-20">
        <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl transition-all duration-300 overflow-hidden">
          
          {/* COLLAPSED BAR HEADER */}
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/60 transition-colors select-none"
            id="trip-detail-toggle-panel-btn"
          >
            {/* Left: Plate, Status, Driver */}
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-base sm:text-lg text-white tracking-wide">{trip.plate_number}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${statusBadge.bg}`}>
                    {statusBadge.label}
                  </span>
                </div>
                <div className="text-xs text-slate-300 font-medium flex items-center gap-1.5 mt-0.5 truncate">
                  <span className="text-white font-bold truncate">{trip.driver_name}</span>
                  <span className="text-slate-600">•</span>
                  <a
                    href={`tel:${trip.driver_phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-amber-400 hover:text-amber-300 font-black flex items-center gap-1 text-xs underline cursor-pointer"
                    title="Tap to call driver"
                    id="trip-detail-driver-phone-link"
                  >
                    <Phone className="w-3 h-3 text-amber-400" />
                    <span>{trip.driver_phone}</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Right: Action Buttons & Expand Toggle */}
            <div className="flex items-center gap-2 shrink-0">
              
              {/* Contextual Action Button based on Trip Status */}
              {(trip.trip_status === 'created' || trip.trip_status === 'payment_confirmed') && canConfirmDeparture && (
                <button
                  type="button"
                  disabled={isSubmittingStatus}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleManualStatusChange('departed', 'Truck departure confirmed by manager.');
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer hover:scale-105 active:scale-95"
                  id="confirm-departure-btn"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Yes, Truck Has Left</span>
                </button>
              )}

              {(trip.trip_status === 'arrived_at_supplier' || trip.trip_status === 'departed' || trip.trip_status === 'in_transit') && canMarkLoaded && (
                <button
                  type="button"
                  disabled={isSubmittingStatus}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleManualStatusChange('loaded', 'Goods loaded onto truck.');
                  }}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer hover:scale-105 active:scale-95"
                  id="mark-loaded-btn"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>Mark as Loaded</span>
                </button>
              )}

              {(trip.trip_status === 'arrived_at_destination' || trip.trip_status === 'returning') && isManagerOrCEO && (
                <button
                  type="button"
                  disabled={isSubmittingStatus}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleManualStatusChange('completed', 'Trip completed by manager.');
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer hover:scale-105 active:scale-95"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>End Trip</span>
                </button>
              )}

              <button
                type="button"
                className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 shadow-md transition-all cursor-pointer"
              >
                <span>{isExpanded ? 'Hide Info' : 'Details'}</span>
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>

            </div>
          </div>

          {/* CRITICAL STOPPED ALERT NOTIFICATION BANNER */}
          {isStoppedWarningOrAlert && (
            <div className="p-3.5 bg-gradient-to-r from-rose-950/90 via-red-900/80 to-rose-950/90 border-t border-b border-rose-500/40 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5 text-rose-200 text-xs">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 animate-bounce" />
                <div>
                  <span className="font-black text-white">TRUCK STOPPED ALERT:</span> Truck has remained stationary during transit.
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmittingStatus}
                onClick={handleAcknowledgeAlert}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-black px-4 py-2 rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer ml-auto"
                id="acknowledge-stopped-alert-btn"
              >
                Acknowledge Alert
              </button>
            </div>
          )}

          {/* EXPANDABLE BODY SECTION */}
          {isExpanded && (
            <div className="p-4 sm:p-6 border-t border-slate-800 space-y-5 max-h-[50vh] overflow-y-auto custom-scrollbar">
              
              {/* Payment Info Card */}
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Payment Plan</div>
                    <div className="text-xs font-black text-white capitalize">{trip.payment_plan}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Status</div>
                  <div className={`text-xs font-black ${trip.payment_status === 'confirmed' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {trip.payment_status.toUpperCase()} (₦{trip.payment_amount.toLocaleString()})
                  </div>
                </div>
              </div>

              {/* Destination Details & Redirect Action Row */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Active Destination Display */}
                <div className="flex items-start gap-3 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 flex-1">
                  {activeDest.isRedirect ? (
                    <Navigation className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                  ) : (
                    <Building2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-wider ${activeDest.isRedirect ? 'text-orange-400' : 'text-emerald-400'}`}>
                        {activeDest.isRedirect ? 'Redirect Customer Destination 🔀' : 'Primary Supplier Destination'}
                      </span>
                      {activeDest.isRedirect && (
                        <span className="text-[9px] bg-orange-500/20 text-orange-300 font-extrabold px-1.5 py-0.2 rounded border border-orange-500/30">
                          ACTIVE REDIRECT
                        </span>
                      )}
                    </div>
                    {/* Original Supplier Destination Name */}
                    <div className="text-sm font-black text-white mt-0.5">{trip.primary_destination_name}</div>
                    
                    {/* Clear line showing Redirected to: [Customer Name] in orange directly below original destination name */}
                    {trip.redirect_destination && (
                      <div className="text-xs font-black text-orange-500 mt-1 flex items-center gap-1">
                        <span>↪️ Redirected to: {trip.redirect_destination.name}</span>
                      </div>
                    )}

                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                      <span>{activeDest.address}</span>
                    </p>
                  </div>
                </div>

                {/* Redirect Button */}
                {canRedirect && (
                  <div className="flex items-center justify-end shrink-0">
                    <button
                      type="button"
                      disabled={isCompletedOrCancelled}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsRedirectModalOpen(true);
                      }}
                      className={`w-full md:w-auto px-5 py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-lg ${
                        isCompletedOrCancelled
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50 opacity-60'
                          : 'bg-purple-600 hover:bg-purple-500 text-white border border-purple-400/40 shadow-purple-950/40 cursor-pointer hover:scale-105 active:scale-95'
                      }`}
                      id="trip-detail-redirect-btn"
                    >
                      <Navigation className="w-4 h-4 text-purple-200" />
                      <span>{trip.redirect_destination ? 'Update Redirect 🔀' : 'Redirect Trip 🔀'}</span>
                    </button>
                  </div>
                )}

              </div>

              {/* AUDIT LOG TIMELINE */}
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2 text-white font-black text-xs uppercase tracking-wider">
                    <History className="w-4 h-4 text-amber-400" />
                    <span>Audit Log & Status History</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold">
                    {statusHistory.length} Event{statusHistory.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="space-y-3 pt-1">
                  {statusHistory.length === 0 ? (
                    <div className="text-center text-xs text-slate-500 py-2 italic">
                      No audit history entries recorded yet.
                    </div>
                  ) : (
                    statusHistory.map((item: TripStatusHistoryEntry, idx: number) => {
                      const itemBadge = getStatusBadge(item.status, false);
                      return (
                        <div key={idx} className="flex items-start gap-3 relative text-xs">
                          {/* Timeline dot */}
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 mt-1 shadow-sm shadow-amber-400/50" />
                          <div className="flex-1 bg-slate-900/90 p-3 rounded-xl border border-slate-800/80">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${itemBadge.bg}`}>
                                {itemBadge.label}
                              </span>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                <Clock className="w-3 h-3 text-slate-500" />
                                <span>{formatIsoTimestamp(item.triggered_at)}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-slate-800/50 text-[11px]">
                              <span className="text-slate-300 font-medium">
                                Triggered by: <strong className="text-white">{item.triggered_by}</strong>
                              </span>
                            </div>

                            {item.note && (
                              <p className="text-[11px] text-amber-300/90 mt-1 italic font-sans bg-amber-500/5 p-1.5 rounded border border-amber-500/10">
                                "{item.note}"
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* Redirect Trip Modal */}
      <RedirectTripModal
        isOpen={isRedirectModalOpen}
        onClose={() => setIsRedirectModalOpen(false)}
        trip={trip}
        token={token}
        onTripRedirected={() => {
          setIsRedirectModalOpen(false);
          if (onTripUpdated) onTripUpdated();
        }}
      />

    </div>
  );
};
