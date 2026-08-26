import React, { useState, useEffect } from 'react';
import { SupplierLocation } from '../types';
import {
  getSupplierLocations,
  createSupplierLocation,
  updateSupplierLocation,
  confirmSupplierLocation,
  deleteSupplierLocation,
} from '../api';
import { LocationConfirmModal } from './LocationConfirmModal';
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
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface SuppliersManagementProps {
  token: string;
  userName?: string;
}

export const SuppliersManagement: React.FC<SuppliersManagementProps> = ({ token, userName }) => {
  const [suppliers, setSuppliers] = useState<SupplierLocation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'confirmed' | 'unconfirmed'>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add / Edit Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierLocation | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formAddress, setFormAddress] = useState<string>('');
  const [savingForm, setSavingForm] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (sup: SupplierLocation) => {
    setEditingSupplier(sup);
    setFormName(sup.name);
    setFormAddress(sup.address_text);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formAddress.trim()) {
      setFormError('Supplier Name and Address are required.');
      return;
    }

    setSavingForm(true);
    setFormError(null);
    try {
      if (editingSupplier) {
        const res = await updateSupplierLocation(token, editingSupplier.id, {
          name: formName.trim(),
          address_text: formAddress.trim(),
        });
        if (res.success && res.supplier) {
          setSuppliers((prev) => prev.map((s) => (s.id === editingSupplier.id ? res.supplier! : s)));
          setIsFormModalOpen(false);
          setMessage({ type: 'success', text: `Updated "${res.supplier.name}" successfully.` });
        } else {
          setFormError(res.error || 'Failed to update supplier.');
        }
      } else {
        const res = await createSupplierLocation(token, {
          name: formName.trim(),
          address_text: formAddress.trim(),
        });
        if (res.success && res.supplier) {
          setSuppliers((prev) => [res.supplier!, ...prev]);
          setIsFormModalOpen(false);
          setMessage({ type: 'success', text: `Added supplier "${res.supplier.name}". Click "Confirm Location" to set GPS coordinates.` });
        } else {
          setFormError(res.error || 'Failed to create supplier.');
        }
      }
    } catch (err: any) {
      setFormError(err?.message || 'Error saving supplier.');
    } finally {
      setSavingForm(false);
    }
  };

  const handleConfirmLocation = async (lat: number, lng: number) => {
    if (!confirmingSupplier) return;
    const res = await confirmSupplierLocation(token, confirmingSupplier.id, {
      lat,
      lng,
      confirmed_by: userName || 'Manager',
    });
    if (res.success && res.supplier) {
      setSuppliers((prev) => prev.map((s) => (s.id === confirmingSupplier.id ? res.supplier! : s)));
      setMessage({ type: 'success', text: `Confirmed coordinates for "${res.supplier.name}".` });
      setConfirmingSupplier(null);
    } else {
      throw new Error(res.error || 'Failed to confirm supplier location.');
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
        setMessage({ type: 'error', text: res.error || 'Failed to delete supplier.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Error deleting supplier.' });
    } finally {
      setDeleting(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.address_text.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (filterStatus === 'confirmed') return s.location_confirmed;
    if (filterStatus === 'unconfirmed') return !s.location_confirmed;
    return true;
  });

  const confirmedCount = suppliers.filter((s) => s.location_confirmed).length;
  const unconfirmedCount = suppliers.length - confirmedCount;

  return (
    <div className="space-y-6">
      {/* Header card with action & stats */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0">
              <Building className="w-6 h-6 text-[#0A1F44]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-[#0A1F44]">Supplier & Factory Locations</h3>
                <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
                  {suppliers.length} Total
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Register destinations (e.g. BUA Factory, Ibeto Cement) and confirm their GPS coordinates.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              onClick={fetchSuppliers}
              disabled={loading}
              className="p-2.5 text-slate-400 hover:text-[#0A1F44] hover:bg-slate-50 rounded-2xl transition-colors cursor-pointer"
              title="Refresh Suppliers"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleOpenAddModal}
              className="bg-[#0A1F44] hover:bg-blue-900 text-white font-extrabold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-lg"
            >
              <Plus className="w-4 h-4 text-[#F2A93B]" />
              <span>Add Supplier Location</span>
            </button>
          </div>
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

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-grow w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search suppliers by name or address..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-[#0A1F44] focus:bg-white rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold outline-hidden transition-all text-slate-800"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl shrink-0 w-full sm:w-auto">
            <button
              onClick={() => setFilterStatus('all')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'all' ? 'bg-white text-[#0A1F44] shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({suppliers.length})
            </button>
            <button
              onClick={() => setFilterStatus('confirmed')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'confirmed' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🟢 Confirmed ({confirmedCount})
            </button>
            <button
              onClick={() => setFilterStatus('unconfirmed')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'unconfirmed' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              🟡 Unconfirmed ({unconfirmedCount})
            </button>
          </div>
        </div>

        {/* Suppliers List */}
        {loading ? (
          <div className="py-12 text-center text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0A1F44]" />
            <p className="text-xs font-semibold">Loading supplier locations...</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200 p-6 space-y-3">
            <Building className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-black text-slate-700">No Supplier Locations Found</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchTerm || filterStatus !== 'all'
                  ? 'No suppliers match your current filter criteria.'
                  : 'Start by adding company supplier or customer destination locations (e.g. BUA Factory, Dangote Depot, Ibeto Cement).'}
              </p>
            </div>
            {suppliers.length === 0 && (
              <button
                onClick={handleOpenAddModal}
                className="bg-[#0A1F44] text-white font-extrabold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 hover:bg-blue-900 transition-all cursor-pointer shadow-xs mt-2"
              >
                <Plus className="w-3.5 h-3.5 text-[#F2A93B]" />
                <span>Add First Supplier</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSuppliers.map((sup) => {
              const isConfirmed = Boolean(sup.location_confirmed && sup.lat && sup.lng);
              return (
                <div
                  key={sup.id}
                  className={`bg-white border rounded-3xl p-5 transition-all shadow-xs hover:shadow-md flex flex-col justify-between space-y-4 ${
                    isConfirmed ? 'border-slate-200/80 hover:border-slate-300' : 'border-amber-200 bg-amber-50/10'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Row: Name and Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                          <Building className="w-4 h-4 text-[#0A1F44]" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-[#0A1F44] leading-tight">{sup.name}</h4>
                          <span className="text-[10px] text-slate-400">Added {new Date(sup.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div>
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
                    </div>

                    {/* Address block */}
                    <div className="bg-slate-50/80 rounded-2xl p-3 text-xs space-y-1">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="text-slate-700 font-semibold leading-snug">{sup.address_text}</span>
                      </div>
                      {isConfirmed && (
                        <div className="text-[11px] text-slate-500 pl-5 pt-1 font-mono">
                          GPS: {sup.lat?.toFixed(5)}, {sup.lng?.toFixed(5)}
                        </div>
                      )}
                    </div>

                    {/* Audit Info if confirmed */}
                    {isConfirmed && sup.confirmed_by && (
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>Confirmed by {sup.confirmed_by}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(sup)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                        title="Edit Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingSupplier(sup)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Delete Supplier"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => setConfirmingSupplier(sup)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                        isConfirmed
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          : 'bg-[#F2A93B] hover:bg-[#d9922b] text-[#0A1F44]'
                      }`}
                    >
                      <MapPin className="w-3 h-3" />
                      <span>{isConfirmed ? 'View / Update Map' : 'Confirm Location 📍'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Supplier Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100 my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0A1F44] flex items-center justify-center font-black">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0A1F44]">
                    {editingSupplier ? 'Edit Supplier Location' : 'Add New Supplier Location'}
                  </h3>
                  <p className="text-xs text-slate-500">Destination for fleet cargo dispatches</p>
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
                  Supplier / Destination Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. BUA Factory, Ibeto Cement, Dangote Depot"
                  disabled={savingForm}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#0A1F44] focus:bg-white rounded-2xl px-3.5 py-2.5 text-xs font-semibold outline-hidden transition-all text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  Physical Address / Destination Area <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="e.g. Km 12 Port Harcourt - Aba Expressway, Port Harcourt"
                  rows={3}
                  disabled={savingForm}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#0A1F44] focus:bg-white rounded-2xl px-3.5 py-2.5 text-xs font-semibold outline-hidden transition-all text-slate-800"
                />
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
                    <span>{editingSupplier ? 'Save Changes' : 'Create Location'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-100 my-8">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-[#0A1F44]">Delete Supplier Location?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to remove <strong>"{deletingSupplier.name}"</strong>? This will remove its confirmed GPS coordinates from your destinations list.
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

      {/* Confirm Coordinates Modal */}
      {confirmingSupplier && (
        <LocationConfirmModal
          isOpen={Boolean(confirmingSupplier)}
          onClose={() => setConfirmingSupplier(null)}
          title="Confirm Supplier Location"
          locationName={confirmingSupplier.name}
          locationType="supplier"
          addressText={confirmingSupplier.address_text}
          initialLat={confirmingSupplier.lat}
          initialLng={confirmingSupplier.lng}
          onConfirm={handleConfirmLocation}
        />
      )}
    </div>
  );
};
