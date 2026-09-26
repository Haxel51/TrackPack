import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TripRecord, SavedCustomer, SupplierLocation } from '../types';
import { getSavedCustomers, getSupplierLocations, redirectTrip, searchLocationGeocode } from '../api';
import { loadGoogleMaps } from '../utils/googleMapsLoader';
import mapsConfig from '../../../config/maps.config';
import {
  X,
  Navigation,
  MapPin,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  Bookmark,
  Sparkles,
  Crosshair,
  Fuel,
  Ship,
  Factory,
  Warehouse,
  Wheat,
  Bus,
  Radio,
  FileText,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';

interface RedirectTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: TripRecord | null;
  token: string;
  onTripRedirected: (message?: string) => void;
}

interface SuggestionItem {
  id: string;
  mainText: string;
  secondaryText: string;
  lat?: number;
  lng?: number;
}

const COMMON_REASONS = [
  'Consignee instructed alternative discharge hub',
  'Destination tank full / capacity diversion',
  'Port terminal congestion bypass',
  'Roadblock / highway accident diversion',
  'Waybill consignee amended by buyer',
  'Commercial re-allocation of cargo',
];

export const RedirectTripModal: React.FC<RedirectTripModalProps> = ({
  isOpen,
  onClose,
  trip,
  token,
  onTripRedirected,
}) => {
  const [option, setOption] = useState<'hub' | 'saved' | 'new'>('hub');

  // Option 1: Universal Hubs
  const [suppliers, setSuppliers] = useState<SupplierLocation[]>([]);
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);
  const [hubCategoryFilter, setHubCategoryFilter] = useState<string>('all');
  const [hubSearchQuery, setHubSearchQuery] = useState<string>('');
  const [isLoadingHubs, setIsLoadingHubs] = useState<boolean>(false);

  // Option 2: Saved Customers
  const [savedCustomers, setSavedCustomers] = useState<SavedCustomer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [isLoadingCustomers, setIsLoadingCustomers] = useState<boolean>(false);

  // Option 3: New Custom Destination
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [newCustomerAddress, setNewCustomerAddress] = useState<string>('');
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [customGeofenceRadius, setCustomGeofenceRadius] = useState<number>(200);
  const [saveAsNewCustomer, setSaveAsNewCustomer] = useState<boolean>(true);

  // Redirection Reason State
  const [redirectReason, setRedirectReason] = useState<string>('');

  // Google Maps Search & Autocomplete State for Option 3
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const googleMarkerRef = useRef<google.maps.Marker | null>(null);
  const geofenceCircleRef = useRef<google.maps.Circle | null>(null);
  const [showMap, setShowMap] = useState<boolean>(false);
  const selectedCoordsRef = useRef<{ lat: number; lng: number } | null>(selectedCoords);

  useEffect(() => {
    selectedCoordsRef.current = selectedCoords;
  }, [selectedCoords]);

  const [addressSearchQuery, setAddressSearchQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // Modal Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && trip) {
      setOption('hub');
      setSelectedHubId(null);
      setSelectedCustomerId(null);
      setHubCategoryFilter('all');
      setHubSearchQuery('');
      setCustomerSearchQuery('');
      setNewCustomerName('');
      setNewCustomerAddress('');
      setSelectedCoords(null);
      setCustomGeofenceRadius(200);
      setSaveAsNewCustomer(true);
      setShowMap(false);
      setRedirectReason('');
      setError(null);

      fetchHubs();
      fetchCustomers();
    }
  }, [isOpen, trip]);

  const fetchHubs = async () => {
    setIsLoadingHubs(true);
    const res = await getSupplierLocations(token);
    if (res.success) {
      setSuppliers(res.suppliers || []);
    }
    setIsLoadingHubs(false);
  };

  const fetchCustomers = async () => {
    setIsLoadingCustomers(true);
    const res = await getSavedCustomers(token);
    if (res.success) {
      setSavedCustomers(res.customers || []);
    }
    setIsLoadingCustomers(false);
  };

  // Initialize Map when user opens map view in Option 3
  const initGoogleMap = useCallback(async () => {
    if (!mapContainerRef.current) return;

    try {
      await loadGoogleMaps(mapsConfig.apiKey);

      if (!mapContainerRef.current) return;

      const currentCoords = selectedCoordsRef.current;
      const defaultLat = currentCoords?.lat || 6.5244;
      const defaultLng = currentCoords?.lng || 3.3792;

      mapContainerRef.current.innerHTML = '';

      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: defaultLat, lng: defaultLng },
        zoom: 14,
        gestureHandling: 'greedy',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
      });

      googleMapRef.current = map;

      const marker = new google.maps.Marker({
        position: { lat: defaultLat, lng: defaultLng },
        map: map,
        draggable: true,
        animation: google.maps.Animation.DROP,
        title: 'Redirect Destination',
      });

      googleMarkerRef.current = marker;

      const circle = new google.maps.Circle({
        strokeColor: '#F7941D',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: '#F7941D',
        fillOpacity: 0.15,
        map,
        center: { lat: defaultLat, lng: defaultLng },
        radius: customGeofenceRadius,
      });
      geofenceCircleRef.current = circle;

      marker.addListener('dragend', () => {
        const pos = marker.getPosition();
        if (pos) {
          const lat = pos.lat();
          const lng = pos.lng();
          setSelectedCoords({ lat, lng });
          circle.setCenter({ lat, lng });
        }
      });

      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          marker.setPosition({ lat, lng });
          circle.setCenter({ lat, lng });
          setSelectedCoords({ lat, lng });
        }
      });

      if (!currentCoords) {
        setSelectedCoords({ lat: defaultLat, lng: defaultLng });
      }
    } catch (err) {
      console.warn('Google Map Load Error in Redirect:', err);
    }
  }, [customGeofenceRadius]);

  useEffect(() => {
    if (showMap) {
      const timer = setTimeout(() => {
        initGoogleMap();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showMap, initGoogleMap]);

  // Update circle radius when slider changes
  useEffect(() => {
    if (geofenceCircleRef.current) {
      geofenceCircleRef.current.setRadius(customGeofenceRadius);
    }
  }, [customGeofenceRadius]);

  // Autocomplete address search
  const handleAddressSearch = async (queryText: string) => {
    setAddressSearchQuery(queryText);
    if (!queryText.trim()) {
      setSuggestions([]);
      setIsDropdownOpen(false);
      return;
    }

    setIsSearchingAddress(true);
    try {
      const res = await searchLocationGeocode(queryText);
      if (res.success && res.results && res.results.length > 0) {
        const mapped: SuggestionItem[] = res.results.map((r: any) => ({
          id: r.id || `${r.lat}-${r.lng}`,
          mainText: r.name || queryText,
          secondaryText: r.formatted_address || '',
          lat: r.lat,
          lng: r.lng,
        }));
        setSuggestions(mapped);
        setIsDropdownOpen(true);
      } else {
        setSuggestions([]);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleSelectSuggestion = (item: SuggestionItem) => {
    setNewCustomerAddress(item.secondaryText ? `${item.mainText}, ${item.secondaryText}` : item.mainText);
    setAddressSearchQuery(item.mainText);
    setIsDropdownOpen(false);

    if (item.lat && item.lng) {
      setSelectedCoords({ lat: item.lat, lng: item.lng });
      if (googleMapRef.current && googleMarkerRef.current) {
        googleMapRef.current.setCenter({ lat: item.lat, lng: item.lng });
        googleMarkerRef.current.setPosition({ lat: item.lat, lng: item.lng });
        if (geofenceCircleRef.current) {
          geofenceCircleRef.current.setCenter({ lat: item.lat, lng: item.lng });
        }
      }
    }
  };

  const handleRedirectSubmit = async () => {
    if (!trip) return;
    setError(null);

    const reasonToSave = redirectReason.trim() || 'Mid-transit route redirection';

    if (option === 'hub') {
      if (!selectedHubId) {
        setError('Please select a loading hub or terminal destination from the directory.');
        return;
      }
      const selectedHub = suppliers.find((s) => s.id === selectedHubId);
      if (!selectedHub) {
        setError('Selected hub not found.');
        return;
      }

      setIsSubmitting(true);
      const res = await redirectTrip(token, trip.id, {
        type: 'hub',
        supplier_id: selectedHub.id,
        name: selectedHub.name,
        address: selectedHub.address_text,
        lat: selectedHub.lat,
        lng: selectedHub.lng,
        geofence_radius: selectedHub.geofence_radius || 200,
        reason: reasonToSave,
      });

      if (res.success) {
        setIsSubmitting(false);
        onTripRedirected(res.message || `Trip rerouted to ${selectedHub.name} successfully`);
        onClose();
      } else {
        setError(res.error || 'Failed to redirect trip');
        setIsSubmitting(false);
      }
    } else if (option === 'saved') {
      if (!selectedCustomerId) {
        setError('Please choose a saved customer destination.');
        return;
      }
      const selectedSavedCustomer = savedCustomers.find((c) => c.id === selectedCustomerId);

      setIsSubmitting(true);
      const res = await redirectTrip(token, trip.id, {
        type: 'saved_customer',
        customer_id: selectedCustomerId,
        name: selectedSavedCustomer?.name || '',
        address: selectedSavedCustomer?.address_text || '',
        lat: selectedSavedCustomer?.lat,
        lng: selectedSavedCustomer?.lng,
        geofence_radius: selectedSavedCustomer?.geofence_radius || 200,
        reason: reasonToSave,
      });

      if (res.success) {
        setIsSubmitting(false);
        onTripRedirected(res.message || `Trip redirected to ${selectedSavedCustomer?.name} successfully`);
        onClose();
      } else {
        setError(res.error || 'Failed to redirect trip');
        setIsSubmitting(false);
      }
    } else {
      if (!newCustomerName.trim()) {
        setError('Destination or customer name is required.');
        return;
      }
      if (!newCustomerAddress.trim()) {
        setError('Delivery address is required.');
        return;
      }
      if (!selectedCoords) {
        setError('Please open the map and pin the destination to establish a geofence.');
        setShowMap(true);
        return;
      }

      setIsSubmitting(true);
      const res = await redirectTrip(token, trip.id, {
        type: 'manual',
        name: newCustomerName.trim(),
        address: newCustomerAddress.trim(),
        lat: selectedCoords.lat,
        lng: selectedCoords.lng,
        geofence_radius: customGeofenceRadius,
        reason: reasonToSave,
        save_as_new_customer: saveAsNewCustomer,
      });

      if (res.success) {
        setIsSubmitting(false);
        onTripRedirected(res.message || `Trip redirected to ${newCustomerName} successfully`);
        onClose();
      } else {
        setError(res.error || 'Failed to redirect trip');
        setIsSubmitting(false);
      }
    }
  };

  if (!isOpen || !trip) return null;

  // Filtered hubs
  const filteredHubs = suppliers.filter((s) => {
    if (hubCategoryFilter !== 'all' && s.category !== hubCategoryFilter) return false;
    if (hubSearchQuery.trim()) {
      const q = hubSearchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.address_text.toLowerCase().includes(q);
    }
    return true;
  });

  // Filtered customers
  const filteredCustomers = savedCustomers.filter((c) => {
    if (customerSearchQuery.trim()) {
      const q = customerSearchQuery.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.address_text.toLowerCase().includes(q);
    }
    return true;
  });

  const getCategoryIcon = (cat?: string) => {
    switch (cat) {
      case 'petroleum':
        return <Fuel className="w-4 h-4 text-amber-500" />;
      case 'port':
        return <Ship className="w-4 h-4 text-cyan-600" />;
      case 'factory':
        return <Factory className="w-4 h-4 text-orange-500" />;
      case 'warehouse':
        return <Warehouse className="w-4 h-4 text-indigo-500" />;
      case 'agriculture':
        return <Wheat className="w-4 h-4 text-emerald-600" />;
      case 'transit':
        return <Bus className="w-4 h-4 text-purple-500" />;
      default:
        return <Building2 className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div
      id="redirect-trip-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col my-8">
        
        {/* Header */}
        <div className="bg-[#0A1F44] px-6 py-5 border-b border-[#15346A] flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F7941D]/20 border border-[#F7941D]/40 flex items-center justify-center text-[#F7941D]">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black">Mid-Transit Trip Redirection</h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-[#F7941D] text-[#0A1F44] px-2 py-0.5 rounded-md">
                  Step 4 Live Action
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Asset: <span className="text-[#F7941D] font-mono font-bold">{trip.plate_number}</span> • Driver: <span className="font-bold text-white">{trip.driver_name}</span> • Waybill: <span className="font-mono text-slate-300">{trip.waybill_number || 'N/A'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            id="close-redirect-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Option Selection Tabs */}
        <div className="bg-slate-50 p-2.5 border-b border-slate-200 flex gap-1.5 overflow-x-auto text-xs font-extrabold">
          <button
            type="button"
            onClick={() => {
              setOption('hub');
              setError(null);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              option === 'hub'
                ? 'bg-[#0A1F44] text-[#F7941D] shadow-md shadow-[#0A1F44]/10'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
            id="option-tab-hub"
          >
            <Building2 className="w-4 h-4" />
            <span>1. Loading Hub Directory</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setOption('saved');
              setError(null);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              option === 'saved'
                ? 'bg-[#0A1F44] text-[#F7941D] shadow-md shadow-[#0A1F44]/10'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
            id="option-tab-saved"
          >
            <Bookmark className="w-4 h-4" />
            <span>2. Saved Destinations</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setOption('new');
              setError(null);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              option === 'new'
                ? 'bg-[#0A1F44] text-[#F7941D] shadow-md shadow-[#0A1F44]/10'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
            id="option-tab-new"
          >
            <MapPin className="w-4 h-4" />
            <span>3. Custom Map Pin</span>
          </button>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-800 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh] custom-scrollbar">

          {/* TAB 1: UNIVERSAL HUBS DIRECTORY */}
          {option === 'hub' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h4 className="text-sm font-black text-slate-900">Select Universal Loading Hub / Terminal</h4>
                  <p className="text-xs text-slate-500">Reroute to a verified depot, seaport, or industrial plant with preset geofences</p>
                </div>
                <span className="text-xs font-bold text-slate-500">{filteredHubs.length} verified hubs</span>
              </div>

              {/* Search & Category Pills */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={hubSearchQuery}
                    onChange={(e) => setHubSearchQuery(e.target.value)}
                    placeholder="Search hub name (e.g. Dangote, APMT, Nipco, Presco)..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#F7941D]"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-bold">
                  {[
                    { id: 'all', label: 'All Hubs' },
                    { id: 'petroleum', label: '⛽ Petroleum' },
                    { id: 'port', label: '🚢 Ports' },
                    { id: 'factory', label: '🏗️ Factory' },
                    { id: 'warehouse', label: '📦 FMCG' },
                    { id: 'agriculture', label: '🌾 Silos' },
                    { id: 'transit', label: '🚌 Transit' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setHubCategoryFilter(cat.id)}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                        hubCategoryFilter === cat.id
                          ? 'bg-[#0A1F44] text-[#F7941D]'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hubs Listing */}
              {isLoadingHubs ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#F7941D]" />
                  <span className="text-xs">Loading verified hubs...</span>
                </div>
              ) : filteredHubs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500">
                  No loading hubs found matching your search.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {filteredHubs.map((hub) => {
                    const isSelected = selectedHubId === hub.id;
                    return (
                      <div
                        key={hub.id}
                        onClick={() => setSelectedHubId(hub.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-[#0A1F44] text-white border-[#0A1F44] shadow-md shadow-[#0A1F44]/20'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-white/10 text-[#F7941D]' : 'bg-slate-100'
                          }`}>
                            {getCategoryIcon(hub.category)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs truncate">{hub.name}</span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                                isSelected ? 'bg-white/20 text-[#F7941D]' : 'bg-slate-100 text-slate-600'
                              }`}>
                                <Radio className="w-2.5 h-2.5 inline mr-0.5" />
                                {hub.geofence_radius || 200}m
                              </span>
                            </div>
                            <p className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                              {hub.address_text}
                            </p>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-[#F7941D] bg-[#F7941D] text-[#0A1F44]' : 'border-slate-300'
                        }`}>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SAVED CUSTOMERS */}
          {option === 'saved' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-900">Select Saved Customer Destination</h4>
                  <p className="text-xs text-slate-500">Pick from previously saved delivery consignees</p>
                </div>
                <span className="text-xs font-bold text-slate-500">{filteredCustomers.length} saved</span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  placeholder="Search saved customer name or address..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#F7941D]"
                />
              </div>

              {isLoadingCustomers ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#F7941D]" />
                  <span className="text-xs">Loading saved customers...</span>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500">
                  No saved customers found. Use Option 1 for Universal Hubs or Option 3 to pin a new address.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {filteredCustomers.map((cust) => {
                    const isSelected = selectedCustomerId === cust.id;
                    return (
                      <div
                        key={cust.id}
                        onClick={() => setSelectedCustomerId(cust.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-[#0A1F44] text-white border-[#0A1F44] shadow-md shadow-[#0A1F44]/20'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-white/10 text-[#F7941D]' : 'bg-slate-100 text-slate-700'
                          }`}>
                            <Bookmark className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-extrabold text-xs truncate block">{cust.name}</span>
                            <p className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                              {cust.address_text}
                            </p>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-[#F7941D] bg-[#F7941D] text-[#0A1F44]' : 'border-slate-300'
                        }`}>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CUSTOM MAP PIN */}
          {option === 'new' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-black text-slate-900">Custom Destination Pin</h4>
                <p className="text-xs text-slate-500">Specify custom consignee address and pin exact GPS coordinates</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Customer / Consignee Name</label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="e.g. TotalEnergies Ikeja Depot / Alaba Int'l Logistics"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#F7941D]"
                  />
                </div>

                <div className="relative">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Destination Delivery Address</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={addressSearchQuery || newCustomerAddress}
                      onChange={(e) => handleAddressSearch(e.target.value)}
                      placeholder="Search landmark, street, city..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#F7941D]"
                    />
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    {isSearchingAddress && <Loader2 className="w-4 h-4 animate-spin text-slate-400 absolute right-3 top-2.5" />}
                  </div>

                  {isDropdownOpen && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {suggestions.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => handleSelectSuggestion(s)}
                          className="p-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 text-xs"
                        >
                          <div className="font-bold text-slate-900">{s.mainText}</div>
                          {s.secondaryText && <div className="text-[11px] text-slate-500">{s.secondaryText}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Geofence Radius Slider */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-[#F7941D]" />
                      <span>Geofence Perimeter Radius:</span>
                    </span>
                    <span className="font-black text-[#0A1F44]">{customGeofenceRadius} meters</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="1000"
                    step="50"
                    value={customGeofenceRadius}
                    onChange={(e) => setCustomGeofenceRadius(Number(e.target.value))}
                    className="w-full accent-[#0A1F44] cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5 pt-1">
                    {[150, 200, 300, 500].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setCustomGeofenceRadius(r)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                          customGeofenceRadius === r
                            ? 'bg-[#0A1F44] text-[#F7941D]'
                            : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        {r}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Map Toggle & Container */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowMap(!showMap)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Crosshair className="w-3.5 h-3.5 text-slate-500" />
                    <span>{showMap ? 'Hide Map Pin' : 'Open Map to Fine-Tune Pin'}</span>
                  </button>

                  {showMap && (
                    <div className="mt-2 relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
                      <div ref={mapContainerRef} className="w-full h-56 bg-slate-100" />
                      {selectedCoords && (
                        <div className="absolute bottom-2 left-2 bg-[#0A1F44]/90 backdrop-blur-xs text-white px-2.5 py-1 rounded-lg text-[10px] font-mono">
                          Pin: {selectedCoords.lat.toFixed(5)}, {selectedCoords.lng.toFixed(5)} (±{customGeofenceRadius}m)
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="save_as_new_cust"
                    checked={saveAsNewCustomer}
                    onChange={(e) => setSaveAsNewCustomer(e.target.checked)}
                    className="rounded text-[#0A1F44] focus:ring-[#F7941D]"
                  />
                  <label htmlFor="save_as_new_cust" className="text-xs text-slate-600 font-medium cursor-pointer">
                    Save this destination for future trip dispatches
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* REQUIRED REDIRECTION REASON SECTION */}
          <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="text-xs font-black text-amber-900 uppercase tracking-wide">
                Mandatory Operational Audit Reason
              </span>
            </div>
            <p className="text-[11px] text-amber-800">
              State the reason for rerouting this active shipment. This will be endorsed onto the Waybill and visible on the Customer Live Tracking Portal.
            </p>

            <input
              type="text"
              value={redirectReason}
              onChange={(e) => setRedirectReason(e.target.value)}
              placeholder="e.g. Consignee requested discharge at Alternative Terminal..."
              className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-600"
            />

            {/* Quick Pills */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {COMMON_REASONS.slice(0, 4).map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRedirectReason(r)}
                  className="px-2 py-0.5 rounded-lg bg-white/80 hover:bg-white text-slate-700 text-[10px] font-bold border border-amber-200 cursor-pointer transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Operational Warning Notice */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2 text-slate-600 text-xs">
            <AlertTriangle className="w-4 h-4 text-[#F7941D] shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Confirming this redirection will dynamically compute a new Google Directions ETA & polyline, recalibrate the geofence perimeter, and update the customer's live tracking link in real time.
            </p>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleRedirectSubmit}
            disabled={
              isSubmitting ||
              (option === 'hub' && !selectedHubId) ||
              (option === 'saved' && !selectedCustomerId) ||
              (option === 'new' && (!newCustomerName || !selectedCoords))
            }
            className="bg-[#0A1F44] hover:bg-[#15346A] disabled:opacity-50 text-[#F7941D] font-black px-6 py-2.5 rounded-xl text-xs transition-all flex items-center gap-2 shadow-md cursor-pointer"
            id="confirm-redirect-btn"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#F7941D]" />
                <span>Redirecting Active Trip...</span>
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                <span>Confirm Mid-Transit Redirection</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
