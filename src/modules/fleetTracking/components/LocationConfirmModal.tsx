import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  MapPin,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Crosshair,
  Building2,
  RotateCw,
  Navigation,
  Factory,
} from 'lucide-react';
import { loadGoogleMaps } from '../utils/googleMapsLoader';
import { getGoogleMapsConfig, searchLocationGeocode } from '../api';

interface LocationConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  locationName?: string;
  locationType?: 'garage' | 'supplier' | 'company';
  addressText: string;
  initialLat?: number | null;
  initialLng?: number | null;
  onConfirm: (lat: number, lng: number) => Promise<void>;
}

interface SuggestionItem {
  id: string;
  mainText: string;
  secondaryText: string;
  lat?: number;
  lng?: number;
  rawSuggestion?: any;
}

// Generate prominent marker pin SVG: Blue for Garage, Green for Supplier
function getColoredMarkerSvg(isSupplier: boolean): string {
  // GARAGE: Royal Blue (#2563EB) fill, Dark Blue stroke (#1E3A8A), Inner Dot (#1D4ED8)
  // SUPPLIER: Emerald Green (#16A34A) fill, Dark Green stroke (#14532D), Inner Dot (#15803D)
  const pinFill = isSupplier ? '%2316A34A' : '%232563EB';
  const strokeColor = isSupplier ? '%2314532D' : '%231E3A8A';
  const innerDotColor = isSupplier ? '%2315803D' : '%231D4ED8';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="60" viewBox="0 0 48 60" fill="none">
    <path d="M24 2C13.507 2 5 10.507 5 21C5 35.8 24 57 24 57S43 35.8 43 21C43 10.507 34.493 2 24 2Z" fill="${pinFill}" stroke="${strokeColor}" stroke-width="2.5"/>
    <circle cx="24" cy="20" r="8.5" fill="white"/>
    <circle cx="24" cy="20" r="4.5" fill="${innerDotColor}"/>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${svg}`;
}

export const LocationConfirmModal: React.FC<LocationConfirmModalProps> = ({
  isOpen,
  onClose,
  title,
  locationName,
  locationType,
  addressText,
  initialLat,
  initialLng,
  onConfirm,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const googleMarkerRef = useRef<google.maps.Marker | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const debounceTimerRef = useRef<any>(null);

  const [apiKey, setApiKey] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const isSupplier =
    locationType === 'supplier' ||
    (title && title.toLowerCase().includes('supplier')) ||
    (locationName && locationName.toLowerCase().includes('supplier'));

  // Sync selected coordinates and clear previous errors
  const updateSelectedCoords = useCallback((lat: number, lng: number) => {
    setSelectedCoords({ lat, lng });
    setSaveError(null);
  }, []);

  // Update or open Google Maps InfoWindow on the active pin
  const updateInfoWindow = useCallback(
    (
      lat: number,
      lng: number,
      map: google.maps.Map,
      marker: google.maps.Marker,
      searchedPlaceName?: string,
      isDragged = false
    ) => {
      if (!infoWindowRef.current) {
        infoWindowRef.current = new google.maps.InfoWindow({
          maxWidth: 270,
        });
      }

      const badgeText = isSupplier ? 'SUPPLIER LOCATION' : 'COMPANY GARAGE';
      const badgeBg = isSupplier ? '#fff7ed' : '#f0fdf4';
      const badgeColor = isSupplier ? '#c2410c' : '#0A1F44';
      const badgeBorder = isSupplier ? '#ffedd5' : '#bbf7d0';
      const primaryTitle = locationName || (isSupplier ? 'Supplier Location' : 'Company Garage');

      const contentHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px; max-width: 250px;">
          <div style="display: inline-flex; items-center; gap: 4px; font-weight: 800; font-size: 10px; text-transform: uppercase; color: ${badgeColor}; background: ${badgeBg}; border: 1px solid ${badgeBorder}; padding: 3px 8px; border-radius: 9999px; margin-bottom: 6px;">
            <span>${badgeText}</span>
          </div>
          <div style="font-weight: 800; font-size: 13px; color: #0f172a; margin-bottom: 4px; line-height: 1.3;">
            ${primaryTitle}
          </div>
          ${
            searchedPlaceName
              ? `<div style="font-size: 11px; font-weight: 600; color: #334155; background: #f8fafc; border: 1px solid #e2e8f0; padding: 4px 8px; border-radius: 8px; margin-bottom: 6px; word-break: break-word;">📍 <b>Place:</b> ${searchedPlaceName}</div>`
              : ''
          }
          <div style="font-size: 10px; font-weight: 700; color: ${isDragged ? '#0284c7' : '#059669'}; background: ${isDragged ? '#f0f9ff' : '#ecfdf5'}; padding: 4px 8px; border-radius: 6px; border: 1px solid ${isDragged ? '#bae6fd' : '#a7f3d0'};">
            ${isDragged ? '📍 Pin adjusted to new position' : '✓ Location pinned. Tap or drag to adjust.'}
          </div>
        </div>
      `;

      infoWindowRef.current.setContent(contentHtml);
      infoWindowRef.current.open(map, marker);
    },
    [isSupplier, locationName]
  );

  // Update or create Google Maps Marker using guaranteed-visible vector circle symbol & explicit map reference
  const setGooglePinLocation = useCallback(
    (lat: number, lng: number, map: google.maps.Map, searchedPlaceName?: string) => {
      updateSelectedCoords(lat, lng);

      // Call setCenter and setZoom(17) BEFORE placing the marker
      map.setCenter({ lat, lng });
      map.setZoom(17);

      const markerColor = isSupplier ? '#00C853' : '#2962FF';
      const symbolIcon: google.maps.Symbol = {
        path: window.google?.maps?.SymbolPath?.CIRCLE ?? 0,
        scale: 12,
        fillColor: markerColor,
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      };

      if (googleMarkerRef.current) {
        googleMarkerRef.current.setPosition({ lat, lng });
        googleMarkerRef.current.setIcon(symbolIcon);
        googleMarkerRef.current.setMap(map);
        googleMarkerRef.current.setAnimation(null);
        setTimeout(() => {
          if (googleMarkerRef.current) {
            googleMarkerRef.current.setAnimation(window.google?.maps?.Animation?.DROP ?? null);
          }
        }, 50);
      } else {
        const marker = new window.google.maps.Marker({
          position: { lat, lng },
          map: map,
          animation: window.google?.maps?.Animation?.DROP ?? null,
          title: searchedPlaceName || locationName || 'Selected Location',
          draggable: true,
          icon: symbolIcon,
        });

        marker.addListener('dragend', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            const newLat = e.latLng.lat();
            const newLng = e.latLng.lng();
            updateSelectedCoords(newLat, newLng);
            updateInfoWindow(newLat, newLng, map, marker, undefined, true);
          }
        });

        googleMarkerRef.current = marker;
      }

      if (googleMarkerRef.current) {
        googleMarkerRef.current.setMap(map);
        updateInfoWindow(lat, lng, map, googleMarkerRef.current, searchedPlaceName);
      }
    },
    [isSupplier, locationName, updateSelectedCoords, updateInfoWindow]
  );

  // Pure Google Maps Initialization
  const initGoogleMap = useCallback(async () => {
    if (!mapContainerRef.current) return;

    setIsInitializing(true);
    setMapError(null);

    const hasInitialCoords =
      initialLat !== undefined &&
      initialLat !== null &&
      initialLng !== undefined &&
      initialLng !== null &&
      !isNaN(initialLat) &&
      !isNaN(initialLng);

    const startLng = hasInitialCoords ? initialLng! : 6.9746;
    const startLat = hasInitialCoords ? initialLat! : 4.8472;
    const startZoom = hasInitialCoords ? 17 : 14;

    try {
      // 1. Fetch API key from backend if not already stored
      let activeKey = apiKey;
      if (!activeKey) {
        const config = await getGoogleMapsConfig();
        if (config.success && config.apiKey) {
          activeKey = config.apiKey.trim();
          setApiKey(activeKey);
        }
      }

      if (!activeKey) {
        throw new Error(
          'Google Maps API Key not found. Please ensure GOOGLE_MAPS_API_KEY is configured.'
        );
      }

      // 2. Load Google Maps SDK
      const googleMaps = await loadGoogleMaps(activeKey);

      if (!mapContainerRef.current) return;
      mapContainerRef.current.innerHTML = '';

      // 3. Mount Google Map instance configured for full-screen mobile UX
      const map = new googleMaps.Map(mapContainerRef.current, {
        center: { lat: startLat, lng: startLng },
        zoom: startZoom,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        gestureHandling: 'greedy',
        mapTypeId: googleMaps.MapTypeId?.ROADMAP || 'roadmap',
      });

      googleMapRef.current = map;

      // Safely load and attach Places and Geocoding services
      let placesService: any = null;
      let autocompleteService: any = null;
      let geocoderInstance: any = null;

      if (window.google?.maps?.importLibrary) {
        try {
          const placesLib: any = await window.google.maps.importLibrary('places');
          if (placesLib?.PlacesService) {
            placesService = new placesLib.PlacesService(map);
          }
          if (placesLib?.AutocompleteService) {
            autocompleteService = new placesLib.AutocompleteService();
          }
        } catch (e) {
          console.warn('Places import notice:', e);
        }

        try {
          const geocodingLib: any = await window.google.maps.importLibrary('geocoding');
          if (geocodingLib?.Geocoder) {
            geocoderInstance = new geocodingLib.Geocoder();
          }
        } catch (e) {
          console.warn('Geocoding import notice:', e);
        }
      }

      if (!placesService && (googleMaps as any).places?.PlacesService) {
        placesService = new (googleMaps as any).places.PlacesService(map);
      }
      if (!autocompleteService && (googleMaps as any).places?.AutocompleteService) {
        autocompleteService = new (googleMaps as any).places.AutocompleteService();
      }
      if (!geocoderInstance && (googleMaps as any).Geocoder) {
        geocoderInstance = new (googleMaps as any).Geocoder();
      }

      placesServiceRef.current = placesService;
      autocompleteServiceRef.current = autocompleteService;
      geocoderRef.current = geocoderInstance;

      if (hasInitialCoords) {
        setGooglePinLocation(initialLat!, initialLng!, map);
      } else {
        setGooglePinLocation(startLat, startLng, map);
      }

      // Tap / click anywhere on Google Map to place pin
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          setGooglePinLocation(e.latLng.lat(), e.latLng.lng(), map, true);
        }
      });

      // Trigger initial address geocoding search if no initial coordinates
      if (!hasInitialCoords && (addressText.trim() || locationName?.trim())) {
        const query = locationName ? `${locationName}, ${addressText}` : addressText;
        executePlacesSearch(query, true);
      }
    } catch (err: any) {
      console.error('Google Maps initialization failed:', err);
      setMapError(
        err?.message ||
          'Failed to load Google Maps JavaScript API. Please check your internet connection or Google Maps API key.'
      );
    } finally {
      setIsInitializing(false);
    }
  }, [apiKey, initialLat, initialLng, locationName, addressText, setGooglePinLocation]);

  useEffect(() => {
    if (!isOpen) {
      googleMapRef.current = null;
      googleMarkerRef.current = null;
      placesServiceRef.current = null;
      autocompleteServiceRef.current = null;
      geocoderRef.current = null;
      setIsInitializing(false);
      setMapError(null);
      return;
    }

    const initialQuery = locationName ? `${locationName}, ${addressText}` : addressText;
    setSearchQuery(initialQuery);
    setSuggestions([]);
    setIsDropdownOpen(false);

    // Initialize Google Map
    const timer = setTimeout(() => {
      initGoogleMap();
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen, locationName, addressText, initGoogleMap]);

  // Google Places Autocomplete Search Handler
  const executePlacesSearch = async (query: string, autoSelectFirst = false) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setMapError(null);

    let autocompleteService = autocompleteServiceRef.current;
    if (!autocompleteService && (window.google?.maps?.places?.AutocompleteService as any)) {
      try {
        autocompleteService = new window.google.maps.places.AutocompleteService();
        autocompleteServiceRef.current = autocompleteService;
      } catch (e) {
        console.warn('Could not instantiate AutocompleteService:', e);
      }
    }

    // Strictly use Google Places Autocomplete
    if (autocompleteService) {
      try {
        const predictions = await new Promise<google.maps.places.AutocompletePrediction[] | null>(
          (resolve) => {
            autocompleteService!.getPlacePredictions(
              {
                input: query.trim(),
              },
              (results, status) => {
                const isOk = status === 'OK' || status === (window.google?.maps?.places?.PlacesServiceStatus?.OK ?? 'OK');
                if (isOk && results) {
                  resolve(results);
                } else {
                  resolve(null);
                }
              }
            );
          }
        );

        if (predictions && predictions.length > 0) {
          const formatted: SuggestionItem[] = predictions.map((p) => ({
            id: p.place_id,
            mainText: p.structured_formatting?.main_text || p.description,
            secondaryText: p.structured_formatting?.secondary_text || '',
            rawSuggestion: p,
          }));

          setSuggestions(formatted);
          if (autoSelectFirst && formatted.length > 0) {
            await handleSelectSuggestion(formatted[0]);
          } else {
            setIsDropdownOpen(true);
          }
          setIsSearching(false);
          return;
        }
      } catch (e) {
        console.warn('Google Places autocomplete search notice:', e);
      }
    }

    setMapError("We couldn't find the exact location of this place. Please tap the correct spot on the map manually.");
    setIsDropdownOpen(false);
    setIsSearching(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!val.trim() || val.length < 2) {
      setSuggestions([]);
      setIsDropdownOpen(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      executePlacesSearch(val, false);
    }, 350);
  };

  const handleSelectSuggestion = async (item: SuggestionItem) => {
    // Ensure we have a valid PlacesService instance
    let placesService = placesServiceRef.current;
    if (!placesService && googleMapRef.current && (window.google?.maps?.places?.PlacesService as any)) {
      try {
        placesService = new window.google.maps.places.PlacesService(googleMapRef.current);
        placesServiceRef.current = placesService;
      } catch (e) {
        console.warn('Could not instantiate PlacesService on fallback:', e);
      }
    }

    if (!item.id || !placesService) {
      setMapError("We couldn't find the exact location of this place. Please tap the correct spot on the map manually.");
      setIsDropdownOpen(false);
      return;
    }

    try {
      placesService.getDetails(
        {
          placeId: item.id,
          fields: ['name', 'geometry', 'formatted_address'],
        },
        (place, status) => {
          const OK_STATUS = window.google?.maps?.places?.PlacesServiceStatus?.OK || 'OK';
          if (status === OK_STATUS && place && place.geometry && place.geometry.location) {
            // Use ONLY place.geometry.location for the marker position
            const location = place.geometry.location;
            const lat = typeof location.lat === 'function' ? location.lat() : (location.lat as unknown as number);
            const lng = typeof location.lng === 'function' ? location.lng() : (location.lng as unknown as number);
            const nameText = place.name || place.formatted_address || item.mainText;

            console.log('Selected place:', nameText, 'lat:', lat, 'lng:', lng);

            setSearchQuery(place.formatted_address || nameText);
            setIsDropdownOpen(false);
            setMapError(null);

            updateSelectedCoords(lat, lng);

            if (googleMapRef.current) {
              const map = googleMapRef.current;

              // If Google Maps has a viewport for the place, use fitBounds; otherwise setCenter and setZoom(18)
              if (place.geometry.viewport) {
                map.fitBounds(place.geometry.viewport);
              } else {
                map.setCenter(location);
                map.setZoom(18);
              }

              // Place the marker exactly at place.geometry.location
              setGooglePinLocation(lat, lng, map, nameText);
            }
          } else {
            console.warn('PlacesService getDetails returned status:', status, place);
            setMapError("We couldn't find the exact location of this place. Please tap the correct spot on the map manually.");
            setIsDropdownOpen(false);
          }
        }
      );
    } catch (err) {
      console.warn('Error fetching Google Place details:', err);
      setMapError("We couldn't find the exact location of this place. Please tap the correct spot on the map manually.");
      setIsDropdownOpen(false);
    }
  };

  const applyCoordinatesByQuery = async (_text: string) => {
    setMapError("We couldn't find the exact location of this place. Please tap the correct spot on the map manually.");
    setIsDropdownOpen(false);
    return;
  };


  const applyCoordinatesToMap = (lat: number, lng: number, searchedName?: string) => {
    updateSelectedCoords(lat, lng);

    if (googleMapRef.current) {
      googleMapRef.current.setCenter({ lat, lng });
      googleMapRef.current.setZoom(17);
      setGooglePinLocation(lat, lng, googleMapRef.current, searchedName);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (suggestions.length > 0) {
        handleSelectSuggestion(suggestions[0]);
      } else {
        executePlacesSearch(searchQuery.trim(), true);
      }
    }
  };

  // Device Geolocation centering
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMapError('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        applyCoordinatesToMap(latitude, longitude);
      },
      (err) => {
        setMapError(`Location access denied or unavailable: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Confirm Location & Save
  const handleConfirmLocation = async () => {
    if (!selectedCoords) {
      setSaveError('Please place or adjust the pin on Google Map before confirming.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await onConfirm(selectedCoords.lat, selectedCoords.lng);
      onClose();
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save confirmed location. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="location-confirm-modal-overlay"
      className="fixed inset-0 z-50 w-full h-[100dvh] bg-slate-950 flex flex-col overflow-hidden animate-fadeIn select-none"
    >
      {/* 1. Full-Screen Edge-to-Edge Google Map Surface */}
      <div id="google-maps-full-surface" className="absolute inset-0 w-full h-full bg-slate-100 z-0">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* 2. Floating Top Header & Search Box (Google Maps App Style) */}
      <div className="absolute top-2 sm:top-4 inset-x-2 sm:inset-x-4 z-30 max-w-2xl mx-auto flex flex-col gap-2 pointer-events-none">
        {/* Main Floating Search & Navigation Bar */}
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-xl border border-slate-200/80 p-1.5 sm:p-2 flex items-center gap-2 transition-all">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close Map"
            className="w-10 h-10 rounded-xl sm:rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <form onSubmit={handleSearchSubmit} className="flex-grow flex items-center gap-1.5 min-w-0">
            <div className="relative flex-grow min-w-0">
              <input
                type="text"
                value={searchQuery}
                onChange={handleInputChange}
                onFocus={() => {
                  if (suggestions.length > 0) setIsDropdownOpen(true);
                }}
                placeholder="Search place, landmark, or address..."
                className="w-full bg-transparent pl-2 pr-8 py-2 text-xs sm:text-sm font-semibold outline-hidden text-slate-900 placeholder:text-slate-400 truncate"
              />
              {searchQuery && !isSearching && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSuggestions([]);
                    setIsDropdownOpen(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {isSearching && (
                <Loader2 className="w-4 h-4 text-[#F2A93B] animate-spin absolute right-2 top-1/2 -translate-y-1/2" />
              )}
            </div>

            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              aria-label="Search"
              className="bg-[#0A1F44] hover:bg-blue-900 disabled:opacity-50 text-white font-bold p-2.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-xs"
            >
              <Search className="w-4 h-4 text-[#F2A93B]" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </form>
        </div>

        {/* Floating Context Pills */}
        <div className="pointer-events-auto flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5 max-w-[95%] min-w-0">
            <div className="bg-slate-900/85 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold flex items-center gap-2 shadow-lg truncate">
              <MapPin className="w-3.5 h-3.5 text-[#F2A93B] shrink-0" />
              <span className="truncate">{locationName || title}</span>
            </div>
          </div>
        </div>

        {/* Search Suggestions Dropdown */}
        {isDropdownOpen && suggestions.length > 0 && (
          <div className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto animate-fadeIn mt-1">
            {suggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                className="w-full text-left p-3 hover:bg-amber-50/70 transition-colors flex items-start gap-2.5 text-xs cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-amber-100 flex items-center justify-center shrink-0 mt-0.5 text-slate-600 group-hover:text-[#F2A93B]">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex-grow min-w-0">
                  <div className="font-bold text-slate-900 group-hover:text-[#0A1F44] truncate">
                    {item.mainText}
                  </div>
                  {item.secondaryText && (
                    <div className="text-[11px] text-slate-500 font-medium line-clamp-1">
                      {item.secondaryText}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Floating Quick Action Controls (Right-Hand Side GPS & Recentering) */}
      <div className="absolute right-3 sm:right-6 bottom-36 sm:bottom-40 z-30 flex flex-col gap-2.5 pointer-events-none">
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          title="Center Google Map on my device location"
          className="pointer-events-auto w-12 h-12 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-slate-200 hover:bg-white text-slate-700 hover:text-[#0A1F44] flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Navigation className="w-5 h-5 text-[#F2A93B]" />
        </button>

        {selectedCoords && googleMapRef.current && (
          <button
            type="button"
            onClick={() => {
              if (selectedCoords && googleMapRef.current) {
                googleMapRef.current.panTo(selectedCoords);
                googleMapRef.current.setZoom(17);
              }
            }}
            title="Recenter on current Pin"
            className="pointer-events-auto w-12 h-12 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-slate-200 hover:bg-white text-slate-700 hover:text-[#0A1F44] flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Crosshair className="w-5 h-5 text-emerald-600" />
          </button>
        )}
      </div>

      {/* 4. Floating Bottom Action Card (Thumb-Friendly Confirmation Bar) */}
      <div className="absolute bottom-2 sm:bottom-4 inset-x-2 sm:inset-x-4 z-30 max-w-xl mx-auto pointer-events-none">
        <div className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-200/90 p-4 sm:p-5 flex flex-col gap-3 transition-all">
          {/* Inline Save Error Banner */}
          {saveError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold p-3 rounded-2xl flex items-center justify-between gap-2 animate-fadeIn">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="truncate">{saveError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSaveError(null)}
                className="text-rose-500 hover:text-rose-700 font-bold p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Guidance Status */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="truncate">
                <span className="font-bold text-slate-900 block truncate">
                  Location pinned on map
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  Tap or drag pin to adjust exact location
                </span>
              </div>
            </div>

            <div className="text-[10px] font-bold text-slate-400 shrink-0 uppercase tracking-wider">
              Google Maps
            </div>
          </div>

          {/* Big Thumb-Friendly Confirm Action Button */}
          <button
            type="button"
            id="btn-confirm-location"
            onClick={handleConfirmLocation}
            disabled={isSaving || !selectedCoords}
            className="w-full py-3.5 sm:py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white text-sm sm:text-base font-black flex items-center justify-center gap-2.5 shadow-lg hover:shadow-xl transition-all cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Saving Location...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Confirm this location</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 5. Loading State Overlay */}
      {isInitializing && !mapError && (
        <div className="absolute inset-0 z-40 bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center gap-3">
          <div className="bg-white rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-3 max-w-xs border border-slate-100">
            <Loader2 className="w-10 h-10 animate-spin text-[#F2A93B]" />
            <div className="space-y-1">
              <span className="text-sm font-black text-[#0A1F44] block">Loading Google Maps</span>
              <span className="text-xs text-slate-500">Preparing high-precision map view...</span>
            </div>
          </div>
        </div>
      )}

      {/* 6. Error Overlay */}
      {mapError && (
        <div className="absolute inset-0 z-40 bg-slate-950/70 backdrop-blur-xs p-4 flex items-center justify-center animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-rose-100 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-black text-rose-900">Google Maps Notice</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{mapError}</p>
            </div>
            <div className="flex flex-wrap gap-2 w-full pt-1">
              <button
                type="button"
                onClick={initGoogleMap}
                className="w-full bg-[#0A1F44] hover:bg-blue-900 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
                <span>Retry Map</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

