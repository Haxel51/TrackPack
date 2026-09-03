import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Logo } from '../components/Logo';
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
  CheckCircle, XCircle, LogOut, Search, Filter, ShieldCheck, UserCheck, AlertCircle, Eye, Trash2, Power,
  ChevronRight, ArrowRight, Navigation, ArrowRightLeft
} from 'lucide-react';
import { FleetDashboard } from '../modules/fleetTracking/pages/FleetDashboard';
import { DriverScreen } from './DriverScreen';
import { initializeFCM } from '../modules/fleetTracking/fcm';
import { FleetPushNotificationCard } from '../modules/fleetTracking/components/FleetPushNotificationCard';

export const ManagerDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const { t } = useLanguage();

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
    onConfirm
  }: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => Promise<void> | void;
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
          setCustomConfirmModal(prev => ({
            ...prev,
            submitting: false,
            error: err?.message || 'Operation failed. Please try again.'
          }));
        }
      }
    });
  };

  const fetchData = async () => {
    const activeToken = token || localStorage.getItem('auth_token');
    if (!activeToken) return;

    try {
      setError(null);
      const [overviewRes, staffRes, waybillsRes] = await Promise.all([
        getManagerOverview(activeToken),
        getManagerStaff(activeToken),
        getManagerWaybills(activeToken)
      ]);

      if (overviewRes.success) setOverview(overviewRes);
      if (staffRes.success) setStaffList(staffRes.staff || []);
      if (waybillsRes.success) setWaybills(waybillsRes.waybills || []);
    } catch (err: any) {
      console.error('Failed to fetch manager data:', err);
      setError(err?.message || 'Failed to load manager dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const activeToken = token || localStorage.getItem('auth_token');
    if (activeToken) {
      initializeFCM(activeToken);
    }
  }, [token]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) {
      setCreateStaffError('Staff name is required');
      return;
    }

    const activeToken = token || localStorage.getItem('auth_token');
    if (!activeToken) return;

    try {
      setCreateStaffLoading(true);
      setCreateStaffError(null);

      const res = await createManagerStaff(activeToken, {
        name: newStaffName.trim(),
        phone: newStaffPhone.trim() || undefined
      });

      if (res.success) {
        setShowCreateStaffModal(false);
        setNewStaffName('');
        setNewStaffPhone('');
        setPinModal({
          title: 'Staff Created Successfully',
          name: res.name || newStaffName.trim(),
          pin: res.pin
        });
        fetchData();
      } else {
        setCreateStaffError(res.error || 'Failed to create staff member.');
      }
    } catch (err: any) {
      setCreateStaffError(err?.message || 'Failed to create staff.');
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

  // Navigation Tabs (Waybill Module Only)
  const navTabs = [
    { id: 'overview' as const, label: t('overview') || 'Overview', icon: Building2 },
    { id: 'staff' as const, label: `${t('staffMembers') || 'Staff'} (${staffList.length})`, icon: Users },
    { id: 'waybills' as const, label: `${t('waybillHistory') || 'Waybills'} (${waybills.length})`, icon: Package },
  ];

  const isDriver = user?.role === 'driver' || user?.manager_type === 'Driver';
  const isTripMonitor = user?.role === 'trip_monitor' || user?.manager_type === 'Trip Monitor';
  const isFleetManager =
    user?.is_fleet_only ||
    user?.service_mode === 'fleet' ||
    user?.service_type === 'fleet' ||
    user?.service_mode === 'haulage' ||
    user?.service_type === 'haulage' ||
    user?.manager_type === 'Fleet Manager';

  if (isDriver) {
    return <DriverScreen />;
  }

  if (isTripMonitor || isFleetManager) {
    return <FleetDashboard showSwitchModule={false} />;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-800 pb-12 w-full overflow-x-hidden font-sans">
      {/* Header */}
      <header className="bg-[#0A1F44] text-white sticky top-0 z-30 shadow-md w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto min-w-0">
            <Logo size="sm" showText={false} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="font-extrabold text-base sm:text-lg text-white truncate max-w-[170px] xs:max-w-[230px] sm:max-w-none">
                  {user?.company_name || overview?.company_name || 'Transport Company'}
                </h1>
                <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full uppercase whitespace-nowrap">
                  📦 Waybill Module
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 flex items-center gap-1.5 mt-0.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-[#F2A93B] shrink-0" />
                <span className="font-bold text-white truncate">{user?.park_location || overview?.park_location || 'Assigned Park'}</span>
                <span>•</span>
                <span className="truncate">{user?.name || 'Park Manager'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto border-t sm:border-t-0 border-white/10 pt-2 sm:pt-0 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <LanguageSwitcher />
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 sm:p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all cursor-pointer disabled:opacity-50"
                title="Refresh Data"
                id="manager-refresh-btn"
              >
                <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 sm:gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-200 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap"
              id="manager-logout-btn"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>{t('signOut')}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex border-t border-white/10 gap-1.5 sm:gap-2 pt-2 overflow-x-auto scrollbar-none pb-1">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 border-b-2 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-white text-[#0A1F44] border-[#F2A93B] shadow-xs'
                    : 'text-slate-300 hover:text-white border-transparent'
                }`}
                id={`manager-tab-${tab.id}`}
              >
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? 'text-[#F2A93B]' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-semibold">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-10 h-10 border-4 border-[#0A1F44]/20 border-t-[#0A1F44] rounded-full animate-spin" />
            <p className="text-sm font-bold text-slate-500">Loading manager dashboard...</p>
          </div>
        ) : (
          <>
            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && overview && (
              <div className="space-y-6">
                <FleetPushNotificationCard />

                {/* Metrics Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                  {/* Waybill Volume */}
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center">
                        <Package className="w-5 h-5 text-[#0A1F44]" />
                      </div>
                      <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase">Volume</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Park Waybills</p>
                      <p className="text-2xl sm:text-3xl font-black text-[#0A1F44] mt-1">{overview.stats?.volume?.today || 0} <span className="text-xs text-slate-400 font-semibold">Today</span></p>
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
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-amber-600" />
                      </div>
                      <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full uppercase">Tracking Fee</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gross Tracking Fee Total</p>
                      <p className="text-2xl sm:text-3xl font-black text-[#0A1F44] mt-1">₦{(overview.stats?.tracking_fees?.today || 0).toLocaleString()} <span className="text-xs text-slate-400 font-semibold">Today</span></p>
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
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                      </div>
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full uppercase">Shipping Fee</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gross Shipping Fee Total</p>
                      <p className="text-2xl sm:text-3xl font-black text-[#0A1F44] mt-1">₦{(overview.stats?.shipping_fees?.today || 0).toLocaleString()} <span className="text-xs text-slate-400 font-semibold">Today</span></p>
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
                <div className="bg-gradient-to-br from-[#0A1F44] to-[#122b5c] text-white rounded-3xl p-5 sm:p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
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
                      <p className="text-base sm:text-lg font-black text-white">{overview.stats?.active_staff_count || 0} Staff Members</p>
                    </div>
                  </div>
                </div>

                {/* Recent Park Waybills */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-extrabold text-[#0A1F44]">Recent Waybills at Park</h3>
                    <button
                      onClick={() => setActiveTab('waybills')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      View Full History <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                          <th className="pb-3 px-3">Tracking Code</th>
                          <th className="pb-3 px-3">Sender</th>
                          <th className="pb-3 px-3">Receiver</th>
                          <th className="pb-3 px-3">Status</th>
                          <th className="pb-3 px-3">Payment</th>
                          <th className="pb-3 px-3">Fee</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {(overview.recent_waybills || []).slice(0, 8).map((wb: any) => (
                          <tr key={wb.id} className="hover:bg-slate-50/80">
                            <td className="py-3 px-3 font-mono font-bold text-[#0A1F44]">{wb.tracking_code}</td>
                            <td className="py-3 px-3">{wb.sender_name}</td>
                            <td className="py-3 px-3">{wb.receiver_name}</td>
                            <td className="py-3 px-3">
                              <span className={`px-2.5 py-1 rounded-full font-extrabold text-[10px] uppercase ${
                                wb.status === 'collected' ? 'bg-emerald-100 text-emerald-800' :
                                wb.status === 'arrived' ? 'bg-blue-100 text-blue-800' :
                                wb.status === 'in_transit' ? 'bg-amber-100 text-amber-800' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {wb.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded-full font-extrabold text-[10px] uppercase ${
                                wb.paid ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {wb.paid ? 'Paid' : 'Unpaid'}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-bold text-[#0A1F44]">
                              ₦{(Number(wb.shipping_fee) || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        {(!overview.recent_waybills || overview.recent_waybills.length === 0) && (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-slate-400 font-semibold">
                              No waybills recorded yet at this park.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: STAFF MEMBERS */}
            {activeTab === 'staff' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm">
                  <div>
                    <h2 className="text-lg font-extrabold text-[#0A1F44]">Park Staff Members</h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Create staff accounts, reset staff 4-digit PINs, and toggle active logins for <strong>{user?.park_location}</strong>.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreateStaffModal(true)}
                    className="w-full sm:w-auto bg-[#0A1F44] hover:bg-[#07152e] text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                    id="manager-add-staff-btn"
                  >
                    <Plus className="w-4 h-4 text-[#F2A93B]" /> Add New Staff
                  </button>
                </div>

                {/* Staff List Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {staffList.map(staff => (
                    <div
                      key={staff.id}
                      className={`bg-white border rounded-3xl p-5 sm:p-6 shadow-sm space-y-4 transition-all ${
                        staff.active !== false ? 'border-slate-200/80' : 'border-red-200 bg-red-50/10'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                            staff.active !== false ? 'bg-indigo-50 text-indigo-600' : 'bg-red-50 text-red-600'
                          }`}>
                            <Users className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-sm text-[#0A1F44]">{staff.name}</h3>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">{staff.phone || 'No phone'}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          staff.active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {staff.active !== false ? 'Active' : 'Disabled'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 space-y-1 bg-slate-50 p-3 rounded-2xl">
                        <p className="flex items-center justify-between">
                          <span className="font-semibold text-slate-400">Assigned Park:</span>
                          <span className="font-bold text-[#0A1F44]">{staff.park_location}</span>
                        </p>
                        <p className="flex items-center justify-between">
                          <span className="font-semibold text-slate-400">Created:</span>
                          <span className="font-medium text-slate-600">
                            {staff.created_at ? new Date(staff.created_at).toLocaleDateString() : 'N/A'}
                          </span>
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleResetPin(staff.id, staff.name)}
                          className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 py-2 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          title="Reset PIN"
                        >
                          <Key className="w-3.5 h-3.5" /> Reset PIN
                        </button>
                        <button
                          onClick={() => handleToggleStaff(staff.id, staff.name, staff.active !== false)}
                          className={`flex-1 py-2 rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                            staff.active !== false
                              ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" /> {staff.active !== false ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(staff.id, staff.name)}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl transition-all cursor-pointer"
                          title="Delete Staff"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {staffList.length === 0 && (
                    <div className="col-span-full bg-white border border-slate-200/80 rounded-3xl p-10 text-center space-y-3">
                      <Users className="w-10 h-10 text-slate-300 mx-auto" />
                      <h3 className="font-extrabold text-[#0A1F44] text-base">No staff members created yet</h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Add staff members to process waybills, record parcel drops, and handle pickups at {user?.park_location}.
                      </p>
                      <button
                        onClick={() => setShowCreateStaffModal(true)}
                        className="bg-[#0A1F44] text-white font-extrabold px-4 py-2.5 rounded-xl text-xs inline-flex items-center gap-2 cursor-pointer mt-2"
                      >
                        <Plus className="w-4 h-4 text-[#F2A93B]" /> Add First Staff
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: WAYBILL REGISTER */}
            {activeTab === 'waybills' && (
              <div className="space-y-6">
                {/* Search & Filters */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search tracking code, sender, receiver, or phone..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-slate-200 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-semibold outline-none focus:border-[#0A1F44]"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-[#FAFAFA] border border-slate-200 rounded-2xl py-2.5 px-3 text-xs font-bold text-slate-700 outline-none focus:border-[#0A1F44]"
                    >
                      <option value="all">All Statuses</option>
                      <option value="booked">Booked</option>
                      <option value="in_transit">In Transit</option>
                      <option value="arrived">Arrived</option>
                      <option value="collected">Collected</option>
                    </select>
                  </div>
                </div>

                {/* Waybills Table */}
                <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                          <th className="p-4">Tracking Code</th>
                          <th className="p-4">Sender</th>
                          <th className="p-4">Receiver</th>
                          <th className="p-4">Route</th>
                          <th className="p-4">Status</th>
                          <th className="p-4">Payment</th>
                          <th className="p-4">Shipping Fee</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {filteredWaybills.map((wb: any) => (
                          <tr key={wb.id} className="hover:bg-slate-50/80">
                            <td className="p-4 font-mono font-bold text-[#0A1F44]">{wb.tracking_code}</td>
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
        <div className="fixed inset-0 bg-[#091026]/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
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
        <div className="fixed inset-0 bg-[#091026]/60 backdrop-blur-xs flex justify-center items-center p-4 z-50">
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
