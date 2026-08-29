import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TripRecord, SavedCustomer } from '../types';
import { getSavedCustomers, redirectTrip, searchLocationGeocode, getGoogleMapsConfig } from '../api';
import { loadGoogleMaps } from '../utils/googleMapsLoader';
import {
  X,
  Navigation,
  UserCheck,
  MapPin,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  Plus,
  Bookmark,
  Sparkles,
  Crosshair,
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

export const RedirectTripModal: React.FC<RedirectTripModalProps> = ({
  isOpen,
  onClose,
  trip,
  token,
  onTripRedirected,
}) => {
  const [option, setOption] = useState<'saved' | 'new'>('saved');

  // Option A State: Saved Customers
  const [savedCustomers, setSavedCustomers] = useState<SavedCustomer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [isLoadingCustomers, setIsLoadingCustomers] = useState<boolean>(false);

  // Option B State: New Customer Destination
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [newCustomerAddress, setNewCustomerAddress] = useState<string>('');
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [saveAsNewCustomer, setSaveAsNewCustomer] = useState<boolean>(true);

  // Google Maps Search & Autocomplete State for Option B
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const googleMarkerRef = useRef<google.maps.Marker | null>(null);
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
      setOption('saved');
      setSelectedCustomerId(null);
      setCustomerSearchQuery('');
      setNewCustomerName('');
      setNewCustomerAddress('');
      setSelectedCoords(null);
      setSaveAsNewCustomer(true);
      setShowMap(false);
      setError(null);

      fetchCustomers();
    }
  }, [isOpen, trip]);

  const fetchCustomers = async () => {
    setIsLoadingCustomers(true);
    const res = await getSavedCustomers(token);
    if (res.success) {
      setSavedCustomers(res.customers || []);
    } else {
      setError(res.error || 'Failed to load saved customers');
    }
    setIsLoadingCustomers(false);
  };

  // Initialize Map when user opens map view in Option B
  const initGoogleMap = useCallback(async () => {
    if (!mapContainerRef.current) return;

    try {
      const configRes = await getGoogleMapsConfig();
      const apiKey = configRes.apiKey || '';
      await loadGoogleMaps(apiKey);

      // Re-verify that mapContainerRef is still mounted after async operations
      if (!mapContainerRef.current) return;

      const currentCoords = selectedCoordsRef.current;
      const defaultLat = currentCoords?.lat || 6.5244; // Default Lagos
      const defaultLng = currentCoords?.lng || 3.3792;

      mapContainerRef.current.innerHTML = '';

      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: defaultLat, lng: defaultLng },
        zoom: 14,
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
        title: 'Customer Destination',
      });

      googleMarkerRef.current = marker;

      marker.addListener('dragend', () => {
        const pos = marker.getPosition();
        if (pos) {
          setSelectedCoords({ lat: pos.lat(), lng: pos.lng() });
        }
      });

      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          marker.setPosition({ lat, lng });
          setSelectedCoords({ lat, lng });
        }
      });

      if (!currentCoords) {
        setSelectedCoords({ lat: defaultLat, lng: defaultLng });
      }
    } catch (err: any) {
      console.error('Error initializing map for redirect:', err);
    }
  }, []);

  useEffect(() => {
    let timer: any = null;
    if (showMap && option === 'new') {
      timer = setTimeout(() => {
        if (mapContainerRef.current) {
          initGoogleMap();
        }
      }, 200);
    } else {
      googleMapRef.current = null;
      googleMarkerRef.current = null;
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showMap, option, initGoogleMap]);

  // Handle Address Search for Option B
  const handleAddressSearch = async (queryText: string) => {
    setAddressSearchQuery(queryText);
    if (!queryText.trim() || queryText.trim().length < 2) {
      setSuggestions([]);
      setIsDropdownOpen(false);
      return;
    }

    setIsSearchingAddress(true);
    setIsDropdownOpen(true);

    const res = await searchLocationGeocode(queryText);
    if (res.success && res.results && res.results.length > 0) {
      setSuggestions(
        res.results.map((r) => ({
          id: r.id,
          mainText: r.name,
          secondaryText: 'Geocoded Address',
          lat: r.lat,
          lng: r.lng,
        }))
      );
    } else {
      setSuggestions([]);
    }
    setIsSearchingAddress(false);
  };

  const handleSelectAddressSuggestion = (item: SuggestionItem) => {
    setNewCustomerAddress(item.mainText);
    setAddressSearchQuery(item.mainText);
    setIsDropdownOpen(false);

    if (item.lat && item.lng) {
      setSelectedCoords({ lat: item.lat, lng: item.lng });
      if (googleMapRef.current && googleMarkerRef.current) {
        const pos = { lat: item.lat, lng: item.lng };
        googleMapRef.current.setCenter(pos);
        googleMapRef.current.setZoom(16);
        googleMarkerRef.current.setPosition(pos);
      }
    }
  };

  if (!isOpen || !trip) return null;

  // Filtered saved customers
  const filteredCustomers = savedCustomers.filter((c) =>
    c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
    c.address_text.toLowerCase().includes(customerSearchQuery.toLowerCase())
  );

  const selectedSavedCustomer = savedCustomers.find((c) => c.id === selectedCustomerId);

  // Submit Redirect
  const handleConfirmRedirect = async () => {
    setError(null);

    if (option === 'saved') {
      if (!selectedCustomerId) {
        setError('Please select a saved customer destination.');
        return;
      }
      setIsSubmitting(true);
      const res = await redirectTrip(token, trip.id, {
        type: 'saved_customer',
        customer_id: selectedCustomerId,
        name: selectedSavedCustomer?.name || '',
        address: selectedSavedCustomer?.address_text || '',
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
        setError('Customer name is required.');
        return;
      }
      if (!newCustomerAddress.trim()) {
        setError('Customer address is required.');
        return;
      }

      setIsSubmitting(true);
      const res = await redirectTrip(token, trip.id, {
        type: 'manual',
        name: newCustomerName.trim(),
        address: newCustomerAddress.trim(),
        lat: selectedCoords?.lat || null,
        lng: selectedCoords?.lng || null,
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

  return (
    <div
      id="redirect-trip-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn overflow-y-auto"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col my-8">
        
        {/* Header */}
        <div className="bg-slate-950 px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Redirect Active Trip</h3>
              <p className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                Truck: {trip.plate_number} • Driver: {trip.driver_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/80 transition-colors cursor-pointer"
            id="close-redirect-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Option Toggle Tabs */}
        <div className="bg-slate-950/60 p-3 border-b border-slate-800 flex gap-2">
          
          <button
            type="button"
            onClick={() => {
              setOption('saved');
              setError(null);
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              option === 'saved'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
            id="option-tab-saved-customer"
          >
            <Bookmark className="w-4 h-4" />
            <span>Option A: Saved Customer</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setOption('new');
              setError(null);
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              option === 'new'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
            id="option-tab-new-destination"
          >
            <Plus className="w-4 h-4" />
            <span>Option B: New Destination</span>
          </button>

        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-rose-300 text-xs font-medium">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          
          {/* OPTION A: SAVED CUSTOMERS */}
          {option === 'saved' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-white">Select Previously Saved Customer</label>
                <span className="text-[11px] text-slate-400">{savedCustomers.length} saved</span>
              </div>

              {/* Customer Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  placeholder="Search saved customer name or address..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              {isLoadingCustomers ? (
                <div className="py-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                  <p className="text-xs font-bold">Loading saved customer list...</p>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-6 text-center bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-2">
                  <UserCheck className="w-6 h-6 text-slate-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-400">
                    {savedCustomers.length === 0
                      ? 'No saved customer destinations yet.'
                      : 'No customer matches your search query.'}
                  </p>
                  {savedCustomers.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setOption('new')}
                      className="text-amber-400 hover:underline text-xs font-bold mt-1 inline-block"
                    >
                      + Create a new destination in Option B
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {filteredCustomers.map((cust) => {
                    const isSelected = selectedCustomerId === cust.id;

                    return (
                      <div
                        key={cust.id}
                        onClick={() => {
                          setSelectedCustomerId(cust.id);
                          setError(null);
                        }}
                        className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/10'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                        id={`saved-customer-card-${cust.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                          }`}>
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-extrabold text-xs text-white">{cust.name}</div>
                            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="line-clamp-1">{cust.address_text}</span>
                            </p>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-amber-500 bg-amber-500 text-slate-950' : 'border-slate-700'
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

          {/* OPTION B: NEW DESTINATION */}
          {option === 'new' && (
            <div className="space-y-4">
              
              {/* Customer Name */}
              <div>
                <label className="block text-xs font-extrabold text-slate-300 mb-1.5">
                  Customer Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newCustomerName}
                  onChange={(e) => {
                    setNewCustomerName(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g., Dangote Cement Depot, Ikeja"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                  id="new-customer-name-input"
                />
              </div>

              {/* Customer Address with Google Maps Autocomplete */}
              <div className="relative">
                <label className="block text-xs font-extrabold text-slate-300 mb-1.5">
                  Customer Delivery Address <span className="text-rose-400">*</span>
                </label>
                
                <div className="relative">
                  <input
                    type="text"
                    value={addressSearchQuery || newCustomerAddress}
                    onChange={(e) => {
                      setNewCustomerAddress(e.target.value);
                      handleAddressSearch(e.target.value);
                      setError(null);
                    }}
                    placeholder="Type street address, landmark or town..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                    id="new-customer-address-input"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  {isSearchingAddress && (
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin absolute right-3.5 top-3" />
                  )}
                </div>

                {/* Dropdown Suggestions */}
                {isDropdownOpen && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl z-20 overflow-hidden max-h-48 overflow-y-auto">
                    {suggestions.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectAddressSuggestion(item)}
                        className="p-3 hover:bg-slate-800/80 cursor-pointer text-xs text-slate-200 border-b border-slate-800/60 last:border-0 flex items-center gap-2.5"
                      >
                        <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <div className="font-bold text-white">{item.mainText}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Toggle Map View for Pinning */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowMap(!showMap)}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <Crosshair className="w-4 h-4" />
                  <span>{showMap ? 'Hide Map Location Picker' : 'Pin exact location on Google Map'}</span>
                </button>

                {showMap && (
                  <div className="mt-3 rounded-2xl border border-slate-800 overflow-hidden bg-slate-950 space-y-2 p-2">
                    <div ref={mapContainerRef} className="w-full h-52 rounded-xl bg-slate-900" />
                    <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
                      <MapPin className="w-3 h-3 text-amber-400" />
                      <span>Drag pin or click map to set exact GPS coordinates</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Checkbox: Save customer for future redirects */}
              <div className="pt-3 border-t border-slate-800/80">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-slate-300">
                  <input
                    type="checkbox"
                    checked={saveAsNewCustomer}
                    onChange={(e) => setSaveAsNewCustomer(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-950 cursor-pointer"
                  />
                  <span>Save customer destination for future redirects</span>
                </label>
              </div>

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmRedirect}
            disabled={isSubmitting || (option === 'saved' && !selectedCustomerId)}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
            id="confirm-redirect-btn"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Redirecting Trip...</span>
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4 stroke-[3]" />
                <span>Confirm Trip Redirect</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
