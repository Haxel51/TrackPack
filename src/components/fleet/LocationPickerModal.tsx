import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Check, X, Navigation, Loader2 } from 'lucide-react';
import { searchLocationNominatim, reverseGeocodeNominatim, Coordinates } from '../../lib/routingEta';

// Fix Leaflet icon assets
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createPinIcon = () => {
  return L.divIcon({
    className: 'custom-location-pin',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="width: 36px; height: 36px; background: #F2A93B; border: 3px solid #0A1F44; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">
          <div style="width: 12px; height: 12px; background: #0A1F44; border-radius: 50%; transform: rotate(45deg);"></div>
        </div>
      </div>
    `,
    iconSize: [36, 42],
    iconAnchor: [18, 42],
    popupAnchor: [0, -38]
  });
};

export interface PinnedLocation {
  latitude: number;
  longitude: number;
  place_name: string;
  formatted_address: string;
}

interface LocationPickerModalProps {
  title?: string;
  initialCoords?: Coordinates | null;
  initialName?: string;
  onConfirm: (location: PinnedLocation) => void;
  onClose: () => void;
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  title = "Pin Exact Location on Map",
  initialCoords,
  initialName = "",
  onConfirm,
  onClose
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [searchQuery, setSearchQuery] = useState(initialName);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCoords, setSelectedCoords] = useState<Coordinates>(
    initialCoords?.latitude && initialCoords?.longitude 
      ? initialCoords 
      : { latitude: 6.5244, longitude: 3.3792 } // Lagos default
  );
  const [selectedPlaceName, setSelectedPlaceName] = useState<string>(initialName || "Pinned Location");
  const [geocoding, setGeocoding] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const defaultLat = selectedCoords.latitude || 6.5244;
    const defaultLng = selectedCoords.longitude || 3.3792;

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 14,
      zoomControl: true
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const marker = L.marker([defaultLat, defaultLng], {
      icon: createPinIcon(),
      draggable: true
    }).addTo(map);

    markerRef.current = marker;
    mapInstanceRef.current = map;

    // On Map Click
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const newCoords = { latitude: e.latlng.lat, longitude: e.latlng.lng };
      setSelectedCoords(newCoords);
      marker.setLatLng([newCoords.latitude, newCoords.longitude]);
      
      setGeocoding(true);
      const name = await reverseGeocodeNominatim(newCoords);
      setSelectedPlaceName(name);
      setGeocoding(false);
    });

    // On Marker Drag End
    marker.on('dragend', async () => {
      const pos = marker.getLatLng();
      const newCoords = { latitude: pos.lat, longitude: pos.lng };
      setSelectedCoords(newCoords);

      setGeocoding(true);
      const name = await reverseGeocodeNominatim(newCoords);
      setSelectedPlaceName(name);
      setGeocoding(false);
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Search Submit
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    const results = await searchLocationNominatim(searchQuery);
    setSearchResults(results);
    setSearching(false);

    if (results.length > 0) {
      selectSearchResult(results[0]);
    }
  };

  // Select Result
  const selectSearchResult = async (result: any) => {
    const coords = { latitude: result.latitude, longitude: result.longitude };
    setSelectedCoords(coords);
    setSelectedPlaceName(result.display_name);
    setSearchResults([]);

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([coords.latitude, coords.longitude], 16);
      markerRef.current.setLatLng([coords.latitude, coords.longitude]);
    }
  };

  // Handle Confirm
  const handleConfirm = () => {
    onConfirm({
      latitude: selectedCoords.latitude,
      longitude: selectedCoords.longitude,
      place_name: selectedPlaceName,
      formatted_address: selectedPlaceName
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-3xl h-[94vh] sm:h-auto sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#0A1F44] border-b border-slate-800/90 p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-2 bg-amber-400/15 text-amber-400 border border-amber-400/30 rounded-xl shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-white truncate">{title}</h3>
              <p className="text-[11px] text-slate-400 truncate">Search location name or click map to drop GPS pin</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3.5 sm:p-4 bg-slate-950/90 border-b border-slate-800 space-y-2 shrink-0">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type location (e.g. IBeto Cement Nnewi, Dangote Onitsha)..."
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0 min-h-[40px]"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>Find</span>
            </button>
          </form>

          {/* Search Dropdown Results */}
          {searchResults.length > 0 && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden max-h-40 overflow-y-auto divide-y divide-slate-800 shadow-xl">
              {searchResults.map((res, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectSearchResult(res)}
                  className="w-full text-left p-2.5 hover:bg-slate-800 text-xs text-slate-200 flex items-start gap-2 transition-colors cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{res.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map View */}
        <div className="flex-1 min-h-[220px] bg-slate-950 relative">
          <div ref={mapContainerRef} className="w-full h-full min-h-[220px]" />
          
          <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-xs border border-slate-700/80 px-3 py-1.5 rounded-xl text-[11px] text-amber-300 font-bold shadow-lg z-10 flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-amber-400" />
            <span>Click or drag pin to adjust exact spot</span>
          </div>
        </div>

        {/* Selected Coordinates Footer Bar */}
        <div className="bg-[#0A1F44] border-t border-slate-800/90 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 pb-10 sm:pb-5">
          <div className="space-y-0.5 max-w-md min-w-0">
            <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Confirmed Pin Location</p>
            <p className="text-xs sm:text-sm font-black text-white truncate">
              {geocoding ? 'Finding place name...' : selectedPlaceName}
            </p>
            <p className="text-[11px] font-mono text-amber-300 font-bold">
              GPS: {selectedCoords.latitude.toFixed(5)}, {selectedCoords.longitude.toFixed(5)}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer min-h-[42px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 sm:flex-none bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg cursor-pointer min-h-[42px]"
            >
              <Check className="w-4 h-4" />
              <span>Confirm Location Pin</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LocationPickerModal;
