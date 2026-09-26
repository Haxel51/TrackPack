import React, { useState, useEffect } from 'react';
import { SupplierLocation } from '../types';
import {
  getSupplierLocations,
  createSupplierLocation,
  updateSupplierLocation,
  confirmSupplierLocation,
  deleteSupplierLocation,
  batchAddSupplierPresets,
} from '../api';
import { useAuth } from '../../../context/AuthContext';
import { getFleetRole, FleetPermissions } from '../utils/permissions';
import { LocationConfirmModal } from './LocationConfirmModal';
import { NIGERIAN_HUB_PRESETS, HubPreset } from '../utils/nigerianHubPresets';
import {
  Building,
  MapPin,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Trash2,
  Search,
  RefreshCw,
  X,
  Loader2,
  Calendar,
  ShieldCheck,
  Fuel,
  Ship,
  Factory,
  Warehouse,
  Wheat,
  Bus,
  Sparkles,
  Radio,
  Check,
  CheckSquare,
  Square,
  Filter,
  ExternalLink,
} from 'lucide-react';

interface SuppliersManagementProps {
  token: string;
  userName?: string;
}

export const SuppliersManagement: React.FC<SuppliersManagementProps> = ({ token, userName }) => {
  const { user, role } = useAuth();
  const fleetRole = getFleetRole(user, role);
  const canCreateSupplier = FleetPermissions.canCreateSupplier(fleetRole);
  const canEditSupplier = FleetPermissions.canEditSupplier(fleetRole);
  const canDeleteSupplier = FleetPermissions.canDeleteSupplier(fleetRole);

  const [suppliers, setSuppliers] = useState<SupplierLocation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'confirmed' | 'unconfirmed'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add / Edit Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierLocation | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('petroleum');
  const [formGeofenceRadius, setFormGeofenceRadius] = useState<number>(200);
  const [savingForm, setSavingForm] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Presets Directory Modal state
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState<boolean>(false);
  const [presetSearch, setPresetSearch] = useState<string>('');
  const [presetCategoryFilter, setPresetCategoryFilter] = useState<string>('all');
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>([]);
  const [isBatchAdding, setIsBatchAdding] = useState<boolean>(false);

  // Confirm Location Modal state
  const [confirmingSupplier, setConfirmingSupplier] = useState<SupplierLocation | null>(null);

  // Delete modal state
  const [deletingSupplier, setDeletingSupplier] = useState<SupplierLocation | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await getSupplierLocations(token);
      if (res.success && Array.isArray(res.suppliers)) {
        setSuppliers(res.suppliers);
      } else {
        setSuppliers([]);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to load supplier locations.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [token]);

  const handleOpenAddModal = () => {
    setEditingSupplier(null);
    setFormName('');
    setFormAddress('');
    setFormCategory('petroleum');
    setFormGeofenceRadius(200);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (sup: SupplierLocation) => {
    setEditingSupplier(sup);
    setFormName(sup.name);
    setFormAddress(sup.address_text);
    setFormCategory(sup.category || 'petroleum');
    setFormGeofenceRadius(sup.geofence_radius || 200);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formAddress.trim()) {
      setFormError('Hub / Destination Name and Address are required.');
      return;
    }

    setSavingForm(true);
    setFormError(null);
    try {
      if (editingSupplier) {
        const res = await updateSupplierLocation(token, editingSupplier.id, {
          name: formName.trim(),
          address_text: formAddress.trim(),
          category: formCategory,
          geofence_radius: formGeofenceRadius,
        });
        if (res.success && res.supplier) {
          setSuppliers((prev) => prev.map((s) => (s.id === editingSupplier.id ? res.supplier! : s)));
          setIsFormModalOpen(false);
          setMessage({ type: 'success', text: `Updated "${res.supplier.name}" successfully.` });
        } else {
          setFormError(res.error || 'Failed to update hub.');
        }
      } else {
        const res = await createSupplierLocation(token, {
          name: formName.trim(),
          address_text: formAddress.trim(),
          category: formCategory,
          geofence_radius: formGeofenceRadius,
        });
        if (res.success && res.supplier) {
          setSuppliers((prev) => [res.supplier!, ...prev]);
          setIsFormModalOpen(false);
          setMessage({
            type: 'success',
            text: `Added destination hub "${res.supplier.name}". Click "Confirm Location 📍" to verify GPS boundary.`,
          });
        } else {
          setFormError(res.error || 'Failed to create hub.');
        }
      }
    } catch (err: any) {
      setFormError(err?.message || 'Error saving hub location.');
    } finally {
      setSavingForm(false);
    }
  };

  const handleConfirmLocation = async (lat: number, lng: number, geofenceRadius?: number) => {
    if (!confirmingSupplier) return;
    const finalRadius = geofenceRadius || confirmingSupplier.geofence_radius || 200;
    const res = await confirmSupplierLocation(token, confirmingSupplier.id, {
      lat,
      lng,
      confirmed_by: userName || 'Manager',
      geofence_radius: finalRadius,
    });
    if (res.success && res.supplier) {
      setSuppliers((prev) => prev.map((s) => (s.id === confirmingSupplier.id ? res.supplier! : s)));
      setMessage({
        type: 'success',
        text: `Confirmed GPS coordinates & ${finalRadius}m geofence for "${res.supplier.name}".`,
      });
      setConfirmingSupplier(null);
    } else {
      throw new Error(res.error || 'Failed to confirm hub location.');
    }
  };

  const handleDelete = async () => {
    if (!deletingSupplier) return;
    setDeleting(true);
    try {
      const res = await deleteSupplierLocation(token, deletingSupplier.id);
      if (res.success) {
        setSuppliers((prev) => prev.filter((s) => s.id !== deletingSupplier.id));
        setMessage({ type: 'success', text: `Deleted "${deletingSupplier.name}".` });
        setDeletingSupplier(null);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to delete hub.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Error deleting hub.' });
    } finally {
      setDeleting(false);
    }
  };

  // Add a single Preset Hub with 1-Click
  const handleAddSinglePreset = async (preset: HubPreset) => {
    try {
      const res = await createSupplierLocation(token, {
        name: preset.name,
        address_text: `${preset.address}, ${preset.state}`,
        lat: preset.lat,
        lng: preset.lng,
        category: preset.category,
        geofence_radius: preset.geofenceRadius,
      });
      if (res.success && res.supplier) {
        setSuppliers((prev) => [res.supplier!, ...prev]);
        setMessage({
          type: 'success',
          text: `Added verified hub "${preset.name}" with ${preset.geofenceRadius}m geofence.`,
        });
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to add preset hub.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Error adding preset hub.' });
    }
  };

  // Batch add selected presets
  const handleBatchAddPresets = async () => {
    if (selectedPresetIds.length === 0) return;
    setIsBatchAdding(true);
    try {
      const presetsToAdd = NIGERIAN_HUB_PRESETS.filter((p) => selectedPresetIds.includes(p.id)).map((p) => ({
        name: p.name,
        address_text: `${p.address}, ${p.state}`,
        lat: p.lat,
        lng: p.lng,
        category: p.category,
        geofence_radius: p.geofenceRadius,
      }));

      const res = await batchAddSupplierPresets(token, presetsToAdd);
      if (res.success && Array.isArray(res.suppliers)) {
        setSuppliers((prev) => [...res.suppliers, ...prev]);
        setMessage({
          type: 'success',
          text: `Successfully imported ${res.suppliers.length} Nigerian Hub presets!`,
        });
        setSelectedPresetIds([]);
        setIsPresetsModalOpen(false);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to batch import presets.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Error importing presets.' });
    } finally {
      setIsBatchAdding(false);
    }
  };

  const getCategoryInfo = (category?: string) => {
    switch (category) {
      case 'petroleum':
        return { label: 'Petroleum & Gas Depot', icon: Fuel, color: 'bg-amber-50 text-amber-900 border-amber-200' };
      case 'port':
        return { label: 'Port & Ocean Terminal', icon: Ship, color: 'bg-cyan-50 text-cyan-900 border-cyan-200' };
      case 'factory':
        return { label: 'Cement & Factory', icon: Factory, color: 'bg-slate-100 text-slate-800 border-slate-200' };
      case 'warehouse':
        return { label: 'FMCG Logistics Hub', icon: Warehouse, color: 'bg-indigo-50 text-indigo-900 border-indigo-200' };
      case 'agriculture':
        return { label: 'Agricultural Reserve', icon: Wheat, color: 'bg-emerald-50 text-emerald-900 border-emerald-200' };
      case 'transit':
        return { label: 'Passenger Transit Hub', icon: Bus, color: 'bg-purple-50 text-purple-900 border-purple-200' };
      default:
        return { label: 'Loading Hub / Destination', icon: Building, color: 'bg-blue-50 text-blue-900 border-blue-200' };
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.address_text.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filterStatus === 'confirmed' && !s.location_confirmed) return false;
    if (filterStatus === 'unconfirmed' && s.location_confirmed) return false;

    if (filterCategory !== 'all' && s.category !== filterCategory) return false;

    return true;
  });

  const confirmedCount = suppliers.filter((s) => s.location_confirmed).length;
  const unconfirmedCount = suppliers.length - confirmedCount;

  // Check if a preset is already in company destinations
  const isPresetImported = (presetName: string) => {
    return suppliers.some(
      (s) => s.name.trim().toLowerCase() === presetName.trim().toLowerCase()
    );
  };

  return (
    <div className="space-y-6">
      {/* Step 2: Universal Loading Hubs & Delivery Terminals Directory Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-[#0A1F44] rounded-2xl flex items-center justify-center shrink-0 shadow-md">
              <Building className="w-6 h-6 text-[#F7941D]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-[#0A1F44]">
                  Universal Loading Hubs & Delivery Terminals
                </h3>
                <span className="text-xs font-black bg-[#F7941D]/15 text-[#b36307] px-2.5 py-0.5 rounded-full">
                  Step 2 Directory
                </span>
                <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
                  {suppliers.length} Registered
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Pre-configured Nigerian petroleum depots (Dangote, Atlas Cove), maritime container ports (APMT, Onne), cement plants (Obajana, Ibese), and FMCG distribution centers with calibrated GPS geofence perimeters.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-auto">
            <button
              onClick={fetchSuppliers}
              disabled={loading}
              className="p-2.5 text-slate-400 hover:text-[#0A1F44] hover:bg-slate-50 rounded-2xl transition-colors cursor-pointer border border-slate-200"
              title="Refresh Hubs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {canCreateSupplier && (
              <>
                <button
                  onClick={() => setIsPresetsModalOpen(true)}
                  className="bg-[#0A1F44] hover:bg-blue-900 text-white font-extrabold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md border border-[#F7941D]/40"
                >
                  <Sparkles className="w-4 h-4 text-[#F7941D]" />
                  <span>Browse Nigerian Hub Presets</span>
                </button>

                <button
                  onClick={handleOpenAddModal}
                  className="bg-[#F7941D] hover:bg-[#e07d0f] text-[#0A1F44] font-black px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-lg"
                >
                  <Plus className="w-4 h-4 text-[#0A1F44]" />
                  <span>Add Custom Hub</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
            <button
              onClick={() => setMessage(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Category Filter Pills & Search Bar */}
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-grow w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search hubs by name, city, state, or address..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#0A1F44] focus:bg-white rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold outline-hidden transition-all text-slate-800"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl shrink-0 w-full md:w-auto">
              <button
                onClick={() => setFilterStatus('all')}
                className={`flex-1 md:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'all'
                    ? 'bg-white text-[#0A1F44] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All ({suppliers.length})
              </button>
              <button
                onClick={() => setFilterStatus('confirmed')}
                className={`flex-1 md:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'confirmed'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🟢 Verified ({confirmedCount})
              </button>
              <button
                onClick={() => setFilterStatus('unconfirmed')}
                className={`flex-1 md:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterStatus === 'unconfirmed'
                    ? 'bg-white text-orange-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🟡 Pending ({unconfirmedCount})
              </button>
            </div>
          </div>

          {/* Industry Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
            <span className="text-slate-400 text-[11px] shrink-0 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter Category:
            </span>
            {[
              { id: 'all', label: 'All Industries' },
              { id: 'petroleum', label: '⛽ Petroleum & Gas Depots' },
              { id: 'port', label: '🚢 Maritime Ports & APMT' },
              { id: 'factory', label: '🏗️ Heavy Industrial / Cement' },
              { id: 'warehouse', label: '📦 FMCG Distribution & DC' },
              { id: 'agriculture', label: '🌾 Agricultural Silos' },
              { id: 'transit', label: '🚌 Interstate Transit Hubs' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id)}
                className={`px-3 py-1 rounded-xl shrink-0 transition-all cursor-pointer ${
                  filterCategory === cat.id
                    ? 'bg-[#0A1F44] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Suppliers / Loading Hubs Grid */}
        {loading ? (
          <div className="py-14 text-center text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0A1F44]" />
            <p className="text-xs font-semibold">Loading Universal Loading Hubs...</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200 p-6 space-y-4">
            <Building className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-black text-slate-700">No Destination Hubs Found</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchTerm || filterStatus !== 'all' || filterCategory !== 'all'
                  ? 'No loading hubs match your active filter criteria.'
                  : 'Start by importing pre-verified Nigerian hubs (Dangote Refinery, Atlas Cove, Apapa APMT) or add custom delivery destinations.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                onClick={() => setIsPresetsModalOpen(true)}
                className="bg-[#0A1F44] hover:bg-blue-900 text-white font-extrabold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#F7941D]" />
                <span>Browse Nigerian Hub Presets</span>
              </button>
              <button
                onClick={handleOpenAddModal}
                className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-slate-500" />
                <span>Add Custom</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSuppliers.map((sup) => {
              const isConfirmed = Boolean(sup.location_confirmed && sup.lat && sup.lng);
              const catInfo = getCategoryInfo(sup.category);
              const CatIcon = catInfo.icon;
              const radius = sup.geofence_radius || 200;

              return (
                <div
                  key={sup.id}
                  className={`bg-white border rounded-3xl p-5 transition-all shadow-xs hover:shadow-md flex flex-col justify-between space-y-4 ${
                    isConfirmed
                      ? 'border-slate-200/90 hover:border-slate-300'
                      : 'border-orange-200 bg-orange-50/15'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Row: Name, Category Pill, Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                          <CatIcon className="w-5 h-5 text-[#0A1F44]" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-[#0A1F44] leading-tight truncate">
                            {sup.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${catInfo.color}`}
                            >
                              {catInfo.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isConfirmed ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            🟢 Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-800 border border-orange-200 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3 text-orange-600" />
                            🟡 Pending GPS
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Address & Geofence Block */}
                    <div className="bg-slate-50/90 rounded-2xl p-3 text-xs space-y-1.5 border border-slate-100">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="text-slate-700 font-semibold leading-snug">
                          {sup.address_text}
                        </span>
                      </div>

                      {/* GPS & Geofence Perimeter readout */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px] font-mono flex-wrap gap-2">
                        {isConfirmed ? (
                          <div className="text-slate-600 font-bold">
                            GPS: {sup.lat?.toFixed(5)}, {sup.lng?.toFixed(5)}
                          </div>
                        ) : (
                          <div className="text-orange-700 font-semibold">
                            ⚠️ GPS Coordinates not locked
                          </div>
                        )}

                        <div className="flex items-center gap-1 text-[#0A1F44] font-extrabold bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                          <Radio className="w-3 h-3 text-[#F7941D]" />
                          <span>Geofence: {radius}m</span>
                        </div>
                      </div>
                    </div>

                    {/* Audit Info if confirmed */}
                    {isConfirmed && sup.confirmed_by && (
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          Verified by {sup.confirmed_by}{' '}
                          {sup.confirmed_at ? `on ${new Date(sup.confirmed_at).toLocaleDateString()}` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5">
                      {canEditSupplier && (
                        <button
                          onClick={() => handleOpenEditModal(sup)}
                          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                          title="Edit Hub Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDeleteSupplier && (
                        <button
                          onClick={() => setDeletingSupplier(sup)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Delete Hub"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => setConfirmingSupplier(sup)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                        isConfirmed
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                          : 'bg-[#F7941D] hover:bg-[#e07d0f] text-[#0A1F44]'
                      }`}
                    >
                      <MapPin className="w-3 h-3" />
                      <span>{isConfirmed ? 'View / Update Perimeter' : 'Confirm Location 📍'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Browse Nigerian Hub Presets Directory Modal */}
      {isPresetsModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#070b19]/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-slideUp">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-[#0A1F44] text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-[#F7941D]" />
                </div>
                <div>
                  <h3 className="text-base font-black">Nigerian Hub Presets Directory</h3>
                  <p className="text-xs text-slate-300">
                    Pre-calibrated GPS coordinates & geofences for major Nigerian loading hubs
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPresetsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Bar */}
            <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/70">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder="Search hub name, state, or cargo type (e.g. Dangote, Atlas Cove, APMT, Ibese)..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold outline-hidden focus:border-[#0A1F44] text-slate-800"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-bold">
                {[
                  { id: 'all', label: 'All Presets' },
                  { id: 'petroleum', label: '⛽ Petroleum & Gas' },
                  { id: 'port', label: '🚢 Ports & APMT' },
                  { id: 'factory', label: '🏗️ Cement & Plants' },
                  { id: 'warehouse', label: '📦 FMCG Logistics' },
                  { id: 'agriculture', label: '🌾 Agriculture & Silos' },
                  { id: 'transit', label: '🚌 Interstate Transit' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setPresetCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-lg shrink-0 transition-all cursor-pointer ${
                      presetCategoryFilter === cat.id
                        ? 'bg-[#0A1F44] text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Presets List */}
            <div className="p-4 overflow-y-auto divide-y divide-slate-100 flex-1 space-y-2">
              {NIGERIAN_HUB_PRESETS.filter((p) => {
                const matchCat = presetCategoryFilter === 'all' || p.category === presetCategoryFilter;
                const matchQuery =
                  !presetSearch.trim() ||
                  p.name.toLowerCase().includes(presetSearch.toLowerCase()) ||
                  p.address.toLowerCase().includes(presetSearch.toLowerCase()) ||
                  p.state.toLowerCase().includes(presetSearch.toLowerCase()) ||
                  p.tag.toLowerCase().includes(presetSearch.toLowerCase());
                return matchCat && matchQuery;
              }).map((preset) => {
                const alreadyAdded = isPresetImported(preset.name);
                const isSelected = selectedPresetIds.includes(preset.id);

                return (
                  <div
                    key={preset.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      alreadyAdded
                        ? 'bg-slate-50/90 border-slate-200/60 opacity-80'
                        : isSelected
                        ? 'bg-amber-50/50 border-[#F7941D]'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {!alreadyAdded && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPresetIds((prev) =>
                              prev.includes(preset.id)
                                ? prev.filter((id) => id !== preset.id)
                                : [...prev, preset.id]
                            );
                          }}
                          className="mt-1 text-slate-400 hover:text-[#0A1F44] cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#F7941D]" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                      )}

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-black text-[#0A1F44] leading-tight">
                            {preset.name}
                          </h4>
                          <span className="text-[10px] font-bold bg-[#F7941D]/15 text-[#b36307] px-2 py-0.5 rounded-md">
                            {preset.categoryLabel}
                          </span>
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                            {preset.tag}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{preset.address}</span>
                          <span className="text-slate-300">•</span>
                          <span className="font-mono text-slate-600 shrink-0 font-bold">{preset.state}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span>GPS: {preset.lat.toFixed(4)}, {preset.lng.toFixed(4)}</span>
                          <span>•</span>
                          <span className="text-emerald-700 font-bold">Geofence: {preset.geofenceRadius}m</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {alreadyAdded ? (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Imported</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddSinglePreset(preset)}
                          className="bg-[#0A1F44] hover:bg-[#F7941D] hover:text-[#0A1F44] text-white px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
                        >
                          + Quick Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer with Batch Add Action */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-600">
                {selectedPresetIds.length} preset(s) selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPresetsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-white cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={selectedPresetIds.length === 0 || isBatchAdding}
                  onClick={handleBatchAddPresets}
                  className="px-5 py-2 rounded-xl bg-[#0A1F44] hover:bg-blue-900 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {isBatchAdding ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-[#F7941D]" />
                      <span>Import Selected ({selectedPresetIds.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Add / Edit Hub Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0b1329]/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100 my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0A1F44] flex items-center justify-center font-black">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0A1F44]">
                    {editingSupplier ? 'Edit Loading Hub' : 'Add Loading Hub / Destination'}
                  </h3>
                  <p className="text-xs text-slate-500">Universal cargo dispatch & delivery point</p>
                </div>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                disabled={savingForm}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  Hub / Terminal Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Dangote Lekki Refinery, APMT Apapa, BUA Cement Okpella"
                  disabled={savingForm}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#0A1F44] focus:bg-white rounded-2xl px-3.5 py-2.5 text-xs font-semibold outline-hidden transition-all text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  Industry / Facility Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  disabled={savingForm}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#0A1F44] focus:bg-white rounded-2xl px-3.5 py-2.5 text-xs font-semibold outline-hidden transition-all text-slate-800 cursor-pointer"
                >
                  <option value="petroleum">⛽ Petroleum & Gas Depot / Tank Farm</option>
                  <option value="port">🚢 Maritime Port & Ocean Terminal</option>
                  <option value="factory">🏗️ Heavy Industrial & Cement Factory</option>
                  <option value="warehouse">📦 FMCG Logistics & Fulfillment Center</option>
                  <option value="agriculture">🌾 Agricultural Silo & Grain Reserve</option>
                  <option value="transit">🚌 Interstate Passenger & Transit Hub</option>
                  <option value="general">🏢 General Destination Hub</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  Physical Address / Destination Area <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="e.g. Lekki Free Trade Zone, Ibeju-Lekki, Lagos"
                  rows={2}
                  disabled={savingForm}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#0A1F44] focus:bg-white rounded-2xl px-3.5 py-2.5 text-xs font-semibold outline-hidden transition-all text-slate-800"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-black text-slate-700 mb-1">
                  <span>Geofence Radius (Arrival Detection)</span>
                  <span className="text-[#0A1F44] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                    {formGeofenceRadius} meters
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="25"
                  value={formGeofenceRadius}
                  onChange={(e) => setFormGeofenceRadius(Number(e.target.value))}
                  disabled={savingForm}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#F7941D]"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mt-1">
                  <span>50m (Gate)</span>
                  <span>200m (Standard Depot)</span>
                  <span>500m (Refinery / Port)</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  disabled={savingForm}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingForm}
                  className="px-5 py-2.5 rounded-xl bg-[#0A1F44] hover:bg-blue-900 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  {savingForm ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingSupplier ? 'Save Changes' : 'Create Hub Location'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Delete Confirmation Modal */}
      {deletingSupplier && (
        <div className="fixed inset-0 z-50 bg-[#0b1329]/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-100 my-8">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-[#0A1F44]">Delete Hub Location?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to remove <strong>"{deletingSupplier.name}"</strong>? This will remove its confirmed GPS coordinates and geofence boundary from your destinations list.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSupplier(null)}
                disabled={deleting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Yes, Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Confirm Coordinates & Geofence Boundary Modal */}
      {confirmingSupplier && (
        <LocationConfirmModal
          isOpen={Boolean(confirmingSupplier)}
          onClose={() => setConfirmingSupplier(null)}
          title={`Confirm ${confirmingSupplier.name}`}
          locationName={confirmingSupplier.name}
          locationType="supplier"
          addressText={confirmingSupplier.address_text}
          initialLat={confirmingSupplier.lat}
          initialLng={confirmingSupplier.lng}
          initialGeofenceRadius={confirmingSupplier.geofence_radius || 200}
          onConfirm={handleConfirmLocation}
        />
      )}
    </div>
  );
};
