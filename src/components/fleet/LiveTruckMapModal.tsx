import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  Truck,
  MapPin,
  RefreshCw,
  X,
  Navigation,
  Building2,
  Phone,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Radio,
  Package,
  Route,
  Store,
  ChevronRight,
  MessageCircle,
  History,
  Gauge,
  Compass,
  CheckCircle2
} from 'lucide-react';
import { pingFleetTruckLocation, updateFleetTripDestination } from '../../lib/api';

// Comprehensive Nigerian Industrial, Commercial & City Directory for Precision Geocoding
const NIGERIA_LOCATIONS_DB: { [key: string]: { lat: number; lng: number; name: string; address: string } } = {
  // IBeto Group & Cement
  'ibeto': { lat: 6.0145, lng: 6.9182, name: 'IBeto Cement / Industrial Group', address: 'IBeto Industrial Avenue, Otolo, Nnewi, Anambra State' },
  'ibeto cement': { lat: 6.0145, lng: 6.9182, name: 'IBeto Cement Company', address: 'IBeto Industrial Complex, Nnewi, Anambra State' },
  'ibeto group': { lat: 6.0145, lng: 6.9182, name: 'IBeto Group Headquarters', address: 'Nnewi Industrial Layout, Anambra State' },
  'ibeto port harcourt': { lat: 4.7550, lng: 7.0250, name: 'IBeto Cement Terminal Port Harcourt', address: 'Bundu Waterside, Port Harcourt, Rivers State' },
  
  // Nnewi Major Industrial Hubs
  'innoson': { lat: 6.0220, lng: 6.9250, name: 'Innoson Vehicle Manufacturing (IVM)', address: 'Innoson Industrial Complex, Nnewi, Anambra State' },
  'cutix': { lat: 6.0180, lng: 6.9150, name: 'Cutix Cables Plc', address: 'Otolo, Nnewi, Anambra State' },
  'chicason': { lat: 6.0120, lng: 6.9200, name: 'Chicason Group / A-Z Petroleum', address: 'Chicason Drive, Nnewi, Anambra State' },
  'tummy tummy': { lat: 6.0280, lng: 6.9320, name: 'Tummy Tummy Foods Industries', address: 'Nnewi-Ihiala Expressway, Anambra State' },

  // Dangote Cement Plants & Depots
  'dangote': { lat: 7.9150, lng: 6.4250, name: 'Dangote Cement Obajana Plant', address: 'Obajana, Kogi State' },
  'dangote ibese': { lat: 6.9833, lng: 3.0333, name: 'Dangote Cement Ibese Plant', address: 'Ibese, Ogun State' },
  'dangote gboko': { lat: 7.3167, lng: 8.9833, name: 'Dangote Cement Gboko', address: 'Gboko, Benue State' },
  'dangote refinery': { lat: 6.4350, lng: 4.0250, name: 'Dangote Petroleum Refinery & Petrochemicals', address: 'Lekki Free Zone, Lagos' },

  // BUA Cement Plants
  'bua': { lat: 7.2600, lng: 6.3400, name: 'BUA Cement Plant Okpella', address: 'Okpella, Edo State' },
  'bua okpella': { lat: 7.2600, lng: 6.3400, name: 'BUA Cement Plant Okpella', address: 'Okpella, Edo State' },
  'bua kalambaina': { lat: 13.0200, lng: 5.1800, name: 'BUA Cement Kalambaina', address: 'Kalambaina, Sokoto State' },

  // Lafarge Cement Plants
  'lafarge': { lat: 6.9000, lng: 3.2167, name: 'Lafarge Cement Ewekoro Plant', address: 'Ewekoro, Ogun State' },
  'lafarge ewekoro': { lat: 6.9000, lng: 3.2167, name: 'Lafarge Cement Ewekoro Plant', address: 'Ewekoro, Ogun State' },
  'lafarge sagamu': { lat: 6.8333, lng: 3.6500, name: 'Lafarge Cement Sagamu Plant', address: 'Sagamu, Ogun State' },
  'lafarge mfamosing': { lat: 5.0500, lng: 8.5333, name: 'Lafarge Cement Mfamosing', address: 'Calabar, Cross River State' },
  'ashaka cement': { lat: 10.9500, lng: 11.4500, name: 'Ashaka Cement Plc', address: 'Ashaka, Gombe State' },

  // Commercial & Port Hubs
  'nnewi': { lat: 6.0180, lng: 6.9150, name: 'Nnewi Industrial Hub', address: 'Nnewi, Anambra State' },
  'onitsha': { lat: 6.1450, lng: 6.7850, name: 'Onitsha Harbour Industrial', address: 'Onitsha, Anambra State' },
  'apapa': { lat: 6.4440, lng: 3.3640, name: 'Apapa Port Terminal', address: 'Wharf Road, Apapa, Lagos' },
  'tin can': { lat: 6.4380, lng: 3.3420, name: 'Tin Can Island Port', address: 'Apapa, Lagos' },
  'ikeja': { lat: 6.5980, lng: 3.3480, name: 'Ikeja Industrial Zone', address: 'Oba Akran, Ikeja, Lagos' },
  'agbara': { lat: 6.5167, lng: 3.1000, name: 'Agbara Industrial Estate', address: 'Agbara, Ogun State' },
  'ojo': { lat: 6.4600, lng: 3.1900, name: 'Ojo Commercial Depot', address: 'Ojo, Lagos' },
  'alaba': { lat: 6.4600, lng: 3.1900, name: 'Alaba International Market Hub', address: 'Ojo, Lagos' },
  'aba': { lat: 5.1200, lng: 7.3500, name: 'Aba Industrial / Osisioma', address: 'Osisioma, Aba, Abia State' },
  'port harcourt': { lat: 4.8200, lng: 7.0350, name: 'Trans-Amadi Industrial Layout', address: 'Port Harcourt, Rivers State' },
  'kano': { lat: 12.0022, lng: 8.5919, name: 'Sharada Industrial Estate', address: 'Kano State' },
  'abuja': { lat: 9.0450, lng: 7.3250, name: 'Idu Industrial Layout', address: 'Abuja FCT' },
  'enugu': { lat: 6.4750, lng: 7.5650, name: 'Emene Industrial Layout', address: 'Enugu State' },
  'asaba': { lat: 6.1980, lng: 6.7320, name: 'Asaba Commercial Area', address: 'Delta State' }
};

// Client-side Geocoding Resolver
function resolveNigerianLocation(rawName: string, rawAddress?: string): { lat: number; lng: number; name: string; address: string } | null {
  const query = `${rawName || ''} ${rawAddress || ''}`.toLowerCase().trim();
  if (!query) return null;

  for (const [key, value] of Object.entries(NIGERIA_LOCATIONS_DB)) {
    if (query.includes(key)) {
      return {
        lat: value.lat,
        lng: value.lng,
        name: rawName || value.name,
        address: value.address
      };
    }
  }

  return null;
}

// Great-Circle Distance Calculation (Haversine formula in KM)
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of Earth in km
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
  const leafletMapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const polylinesRef = useRef<L.Polyline[]>([]);

  const [locationData, setLocationData] = useState<any>(null);
  const [tripData, setTripData] = useState<any>(null);
  const [driverData, setDriverData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [autoTrack, setAutoTrack] = useState<boolean>(true);
  const [autoRefreshCount, setAutoRefreshCount] = useState<number>(10);
  const [mapLayerType, setMapLayerType] = useState<'streets' | 'satellite'>('streets');

  // Compute Destination Coordinates accurately
  const isCustomerDestination = useMemo(() => {
    return tripData?.destination_type === 'customer' || Boolean(tripData?.customer_info?.name);
  }, [tripData]);

  const destCoords = useMemo(() => {
    // 1. Check customer info
    if (isCustomerDestination && tripData?.customer_info) {
      if (typeof tripData.customer_info.latitude === 'number' && typeof tripData.customer_info.longitude === 'number') {
        return {
          lat: tripData.customer_info.latitude,
          lng: tripData.customer_info.longitude,
          name: tripData.customer_info.name || 'Customer Delivery',
          address: tripData.customer_info.address || 'Customer Delivery Location',
          phone: tripData.customer_info.phone_number || ''
        };
      }
      // Try resolving customer address / name
      const resolved = resolveNigerianLocation(tripData.customer_info.name, tripData.customer_info.address);
      if (resolved) {
        return {
          lat: resolved.lat,
          lng: resolved.lng,
          name: tripData.customer_info.name || resolved.name,
          address: tripData.customer_info.address || resolved.address,
          phone: tripData.customer_info.phone_number || ''
        };
      }
    }

    // 2. Check destination_info / supplier_info from backend
    if (tripData?.destination_info?.latitude && tripData?.destination_info?.longitude) {
      return {
        lat: tripData.destination_info.latitude,
        lng: tripData.destination_info.longitude,
        name: tripData.destination_info.name || tripData.supplier_name || 'Destination Facility',
        address: tripData.destination_info.address || 'Industrial Zone Facility',
        phone: ''
      };
    }

    // 3. Resolve destination name (e.g. "IBeto Cement Company", "Innoson", "Dangote")
    const destName = tripData?.supplier_name || tripData?.destination_name || 'IBeto Cement Company';
    const resolvedSupplier = resolveNigerianLocation(destName);
    if (resolvedSupplier) {
      return {
        lat: resolvedSupplier.lat,
        lng: resolvedSupplier.lng,
        name: destName,
        address: resolvedSupplier.address,
        phone: ''
      };
    }

    // 4. Default fallback: If driver is in Nnewi/Anambra area, place near Nnewi; otherwise standard
    const truckLat = locationData?.latitude || 6.0180;
    const truckLng = locationData?.longitude || 6.9150;
    return {
      lat: 6.0145,
      lng: 6.9182,
      name: destName,
      address: 'IBeto Industrial Complex, Nnewi, Anambra State',
      phone: ''
    };
  }, [tripData, isCustomerDestination, locationData]);

  // Compute Origin Coordinates
  const originCoords = useMemo(() => {
    if (tripData?.origin_info?.latitude && tripData?.origin_info?.longitude) {
      return {
        lat: tripData.origin_info.latitude,
        lng: tripData.origin_info.longitude,
        name: tripData.origin_info.name || tripData.origin_park || 'Company Origin Garage'
      };
    }

    const originName = tripData?.origin_park || 'Company Garage';
    const resolvedOrigin = resolveNigerianLocation(originName);
    if (resolvedOrigin) {
      return {
        lat: resolvedOrigin.lat,
        lng: resolvedOrigin.lng,
        name: originName
      };
    }

    const truckLat = locationData?.latitude || 6.0180;
    const truckLng = locationData?.longitude || 6.9150;
    return {
      lat: Number((truckLat - 0.015).toFixed(5)),
      lng: Number((truckLng - 0.012).toFixed(5)),
      name: originName
    };
  }, [tripData, locationData]);

  // Calculate Metrics: True Distance, Speed, ETA
  const tripMetrics = useMemo(() => {
    const truckLat = locationData?.latitude || 6.0180;
    const truckLng = locationData?.longitude || 6.9150;

    const distanceToDestKm = calculateHaversineDistance(
      truckLat,
      truckLng,
      destCoords.lat,
      destCoords.lng
    );

    const speed = typeof locationData?.speed === 'number' && locationData.speed > 3 ? Math.round(locationData.speed) : 0;
    const isStopped = speed < 4;
    const effectiveSpeed = speed > 15 ? speed : 35; // km/h for ETA
    const etaMinutes = Math.max(3, Math.round((distanceToDestKm / effectiveSpeed) * 60));

    const isNearDestination = distanceToDestKm <= 1.5;

    return {
      distanceKm: Number(distanceToDestKm.toFixed(1)),
      speed,
      isStopped,
      etaMinutes,
      isNearDestination
    };
  }, [locationData, destCoords]);

  // Fetch Live Location & Updates
  const fetchLiveLocation = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setError(null);

    try {
      const res = await pingFleetTruckLocation(token, truckId);
      if (!res.success) {
        throw new Error(res.error || 'Unable to retrieve live coordinates.');
      }

      setLocationData(res.location);
      setTripData(res.trip);
      setDriverData(res.driver);
      setHistory(res.location_history || []);
    } catch (err: any) {
      setError(err.message || 'Could not ping truck GPS.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLiveLocation(false);
  }, [truckId]);

  // Auto-polling interval
  useEffect(() => {
    if (!autoTrack) return;

    const interval = setInterval(() => {
      setAutoRefreshCount((prev) => {
        if (prev <= 1) {
          fetchLiveLocation(false);
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoTrack, truckId]);

  // Leaflet Map Initialization & Updates
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const truckLat = locationData?.latitude || 6.0180;
    const truckLng = locationData?.longitude || 6.9150;

    // 1. Initialize Map Instance if not created
    if (!leafletMapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [truckLat, truckLng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false
      });

      // Add modern zoom controls to top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Tile Layer (CartoDB Voyager or OpenStreetMap)
      const streetTiles = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 19,
          subdomains: 'abcd'
        }
      );

      streetTiles.addTo(map);
      tileLayerRef.current = streetTiles;
      leafletMapRef.current = map;
    }

    const map = leafletMapRef.current;
    if (!map) return;

    // Invalidate map size to prevent rendering glitches on mobile viewport
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    // 2. Clear old polylines
    polylinesRef.current.forEach((poly) => poly.remove());
    polylinesRef.current = [];

    // 3. Clear old markers
    (Object.values(markersRef.current) as L.Marker[]).forEach((marker) => {
      if (marker && typeof marker.remove === 'function') {
        marker.remove();
      }
    });
    markersRef.current = {};

    // 4. Custom Icon Helpers (Rich HTML Badges with pulse)
    const originIcon = L.divIcon({
      className: 'custom-leaflet-pin',
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <div style="background: #059669; color: white; padding: 6px 10px; border-radius: 9999px; font-weight: 800; font-size: 11px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2px solid white; display: flex; align-items: center; gap: 4px; white-space: nowrap;">
            <span>🏁</span> Starting Point
          </div>
          <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #059669; margin-top: -1px;"></div>
        </div>
      `,
      iconSize: [110, 36],
      iconAnchor: [55, 36]
    });

    const destIcon = L.divIcon({
      className: 'custom-leaflet-pin',
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <div style="background: ${isCustomerDestination ? '#7E22CE' : '#1D4ED8'}; color: white; padding: 6px 10px; border-radius: 9999px; font-weight: 800; font-size: 11px; box-shadow: 0 4px 14px rgba(0,0,0,0.35); border: 2px solid white; display: flex; align-items: center; gap: 4px; white-space: nowrap;">
            <span>${isCustomerDestination ? '📦' : '🏢'}</span> ${destCoords.name.slice(0, 20)}
          </div>
          <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid ${isCustomerDestination ? '#7E22CE' : '#1D4ED8'}; margin-top: -1px;"></div>
        </div>
      `,
      iconSize: [140, 36],
      iconAnchor: [70, 36]
    });

    const truckIcon = L.divIcon({
      className: 'custom-leaflet-pin',
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <div style="position: relative;">
            <div style="position: absolute; inset: -4px; border-radius: 9999px; background: #F59E0B; opacity: 0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="background: #D97706; color: white; padding: 6px 12px; border-radius: 9999px; font-weight: 900; font-size: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.4); border: 2px solid white; display: flex; align-items: center; gap: 6px; position: relative;">
              <span style="font-size: 14px;">🚛</span>
              <span>${truckNumber}</span>
              <span style="background: rgba(0,0,0,0.25); padding: 2px 6px; border-radius: 6px; font-size: 10px;">${tripMetrics.speed} km/h</span>
            </div>
          </div>
          <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 7px solid #D97706; margin-top: -1px;"></div>
        </div>
      `,
      iconSize: [160, 42],
      iconAnchor: [80, 42]
    });

    // 5. Add Markers
    const originMarker = L.marker([originCoords.lat, originCoords.lng], { icon: originIcon }).addTo(map);
    originMarker.bindPopup(`
      <div style="font-family: sans-serif; padding: 4px;">
        <strong style="color: #059669; font-size: 13px;">🏁 Origin Garage / Terminal</strong><br/>
        <div style="font-size: 12px; font-weight: bold; margin-top: 2px;">${originCoords.name}</div>
      </div>
    `);
    markersRef.current.origin = originMarker;

    const destMarker = L.marker([destCoords.lat, destCoords.lng], { icon: destIcon }).addTo(map);
    destMarker.bindPopup(`
      <div style="font-family: sans-serif; padding: 4px;">
        <strong style="color: ${isCustomerDestination ? '#7E22CE' : '#1D4ED8'}; font-size: 13px;">
          ${isCustomerDestination ? '📦 Customer Destination' : '🏢 Company Destination'}
        </strong><br/>
        <div style="font-size: 13px; font-weight: bold; margin-top: 2px;">${destCoords.name}</div>
        <div style="font-size: 11px; color: #475569; margin-top: 2px;">${destCoords.address}</div>
      </div>
    `);
    markersRef.current.dest = destMarker;

    const truckMarker = L.marker([truckLat, truckLng], { icon: truckIcon, zIndexOffset: 1000 }).addTo(map);
    truckMarker.bindPopup(`
      <div style="font-family: sans-serif; padding: 6px; min-width: 180px;">
        <strong style="color: #B45309; font-size: 14px;">🚛 Truck: ${truckNumber}</strong><br/>
        <div style="font-size: 12px; color: #334155; margin-top: 2px;">Driver: <b>${driverData?.name || 'Assigned Driver'}</b></div>
        <div style="margin-top: 4px; font-size: 11px; font-weight: bold; color: ${tripMetrics.isStopped ? '#DC2626' : '#16A34A'};">
          ${tripMetrics.isStopped ? '🛑 Stopped / Idle' : `🚚 Moving at ${tripMetrics.speed} km/h`}
        </div>
        <div style="font-size: 10px; color: #64748B; margin-top: 4px;">
          📍 ${locationData?.place_name || `${truckLat.toFixed(4)}, ${truckLng.toFixed(4)}`}
        </div>
      </div>
    `);
    markersRef.current.truck = truckMarker;

    // 6. Draw Connected Delivery Corridor Line
    const corridorLine = L.polyline(
      [
        [originCoords.lat, originCoords.lng],
        [truckLat, truckLng],
        [destCoords.lat, destCoords.lng]
      ],
      {
        color: isCustomerDestination ? '#9333EA' : '#2563EB',
        weight: 4,
        opacity: 0.85,
        dashArray: '6, 8'
      }
    ).addTo(map);
    polylinesRef.current.push(corridorLine);

    // 7. Draw Breadcrumb trail if history exists
    if (history && history.length > 1) {
      const historyPoints = history
        .filter((h) => typeof h.latitude === 'number' && typeof h.longitude === 'number')
        .map((h) => [h.latitude, h.longitude] as [number, number]);

      if (historyPoints.length > 0) {
        const historyPolyline = L.polyline(historyPoints, {
          color: '#F59E0B',
          weight: 3,
          opacity: 0.7
        }).addTo(map);
        polylinesRef.current.push(historyPolyline);
      }
    }

    // 8. Auto-fit bounds
    const bounds = L.latLngBounds([
      [originCoords.lat, originCoords.lng],
      [truckLat, truckLng],
      [destCoords.lat, destCoords.lng]
    ]);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });

  }, [locationData, originCoords, destCoords, truckNumber, isCustomerDestination, history]);

  // Toggle Map Tiles (Streets vs High-Res Satellite)
  const toggleMapLayer = () => {
    if (!leafletMapRef.current || !tileLayerRef.current) return;

    leafletMapRef.current.removeLayer(tileLayerRef.current);

    if (mapLayerType === 'streets') {
      const satLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 }
      );
      satLayer.addTo(leafletMapRef.current);
      tileLayerRef.current = satLayer;
      setMapLayerType('satellite');
    } else {
      const streetLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { maxZoom: 19, subdomains: 'abcd' }
      );
      streetLayer.addTo(leafletMapRef.current);
      tileLayerRef.current = streetLayer;
      setMapLayerType('streets');
    }
  };

  const centerOnTruck = () => {
    if (leafletMapRef.current && locationData?.latitude && locationData?.longitude) {
      leafletMapRef.current.flyTo([locationData.latitude, locationData.longitude], 16, { duration: 1 });
    }
  };

  const centerOnDestination = () => {
    if (leafletMapRef.current && destCoords.lat && destCoords.lng) {
      leafletMapRef.current.flyTo([destCoords.lat, destCoords.lng], 16, { duration: 1 });
    }
  };

  const [showTimelineDrawer, setShowTimelineDrawer] = useState<boolean>(false);

  const driverPhoneClean = driverData?.phone_number ? driverData.phone_number.replace(/\D/g, '') : '';
  const whatsappDriverUrl = driverPhoneClean
    ? `https://wa.me/234${driverPhoneClean.replace(/^0+/, '')}?text=Hello%20${encodeURIComponent(
        driverData?.name || 'Driver'
      )},%20fleet%20dispatch%20checking%20status%20on%20Truck%20${encodeURIComponent(truckNumber)}.`
    : null;

  const phoneCallUrl = driverPhoneClean ? `tel:+234${driverPhoneClean.replace(/^0+/, '')}` : null;

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl h-[92vh] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* COMPACT PURE IN-HOUSE HEADER */}
        <div className="bg-[#0A1F44] border-b border-slate-800/90 px-3.5 py-3 sm:px-5 sm:py-3.5 shrink-0">
          <div className="flex items-center justify-between gap-2">
            
            {/* Truck & Trip Identification */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
                <Truck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="bg-amber-400 text-slate-950 font-mono text-xs px-2 py-0.5 rounded-md font-black shadow-xs">
                    {truckNumber}
                  </span>
                  
                  {isCustomerDestination ? (
                    <span className="bg-purple-500/20 border border-purple-400/40 text-purple-200 text-[11px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <span>📦</span> Customer Delivery
                    </span>
                  ) : (
                    <span className="bg-blue-500/20 border border-blue-400/40 text-blue-200 text-[11px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <span>🏢</span> Company Depot
                    </span>
                  )}

                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1.5 ${
                    tripMetrics.isStopped 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${tripMetrics.isStopped ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`}></span>
                    {tripMetrics.isStopped ? '🛑 Parked / Idle' : `🟢 Moving (${tripMetrics.speed} km/h)`}
                  </span>
                </div>

                <p className="text-xs text-slate-300 truncate mt-0.5 font-medium flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">{originCoords.name}</span>
                  <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="text-white font-bold">{destCoords.name}</span>
                </p>
              </div>
            </div>

            {/* View Timeline Toggle & Close */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowTimelineDrawer(!showTimelineDrawer)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer border ${
                  showTimelineDrawer 
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
                title="View Trip Stops & Breadcrumb History"
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Stops & History</span>
                <span className="sm:hidden">Log</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* TELEMETRY BAR */}
        <div className="bg-slate-950 border-b border-slate-800 px-3.5 py-2 sm:px-5 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-3 text-slate-300">
            <div>
              Remaining: <strong className="text-white font-mono">{tripMetrics.distanceKm} km</strong>
            </div>
            <div className="text-slate-600">•</div>
            <div>
              Estimated Arrival: <strong className="text-amber-400 font-mono">~{tripMetrics.etaMinutes} mins</strong>
            </div>
            <div className="text-slate-600 hidden sm:inline">•</div>
            <div className="hidden sm:inline text-slate-400">
              Driver: <strong className="text-slate-200">{driverData?.name || 'Assigned Driver'}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchLiveLocation(true)}
              disabled={refreshing}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Syncing...' : `${autoRefreshCount}s`}</span>
            </button>

            <button
              type="button"
              onClick={() => setAutoTrack(!autoTrack)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                autoTrack ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              Auto: {autoTrack ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* MAIN MAP CANVAS */}
        <div className="flex-1 relative flex flex-col min-h-0 bg-slate-950">
          <div ref={mapContainerRef} className="w-full h-full min-h-[300px] z-0" />

          {/* Floating Map Controls */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={centerOnTruck}
              className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-lg transition-all cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Truck</span>
            </button>

            <button
              type="button"
              onClick={centerOnDestination}
              className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-extrabold text-xs px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-lg transition-all cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Destination</span>
            </button>

            <button
              type="button"
              onClick={toggleMapLayer}
              className="bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 font-extrabold text-xs px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-lg transition-all cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{mapLayerType === 'streets' ? 'Satellite' : 'Roads'}</span>
            </button>
          </div>

          {/* Side Drawer: Trip Stops & Audit History */}
          {showTimelineDrawer && (
            <div className="absolute top-3 right-3 bottom-18 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl z-30 flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-200">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" /> Trip Audit & Stops
                </span>
                <button
                  type="button"
                  onClick={() => setShowTimelineDrawer(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
                <div className="space-y-1">
                  <div className="text-[11px] text-slate-400 font-semibold">Current Motion State:</div>
                  <div className={`p-2.5 rounded-xl border ${
                    tripMetrics.isStopped ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  }`}>
                    <div className="font-bold flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${tripMetrics.isStopped ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`}></span>
                      {tripMetrics.isStopped ? 'Currently Parked / Idle' : `In Transit at ${tripMetrics.speed} km/h`}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {locationData?.place_name || 'Eme Court Road, Otolo Nnewi'}
                    </p>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="text-[11px] text-slate-400 font-semibold">Audit Milestones:</div>
                  <div className="space-y-2 relative pl-3 border-l border-slate-800">
                    <div className="relative">
                      <span className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-emerald-400"></span>
                      <div className="text-white font-bold text-[11px]">Departed Origin</div>
                      <div className="text-slate-400 text-[10px]">{originCoords.name}</div>
                    </div>

                    <div className="relative">
                      <span className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-amber-400"></span>
                      <div className="text-white font-bold text-[11px]">Latest Location Ping</div>
                      <div className="text-slate-400 text-[10px]">
                        {locationData?.updated_at ? new Date(locationData.updated_at).toLocaleTimeString() : 'Live Connected'}
                      </div>
                    </div>

                    <div className="relative">
                      <span className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-blue-400"></span>
                      <div className="text-white font-bold text-[11px]">Target Destination</div>
                      <div className="text-slate-400 text-[10px]">{destCoords.name}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Floating Delivery & Dispatch Card */}
          <div className="absolute bottom-3 left-3 right-3 sm:left-4 sm:right-4 z-20 pointer-events-none">
            <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-3.5 shadow-2xl pointer-events-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              
              {/* Destination & Location Details */}
              <div className="space-y-1 min-w-0 w-full sm:w-auto">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-bold text-white flex items-center gap-1">
                    <span className="text-base">{isCustomerDestination ? '📦' : '🏢'}</span> {destCoords.name}
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-amber-400 font-mono font-bold">
                    {tripMetrics.distanceKm} km away (~{tripMetrics.etaMinutes} mins)
                  </span>
                </div>

                <div className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-slate-300">
                    Live GPS Street: <strong className="text-white">{locationData?.place_name || `${locationData?.latitude?.toFixed(4)}, ${locationData?.longitude?.toFixed(4)}`}</strong>
                  </span>
                </div>
              </div>

              {/* Direct Driver Dispatch Contact Actions */}
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                {whatsappDriverUrl && (
                  <a
                    href={whatsappDriverUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs py-2 px-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-lg transition-all cursor-pointer"
                    title="Send WhatsApp Dispatch Message to Driver"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp Driver</span>
                  </a>
                )}

                {phoneCallUrl && (
                  <a
                    href={phoneCallUrl}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="Direct Phone Call"
                  >
                    <Phone className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">Call</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LiveTruckMapModal;
