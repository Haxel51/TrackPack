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
  Navigation,
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
  const [saveError, setSaveError] = useState<string | null>(null);

  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Friendly non-technical search status states
  const [searchNotFound, setSearchNotFound] = useState<boolean>(false);
  const [closestMatchNotice, setClosestMatchNotice] = useState<string | null>(null);

  const isSupplier =
    locationType === 'supplier' ||
    (title && title.toLowerCase().includes('supplier')) ||
    (locationName && locationName.toLowerCase().includes('supplier'));

  // Sync selected coordinates and clear previous notices/errors
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
          <div style="display: inline-flex; align-items: center; gap: 4px; font-weight: 800; font-size: 10px; text-transform: uppercase; color: ${badgeColor}; background: ${badgeBg}; border: 1px solid ${badgeBorder}; padding: 3px 8px; border-radius: 9999px; margin-bottom: 6px;">
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

  // Update or create Google Maps Marker using guaranteed-visible vector circle symbol
  const setGooglePinLocation = useCallback(
    (lat: number, lng: number, map: google.maps.Map, searchedPlaceName?: string) => {
      updateSelectedCoords(lat, lng);

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
            setSearchNotFound(false);
            setClosestMatchNotice(null);
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
        setIsInitializing(false);
        return;
      }

      // 2. Load Google Maps SDK
      const googleMaps = await loadGoogleMaps(activeKey);

      if (!mapContainerRef.current) return;
      mapContainerRef.current.innerHTML = '';

      // 3. Mount Google Map instance
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
          const newLat = e.latLng.lat();
          const newLng = e.latLng.lng();
          setSearchNotFound(false);
          setClosestMatchNotice(null);
          setSaveError(null);
          setGooglePinLocation(newLat, newLng, map);
        }
      });

      // Trigger initial address geocoding search if no initial coordinates
      if (!hasInitialCoords && (addressText.trim() || locationName?.trim())) {
        const query = locationName ? `${locationName}, ${addressText}` : addressText;
        executePlacesSearch(query, true);
      }
    } catch (err: any) {
      console.warn('Google Maps initialization notice:', err);
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
      setSearchNotFound(false);
      setClosestMatchNotice(null);
      setSaveError(null);
      return;
    }

    const initialQuery = locationName ? `${locationName}, ${addressText}` : addressText;
    setSearchQuery(initialQuery);
    setSuggestions([]);
    setIsDropdownOpen(false);
    setSearchNotFound(false);
    setClosestMatchNotice(null);

    // Initialize Google Map
    const timer = setTimeout(() => {
      initGoogleMap();
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen, locationName, addressText, initGoogleMap]);

  // Google Places & Geocoding Search Handler with resilient fallback & partial matching
  const executePlacesSearch = async (query: string, autoSelectFirst = false) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchNotFound(false);
    setClosestMatchNotice(null);

    // 1. Try Google Places Autocomplete first
    let autocompleteService = autocompleteServiceRef.current;
    if (!autocompleteService && (window.google?.maps?.places?.AutocompleteService as any)) {
      try {
        autocompleteService = new window.google.maps.places.AutocompleteService();
        autocompleteServiceRef.current = autocompleteService;
      } catch (e) {
        console.warn('Could not instantiate AutocompleteService:', e);
      }
    }

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

    // 2. If autocomplete has no predictions, try Geocoder for closest/partial match
    let geocoderInstance = geocoderRef.current;
    if (!geocoderInstance && (window.google?.maps?.Geocoder as any)) {
      try {
        geocoderInstance = new window.google.maps.Geocoder();
        geocoderRef.current = geocoderInstance;
      } catch (e) {
        console.warn('Could not instantiate Geocoder:', e);
      }
    }

    if (geocoderInstance) {
      try {
        const geocodeResults = await new Promise<google.maps.GeocoderResult[] | null>((resolve) => {
          geocoderInstance!.geocode({ address: query.trim() }, (results, status) => {
            if (status === 'OK' && results && results.length > 0) {
              resolve(results);
            } else {
              resolve(null);
            }
          });
        });

        if (geocodeResults && geocodeResults.length > 0) {
          const best = geocodeResults[0];
          const loc = best.geometry.location;
          const lat = typeof loc.lat === 'function' ? loc.lat() : (loc.lat as unknown as number);
          const lng = typeof loc.lng === 'function' ? loc.lng() : (loc.lng as unknown as number);
          const formattedAddress = best.formatted_address || query;

          setIsDropdownOpen(false);
          setSearchNotFound(false);

          if (googleMapRef.current) {
            const map = googleMapRef.current;
            if (best.geometry.viewport) {
              map.fitBounds(best.geometry.viewport);
            } else {
              map.setCenter({ lat, lng });
              map.setZoom(17);
            }
            setGooglePinLocation(lat, lng, map, formattedAddress);
          } else {
            updateSelectedCoords(lat, lng);
          }

          // Let them know this is the closest match found so they can adjust if needed
          setClosestMatchNotice(
            "Showing the closest match found for this place. If this isn't exact, tap or drag the pin on the map to set your exact spot."
          );
          setIsSearching(false);
          return;
        }
      } catch (e) {
        console.warn('Geocoding notice:', e);
      }
    }

    // 3. Fallback: Server-side geocoding
    try {
      const serverRes = await searchLocationGeocode(query.trim());
      if (serverRes.success && serverRes.results && serverRes.results.length > 0) {
        const first = serverRes.results[0];
        setIsDropdownOpen(false);
        setSearchNotFound(false);

        if (googleMapRef.current) {
          const map = googleMapRef.current;
          map.setCenter({ lat: first.lat, lng: first.lng });
          map.setZoom(17);
          setGooglePinLocation(first.lat, first.lng, map, first.name);
        } else {
          updateSelectedCoords(first.lat, first.lng);
        }

        setClosestMatchNotice(
          "Showing the closest match found for this place. If this isn't exact, tap or drag the pin on the map to set your exact spot."
        );
        setIsSearching(false);
        return;
      }
    } catch (e) {
      console.warn('Server geocode notice:', e);
    }

    // 4. If no results at all: show friendly message directly below the search box
    // The map stays completely visible and interactive
    setIsDropdownOpen(false);
    setClosestMatchNotice(null);
    setSearchNotFound(true);
    setIsSearching(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setSearchNotFound(false);
    setClosestMatchNotice(null);

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
      setIsDropdownOpen(false);
      setSearchNotFound(true);
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
            const location = place.geometry.location;
            const lat = typeof location.lat === 'function' ? location.lat() : (location.lat as unknown as number);
            const lng = typeof location.lng === 'function' ? location.lng() : (location.lng as unknown as number);
            const nameText = place.name || place.formatted_address || item.mainText;

            setSearchQuery(place.formatted_address || nameText);
            setIsDropdownOpen(false);
            setSearchNotFound(false);
            setClosestMatchNotice(null);

            updateSelectedCoords(lat, lng);

            if (googleMapRef.current) {
              const map = googleMapRef.current;
              if (place.geometry.viewport) {
                map.fitBounds(place.geometry.viewport);
              } else {
                map.setCenter(location);
                map.setZoom(18);
              }
              setGooglePinLocation(lat, lng, map, nameText);
            }
          } else {
            setIsDropdownOpen(false);
            setSearchNotFound(true);
          }
        }
      );
    } catch (err) {
      console.warn('Error fetching Google Place details:', err);
      setIsDropdownOpen(false);
      setSearchNotFound(true);
    }
  };

  const applyCoordinatesToMap = (lat: number, lng: number, searchedName?: string) => {
    updateSelectedCoords(lat, lng);
    setSearchNotFound(false);
    setClosestMatchNotice(null);

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
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        applyCoordinatesToMap(latitude, longitude);
      },
      (err) => {
        console.warn('Device location notice:', err);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Confirm Location & Save
  const handleConfirmLocation = async () => {
    if (!selectedCoords) {
      setSaveError('Please place or adjust the pin on the map before confirming.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await onConfirm(selectedCoords.lat, selectedCoords.lng);
      onClose();
    } catch (err: any) {
      setSaveError(err?.message || 'Unable to save this location. Please try again.');
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
      {/* 1. Full-Screen Edge-to-Edge Google Map Surface - Always visible and interactive */}
      <div id="google-maps-full-surface" className="absolute inset-0 w-full h-full bg-slate-100 z-0">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* 2. Floating Top Header & Search Box */}
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
                    setSearchNotFound(false);
                    setClosestMatchNotice(null);
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

        {/* 1. Friendly "No Results" Message directly below search box */}
        {searchNotFound && (
          <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-amber-200/90 rounded-2xl p-3 shadow-xl flex items-start gap-2.5 text-xs text-slate-700 animate-fadeIn">
            <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5 text-amber-700 font-bold">
              📍
            </div>
            <div className="flex-1 leading-relaxed">
              <p className="font-bold text-slate-900">
                We couldn't find that place. Try adding more details, like the city name (e.g. 'BUA Factory, Port Harcourt')
              </p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                You can also tap directly anywhere on the map to place your pin.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSearchNotFound(false)}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              aria-label="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 2. Closest / Partial Match Informational Notice */}
        {closestMatchNotice && (
          <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-blue-200/90 rounded-2xl p-3 shadow-xl flex items-start gap-2.5 text-xs text-slate-700 animate-fadeIn">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5 text-[#0A1F44] font-bold">
              📍
            </div>
            <div className="flex-1 leading-relaxed">
              <p className="font-bold text-slate-900">
                Showing the closest match found for this place.
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5 font-medium">
                If this isn't exact, tap or drag the pin on the map to set your exact spot.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setClosestMatchNotice(null)}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              aria-label="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

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
          title="Center on device location"
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

      {/* 5. Subtle Loading State Overlay */}
      {isInitializing && (
        <div className="absolute inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center gap-3 pointer-events-none">
          <div className="bg-white rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-3 max-w-xs border border-slate-100 pointer-events-auto">
            <Loader2 className="w-10 h-10 animate-spin text-[#F2A93B]" />
            <div className="space-y-1">
              <span className="text-sm font-black text-[#0A1F44] block">Loading Map View</span>
              <span className="text-xs text-slate-500">Preparing location interface...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


