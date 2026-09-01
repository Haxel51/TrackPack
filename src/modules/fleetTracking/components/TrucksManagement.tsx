import React, { useState, useEffect } from 'react';
import { TruckProfile } from '../types';
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
      setError(res.error || 'Failed to load truck profiles.');
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
    driver_name: string;
    driver_phone: string;
    payment_plan: 'per_trip' | 'monthly';
  }) => {
    setIsSaving(true);
    setModalError(null);

    if (editingTruck) {
      const res = await updateTruckProfile(token, editingTruck.id, payload);
      if (res.success) {
        showSuccessNotice(`Truck profile "${payload.plate_number}" updated successfully.`);
        setIsModalOpen(false);
        loadTrucks();
      } else {
        setModalError(res.error || 'Failed to update truck profile');
      }
    } else {
      const res = await createTruckProfile(token, payload);
      if (res.success) {
        showSuccessNotice(`Truck profile "${payload.plate_number}" created successfully.`);
        setIsModalOpen(false);
        loadTrucks();
      } else {
        setModalError(res.error || 'Failed to create truck profile');
      }
    }
    setIsSaving(false);
  };

  // Open plan selector modal when user taps badge or pencil icon
  const handleOpenPlanSelector = (truck: TruckProfile) => {
    if (!canManageTrucks) return;
    setSelectedTruckForPlan(truck);
    setSelectedPlanOption(truck.payment_plan || 'per_trip');
    setPlanSelectorError(null);
  };

  // Confirm plan change from the bottom sheet / modal
  const handleConfirmPlanChange = async () => {
    if (!selectedTruckForPlan || !canManageTrucks) return;

    setPlanChangingTruckId(selectedTruckForPlan.id);
    setPlanSelectorError(null);

    const res = await changeTruckPaymentPlan(token, selectedTruckForPlan.id, selectedPlanOption);
    if (res.success) {
      if (selectedPlanOption === 'per_trip') {
        showSuccessNotice(`Payment plan for "${selectedTruckForPlan.plate_number}" updated to Per Trip.`);
      } else {
        showSuccessNotice(`Payment plan for "${selectedTruckForPlan.plate_number}" updated to Monthly (Pending trip payment activation).`);
      }
      setSelectedTruckForPlan(null);
      loadTrucks();
    } else {
      setPlanSelectorError(res.error || 'Failed to update payment plan');
    }
    setPlanChangingTruckId(null);
  };

  const handleDeleteTruck = async (truckId: string) => {
    setIsDeleting(true);
    const res = await deleteTruckProfile(token, truckId);
    if (res.success) {
      showSuccessNotice('Truck profile deleted successfully.');
      setDeletingTruckId(null);
      loadTrucks();
    } else {
      setError(res.error || 'Failed to delete truck profile.');
    }
    setIsDeleting(false);
  };

  const filteredTrucks = trucks.filter((t) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (t.plate_number || '').toLowerCase().includes(query) ||
      (t.driver_name || '').toLowerCase().includes(query) ||
      (t.driver_phone || '').toLowerCase().includes(query)
    );
  });

  // 4 Badge States as requested
  const getBadgeState = (truck: TruckProfile) => {
    // State 1: Per Trip
    if (truck.payment_plan === 'per_trip') {
      return {
        label: 'Per Trip',
        bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:border-blue-400',
        dot: 'bg-blue-400',
        subtitle: '₦1,000 / trip',
      };
    }

    // State 4: Monthly - Pending Payment (null or empty subscription_active_until)
    if (!truck.subscription_active_until) {
      return {
        label: 'Monthly - Pending Payment',
        bg: 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:border-orange-400',
        dot: 'bg-orange-400',
        subtitle: 'Plan set • Pending trip activation',
      };
    }

    const expTime = new Date(truck.subscription_active_until).getTime();
    const isActive = expTime > Date.now();

    // State 2: Monthly Active (future date)
    if (isActive) {
      const expDate = new Date(truck.subscription_active_until).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      return {
        label: 'Monthly Active',
        bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:border-emerald-400',
        dot: 'bg-emerald-400',
        subtitle: `Active until ${expDate}`,
      };
    }

    // State 3: Monthly Expired (past date)
    const expDate = new Date(truck.subscription_active_until).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return {
      label: 'Monthly Expired',
      bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:border-amber-400',
      dot: 'bg-amber-400',
      subtitle: `Expired on ${expDate}`,
    };
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Control Header */}
      <div className="bg-[#0b1329] border border-blue-950/60 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400 mb-1">
              <Truck className="w-4 h-4" />
              <span>Fleet Truck Profiles</span>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Registered Fleet Trucks & Payment Plans
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Manage truck records, driver contact information, and payment plan subscriptions (Per Trip vs Monthly).
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={loadTrucks}
              disabled={loading}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl border border-blue-900/65 transition-colors cursor-pointer"
              title="Refresh Trucks"
              id="refresh-trucks-btn"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {canCreateTruck && (
              <button
                onClick={handleOpenAddModal}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-5 py-3 rounded-2xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                id="add-truck-btn"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Add Truck Profile</span>
              </button>
            )}
          </div>
        </div>

        {!canCreateTruck && !canEditTruck && (
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center gap-2.5 text-xs text-blue-300 font-medium">
            <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0" />
            <span>You have read-only access. Manager or CEO role is required to add or edit truck profiles.</span>
          </div>
        )}
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-300 text-xs font-bold animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-300 text-xs font-bold animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Bar & Summary Count */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search plate number, driver..."
            className="w-full bg-[#0b1329] border border-blue-950/60 rounded-2xl pl-11 pr-4 py-3 text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            id="truck-search-input"
          />
        </div>

        <div className="text-xs text-slate-400 font-bold self-end sm:self-center">
          Showing <span className="text-white font-extrabold">{filteredTrucks.length}</span> of{' '}
          <span className="text-white font-extrabold">{trucks.length}</span> truck profiles
        </div>
      </div>

      {/* Trucks List Grid */}
      {loading ? (
        <div className="bg-[#0b1329] border border-blue-950/60 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-xs font-bold text-slate-400">Loading fleet truck profiles...</p>
        </div>
      ) : filteredTrucks.length === 0 ? (
        <div className="bg-[#0b1329] border border-blue-950/60 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-slate-800/80 border border-blue-900/65 flex items-center justify-center text-slate-500">
            <Truck className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-white">No Truck Profiles Found</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              {searchQuery
                ? `No truck matched "${searchQuery}". Try searching a different plate or driver name.`
                : 'No truck profiles have been registered yet for your company.'}
            </p>
          </div>
          {canCreateTruck && !searchQuery && (
            <button
              onClick={handleOpenAddModal}
              className="mt-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-5 py-2.5 rounded-2xl text-xs transition-colors cursor-pointer"
            >
              Add First Truck
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTrucks.map((truck) => {
            const badge = getBadgeState(truck);
            const isChangingThisPlan = planChangingTruckId === truck.id;

            return (
              <div
                key={truck.id}
                className="bg-[#0b1329] border border-blue-950/60 hover:border-blue-900/65 rounded-3xl p-5 shadow-lg flex flex-col justify-between gap-4 transition-all group"
                id={`truck-card-${truck.id}`}
              >
                {/* Card Top Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    {/* Plate Number */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-blue-900/65 flex items-center justify-center text-amber-400 shrink-0">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-black uppercase text-amber-400 tracking-wider">Plate Number</span>
                        <h4 className="text-base font-black text-white uppercase tracking-wider">
                          {truck.plate_number}
                        </h4>
                      </div>
                    </div>

                    {/* Interactive Payment Plan Badge with Edit Pencil Icon & Hint */}
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        
                        {/* Pencil Edit Icon next to the badge (Only for CEO who can access billing/plan) */}
                        {canChangePaymentPlan && (
                          <button
                            type="button"
                            onClick={() => handleOpenPlanSelector(truck)}
                            className="p-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all cursor-pointer hover:scale-105 active:scale-95"
                            title="Edit Payment Plan"
                            id={`edit-plan-pencil-${truck.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Interactive Tappable Badge Button with Chevron */}
                        <button
                          type="button"
                          onClick={() => canChangePaymentPlan && handleOpenPlanSelector(truck)}
                          disabled={!canChangePaymentPlan || isChangingThisPlan}
                          className={`px-3 py-1.5 rounded-2xl border text-xs font-extrabold flex items-center gap-2 transition-all shadow-sm ${badge.bg} ${
                            canChangePaymentPlan
                              ? 'hover:scale-105 cursor-pointer active:scale-95 ring-1 ring-amber-500/20 hover:ring-amber-500/40'
                              : 'cursor-default'
                          }`}
                          title={canChangePaymentPlan ? 'Tap to change payment plan' : 'Payment Plan'}
                          id={`plan-badge-${truck.id}`}
                        >
                          {isChangingThisPlan ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          ) : (
                            <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                          )}
                          <span>{badge.label}</span>

                          {/* Chevron Arrow indicating dropdown interactivity */}
                          {canChangePaymentPlan && (
                            <ChevronDown className="w-3.5 h-3.5 opacity-80 shrink-0 text-slate-300 group-hover:text-amber-400 transition-colors" />
                          )}
                        </button>

                      </div>

                      {/* Instruction hint text below the badge */}
                      <div className="text-right">
                        {canChangePaymentPlan ? (
                          <span
                            onClick={() => handleOpenPlanSelector(truck)}
                            className="text-[10px] font-bold text-amber-400/90 hover:underline cursor-pointer flex items-center justify-end gap-1"
                          >
                            <span>Tap to change plan</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-500">{badge.subtitle}</span>
                        )}
                      </div>

                    </div>
                  </div>

                  {/* Driver Details */}
                  <div className="bg-[#070b19]/80 border border-blue-950/60/80 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-bold flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Driver
                      </span>
                      <span className="font-extrabold text-white">{truck.driver_name}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-blue-950/60/50">
                      <span className="text-slate-500 font-bold flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        Phone
                      </span>
                      <a
                        href={`tel:${truck.driver_phone}`}
                        className="font-extrabold text-amber-400 hover:underline flex items-center gap-1"
                      >
                        {truck.driver_phone}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Card Footer / Actions */}
                <div className="pt-3 border-t border-blue-950/60/80 flex items-center justify-between text-xs text-slate-500">
                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-600" />
                    Added {new Date(truck.created_at || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>

                  {(canEditTruck || canDeleteTruck) && (
                    <div className="flex items-center gap-1.5">
                      {canEditTruck && (
                        <button
                          onClick={() => handleOpenEditModal(truck)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                          title="Edit Truck Profile"
                          id={`edit-truck-btn-${truck.id}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      )}
                      {canDeleteTruck && (
                        <button
                          onClick={() => setDeletingTruckId(truck.id)}
                          className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-colors cursor-pointer"
                          title="Delete Truck Profile"
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

      {/* Add / Edit Truck Modal */}
      <TruckModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTruck}
        editingTruck={editingTruck}
        isSaving={isSaving}
        error={modalError}
        setError={setModalError}
      />

      {/* Payment Plan Selector Modal / Bottom Sheet */}
      {selectedTruckForPlan && (
        <div
          id="plan-selector-modal-overlay"
          className="fixed inset-0 z-50 bg-[#070b19]/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fadeIn"
        >
          <div className="bg-[#0b1329] border border-blue-950/60 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col my-4">
            
            {/* Header */}
            <div className="bg-[#070b19] px-6 py-4 border-b border-blue-950/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Select Payment Plan</h3>
                  <p className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                    {selectedTruckForPlan.plate_number} • {selectedTruckForPlan.driver_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTruckForPlan(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/80 transition-colors cursor-pointer"
                id="close-plan-selector-btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error in Plan Selector */}
            {planSelectorError && (
              <div className="mx-6 mt-4 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-rose-300 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{planSelectorError}</span>
              </div>
            )}

            {/* Plan Options List */}
            <div className="p-6 space-y-3">
              <p className="text-xs font-medium text-slate-400 mb-1">
                Choose how haulage charges should be billed for this truck:
              </p>

              {/* Option 1: Per Trip */}
              <button
                type="button"
                onClick={() => setSelectedPlanOption('per_trip')}
                className={`w-full p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center justify-between gap-4 ${
                  selectedPlanOption === 'per_trip'
                    ? 'bg-blue-500/10 border-blue-500 shadow-lg shadow-blue-500/10'
                    : 'bg-[#070b19] border-blue-950/60 hover:border-blue-900/65'
                }`}
                id="select-option-per-trip"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    selectedPlanOption === 'per_trip' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-white">🔵 Per Trip</span>
                      <span className="text-[11px] font-black bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
                        ₦1,000 / trip
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Pay ₦1,000 per haulage dispatch
                    </p>
                  </div>
                </div>

                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selectedPlanOption === 'per_trip' ? 'border-blue-500 bg-blue-500 text-white' : 'border-blue-900/65'
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
                    ? 'bg-orange-500/10 border-orange-500 shadow-lg shadow-orange-500/10'
                    : 'bg-[#070b19] border-blue-950/60 hover:border-blue-900/65'
                }`}
                id="select-option-monthly"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    selectedPlanOption === 'monthly' ? 'bg-orange-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}>
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-white">🟠 Monthly Subscription</span>
                      <span className="text-[11px] font-black bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/30">
                        ₦3,500 / month
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Unlimited trips per month per truck
                    </p>
                  </div>
                </div>

                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selectedPlanOption === 'monthly' ? 'border-orange-500 bg-orange-500 text-slate-950' : 'border-blue-900/65'
                }`}>
                  {selectedPlanOption === 'monthly' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </button>

            </div>

            {/* Actions */}
            <div className="bg-[#070b19] px-6 py-4 border-t border-blue-950/60 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleConfirmPlanChange}
                disabled={!!planChangingTruckId}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black py-3 rounded-2xl text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                id="confirm-plan-change-btn"
              >
                {planChangingTruckId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
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
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-2xl text-xs transition-colors cursor-pointer"
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
          className="fixed inset-0 z-50 bg-[#070b19]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
        >
          <div className="bg-[#0b1329] border border-blue-950/60 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-white">Delete Truck Profile?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Are you sure you want to delete this truck profile? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTruckId(null)}
                disabled={isDeleting}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-2xl text-xs transition-colors cursor-pointer"
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

