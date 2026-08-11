import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getManagerOverview,
  getManagerStaff,
  createManagerStaff,
  toggleManagerStaffStatus,
  resetManagerStaffPin,
  deleteManagerStaff,
  getManagerWaybills
} from '../lib/api';
import {
  Building2, MapPin, Users, Package, DollarSign, Plus, RefreshCw, Key,
  CheckCircle, XCircle, LogOut, Search, Filter, ShieldCheck, UserCheck, AlertCircle, Eye, Trash2, Power
} from 'lucide-react';

export const ManagerDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();

  const [overview, setOverview] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [waybills, setWaybills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'staff' | 'waybills'>('overview');

  // Search & Filter for waybills
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Create Staff Modal State
  const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [createStaffLoading, setCreateStaffLoading] = useState(false);
  const [createStaffError, setCreateStaffError] = useState<string | null>(null);

  // One-time PIN display modal
  const [pinModal, setPinModal] = useState<{ title: string; name: string; pin: string } | null>(null);

  // Reusable custom confirmation modal state
  const [customConfirmModal, setCustomConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    submitting: boolean;
    error: string | null;
    onConfirm: () => Promise<void> | void;
  }>({
    open: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    submitting: false,
    error: null,
    onConfirm: () => {},
  });

  const showCustomConfirm = ({
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
  }: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => Promise<void>;
  }) => {
    setCustomConfirmModal({
      open: true,
      title,
      message,
      confirmText,
      cancelText,
      submitting: false,
      error: null,
      onConfirm: async () => {
        setCustomConfirmModal(prev => ({ ...prev, submitting: true, error: null }));
        try {
          await onConfirm();
          setCustomConfirmModal(prev => ({ ...prev, open: false, submitting: false }));
        } catch (err: any) {
          setCustomConfirmModal(prev => ({ ...prev, submitting: false, error: err.message || 'Action failed' }));
        }
      },
    });
  };

  const fetchData = async () => {
    if (!token) return;
    try {
      setError(null);
      const [ovRes, staffRes, wbRes] = await Promise.all([
        getManagerOverview(token),
        getManagerStaff(token),
        getManagerWaybills(token)
      ]);

      if (ovRes.success) setOverview(ovRes);
      if (staffRes.success) setStaffList(staffRes.staff || []);
      if (wbRes.success) setWaybills(wbRes.waybills || []);
    } catch (err) {
      console.error('Error fetching manager dashboard data:', err);
      setError('Failed to load dashboard data. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeToken = token || localStorage.getItem('auth_token');
    if (!activeToken) return;
    if (!newStaffName.trim()) {
      setCreateStaffError('Staff name is required.');
      return;
    }

    if (newStaffPhone.trim() && !/^\d{11}$/.test(newStaffPhone.trim())) {
      setCreateStaffError('Phone number must be a valid 11-digit phone number (e.g. 08012345678).');
      return;
    }

    setCreateStaffLoading(true);
    setCreateStaffError(null);

    try {
      const res = await createManagerStaff(activeToken, {
        name: newStaffName.trim(),
        phone: newStaffPhone.trim() || undefined
      });

      if (res.success) {
        setShowCreateStaffModal(false);
        setNewStaffName('');
        setNewStaffPhone('');
        setPinModal({
          title: 'New Staff PIN Generated',
          name: res.staff.name,
          pin: res.pin
        });
        fetchData();
      } else {
        setCreateStaffError(res.error || 'Failed to create staff.');
      }
    } catch (err) {
      setCreateStaffError('An error occurred. Please try again.');
    } finally {
      setCreateStaffLoading(false);
    }
  };

  const handleToggleStaff = (staffId: string, staffName: string, currentActive: boolean) => {
    const activeToken = token || localStorage.getItem('auth_token');
    if (!activeToken) return;
    const actionText = currentActive ? 'deactivate' : 'activate';

    showCustomConfirm({
      title: `${currentActive ? 'Deactivate' : 'Activate'} Staff Access?`,
      message: `Are you sure you want to ${actionText} staff member "${staffName}"? They will ${currentActive ? 'no longer' : 'now'} be able to sign in and process waybills.`,
      confirmText: currentActive ? 'Yes, Deactivate' : 'Yes, Activate',
      onConfirm: async () => {
        const res = await toggleManagerStaffStatus(activeToken, staffId);
        if (res.success) {
          fetchData();
        } else {
          throw new Error(res.error || 'Failed to toggle staff status.');
        }
      }
    });
  };

  const handleResetPin = (staffId: string, staffName: string) => {
    const activeToken = token || localStorage.getItem('auth_token');
    if (!activeToken) return;

    showCustomConfirm({
      title: 'Reset Staff PIN?',
      message: `Are you sure you want to reset "${staffName}"'s PIN? A new secure 4-digit PIN will be generated and shown to you immediately. Their previous PIN will stop working.`,
      confirmText: 'Reset PIN',
      onConfirm: async () => {
        const res = await resetManagerStaffPin(activeToken, staffId);
        if (res.success) {
          setPinModal({
            title: 'Staff PIN Reset',
            name: res.name || staffName,
            pin: res.pin
          });
          fetchData();
        } else {
          throw new Error(res.error || 'Failed to reset PIN.');
        }
      }
    });
  };

  const handleDeleteStaff = (staffId: string, staffName: string) => {
    const activeToken = token || localStorage.getItem('auth_token');
    if (!activeToken) return;

    showCustomConfirm({
      title: 'Permanently Delete Staff?',
      message: `Are you sure you want to permanently delete staff member "${staffName}"? This action cannot be undone. They will lose all access immediately.`,
      confirmText: 'Delete Permanently',
      onConfirm: async () => {
        const res = await deleteManagerStaff(activeToken, staffId);
        if (res.success) {
          fetchData();
        } else {
          throw new Error(res.error || 'Failed to delete staff member.');
        }
      }
    });
  };

  // Filtered waybills
  const filteredWaybills = waybills.filter(wb => {
    const matchesSearch =
      (wb.tracking_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (wb.sender_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (wb.receiver_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (wb.sender_phone || '').includes(searchTerm) ||
      (wb.receiver_phone || '').includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || wb.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-800 pb-12">
      {/* Header */}
      <header className="bg-[#0A1F44] text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#08152B] rounded-2xl border border-amber-400/30 flex items-center justify-center shadow-sm shrink-0">
              <UserCheck className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-lg sm:text-xl text-white">
                  {user?.company_name || overview?.company_name || 'Transport Company'}
                </h1>
                <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase">
                  Manager Portal
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-[#F2A93B]" />
                <span className="font-bold text-white">{user?.park_location || overview?.park_location || 'Assigned Park'}</span>
                <span>•</span>
                <span>{user?.name || 'Park Manager'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all cursor-pointer disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-200 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex border-t border-white/10 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === 'overview'
                ? 'bg-white text-[#0A1F44] border-[#F2A93B]'
                : 'text-slate-300 hover:text-white border-transparent'
            }`}
          >
            <Building2 className="w-4 h-4" /> Park Overview
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === 'staff'
                ? 'bg-white text-[#0A1F44] border-[#F2A93B]'
                : 'text-slate-300 hover:text-white border-transparent'
            }`}
          >
            <Users className="w-4 h-4" /> Park Staff ({staffList.length})
          </button>
          <button
            onClick={() => setActiveTab('waybills')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 ${
              activeTab === 'waybills'
                ? 'bg-white text-[#0A1F44] border-[#F2A93B]'
                : 'text-slate-300 hover:text-white border-transparent'
            }`}
          >
            <Package className="w-4 h-4" /> Park Waybills ({waybills.length})
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-semibold">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-10 h-10 border-4 border-[#0A1F44]/20 border-t-[#0A1F44] rounded-full animate-spin" />
            <p className="text-sm font-bold text-slate-500">Loading park manager dashboard...</p>
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && overview && (
              <div className="space-y-6">
                {/* Metrics Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Waybill Volume */}
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center">
                        <Package className="w-5 h-5 text-[#0A1F44]" />
                      </div>
                      <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase">Volume</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Park Waybills</p>
                      <p className="text-3xl font-black text-[#0A1F44] mt-1">{overview.stats?.volume?.today || 0} <span className="text-xs text-slate-400 font-semibold">Today</span></p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 block font-semibold">This Week</span>
                        <span className="font-extrabold text-[#0A1F44]">{overview.stats?.volume?.week || 0}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-semibold">This Month</span>
                        <span className="font-extrabold text-[#0A1F44]">{overview.stats?.volume?.month || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Gross Tracking Fees */}
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-amber-600" />
                      </div>
                      <span className="text-xs font-extrabold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full uppercase">Tracking Fee</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gross Tracking Fee Total</p>
                      <p className="text-3xl font-black text-[#0A1F44] mt-1">₦{(overview.stats?.tracking_fees?.today || 0).toLocaleString()} <span className="text-xs text-slate-400 font-semibold">Today</span></p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 block font-semibold">This Week</span>
                        <span className="font-extrabold text-[#0A1F44]">₦{(overview.stats?.tracking_fees?.week || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-semibold">This Month</span>
                        <span className="font-extrabold text-[#0A1F44]">₦{(overview.stats?.tracking_fees?.month || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Gross Shipping Fees */}
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                      </div>
                      <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full uppercase">Shipping Fee</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gross Shipping Fee Total</p>
                      <p className="text-3xl font-black text-[#0A1F44] mt-1">₦{(overview.stats?.shipping_fees?.today || 0).toLocaleString()} <span className="text-xs text-slate-400 font-semibold">Today</span></p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 block font-semibold">This Week</span>
                        <span className="font-extrabold text-[#0A1F44]">₦{(overview.stats?.shipping_fees?.week || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-semibold">This Month</span>
                        <span className="font-extrabold text-[#0A1F44]">₦{(overview.stats?.shipping_fees?.month || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Park Quick Summary Box */}
                <div className="bg-gradient-to-br from-[#0A1F44] to-[#122b5c] text-white rounded-3xl p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-extrabold flex items-center gap-2">
                      <MapPin className="text-[#F2A93B] w-5 h-5" />
                      Park Location: {overview.park_location}
                    </h2>
                    <p className="text-xs text-slate-300">
                      As Manager, you have full supervisory control over staff operations, PIN resets, and waybill volume tracking at this park.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 px-4 py-3 rounded-2xl backdrop-blur-sm">
                    <Users className="w-5 h-5 text-indigo-300" />
                    <div>
                      <p className="text-xs text-slate-300 font-semibold">Active Staff On Duty</p>
                      <p className="text-lg font-black text-white">{overview.stats?.active_staff_count || 0} Staff Members</p>
                    </div>
                  </div>
                </div>

                {/* Recent Park Waybills */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-extrabold text-[#0A1F44]">Recent Waybills at Park</h3>
                    <button
                      onClick={() => setActiveTab('waybills')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                    >
                      View All Waybills →
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-extrabold uppercase">
                          <th className="pb-3">Tracking Code</th>
                          <th className="pb-3">Sender</th>
                          <th className="pb-3">Receiver</th>
                          <th className="pb-3">Route</th>
                          <th className="pb-3">Status</th>
                          <th className="pb-3">Shipping Fee</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {(overview.recent_waybills || []).map((wb: any) => (
                          <tr key={wb.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 font-mono font-bold text-[#0A1F44]">{wb.tracking_code || 'Pending'}</td>
                            <td className="py-3">{wb.sender_name}</td>
                            <td className="py-3">{wb.receiver_name}</td>
                            <td className="py-3">{wb.origin_park} → {wb.destination_park}</td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] uppercase ${
                                wb.status === 'collected' ? 'bg-emerald-100 text-emerald-800' :
                                wb.status === 'arrived' ? 'bg-blue-100 text-blue-800' :
                                wb.status === 'in_transit' ? 'bg-amber-100 text-amber-800' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {wb.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-3 font-extrabold text-[#0A1F44]">₦{(Number(wb.shipping_fee) || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                        {(!overview.recent_waybills || overview.recent_waybills.length === 0) && (
                          <tr>
                            <td colSpan={6} className="text-center py-6 text-slate-400 font-semibold">No recent waybills for this park.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* STAFF TAB */}
            {activeTab === 'staff' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 border border-slate-200/80 rounded-3xl shadow-sm">
                  <div>
                    <h2 className="text-lg font-extrabold text-[#0A1F44]">Park Staff Members</h2>
                    <p className="text-xs text-slate-500">Manage and issue 4-digit PINs for staff operating at {user?.park_location}.</p>
                  </div>
                  <button
                    onClick={() => setShowCreateStaffModal(true)}
                    className="bg-[#0A1F44] hover:bg-[#07152e] text-white font-bold px-4 py-2.5 rounded-2xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add Park Staff
                  </button>
                </div>

                {/* Desktop View: Table */}
                <div className="hidden md:block bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-extrabold uppercase">
                        <tr>
                          <th className="p-4">Staff Name</th>
                          <th className="p-4">Phone Number</th>
                          <th className="p-4">Assigned Park</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {staffList.map((st) => (
                          <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-4 font-bold text-[#0A1F44]">{st.name}</td>
                            <td className="p-4 font-mono">{st.phone || 'N/A'}</td>
                            <td className="p-4">{st.park_location}</td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-full font-extrabold text-[10px] uppercase flex items-center w-max gap-1 ${
                                st.active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {st.active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {st.active ? 'Active' : 'Deactivated'}
                              </span>
                            </td>
                            <td className="p-4 text-right space-x-2">
                              <button
                                onClick={() => handleResetPin(st.id, st.name)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <Key className="w-3.5 h-3.5 text-amber-600" /> Reset PIN
                              </button>
                              <button
                                onClick={() => handleToggleStaff(st.id, st.name, st.active)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                  st.active
                                    ? 'bg-red-50 hover:bg-red-100 text-red-600'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                                }`}
                              >
                                {st.active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleDeleteStaff(st.id, st.name)}
                                className="p-1.5 rounded-lg border-0 cursor-pointer transition-all bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center align-middle"
                                title="Permanently Delete Staff"
                                id={`delete-staff-btn-${st.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {staffList.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-slate-400 font-semibold">No staff members created yet for this park.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile/Tablet View: Card-based grid for responsive, spacious UI */}
                <div className="block md:hidden space-y-4">
                  {staffList.map((st) => (
                    <div key={st.id} className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-extrabold text-[#0A1F44]">{st.name}</p>
                          <p className="text-[11px] font-mono text-slate-500 mt-1">{st.phone || 'No phone number'}</p>
                          <p className="text-[10px] text-slate-400 mt-1 font-medium">{st.park_location}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full font-extrabold text-[9px] uppercase flex items-center gap-1 ${
                          st.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {st.active ? <CheckCircle className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                          {st.active ? 'Active' : 'Deactivated'}
                        </span>
                      </div>

                      {/* Spacious Action buttons with massive touch target and clear spacing */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleResetPin(st.id, st.name)}
                          className="flex items-center justify-center gap-2 py-3 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-100 rounded-2xl text-[11px] font-extrabold transition-colors cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5" /> Reset PIN
                        </button>
                        <button
                          onClick={() => handleToggleStaff(st.id, st.name, st.active)}
                          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl text-[11px] font-extrabold transition-colors cursor-pointer border ${
                            st.active
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" /> {st.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>

                      <button
                        onClick={() => handleDeleteStaff(st.id, st.name)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl text-[10px] font-extrabold transition-colors cursor-pointer border border-red-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Permanently Delete Staff
                      </button>
                    </div>
                  ))}

                  {staffList.length === 0 && (
                    <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center text-slate-400 font-semibold shadow-sm">
                      No staff members created yet for this park.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* WAYBILLS TAB */}
            {activeTab === 'waybills' && (
              <div className="space-y-6">
                {/* Search & Filters */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-lg font-extrabold text-[#0A1F44]">Park Waybill Register</h2>
                      <p className="text-xs text-slate-500">Track and filter all waybills passing through {user?.park_location}.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        placeholder="Search tracking code, sender, receiver..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#FAFAFA] border border-slate-200 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-semibold outline-none focus:border-[#0A1F44]"
                      />
                    </div>
                    <div className="relative">
                      <Filter className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full bg-[#FAFAFA] border border-slate-200 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-semibold outline-none focus:border-[#0A1F44] cursor-pointer"
                      >
                        <option value="all">All Statuses</option>
                        <option value="booked">Booked (Pending Payment)</option>
                        <option value="received_at_park">Received at Park</option>
                        <option value="in_transit">In Transit</option>
                        <option value="arrived">Arrived at Destination</option>
                        <option value="collected">Collected</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Waybills Table */}
                <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-extrabold uppercase">
                        <tr>
                          <th className="p-4">Tracking Code</th>
                          <th className="p-4">Sender</th>
                          <th className="p-4">Receiver</th>
                          <th className="p-4">Origin → Destination</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Payment</th>
                          <th className="p-4">Shipping Fee</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {filteredWaybills.map((wb) => (
                          <tr key={wb.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-4 font-mono font-bold text-[#0A1F44]">{wb.tracking_code || 'Pending'}</td>
                            <td className="p-4">
                              <p className="font-bold">{wb.sender_name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{wb.sender_phone}</p>
                            </td>
                            <td className="p-4">
                              <p className="font-bold">{wb.receiver_name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{wb.receiver_phone}</p>
                            </td>
                            <td className="p-4">{wb.origin_park} → {wb.destination_park}</td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-full font-extrabold text-[10px] uppercase ${
                                wb.status === 'collected' ? 'bg-emerald-100 text-emerald-800' :
                                wb.status === 'arrived' ? 'bg-blue-100 text-blue-800' :
                                wb.status === 'in_transit' ? 'bg-amber-100 text-amber-800' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {wb.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] uppercase ${
                                wb.paid ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {wb.paid ? 'Paid' : 'Unpaid'}
                              </span>
                            </td>
                            <td className="p-4 font-extrabold text-[#0A1F44]">
                              ₦{(Number(wb.shipping_fee) || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        {filteredWaybills.length === 0 && (
                          <tr>
                            <td colSpan={7} className="text-center py-10 text-slate-400 font-semibold">No waybills found matching your search.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* CREATE STAFF MODAL */}
      {showCreateStaffModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-[#0A1F44]">Add New Park Staff</h3>
              <button onClick={() => setShowCreateStaffModal(false)} className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Staff Name *</label>
                <input
                  type="text"
                  placeholder="e.g. John Okonkwo"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="w-full bg-[#FAFAFA] border border-slate-200 rounded-2xl py-3 px-4 text-xs font-semibold outline-none focus:border-[#0A1F44]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Phone Number (Optional)</label>
                <input
                  type="tel"
                  placeholder="e.g. 08012345678"
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value)}
                  className="w-full bg-[#FAFAFA] border border-slate-200 rounded-2xl py-3 px-4 text-xs font-semibold outline-none focus:border-[#0A1F44]"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-800 font-semibold">
                Staff will be assigned automatically to <strong>{user?.park_location}</strong>. A 4-digit PIN will be auto-generated.
              </div>

              {createStaffError && (
                <p className="text-xs font-bold text-red-600 bg-red-50 p-3 rounded-2xl">{createStaffError}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateStaffModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createStaffLoading}
                  className="px-5 py-2.5 rounded-xl bg-[#0A1F44] text-white text-xs font-bold hover:bg-[#07152e] cursor-pointer disabled:opacity-50"
                >
                  {createStaffLoading ? 'Creating...' : 'Create Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ONE-TIME PIN DISPLAY MODAL */}
      {pinModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto">
              <Key className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="font-extrabold text-[#0A1F44] text-lg">{pinModal.title}</h3>
            <p className="text-xs text-slate-500">
              Share this 4-digit PIN with <strong>{pinModal.name}</strong>. This PIN is shown ONLY ONCE.
            </p>

            <div className="bg-slate-100 p-4 rounded-2xl font-mono text-3xl font-black text-[#0A1F44] tracking-widest">
              {pinModal.pin}
            </div>

            <button
              onClick={() => setPinModal(null)}
              className="w-full bg-[#0A1F44] text-white font-bold py-3 rounded-2xl text-xs hover:bg-[#07152e] cursor-pointer transition-all"
            >
              Done / Copy PIN
            </button>
          </div>
        </div>
      )}

      {/* REUSABLE CUSTOM CONFIRMATION MODAL */}
      {customConfirmModal.open && (
        <div className="fixed inset-0 bg-[#0A1F44]/50 backdrop-blur-xs flex items-center justify-center p-6 z-60 animate-fade-in" id="custom-confirm-modal">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative space-y-6 border border-slate-100">
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center border border-indigo-100">
                <AlertCircle className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-[#0A1F44]">{customConfirmModal.title}</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {customConfirmModal.message}
                </p>
              </div>
            </div>

            {customConfirmModal.error && (
              <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100 text-center">
                {customConfirmModal.error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setCustomConfirmModal(prev => ({ ...prev, open: false }))}
                disabled={customConfirmModal.submitting}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-[#0A1F44] font-extrabold py-3 px-4 rounded-xl text-xs transition-all cursor-pointer border-0 disabled:opacity-50"
                id="custom-confirm-cancel-btn"
              >
                {customConfirmModal.cancelText}
              </button>
              <button
                onClick={() => {
                  if (customConfirmModal.onConfirm) {
                    customConfirmModal.onConfirm();
                  }
                }}
                disabled={customConfirmModal.submitting}
                className={`flex-1 font-extrabold py-3 px-4 rounded-xl text-xs transition-all shadow-sm cursor-pointer border-0 disabled:opacity-50 text-white ${
                  customConfirmModal.title.toLowerCase().includes('delete')
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
                id="custom-confirm-proceed-btn"
              >
                {customConfirmModal.submitting ? 'Processing...' : customConfirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
