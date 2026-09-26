import React, { useState, useEffect } from 'react';
import { TruckProfile, AssetCategory, TrackerModelType } from '../types';
import {
  getTruckProfiles,
  createTruckProfile,
  updateTruckProfile,
  changeTruckPaymentPlan,
  deleteTruckProfile,
} from '../api';
import { getFleetRole, FleetPermissions } from '../utils/permissions';
import { TruckModal } from './TruckModal';
import {
  Truck,
  Plus,
  Search,
  Phone,
  User,
  CreditCard,
  Edit2,
  Trash2,
  AlertCircle,
  RefreshCw,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  Calendar,
  ChevronDown,
  Pencil,
  X,
  Check,
  Radio,
  Fuel,
  Bus,
  Package,
  Wrench,
  Car,
  Battery,
  ShieldCheck,
  Filter,
} from 'lucide-react';

interface TrucksManagementProps {
  token: string;
  role: 'customer' | 'company' | 'staff' | 'manager' | 'admin' | null;
  user: any;
}

export const TrucksManagement: React.FC<TrucksManagementProps> = ({ token, role, user }) => {
  const [trucks, setTrucks] = useState<TruckProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modal State for Add/Edit Truck Profile
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTruck, setEditingTruck] = useState<TruckProfile | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Delete State
  const [deletingTruckId, setDeletingTruckId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Payment Plan Selector Modal State
  const [selectedTruckForPlan, setSelectedTruckForPlan] = useState<TruckProfile | null>(null);
  const [selectedPlanOption, setSelectedPlanOption] = useState<'per_trip' | 'monthly'>('per_trip');
  const [planChangingTruckId, setPlanChangingTruckId] = useState<string | null>(null);
  const [planSelectorError, setPlanSelectorError] = useState<string | null>(null);

  // Determine permissions based on centralized fleet role
  const fleetRole = getFleetRole(user, role);
  const canManageTrucks = FleetPermissions.canManageTrucks(fleetRole);
  const canCreateTruck = FleetPermissions.canCreateTruck(fleetRole);
  const canEditTruck = FleetPermissions.canEditTruck(fleetRole);
  const canDeleteTruck = FleetPermissions.canDeleteTruck(fleetRole);
  const canChangePaymentPlan = FleetPermissions.canAccessBilling(fleetRole);

  const loadTrucks = async () => {
    setLoading(true);
    setError(null);
    const res = await getTruckProfiles(token);
    if (res.success) {
      setTrucks(res.trucks || []);
    } else {
      setError(res.error || 'Failed to load fleet assets.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTrucks();
  }, [token]);

  const showSuccessNotice = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  const handleOpenAddModal = () => {
    setEditingTruck(null);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (truck: TruckProfile) => {
    setEditingTruck(truck);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveTruck = async (payload: {
    plate_number: string;
    asset_type?: AssetCategory;
    asset_name?: string;
    tracker_id?: string;
    tracker_model?: TrackerModelType | string;
    driver_name: string;
    driver_phone: string;
    payment_plan: 'per_trip' | 'monthly';
  }) => {
    setIsSaving(true);
    setModalError(null);

    if (editingTruck) {
      const res = await updateTruckProfile(token, editingTruck.id, payload as any);
      if (res.success) {
        showSuccessNotice(`Fleet asset "${payload.plate_number}" updated successfully.`);
        setIsModalOpen(false);
        loadTrucks();
      } else {
        setModalError(res.error || 'Failed to update asset profile');
      }
    } else {
      const res = await createTruckProfile(token, payload as any);
      if (res.success) {
        showSuccessNotice(`Fleet asset "${payload.plate_number}" registered successfully.`);
        setIsModalOpen(false);
        loadTrucks();
      } else {
        setModalError(res.error || 'Failed to create asset profile');
      }
    }
    setIsSaving(false);
  };

  const handleOpenPlanSelector = (truck: TruckProfile) => {
    if (!canManageTrucks) return;
    setSelectedTruckForPlan(truck);
    setSelectedPlanOption(truck.payment_plan || 'per_trip');
    setPlanSelectorError(null);
  };

  const handleConfirmPlanChange = async () => {
    if (!selectedTruckForPlan || !canManageTrucks) return;

    setPlanChangingTruckId(selectedTruckForPlan.id);
    setPlanSelectorError(null);

    const res = await changeTruckPaymentPlan(token, selectedTruckForPlan.id, selectedPlanOption);
    if (res.success) {
      if (selectedPlanOption === 'per_trip') {
        showSuccessNotice(`Billing plan for "${selectedTruckForPlan.plate_number}" updated to Per Trip.`);
      } else {
        showSuccessNotice(`Billing plan for "${selectedTruckForPlan.plate_number}" updated to Monthly (Pending trip payment activation).`);
      }
      setSelectedTruckForPlan(null);
      loadTrucks();
    } else {
      setPlanSelectorError(res.error || 'Failed to update billing plan');
    }
    setPlanChangingTruckId(null);
  };

  const handleDeleteTruck = async (truckId: string) => {
    setIsDeleting(true);
    const res = await deleteTruckProfile(token, truckId);
    if (res.success) {
      showSuccessNotice('Fleet asset deleted successfully.');
      setDeletingTruckId(null);
      loadTrucks();
    } else {
      setError(res.error || 'Failed to delete asset profile.');
    }
    setIsDeleting(false);
  };

  const getAssetIcon = (type?: string) => {
    switch (type) {
      case 'fuel_tanker':
        return Fuel;
      case 'commercial_bus':
        return Bus;
      case 'delivery_van':
        return Package;
      case 'construction_equipment':
        return Wrench;
      case 'utility_vehicle':
        return Car;
      default:
        return Truck;
    }
  };

  const getAssetLabel = (type?: string) => {
    switch (type) {
      case 'fuel_tanker':
        return 'Fuel Tanker';
      case 'commercial_bus':
        return 'Interstate Bus / Van';
      case 'delivery_van':
        return 'Delivery Van';
      case 'construction_equipment':
        return 'Heavy Machinery';
      case 'utility_vehicle':
        return 'Utility Car';
      default:
        return 'Heavy Truck / Flatbed';
    }
  };

  const filteredTrucks = trucks.filter((t) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      (t.plate_number || '').toLowerCase().includes(query) ||
      (t.driver_name || '').toLowerCase().includes(query) ||
      (t.driver_phone || '').toLowerCase().includes(query) ||
      (t.asset_name || '').toLowerCase().includes(query) ||
      (t.tracker_id || '').toLowerCase().includes(query);

    const matchesCategory =
      categoryFilter === 'all' ||
      (t.asset_type || 'heavy_truck') === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const getBadgeState = (truck: TruckProfile) => {
    if (truck.payment_plan === 'per_trip') {
      return {
        label: 'Per Trip',
        bg: 'bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400',
        dot: 'bg-blue-500',
        subtitle: '₦1,000 / trip',
      };
    }

    if (!truck.subscription_active_until) {
      return {
        label: 'Monthly - Pending',
        bg: 'bg-orange-50 text-orange-700 border-orange-200 hover:border-orange-400',
        dot: 'bg-orange-500',
        subtitle: 'Plan set • Pending trip activation',
      };
    }

    const expTime = new Date(truck.subscription_active_until).getTime();
    const isActive = expTime > Date.now();

    if (isActive) {
      const expDate = new Date(truck.subscription_active_until).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      return {
        label: 'Monthly Active',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400',
        dot: 'bg-emerald-500',
        subtitle: `Active until ${expDate}`,
      };
    }

    const expDate = new Date(truck.subscription_active_until).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return {
      label: 'Monthly Expired',
      bg: 'bg-orange-50 text-orange-700 border-orange-200 hover:border-orange-400',
      dot: 'bg-orange-500',
      subtitle: `Expired on ${expDate}`,
    };
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Control Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#0A1F44] mb-1">
              <Truck className="w-4 h-4 text-[#F7941D]" />
              <span className="bg-[#F7941D]/15 text-[#0A1F44] px-2 py-0.5 rounded-md border border-[#F7941D]/30">Universal Fleet Asset & Tracker Registry</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Registered Fleet Assets & Magnetic Trackers
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed font-medium">
              Manage trucks, fuel tankers, interstate transport buses, and heavy machinery with universal magnetic GPS tracker pairing.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={loadTrucks}
              disabled={loading}
              className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl border border-slate-200 transition-colors cursor-pointer"
              title="Refresh Assets"
              id="refresh-trucks-btn"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {canCreateTruck && (
              <button
                onClick={handleOpenAddModal}
                className="bg-[#F7941D] hover:bg-[#e08215] text-[#0A1F44] font-black px-5 py-3 rounded-2xl text-xs transition-all flex items-center gap-2 shadow-md shadow-[#F7941D]/20 cursor-pointer active:scale-95"
                id="add-truck-btn"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Register Fleet Asset</span>
              </button>
            )}
          </div>
        </div>

        {!canCreateTruck && !canEditTruck && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-2.5 text-xs text-blue-800 font-medium">
            <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0" />
            <span>You have read-only access. Manager or CEO role is required to add or edit fleet assets.</span>
          </div>
        )}
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs font-bold animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters & Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search plate, IMEI, driver, asset..."
              className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#F7941D] focus:ring-1 focus:ring-[#F7941D] shadow-xs transition-colors"
              id="truck-search-input"
            />
          </div>

          <div className="text-xs text-slate-500 font-bold self-end sm:self-center">
            Showing <span className="text-slate-900 font-extrabold">{filteredTrucks.length}</span> of{' '}
            <span className="text-slate-900 font-extrabold">{trucks.length}</span> assets
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar text-xs">
          <span className="text-slate-500 font-bold text-[11px] flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {[
            { id: 'all', label: 'All Fleets' },
            { id: 'heavy_truck', label: '🚛 Heavy Trucks' },
            { id: 'fuel_tanker', label: '⛽ Fuel Tankers' },
            { id: 'commercial_bus', label: '🚐 Transport Buses' },
            { id: 'delivery_van', label: '📦 Delivery Vans' },
            { id: 'construction_equipment', label: '🚜 Heavy Machinery' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
                categoryFilter === cat.id
                  ? 'bg-[#0A1F44] text-[#F7941D] border border-[#0A1F44] shadow-sm font-black'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fleet Assets List Grid */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
          <Loader2 className="w-8 h-8 text-[#F7941D] animate-spin" />
          <p className="text-xs font-bold text-slate-500">Loading fleet assets & trackers...</p>
        </div>
      ) : filteredTrucks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-4 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
            <Truck className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-slate-900">No Fleet Assets Found</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              {searchQuery || categoryFilter !== 'all'
                ? 'No fleet asset matched your search or category filter.'
                : 'No vehicles or magnetic trackers have been registered yet for your company.'}
            </p>
          </div>
          {canCreateTruck && !searchQuery && categoryFilter === 'all' && (
            <button
              onClick={handleOpenAddModal}
              className="mt-2 bg-[#F7941D] hover:bg-[#e08215] text-[#0A1F44] font-black px-5 py-2.5 rounded-2xl text-xs transition-colors cursor-pointer shadow-md shadow-[#F7941D]/20"
            >
              Register First Asset
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTrucks.map((truck) => {
            const badge = getBadgeState(truck);
            const isChangingThisPlan = planChangingTruckId === truck.id;
            const AssetIcon = getAssetIcon(truck.asset_type);
            const assetLabel = getAssetLabel(truck.asset_type);

            return (
              <div
                key={truck.id}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-3xl p-5 shadow-xs hover:shadow-md flex flex-col justify-between gap-4 transition-all group"
                id={`truck-card-${truck.id}`}
              >
                {/* Card Top Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    {/* Plate Number & Category Icon */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-11 h-11 rounded-2xl bg-[#0A1F44] border border-[#15346A] flex items-center justify-center text-[#F7941D] shrink-0 shadow-xs">
                        <AssetIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black uppercase text-[#0A1F44] tracking-wider">
                            {assetLabel}
                          </span>
                        </div>
                        <h4 className="text-base font-black text-slate-900 uppercase tracking-wider mt-0.5">
                          <span className="inline-block bg-[#0A1F44] text-[#F7941D] px-2.5 py-0.5 rounded-lg font-mono font-black text-xs tracking-wider border border-[#15346A]">
                            {truck.plate_number}
                          </span>
                        </h4>
                        {truck.asset_name && (
                          <p className="text-[11px] text-slate-500 font-medium truncate max-w-[140px] mt-0.5">
                            {truck.asset_name}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Interactive Payment Plan Badge */}
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        {canChangePaymentPlan && (
                          <button
                            type="button"
                            onClick={() => handleOpenPlanSelector(truck)}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0A1F44] border border-slate-200 transition-all cursor-pointer hover:scale-105 active:scale-95"
                            title="Edit Billing Plan"
                            id={`edit-plan-pencil-${truck.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => canChangePaymentPlan && handleOpenPlanSelector(truck)}
                          disabled={!canChangePaymentPlan || isChangingThisPlan}
                          className={`px-3 py-1.5 rounded-2xl border text-xs font-extrabold flex items-center gap-2 transition-all shadow-xs ${badge.bg} ${
                            canChangePaymentPlan
                              ? 'hover:scale-105 cursor-pointer active:scale-95'
                              : 'cursor-default'
                          }`}
                          title={canChangePaymentPlan ? 'Tap to change payment plan' : 'Payment Plan'}
                          id={`plan-badge-${truck.id}`}
                        >
                          {isChangingThisPlan ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F7941D]" />
                          ) : (
                            <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                          )}
                          <span>{badge.label}</span>

                          {canChangePaymentPlan && (
                            <ChevronDown className="w-3.5 h-3.5 opacity-80 shrink-0 text-slate-600 group-hover:text-[#0A1F44] transition-colors" />
                          )}
                        </button>
                      </div>

                      <div className="text-right">
                        {canChangePaymentPlan ? (
                          <span
                            onClick={() => handleOpenPlanSelector(truck)}
                            className="text-[10px] font-bold text-[#0A1F44] hover:underline cursor-pointer flex items-center justify-end gap-1"
                          >
                            <span>Tap to change plan</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400">{badge.subtitle}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Magnetic Tracker Hardware Section */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 font-bold flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-emerald-600" />
                        Magnetic Tracker
                      </span>
                      {truck.tracker_id ? (
                        <span className="font-mono text-emerald-800 font-extrabold text-[11px] bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200">
                          {truck.tracker_id}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic font-semibold">
                          Snap & pair before trip
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200 text-slate-500">
                      <span className="flex items-center gap-1 font-medium">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                        Hardware: {truck.tracker_model ? truck.tracker_model.toUpperCase().replace('_', ' ') : 'TK905'}
                      </span>
                      <span className="flex items-center gap-1 text-slate-700 font-bold">
                        <Battery className="w-3 h-3 text-emerald-600" />
                        {truck.tracker_battery_level !== undefined ? `${truck.tracker_battery_level}%` : 'Standby'}
                      </span>
                    </div>
                  </div>

                  {/* Driver / Operator Details */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-bold flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Driver / Operator
                      </span>
                      <span className="font-extrabold text-slate-900">{truck.driver_name}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                      <span className="text-slate-500 font-bold flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        Phone
                      </span>
                      <a
                        href={`tel:${truck.driver_phone}`}
                        className="font-extrabold text-[#0A1F44] hover:text-[#F7941D] hover:underline flex items-center gap-1"
                      >
                        {truck.driver_phone}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Card Footer / Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    Added {new Date(truck.created_at || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>

                  {(canEditTruck || canDeleteTruck) && (
                    <div className="flex items-center gap-1.5">
                      {canEditTruck && (
                        <button
                          onClick={() => handleOpenEditModal(truck)}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                          title="Edit Fleet Asset"
                          id={`edit-truck-btn-${truck.id}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      )}
                      {canDeleteTruck && (
                        <button
                          onClick={() => setDeletingTruckId(truck.id)}
                          className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors cursor-pointer border border-rose-200"
                          title="Delete Asset"
                          id={`delete-truck-btn-${truck.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Fleet Asset Modal */}
      <TruckModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTruck}
        editingTruck={editingTruck}
        isSaving={isSaving}
        error={modalError}
        setError={setModalError}
      />

      {/* Payment Plan Selector Modal */}
      {selectedTruckForPlan && (
        <div
          id="plan-selector-modal-overlay"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-fadeIn"
        >
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col my-4">
            
            {/* Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Select Billing Plan</h3>
                  <p className="text-xs text-orange-600 font-bold uppercase tracking-wider">
                    {selectedTruckForPlan.plate_number} • {selectedTruckForPlan.driver_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTruckForPlan(null)}
                className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                id="close-plan-selector-btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error in Plan Selector */}
            {planSelectorError && (
              <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{planSelectorError}</span>
              </div>
            )}

            {/* Plan Options List */}
            <div className="p-6 space-y-3">
              <p className="text-xs font-medium text-slate-500 mb-1">
                Choose how tracking charges should be billed for this fleet asset:
              </p>

              {/* Option 1: Per Trip */}
              <button
                type="button"
                onClick={() => setSelectedPlanOption('per_trip')}
                className={`w-full p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center justify-between gap-4 ${
                  selectedPlanOption === 'per_trip'
                    ? 'bg-blue-50/80 border-blue-500 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
                id="select-option-per-trip"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    selectedPlanOption === 'per_trip' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">🔵 Per Trip</span>
                      <span className="text-[11px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                        ₦1,000 / trip
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pay ₦1,000 per haulage or transit trip
                    </p>
                  </div>
                </div>

                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selectedPlanOption === 'per_trip' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                }`}>
                  {selectedPlanOption === 'per_trip' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </button>

              {/* Option 2: Monthly */}
              <button
                type="button"
                onClick={() => setSelectedPlanOption('monthly')}
                className={`w-full p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center justify-between gap-4 ${
                  selectedPlanOption === 'monthly'
                    ? 'bg-amber-50/80 border-[#F7941D] shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
                id="select-option-monthly"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    selectedPlanOption === 'monthly' ? 'bg-[#0A1F44] text-[#F7941D]' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">Monthly Subscription</span>
                      <span className="text-[11px] font-black bg-[#F7941D]/20 text-[#0A1F44] px-2 py-0.5 rounded-full border border-[#F7941D]/30">
                        ₦3,500 / month
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Unlimited trips per month per fleet asset
                    </p>
                  </div>
                </div>

                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selectedPlanOption === 'monthly' ? 'border-[#F7941D] bg-[#F7941D] text-[#0A1F44]' : 'border-slate-300'
                }`}>
                  {selectedPlanOption === 'monthly' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </button>

            </div>

            {/* Actions */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleConfirmPlanChange}
                disabled={!!planChangingTruckId}
                className="w-full bg-[#F7941D] hover:bg-[#e08215] disabled:opacity-50 text-[#0A1F44] font-black py-3 rounded-2xl text-xs transition-colors flex items-center justify-center gap-2 shadow-md shadow-[#F7941D]/20 cursor-pointer"
                id="confirm-plan-change-btn"
              >
                {planChangingTruckId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#0A1F44]" />
                    <span>Updating Plan...</span>
                  </>
                ) : (
                  <span>Confirm Plan Change</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedTruckForPlan(null)}
                disabled={!!planChangingTruckId}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-xs transition-colors cursor-pointer"
                id="cancel-plan-change-btn"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {deletingTruckId && (
        <div
          id="delete-truck-modal-overlay"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
        >
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">Delete Fleet Asset?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to delete this asset profile? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTruckId(null)}
                disabled={isDeleting}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-xs transition-colors cursor-pointer"
                id="cancel-delete-truck-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTruck(deletingTruckId)}
                disabled={isDeleting}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-black py-3 rounded-2xl text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 cursor-pointer"
                id="confirm-delete-truck-btn"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Delete</span>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
