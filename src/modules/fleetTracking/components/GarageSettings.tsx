import React, { useState, useEffect } from 'react';
import { GarageLocation } from '../types';
import { getGarageLocation, saveGarageLocation, confirmGarageLocation } from '../api';
import { LocationConfirmModal } from './LocationConfirmModal';
import {
  Warehouse,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Save,
  Loader2,
  RefreshCw,
  Edit3,
  ExternalLink,
  ShieldCheck,
  Calendar
} from 'lucide-react';

interface GarageSettingsProps {
  token: string;
  userName?: string;
}

export const GarageSettings: React.FC<GarageSettingsProps> = ({ token, userName }) => {
  const [garage, setGarage] = useState<GarageLocation | null>(null);
  const [addressInput, setAddressInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [savingAddress, setSavingAddress] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);

  const fetchGarage = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await getGarageLocation(token);
      if (res.success && res.garage) {
        setGarage(res.garage);
        setAddressInput(res.garage.address_text || '');
      } else {
        setGarage(null);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to load garage settings.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGarage();
  }, [token]);

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressInput.trim()) {
      setMessage({ type: 'error', text: 'Please enter a valid garage address.' });
      return;
    }

    setSavingAddress(true);
    setMessage(null);
    try {
      const res = await saveGarageLocation(token, {
        address_text: addressInput.trim(),
      });
      if (res.success && res.garage) {
        setGarage(res.garage);
        setMessage({ type: 'success', text: 'Garage address saved successfully.' });
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to save garage address.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Error saving garage address.' });
    } finally {
      setSavingAddress(false);
    }
  };

  const handleConfirmLocation = async (lat: number, lng: number) => {
    const res = await confirmGarageLocation(token, {
      lat,
      lng,
      confirmed_by: userName || 'Manager',
    });
    if (res.success && res.garage) {
      setGarage(res.garage);
      setMessage({ type: 'success', text: 'Garage coordinates confirmed and verified!' });
    } else {
      throw new Error(res.error || 'Failed to confirm garage coordinates.');
    }
  };

  const isConfirmed = Boolean(garage?.location_confirmed && garage?.lat && garage?.lng);

  return (
    <div className="space-y-6">
      {/* Garage Top Card */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center shrink-0">
              <Warehouse className="w-6 h-6 text-[#F2A93B]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-[#0A1F44]">Company Garage Location</h3>
                {isConfirmed ? (
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    🟢 Confirmed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    🟡 Not confirmed
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                The designated garage/base origin for your company fleet trips.
              </p>
            </div>
          </div>

          <button
            onClick={fetchGarage}
            disabled={loading}
            className="self-start sm:self-auto p-2 text-slate-400 hover:text-[#0A1F44] hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
            title="Refresh Garage Settings"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Address Edit Form */}
        <form onSubmit={handleSaveAddress} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5">
              Garage Address / Street Location
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-grow">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  placeholder="e.g. Plot 14 Industrial Layout, Off Onitsha-Enugu Expressway, Nnewi"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#0A1F44] focus:bg-white rounded-2xl pl-10 pr-4 py-3 text-xs font-semibold outline-hidden transition-all text-slate-800"
                />
              </div>
              <button
                type="submit"
                disabled={savingAddress || !addressInput.trim()}
                className="bg-[#0A1F44] hover:bg-blue-900 disabled:opacity-50 text-white font-extrabold px-5 py-3 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer shadow-xs"
              >
                {savingAddress ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Address</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Coordinates & Confirmation Status */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                GPS Latitude & Longitude
              </span>
              {isConfirmed ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-black text-slate-800">
                    {garage?.lat?.toFixed(6)}, {garage?.lng?.toFixed(6)}
                  </span>
                  <span className="text-xs text-emerald-600 font-bold bg-emerald-100/60 px-2 py-0.5 rounded-md">
                    Verified
                  </span>
                </div>
              ) : (
                <p className="text-xs text-amber-700 font-bold mt-1">
                  No confirmed GPS coordinates yet. Fleet tracking requires a confirmed location.
                </p>
              )}
            </div>

            <button
              onClick={() => setIsConfirmModalOpen(true)}
              disabled={!addressInput.trim()}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
                isConfirmed
                  ? 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                  : 'bg-[#F2A93B] hover:bg-[#d9922b] text-[#0A1F44]'
              }`}
            >
              {isConfirmed ? (
                <>
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Update Location on Map</span>
                </>
              ) : (
                <>
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Confirm Location 📍</span>
                </>
              )}
            </button>
          </div>

          {/* Audit information if confirmed */}
          {isConfirmed && garage?.confirmed_at && (
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 border-t border-slate-200/60 pt-3">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Confirmed by: <strong>{garage.confirmed_by || 'Manager'}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Date: {new Date(garage.confirmed_at).toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Live Map Preview if coordinates confirmed */}
          {isConfirmed && garage?.lat && garage?.lng && (
            <div className="space-y-1.5 pt-2">
              <span className="text-[11px] font-black text-slate-600 block">
                Confirmed Garage Map Location:
              </span>
              <div className="w-full h-[220px] rounded-xl overflow-hidden border border-slate-200">
                <iframe
                  title="Garage Google Map Preview"
                  width="100%"
                  height="220"
                  frameBorder="0"
                  scrolling="no"
                  src={`https://maps.google.com/maps?q=${garage.lat},${garage.lng}&z=16&output=embed`}
                  className="w-full h-full border-0"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <LocationConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Garage Location"
        locationName="Company Garage"
        locationType="garage"
        addressText={addressInput || garage?.address_text || ''}
        initialLat={garage?.lat}
        initialLng={garage?.lng}
        onConfirm={handleConfirmLocation}
      />
    </div>
  );
};
