import React, { useState, useEffect } from 'react';
import { createBus, getStaffCompanyParks } from '../../lib/api';
import { Truck, ArrowLeft, Loader2, MapPin } from 'lucide-react';

interface BusFormProps {
  token: string;
  originPark: string;
  onSuccess: (newBusId: string) => void;
  onCancel: () => void;
}

export const BusForm: React.FC<BusFormProps> = ({ token, originPark, onSuccess, onCancel }) => {
  const [busNumber, setBusNumber] = useState('');
  const [destinationPark, setDestinationPark] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverName, setDriverName] = useState('');
  
  const [companyParks, setCompanyParks] = useState<{ id: string; park_name?: string; park_location?: string }[]>([]);
  const [loadingParks, setLoadingParks] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadParks = async () => {
      try {
        setLoadingParks(true);
        const res = await getStaffCompanyParks(token);
        if (res.success && Array.isArray(res.parks)) {
          setCompanyParks(res.parks);
          // Auto-select first available branch that is not the origin branch
          const otherParks = res.parks.filter(
            (p: any) =>
              (p.park_location && p.park_location.toLowerCase() !== originPark.toLowerCase()) &&
              (p.park_name && p.park_name.toLowerCase() !== originPark.toLowerCase())
          );
          if (otherParks.length > 0) {
            setDestinationPark(otherParks[0].park_location || otherParks[0].park_name || '');
          } else if (res.parks.length > 0) {
            setDestinationPark(res.parks[0].park_location || res.parks[0].park_name || '');
          }
        }
      } catch (err) {
        console.error('Failed to load company parks:', err);
      } finally {
        setLoadingParks(false);
      }
    };
    loadParks();
  }, [token, originPark]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!busNumber.trim() || !destinationPark.trim() || !driverPhone.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (destinationPark.trim().toLowerCase() === originPark.trim().toLowerCase()) {
      setError(`Destination branch cannot be the same as origin branch (${originPark}). Please select another destination branch.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createBus(token, {
        bus_number: busNumber.trim().toUpperCase(),
        destination_park: destinationPark.trim(),
        driver_phone: driverPhone.trim(),
        driver_name: driverName.trim() || undefined,
      });

      if (res.success && res.bus) {
        onSuccess(res.bus.id);
      } else {
        setError(res.error || 'Failed to create vehicle loading list. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white border border-slate-100 rounded-3xl p-8 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={onCancel}
          className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
          type="button"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-extrabold text-[#0A1F44] flex items-center gap-2">
            <Truck className="text-[#F2A93B] w-5 h-5" />
            Create New Vehicle Loading List
          </h2>
          <p className="text-xs text-slate-500">Register a new vehicle loading list at this park</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Origin Branch (Departure)
            </label>
            <div className="relative">
              <input
                type="text"
                value={originPark}
                disabled
                className="w-full bg-slate-50 text-slate-600 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none cursor-not-allowed font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Destination Branch <span className="text-red-500">*</span>
            </label>
            {loadingParks ? (
              <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0A1F44]" />
                <span>Loading company branches in Nigeria...</span>
              </div>
            ) : companyParks.length > 0 ? (
              <select
                required
                value={destinationPark}
                onChange={(e) => setDestinationPark(e.target.value)}
                className="w-full border border-slate-200 focus:border-[#0A1F44] rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors bg-white font-semibold text-[#0A1F44] cursor-pointer"
              >
                <option value="" disabled>-- Select Destination Branch --</option>
                {companyParks.map((p, idx) => {
                  const loc = p.park_location || p.park_name || `Branch ${idx + 1}`;
                  const displayName = p.park_name ? `${p.park_name} (${loc})` : loc;
                  const isCurrentOrigin = loc.toLowerCase() === originPark.toLowerCase() || (p.park_name && p.park_name.toLowerCase() === originPark.toLowerCase());
                  return (
                    <option key={`dst-park-${p.id || idx}-${idx}`} value={loc} disabled={isCurrentOrigin}>
                      {displayName} {isCurrentOrigin ? ' (Current Origin Branch)' : ''}
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                type="text"
                required
                placeholder="e.g. Lagos, Abuja, Port Harcourt"
                value={destinationPark}
                onChange={(e) => setDestinationPark(e.target.value)}
                className="w-full border border-slate-200 focus:border-[#0A1F44] rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
              />
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Vehicle Plate Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. ENU-431-AA (Vehicle Plate)"
            value={busNumber}
            onChange={(e) => setBusNumber(e.target.value)}
            className="w-full border border-slate-200 focus:border-[#0A1F44] rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Driver Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              placeholder="e.g. 08031234567"
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
              className="w-full border border-slate-200 focus:border-[#0A1F44] rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Driver Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Emeka Driver"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className="w-full border border-slate-200 focus:border-[#0A1F44] rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="pt-4 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl text-sm transition-colors cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-[#0A1F44] hover:bg-blue-900 text-white font-bold py-3.5 rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Loading List'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
