import React, { useState, useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { TripRecord, TripStatusHistoryEntry } from '../types';
import { loadGoogleMaps } from '../utils/googleMapsLoader';
import { getFleetRole, FleetPermissions } from '../utils/permissions';
import {
  getGarageLocation,
  updateTripStatus,
  acknowledgeStoppedAlert,
  initializeTripPayment,
  verifyTripPayment,
  keepTripOpen,
  endTripManually,
} from '../api';
import { RedirectTripModal } from './RedirectTripModal';
import { ConfirmDepartureModal } from './ConfirmDepartureModal';
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
  CheckCircle2,
} from 'lucide-react';

// Off-route detection constants
const REROUTE_COOLDOWN = 30000; // 30 seconds between reroutes
const OFF_ROUTE_THRESHOLD = 500; // 500 meters

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
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isRedirectModalOpen, setIsRedirectModalOpen] = useState<boolean>(false);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState<boolean>(false);

  // Collapsible panel state — false by default so map takes up >90% of screen
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Map DOM Container
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInitializedRef = useRef<boolean>(false);

  // Google Maps Refs
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const googleMapsRef = useRef<any>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const garageMarkerRef = useRef<google.maps.Marker | null>(null);
  const destMarkerRef = useRef<google.maps.Marker | null>(null);
  const redirectMarkerRef = useRef<google.maps.Marker | null>(null);
  const truckMarkerRef = useRef<google.maps.Marker | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  // Route & Off-Route Detection Refs
  const currentRoutePathRef = useRef<google.maps.LatLng[]>([]);
  const lastRerouteTimeRef = useRef<number>(0);
  const lastDestinationKeyRef = useRef<string>('');

  // User permissions
  const fleetRole = getFleetRole(user, role);
  const canConfirmDeparture = FleetPermissions.canConfirmDeparture(fleetRole);
  const canRedirect = FleetPermissions.canRedirect(fleetRole);
  const canMarkLoaded = FleetPermissions.canMarkLoaded(fleetRole);
  const isManagerOrCEO = fleetRole === 'manager' || fleetRole === 'ceo';
  const isCompletedOrCancelled = trip.trip_status === 'completed' || trip.trip_status === 'cancelled';
  const isPaymentConfirmed = trip.payment_status === 'confirmed' || trip.tracking_active === true;

  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [showDepartureConfirmModal, setShowDepartureConfirmModal] = useState<boolean>(false);
  const [showEndTripModal, setShowEndTripModal] = useState<boolean>(false);
  const [endTripReason, setEndTripReason] = useState<string>('');
  const [isSubmittingEndTrip, setIsSubmittingEndTrip] = useState<boolean>(false);
  const [isSubmittingKeepOpen, setIsSubmittingKeepOpen] = useState<boolean>(false);
  const [paymentModalData, setPaymentModalData] = useState<{
    reference: string;
    checkout_url: string;
    amount: number;
    payment_plan: string;
  } | null>(null);

  const handleActivateTracking = async () => {
    if (trip.payment_plan === 'monthly') {
      const confirmMonthly = window.confirm(
        `You are subscribing truck ${trip.plate_number} to the Monthly Unlimited Plan for ₦3,500. This covers all trips for this truck for 30 days. Proceed to Paystack?`
      );
      if (!confirmMonthly) return;
    }

    try {
      setIsProcessingPayment(true);
      const res = await initializeTripPayment(token, trip.id, trip.payment_plan || 'per_trip');
      if (!res.success || !res.reference || !res.checkout_url) {
        alert(res.error || 'Failed to initialize payment gateway.');
        setIsProcessingPayment(false);
        return;
      }

      setPaymentModalData({
        reference: res.reference,
        checkout_url: res.checkout_url,
        amount: res.amount || (trip.payment_plan === 'monthly' ? 3500 : 1000),
        payment_plan: res.payment_plan || trip.payment_plan || 'per_trip'
      });

      window.open(res.checkout_url, '_blank');
    } catch (err: any) {
      alert(err?.message || 'Error initiating payment');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleConfirmPaymentSuccess = async () => {
    if (!paymentModalData) return;
    try {
      setIsProcessingPayment(true);
      const res = await verifyTripPayment(token, trip.id, paymentModalData.reference, (paymentModalData.payment_plan as any) || 'per_trip');
      if (!res.success) {
        alert(res.error || 'Payment verification failed');
      } else if (res.trip) {
        setTrip(res.trip);
        setPaymentModalData(null);
        alert('Payment confirmed successfully! Live tracking is now active.');
        if (onTripUpdated) onTripUpdated();
      }
    } catch (err: any) {
      alert(err?.message || 'Error verifying payment');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleDepartureClick = () => {
    if (!isPaymentConfirmed) {
      alert('Please activate live tracking and complete payment (₦1,000 per trip or ₦3,500 monthly) before confirming truck departure.');
      return;
    }
    setShowDepartureConfirmModal(true);
  };

  const handleConfirmDepartureFromModal = async () => {
    try {
      setIsSubmittingStatus(true);
      const res = await updateTripStatus(trip.id, 'departed', 'Truck departure confirmed by manager.', token);
      if (res.success) {
        if (res.trip) {
          setTrip(res.trip);
        }
        setShowDepartureConfirmModal(false);
        if (onTripUpdated) onTripUpdated();
      } else {
        alert(res.error || 'Failed to confirm truck departure');
      }
    } catch (err: any) {
      alert(err?.message || 'Error confirming truck departure');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

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

  // Draw initial route ONCE when screen opens using modern Google Routes API v2
  const drawInitialRoute = useCallback(
    async (originLat: number, originLng: number, destLat: number, destLng: number) => {
      if (!googleMapsRef.current || !googleMapRef.current) {
        return;
      }
      const googleMaps = googleMapsRef.current;
      const map = googleMapRef.current;

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
              strokeColor: '#1A73E8',
              strokeOpacity: 0.9,
              strokeWeight: 6,
              map: map,
            });

            currentRoutePathRef.current = points;
            setRouteError(null);
            return;
          }
        }
      } catch (srvErr) {
        console.warn('Route computation request error:', srvErr);
      }

      // If route fails, show friendly error and NEVER draw straight line
      setRouteError('Unable to load route. Check your connection.');
    },
    []
  );

  // Notify Manager When Off Route
  const notifyManagerOffRoute = useCallback(() => {
    if (!trip.id) return;
    const driverName = trip.driver_name || 'Driver';
    const plateNumber = trip.plate_number || 'Truck';

    // 1. Subcollection event
    addDoc(collection(db, 'fleetTracking_trips', trip.id, 'events'), {
      type: 'off_route',
      timestamp: serverTimestamp(),
      message: `⚠️ ${driverName} (${plateNumber}) has taken a different route than planned.`,
    }).catch((err) => console.warn('Failed to write off_route trip event:', err));

    // 2. Company notifications collection
    if (trip.company_id) {
      addDoc(collection(db, 'notifications'), {
        company_id: trip.company_id,
        trip_id: trip.id,
        title: '⚠️ Route Change Alert',
        message: `⚠️ Route Change: ${driverName} (${plateNumber}) has taken a different route. The map has been updated automatically.`,
        detail: `${driverName} (${plateNumber}) deviated more than 500m from planned route.`,
        created_at: new Date().toISOString(),
        type: 'off_route',
      }).catch(() => {});
    }
  }, [trip.company_id, trip.driver_name, trip.id, trip.plate_number]);

  // Handle off-route — reroute with 30s cooldown
  const handleOffRoute = useCallback(
    async (truckPosition: google.maps.LatLng) => {
      const now = Date.now();
      if (now - lastRerouteTimeRef.current < REROUTE_COOLDOWN) {
        return;
      }
      lastRerouteTimeRef.current = now;

      console.log('Truck is off route — requesting new route');
      const dest = getActiveDestination();
      if (!dest || !googleMapsRef.current || !googleMapRef.current) {
        return;
      }
      const googleMaps = googleMapsRef.current;
      const map = googleMapRef.current;

      try {
        const res = await fetch(
          `/api/fleet-tracking/route?originLat=${truckPosition.lat()}&originLng=${truckPosition.lng()}&destLat=${dest.lat}&destLng=${dest.lng}`
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
              strokeColor: '#1A73E8',
              strokeOpacity: 0.9,
              strokeWeight: 6,
              map: map,
            });

            currentRoutePathRef.current = points;
            notifyManagerOffRoute();
            console.log('New route drawn after off-route detection');
            setRouteError(null);
          }
        }
      } catch (err) {
        console.warn('Rerouting request failed:', err);
      }
    },
    [getActiveDestination, notifyManagerOffRoute]
  );

  // Off-Route Detection using Google Maps Spherical Geometry
  const checkOffRoute = useCallback(
    (truckPosition: google.maps.LatLng) => {
      if (!googleMapsRef.current?.geometry?.spherical) {
        return;
      }
      let minDistance = Infinity;
      const path = currentRoutePathRef.current;
      if (path.length === 0) return;

      path.forEach((point) => {
        const distance = googleMapsRef.current.geometry.spherical.computeDistanceBetween(truckPosition, point);
        if (distance < minDistance) {
          minDistance = distance;
        }
      });

      console.log('Distance from route:', minDistance, 'meters');

      if (minDistance > OFF_ROUTE_THRESHOLD) {
        handleOffRoute(truckPosition);
      }
    },
    [handleOffRoute]
  );

  // On each GPS update — ONLY move truck pin
  const handleTruckLocationUpdate = useCallback(
    (newLat: number, newLng: number) => {
      if (!googleMapsRef.current || !truckMarkerRef.current) return;
      const googleMaps = googleMapsRef.current;
      const newPosition = new googleMaps.LatLng(newLat, newLng);

      // 1. Move ONLY the truck pin — never redraw route here
      truckMarkerRef.current.setPosition(newPosition);

      // 2. Check if truck is off route
      if (currentRoutePathRef.current.length > 0) {
        checkOffRoute(newPosition);
      }
    },
    [checkOffRoute]
  );

  // Reroute when trip is redirected
  const handleTripRedirect = useCallback(
    (truckLat: number, truckLng: number, newDestLat: number, newDestLng: number) => {
      drawInitialRoute(truckLat, truckLng, newDestLat, newDestLng);
    },
    [drawInitialRoute]
  );

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
            tracking_active: data.tracking_active ?? trip.tracking_active,
            paid_by: data.paid_by || trip.paid_by,
            payment_date: data.payment_date || trip.payment_date,
            payment_reference: data.payment_reference || trip.payment_reference,
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

          // Check live location & update marker position + off-route check
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
            handleTruckLocationUpdate(parsedLat, parsedLng);
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
  }, [handleTruckLocationUpdate, trip.company_id, trip.created_at, trip.created_by, trip.driver_name, trip.driver_phone, trip.garage_lat, trip.garage_lng, trip.id, trip.last_known_lat, trip.last_known_lng, trip.last_movement_at, trip.paid_by, trip.payment_amount, trip.payment_date, trip.payment_plan, trip.payment_reference, trip.payment_status, trip.plate_number, trip.primary_destination_id, trip.primary_destination_lat, trip.primary_destination_lng, trip.primary_destination_name, trip.primary_destination_type, trip.redirect_destination, trip.status_history, trip.stopped_acknowledged, trip.stopped_alert_sent, trip.stopped_warning_sent, trip.tracking_active, trip.trip_status, trip.truck_id]);

  // ----------------------------------------------------
  // 4. MAIN GOOGLE MAP INITIALIZER
  // ----------------------------------------------------
  const initMap = useCallback(async () => {
    if (mapInitializedRef.current && googleMapRef.current) {
      setIsLoadingMap(false);
      return;
    }

    try {
      setIsLoadingMap(true);
      setMapError(null);

      // Safety timeout: dismiss loading spinner after 3 seconds max so UI is never blocked
      const safetyDismissTimer = setTimeout(() => {
        setIsLoadingMap(false);
      }, 3000);

      // Load Google Maps SDK with the bundled key
      const googleMaps = await loadGoogleMaps(mapsConfig.apiKey);
      googleMapsRef.current = googleMaps;

      if (!mapContainerRef.current) {
        setIsLoadingMap(false);
        clearTimeout(safetyDismissTimer);
        return;
      }
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
      mapInitializedRef.current = true;
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
          <svg xmlns="http://www.w3.org/2000/svg" width="52" height="60" viewBox="0 0 52 60">
            <path d="M26 0C11.6 0 0 11.6 0 26C0 41 26 60 26 60C26 60 52 41 52 26C52 11.6 40.4 0 26 0Z" fill="#F59E0B" stroke="#FFFFFF" stroke-width="3"/>
            <circle cx="26" cy="24" r="17" fill="#0F172A"/>
            <path d="M18 19H30V29H18V19Z" fill="#F59E0B"/>
            <path d="M30 22H34L37 25V29H30V22Z" fill="#F59E0B"/>
            <circle cx="21" cy="30" r="3" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.5"/>
            <circle cx="33" cy="30" r="3" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.5"/>
          </svg>
        `),
        scaledSize: new googleMaps.Size(52, 60),
        anchor: new googleMaps.Point(26, 60),
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
        zIndex: 2,
      });

      const garageInfoWindow = new googleMaps.InfoWindow({
        content: `
          <div style="padding: 8px; font-family: sans-serif;">
            <strong style="color: #1e40af; font-size: 14px;">🏭 Garage</strong>
            <p style="margin: 4px 0; color: #666; font-size: 12px;">
              Starting point
            </p>
          </div>
        `,
      });

      gMarker.addListener('click', () => {
        garageInfoWindow.open(map, gMarker);
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

      const destInfoWindow = new googleMaps.InfoWindow({
        content: `
          <div style="padding: 8px; font-family: sans-serif;">
            <strong style="color: #0f172a; font-size: 14px;">${primaryName}</strong>
            <p style="margin: 4px 0; color: #666; font-size: 12px;">
              ${hasRedirect ? '↪️ Redirected Destination' : '📦 Supplier Destination'}
            </p>
          </div>
        `,
      });

      dMarker.addListener('click', () => {
        destInfoWindow.open(map, dMarker);
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

        const redirectInfoWindow = new googleMaps.InfoWindow({
          content: `
            <div style="padding: 8px; font-family: sans-serif;">
              <strong style="color: #c2410c; font-size: 14px;">↪️ ${redirectCustomerName}</strong>
              <p style="margin: 4px 0; color: #666; font-size: 12px;">
                Redirected Destination
              </p>
            </div>
          `,
        });

        rMarker.addListener('click', () => {
          redirectInfoWindow.open(map, rMarker);
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

      const truckDriverName = trip.driver_name || 'Assigned Driver';
      const truckPlate = trip.plate_number || 'Truck';
      const truckPhone = trip.driver_phone || 'No phone provided';

      const truckInfoWindow = new googleMaps.InfoWindow({
        content: `
          <div style="padding: 8px; font-family: sans-serif;">
            <strong style="color: #0f172a; font-size: 14px;">🚛 ${truckPlate}</strong>
            <p style="margin: 4px 0; font-size: 12px; color: #334155;">
              Driver: ${truckDriverName}
            </p>
            <p style="margin: 4px 0; color: #666; font-size: 12px;">
              ${truckPhone}
            </p>
          </div>
        `,
      });

      tMarker.addListener('click', () => {
        truckInfoWindow.open(map, tMarker);
      });

      truckMarkerRef.current = tMarker;

      // Draw Initial Route ONCE when screen opens
      const originPos = isValidCoord(truckLocation) ? truckLocation! : garageCoords;
      if (isValidCoord(originPos) && dest && isValidCoord({ lat: dest.lat, lng: dest.lng })) {
        drawInitialRoute(originPos.lat, originPos.lng, dest.lat, dest.lng);
        lastDestinationKeyRef.current = `${dest.lat}_${dest.lng}_${dest.isRedirect}`;
      }

      // Active pins calculation for initial view bounds
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
        clearTimeout(safetyDismissTimer);
        setIsLoadingMap(false);
      });

      clearTimeout(safetyDismissTimer);
      setIsLoadingMap(false);
    } catch (err: any) {
      console.error('Google Map initialization error:', err);
      setMapError(err?.message || 'Failed to initialize Google Maps');
      setIsLoadingMap(false);
    }
  }, [drawInitialRoute, garageCoords, getActiveDestination, trip.driver_name, trip.driver_phone, trip.plate_number, trip.primary_destination_lat, trip.primary_destination_lng, trip.primary_destination_name, trip.redirect_destination, truckLocation]);

  useEffect(() => {
    let timer = setTimeout(() => {
      initMap();
    }, 100);
    return () => clearTimeout(timer);
  }, [initMap]);

  // Clean up polyline on unmount
  useEffect(() => {
    return () => {
      if (routePolylineRef.current) {
        routePolylineRef.current.setMap(null);
      }
    };
  }, []);

  // STEP 7 — Reroute when trip is redirected to new destination
  useEffect(() => {
    if (!googleMapRef.current || !googleMapsRef.current) return;
    const dest = getActiveDestination();
    const destKey = `${dest.lat}_${dest.lng}_${dest.isRedirect}`;

    if (lastDestinationKeyRef.current && lastDestinationKeyRef.current !== destKey) {
      console.log('Destination changed or redirected — redrawing route to new destination');
      const originPos = truckLocation || garageCoords;
      if (originPos && typeof originPos.lat === 'number' && typeof originPos.lng === 'number') {
        handleTripRedirect(originPos.lat, originPos.lng, dest.lat, dest.lng);
      }
    }
    lastDestinationKeyRef.current = destKey;
  }, [trip.redirect_destination, trip.primary_destination_lat, trip.primary_destination_lng, getActiveDestination, truckLocation, garageCoords, handleTripRedirect]);

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

  const handleEndTripConfirm = async () => {
    try {
      setIsSubmittingEndTrip(true);
      const res = await endTripManually(token, trip.id, endTripReason || undefined);
      if (!res.success) {
        alert(res.error || 'Failed to end trip');
      } else if (res.trip) {
        setTrip(res.trip);
        setShowEndTripModal(false);
        setEndTripReason('');
        if (onTripUpdated) onTripUpdated();
      }
    } catch (err: any) {
      alert(err?.message || 'Error ending trip');
    } finally {
      setIsSubmittingEndTrip(false);
    }
  };

  const handleKeepTripOpen = async () => {
    try {
      setIsSubmittingKeepOpen(true);
      const res = await keepTripOpen(token, trip.id);
      if (!res.success) {
        alert(res.error || 'Failed to keep trip open');
      } else if (res.trip) {
        setTrip(res.trip);
        if (onTripUpdated) onTripUpdated();
      }
    } catch (err: any) {
      alert(err?.message || 'Error dismissing alert');
    } finally {
      setIsSubmittingKeepOpen(false);
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
      <div className="absolute top-16 sm:top-18 left-4 right-4 z-20 pointer-events-none flex flex-col gap-2 items-start justify-start">
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md text-slate-900 border border-slate-200/90 px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2 max-w-[90vw] truncate">
          <MapPin className="w-4 h-4 text-[#F2A93B] shrink-0" />
          <span className="text-xs font-black truncate">{activeDest.name || 'Trip Destination'}</span>
          {activeDest.address && (
            <span className="text-[11px] text-slate-500 font-medium truncate hidden sm:inline">• {activeDest.address}</span>
          )}
        </div>

        {/* Route Warning Banner */}
        {routeError && (
          <div className="pointer-events-auto bg-amber-500/95 text-slate-950 px-3.5 py-1.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold border border-amber-400 backdrop-blur-md">
            <AlertCircle className="w-4 h-4 shrink-0 text-slate-950" />
            <span>{routeError}</span>
          </div>
        )}
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
                    handleDepartureClick();
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer transition-all hover:scale-105 active:scale-95 ${
                    !isPaymentConfirmed
                      ? 'bg-amber-600/90 text-white border border-amber-400'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                  id="confirm-departure-btn"
                  title={!isPaymentConfirmed ? 'Payment required before departure' : 'Has the truck departed? Confirm departure.'}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{!isPaymentConfirmed ? '⚠️ Pay to Depart' : 'Has the truck departed? 🚛'}</span>
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

              {/* Manual End Trip Button for Manager/CEO on any active trip */}
              {!isCompletedOrCancelled && isManagerOrCEO && (
                <button
                  type="button"
                  disabled={isSubmittingStatus || isSubmittingEndTrip}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEndTripModal(true);
                  }}
                  className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer hover:scale-105 active:scale-95"
                  id="manual-end-trip-btn"
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

          {/* GPS LOSS ALERT BANNERS */}
          {!isCompletedOrCancelled && trip.gps_signal_status === 'lost_60min' && !trip.gps_loss_dismissed && (
            <div className="p-3.5 bg-gradient-to-r from-red-950/95 via-rose-900/90 to-red-950/95 border-t border-b border-rose-500/50 flex items-center justify-between flex-wrap gap-3 animate-pulse">
              <div className="flex items-center gap-2.5 text-rose-200 text-xs">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <span className="font-black text-white">🔴 GPS SIGNAL LOST &gt; 1 HOUR:</span> Truck has not sent GPS updates for over 60 minutes.
                </div>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  disabled={isSubmittingKeepOpen}
                  onClick={handleKeepTripOpen}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-600 cursor-pointer"
                  id="keep-trip-open-btn"
                >
                  Keep Trip Open
                </button>
                {isManagerOrCEO && (
                  <button
                    type="button"
                    onClick={() => setShowEndTripModal(true)}
                    className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-lg cursor-pointer"
                    id="gps-lost-end-trip-btn"
                  >
                    End Trip Now
                  </button>
                )}
              </div>
            </div>
          )}

          {!isCompletedOrCancelled && trip.gps_signal_status === 'lost_30min' && !trip.gps_loss_dismissed && (
            <div className="p-3 bg-gradient-to-r from-amber-950/90 via-yellow-900/80 to-amber-950/90 border-t border-b border-amber-500/40 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5 text-amber-200 text-xs">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <span className="font-black text-white">⚠️ GPS SIGNAL LOST:</span> Location has not updated for 30 minutes. Please contact driver.
                </div>
              </div>
            </div>
          )}

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
              
              {/* Payment Info Card & Activation */}
              {!isPaymentConfirmed ? (
                <div className="bg-slate-950/90 p-4 rounded-2xl border border-amber-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-extrabold text-amber-400 tracking-wider">Live Tracking Payment Pending</div>
                        <div className="text-xs font-black text-white capitalize">
                          {trip.payment_plan === 'monthly' ? 'Monthly Plan (₦3,500 / month)' : 'Per Trip Plan (₦1,000 / trip)'}
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      PENDING 🔴
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    {isManagerOrCEO
                      ? 'Live tracking and truck departure confirmation require active payment confirmation via Paystack.'
                      : 'Live tracking is awaiting Manager or CEO payment activation.'}
                  </p>

                  {isManagerOrCEO && (
                    <button
                      type="button"
                      disabled={isProcessingPayment}
                      onClick={handleActivateTracking}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-transform hover:scale-[1.01]"
                      id="activate-tracking-btn-detail"
                    >
                      {isProcessingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4 stroke-[2.5]" />}
                      <span>Activate Live Tracking Now (₦{trip.payment_amount.toLocaleString()})</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-slate-950/90 p-4 rounded-2xl border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-extrabold text-emerald-400 tracking-wider">Live Tracking & Payment Active 🟢</div>
                      <div className="text-xs font-black text-white capitalize">
                        {trip.payment_plan === 'monthly' ? 'Monthly Unlimited Plan' : 'Per Trip Plan'} (₦{trip.payment_amount.toLocaleString()})
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-300">
                    <div>Paid by: <strong className="text-white">{trip.paid_by || 'Manager'}</strong></div>
                    {trip.payment_date && <div className="text-[10px] text-slate-400">{formatIsoTimestamp(trip.payment_date)}</div>}
                  </div>
                </div>
              )}

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

      {/* Paystack Payment Checkout & Verification Modal */}
      {paymentModalData && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-white">Complete Paystack Payment</h3>
            <p className="text-xs text-slate-300">
              Pay <strong>₦{paymentModalData.amount.toLocaleString()}</strong> ({paymentModalData.payment_plan === 'monthly' ? 'Monthly Unlimited Plan' : 'Per Trip Plan'}) to activate live GPS tracking for truck <strong>{trip.plate_number}</strong>.
            </p>
            <div className="space-y-2 pt-2">
              <a
                href={paymentModalData.checkout_url}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg transition-transform hover:scale-105"
              >
                <span>Open Paystack Checkout Portal ↗</span>
              </a>
              <button
                type="button"
                disabled={isProcessingPayment}
                onClick={handleConfirmPaymentSuccess}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                {isProcessingPayment && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Confirm Paystack Payment Success</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentModalData(null)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-2xl text-xs cursor-pointer"
              >
                Cancel / Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Departure Dialog Modal */}
      <ConfirmDepartureModal
        isOpen={showDepartureConfirmModal}
        onClose={() => setShowDepartureConfirmModal(false)}
        trip={trip}
        isLoading={isSubmittingStatus}
        onConfirmDeparture={handleConfirmDepartureFromModal}
      />

      {/* Manual End Trip Modal */}
      {showEndTripModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-fadeIn text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Flag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Manually End Trip</h3>
                <p className="text-xs text-slate-400">Truck: {trip.plate_number} • Driver: {trip.driver_name}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Reason for ending trip (Optional)</label>
              <input
                type="text"
                value={endTripReason}
                onChange={(e) => setEndTripReason(e.target.value)}
                placeholder="e.g. Driver confirmed delivery offline"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
              />
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Ending this trip will mark it as Completed and stop active tracking immediately. This will be recorded permanently in the audit log.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEndTripModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingEndTrip}
                onClick={handleEndTripConfirm}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer"
                id="confirm-manual-end-trip-btn"
              >
                {isSubmittingEndTrip && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm End Trip</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
