import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import {
  getTeamMembers,
  createTeamMember,
  toggleTeamMemberActive,
  resetTeamMemberPin,
  deleteTeamMember,
  getTrucks
} from '../../../lib/api';
import {
  Users,
  ShieldCheck,
  Plus,
  Search,
  Filter,
  Power,
  KeyRound,
  Trash2,
  AlertCircle,
  Eye,
  Truck,
  CheckCircle2,
  XCircle,
  Building,
  UserCheck,
  Clock,
  Activity,
  Smartphone,
  Signal,
  ShieldAlert
} from 'lucide-react';

interface TeamManagementProps {
  token: string;
  role: string | null;
  user: User | null;
}

export interface TeamMember {
  id: string;
  name: string;
  full_name?: string;
  phone: string;
  role: 'manager' | 'trip_monitor' | 'driver';
  manager_type?: string;
  company_id: string;
  park_id?: string;
  park_location?: string;
  active: boolean;
  account_created?: boolean;
  truck_id?: string;
  truck_plate?: string;
  created_at?: string;
  // Security monitoring fields:
  lastHeartbeatAt?: any;
  locationPermission?: 'granted' | 'denied' | 'prompt' | string;
  appInstalled?: boolean;
  deviceId?: string;
  deviceInfo?: any;
  loginCount?: number;
  reinstallCount?: number;
  firstLoginAt?: any;
  lastLoginAt?: any;
  reinstallDetectedAt?: any;
}

export const TeamManagement: React.FC<TeamManagementProps> = ({ token, role, user }) => {
  const isCEO = role === 'company' || user?.manager_type === 'CEO';
  const isManager = role === 'manager' || user?.manager_type === 'Manager';

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [truckList, setTruckList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'manager' | 'trip_monitor' | 'driver'>('all');

  // Add Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState<'manager' | 'trip_monitor' | 'driver'>(
    isCEO ? 'manager' : 'trip_monitor'
  );
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // One-time PIN display modal
  const [pinNoticeModal, setPinNoticeModal] = useState<{ title: string; name: string; pin?: string; message?: string } | null>(null);

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmText: string;
    submitting: boolean;
    error: string | null;
    onConfirm: () => Promise<void>;
  }>({
    open: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    submitting: false,
    error: null,
    onConfirm: async () => {}
  });

  const fetchTeam = async () => {
    if (!token) return;
    try {
      setError(null);
      const res = await getTeamMembers(token);
      if (res.success) {
        setTeam(res.teamMembers || res.managers || []);
      } else {
        setError(res.error || 'Failed to fetch team members.');
      }
    } catch (err: any) {
      console.error('Error fetching team members:', err);
      setError(err?.message || 'Failed to load team data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrucks = async () => {
    if (!token) return;
    try {
      const res = await getTrucks(token);
      if (res.success && Array.isArray(res.trucks)) {
        setTruckList(res.trucks);
      }
    } catch (tErr) {
      console.warn("Could not load trucks for team dropdown:", tErr);
    }
  };

  useEffect(() => {
    fetchTeam();
    fetchTrucks();
  }, [token]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    const cleanName = newName.trim();
    const cleanPhone = newPhone.trim();

    if (!cleanName) {
      setAddError('Full name is required.');
      return;
    }

    if (!cleanPhone || !/^\d{11}$/.test(cleanPhone)) {
      setAddError('Please enter a valid 11-digit phone number (e.g. 08012345678).');
      return;
    }

    if (!isCEO && selectedRole === 'manager') {
      setAddError('Only the company owner (CEO) can add Managers.');
      return;
    }

    setAddLoading(true);
    try {
      const res = await createTeamMember(token, {
        name: cleanName,
        phone: cleanPhone,
        role: selectedRole,
        truck_id: selectedRole === 'driver' ? selectedTruckId : undefined,
        park_id: user?.park_id || 'default_park'
      });

      if (res.success) {
        setShowAddModal(false);
        setNewName('');
        setNewPhone('');
        setSelectedTruckId('');
        setPinNoticeModal({
          title: 'Team Member Registered',
          name: cleanName,
          message: `${cleanName} has been registered as ${
            selectedRole === 'manager' ? 'Manager' : selectedRole === 'trip_monitor' ? 'Trip Monitor' : 'Driver'
          }. They can now open the app, click "Create Account", enter their phone number (${cleanPhone}), and set their password.`
        });
        fetchTeam();
      } else {
        setAddError(res.error || 'Failed to register team member.');
      }
    } catch (err: any) {
      setAddError(err?.message || 'Error adding team member.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleToggleActive = (member: TeamMember) => {
    const isMemberManager = member.role === 'manager' || member.manager_type === 'Manager';
    if (!isCEO && isMemberManager) {
      alert('Only company owners can deactivate Managers.');
      return;
    }

    const nextActive = !member.active;
    const actionText = member.active ? 'deactivate' : 'activate';

    setConfirmModal({
      open: true,
      title: `${member.active ? 'Deactivate' : 'Activate'} ${member.name}?`,
      message: `Are you sure you want to ${actionText} ${member.name}? ${
        member.active ? 'When deactivated, they will be blocked from logging into the app.' : 'They will regain sign in access.'
      }`,
      confirmText: member.active ? 'Yes, Deactivate' : 'Yes, Activate',
      submitting: false,
      error: null,
      onConfirm: async () => {
        const res = await toggleTeamMemberActive(token, member.id);
        if (res.success) {
          fetchTeam();
        } else {
          throw new Error(res.error || 'Failed to update member status.');
        }
      }
    });
  };

  const handleResetPin = (member: TeamMember) => {
    setConfirmModal({
      open: true,
      title: `Reset PIN for ${member.name}?`,
      message: `This will reset ${member.name}'s passcode lockouts and allow them to create a new 6-digit PIN on sign-in.`,
      confirmText: 'Reset PIN',
      submitting: false,
      error: null,
      onConfirm: async () => {
        const res = await resetTeamMemberPin(token, member.id);
        if (res.success) {
          setPinNoticeModal({
            title: 'PIN Reset Initiated',
            name: member.name,
            pin: res.pin,
            message: res.message || `PIN reset for ${member.name}. They can now enter their phone on sign-in and set a new 6-digit PIN.`
          });
          fetchTeam();
        } else {
          throw new Error(res.error || 'Failed to reset PIN.');
        }
      }
    });
  };

  const handleDelete = (member: TeamMember) => {
    if (!isCEO) {
      alert('Only the company owner can delete team members permanently.');
      return;
    }

    setConfirmModal({
      open: true,
      title: `Permanently Delete ${member.name}?`,
      message: `Are you sure you want to delete ${member.name} permanently? This action cannot be undone.`,
      confirmText: 'Delete Permanently',
      submitting: false,
      error: null,
      onConfirm: async () => {
        const res = await deleteTeamMember(token, member.id);
        if (res.success) {
          fetchTeam();
        } else {
          throw new Error(res.error || 'Failed to delete team member.');
        }
      }
    });
  };

  // Filtered members
  const filteredTeam = team.filter(m => {
    const normRole = (m.role || m.manager_type || 'manager').toLowerCase();
    const roleMatch = roleFilter === 'all' || 
      (roleFilter === 'manager' && (normRole.includes('manager') && !normRole.includes('trip'))) ||
      (roleFilter === 'trip_monitor' && normRole.includes('trip')) ||
      (roleFilter === 'driver' && normRole.includes('driver'));

    const searchMatch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.phone.includes(searchTerm);

    return roleMatch && searchMatch;
  });

  const managers = team.filter(m => {
    const r = (m.role || m.manager_type || 'manager').toLowerCase();
    return r.includes('manager') && !r.includes('trip');
  });

  const tripMonitors = team.filter(m => {
    const r = (m.role || m.manager_type || '').toLowerCase();
    return r.includes('trip');
  });

  const drivers = team.filter(m => {
    const r = (m.role || m.manager_type || '').toLowerCase();
    return r.includes('driver');
  });

  const getRoleBadge = (m: TeamMember) => {
    const r = (m.role || m.manager_type || 'manager').toLowerCase();
    if (r.includes('driver')) {
      return (
        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
          <Truck className="w-3 h-3" /> Driver
        </span>
      );
    }
    if (r.includes('trip')) {
      return (
        <span className="bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
          <Eye className="w-3 h-3" /> Trip Monitor
        </span>
      );
    }
    return (
      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
        <ShieldCheck className="w-3 h-3" /> Manager
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in" id="team-management-view">
      
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-orange-600" /> Team & Roles Management
            </h2>
            <span className="bg-orange-100 text-orange-700 border border-orange-200 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
              {team.length} Members
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-xl font-medium">
            Register and manage your fleet managers, trip monitors, and drivers. Deactivated team members will be blocked from logging in.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedRole(isCEO ? 'manager' : 'trip_monitor');
            setShowAddModal(true);
          }}
          className="bg-orange-500 hover:bg-orange-600 text-white font-black px-5 py-3 rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-orange-500/20 active:scale-95"
          id="add-team-member-btn"
        >
          <Plus className="w-4 h-4" />
          <span>Add Team Member</span>
        </button>
      </div>

      {/* Role Counts Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Managers Stat */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">👔 Managers</span>
            <p className="text-2xl font-black text-slate-900">{managers.length}</p>
            <p className="text-[11px] text-indigo-700 font-semibold">{managers.filter(m => m.active).length} Active Managers</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center text-indigo-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Trip Monitors Stat */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">👁️ Trip Monitors</span>
            <p className="text-2xl font-black text-slate-900">{tripMonitors.length}</p>
            <p className="text-[11px] text-orange-700 font-semibold">{tripMonitors.filter(m => m.active).length} Active Monitors</p>
          </div>
          <div className="w-12 h-12 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-center text-orange-600">
            <Eye className="w-6 h-6" />
          </div>
        </div>

        {/* Drivers Stat */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">🚛 Drivers</span>
            <p className="text-2xl font-black text-slate-900">{drivers.length}</p>
            <p className="text-[11px] text-emerald-700 font-semibold">{drivers.filter(m => m.active).length} Active Drivers</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center text-emerald-600">
            <Truck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search member by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs font-medium text-slate-900 placeholder-slate-400 outline-none focus:border-orange-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === 'all'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            All Roles ({team.length})
          </button>
          <button
            onClick={() => setRoleFilter('manager')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === 'manager'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            Managers ({managers.length})
          </button>
          <button
            onClick={() => setRoleFilter('trip_monitor')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === 'trip_monitor'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            Trip Monitors ({tripMonitors.length})
          </button>
          <button
            onClick={() => setRoleFilter('driver')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === 'driver'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            Drivers ({drivers.length})
          </button>
        </div>
      </div>

      {/* Team Cards Grid */}
      {loading ? (
        <div className="py-16 text-center space-y-3 bg-white border border-slate-200 rounded-3xl shadow-xs">
          <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading team roster...</p>
        </div>
      ) : filteredTeam.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-3 shadow-xs">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">No team members found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm || roleFilter !== 'all'
              ? 'No team members match your current filter criteria.'
              : 'Add your first manager, trip monitor, or driver to grant them app access.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeam.map((m) => {
            const isMemberManager = (m.role || m.manager_type || 'manager').toLowerCase().includes('manager') && !(m.role || m.manager_type || '').toLowerCase().includes('trip');
            const canManageThisMember = isCEO || !isMemberManager;

            return (
              <div
                key={m.id}
                className={`bg-white border rounded-2xl p-5 space-y-4 transition-all shadow-xs relative ${
                  m.active ? 'border-slate-200' : 'border-rose-200 bg-rose-50/20'
                }`}
              >
                {/* Top Member Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-slate-900 text-base leading-tight">{m.name}</h3>
                    <p className="text-xs font-mono text-slate-500 font-semibold">{m.phone}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    {getRoleBadge(m)}
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      m.active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {m.active ? 'Active' : 'Deactivated'}
                    </span>
                    <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md flex items-center gap-1 ${
                      (m.account_created || m.lastLoginAt || m.last_login_at || m.firstLoginAt)
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      {(m.account_created || m.lastLoginAt || m.last_login_at || m.firstLoginAt) ? (
                        <>
                          <CheckCircle2 className="w-2.5 h-2.5 text-blue-600" />
                          <span>Registered</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-2.5 h-2.5 text-amber-600" />
                          <span>Pending Sign-Up</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Additional Info Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5 text-slate-500">
                  <div className="flex justify-between items-center">
                    <span>Company:</span>
                    <span className="font-bold text-slate-900">{user?.company_name || 'Transport Company'}</span>
                  </div>
                  {m.truck_plate && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="flex items-center gap-1"><Truck className="w-3 h-3 text-emerald-600" /> Assigned Asset:</span>
                      <span className="font-bold text-orange-600 font-mono">{m.truck_plate}</span>
                    </div>
                  )}
                  {m.created_at && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span>Added:</span>
                      <span className="font-mono text-slate-500">{new Date(m.created_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {/* Driver App & Security Monitoring Box */}
                {(m.role === 'driver' || m.manager_type === 'Driver') && (() => {
                  const rawSignal = m.lastHeartbeatAt || m.lastLoginAt;
                  let signalDate: Date | null = null;
                  if (rawSignal) {
                    if (typeof rawSignal.toDate === 'function') {
                      signalDate = rawSignal.toDate();
                    } else if (rawSignal.seconds) {
                      signalDate = new Date(rawSignal.seconds * 1000);
                    } else {
                      signalDate = new Date(rawSignal);
                    }
                  }
                  const isSignalValid = signalDate && !isNaN(signalDate.getTime());
                  const hasRecentSignal = isSignalValid && (Date.now() - signalDate.getTime() <= 24 * 60 * 60 * 1000);
                  const formattedSignal = isSignalValid 
                    ? signalDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                    : null;

                  const rawLogin = m.lastLoginAt;
                  let loginDate: Date | null = null;
                  if (rawLogin) {
                    if (typeof rawLogin.toDate === 'function') {
                      loginDate = rawLogin.toDate();
                    } else if (rawLogin.seconds) {
                      loginDate = new Date(rawLogin.seconds * 1000);
                    } else {
                      loginDate = new Date(rawLogin);
                    }
                  }
                  const formattedLogin = loginDate && !isNaN(loginDate.getTime()) 
                    ? loginDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                    : (m.created_at ? new Date(m.created_at).toLocaleDateString() : 'Never');

                  const rawReinstall = m.reinstallDetectedAt;
                  let reinstallDate: Date | null = null;
                  if (rawReinstall) {
                    if (typeof rawReinstall.toDate === 'function') {
                      reinstallDate = rawReinstall.toDate();
                    } else if (rawReinstall.seconds) {
                      reinstallDate = new Date(rawReinstall.seconds * 1000);
                    } else {
                      reinstallDate = new Date(rawReinstall);
                    }
                  }
                  const formattedReinstall = reinstallDate && !isNaN(reinstallDate.getTime())
                    ? reinstallDate.toLocaleDateString()
                    : ((m.reinstallCount || 0) > 0 ? 'Detected on login' : 'None');

                  const reinstalls = m.reinstallCount || 0;
                  const totalLogins = m.loginCount || (m.account_created ? 1 : 0);

                  return (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2 text-slate-700">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                        <span className="text-[10px] font-black uppercase tracking-wider text-orange-700 flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-orange-600" /> Driver Security & App Status
                        </span>
                        {hasRecentSignal ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" /> Live Signal
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-rose-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Offline
                          </span>
                        )}
                      </div>

                      {/* 1. Last app signal */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Last app signal:</span>
                        <span className="font-semibold text-right">
                          {hasRecentSignal && formattedSignal ? (
                            <span className="text-emerald-700 font-mono text-[11px] font-bold">{formattedSignal}</span>
                          ) : (
                            <span className="text-rose-600 font-bold text-[11px] flex items-center gap-1">
                              <span>No signal in 24+ hours</span>
                              <span>🔴</span>
                            </span>
                          )}
                        </span>
                      </div>

                      {/* 2. Location permission */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Location permission:</span>
                        <span className="font-bold">
                          {m.locationPermission === 'denied' ? (
                            <span className="text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded text-[10px] flex items-center gap-1 font-bold">
                              🚫 Disabled
                            </span>
                          ) : m.locationPermission === 'granted' || m.locationPermission === 'allow_all' ? (
                            <span className="text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded text-[10px] flex items-center gap-1 font-bold">
                              ✅ Enabled
                            </span>
                          ) : (
                            <span className="text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold">
                              ⏳ Prompt / Pending
                            </span>
                          )}
                        </span>
                      </div>

                      {/* 3. Total logins */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Total logins:</span>
                        <span className="font-mono text-slate-800 text-[11px] font-bold">{totalLogins}</span>
                      </div>

                      {/* 5. Last login */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Last login:</span>
                        <span className="font-mono text-slate-600 text-[10px] font-semibold">{formattedLogin}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleResetPin(m)}
                    disabled={!canManageThisMember}
                    className="flex-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                    title="Reset PIN"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-orange-600" />
                    <span>Reset PIN</span>
                  </button>

                  <button
                    onClick={() => handleToggleActive(m)}
                    disabled={!canManageThisMember}
                    className={`flex-1 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer border disabled:opacity-40 ${
                      m.active
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{m.active ? 'Deactivate' : 'Activate'}</span>
                  </button>

                  {isCEO && (
                    <button
                      onClick={() => handleDelete(m)}
                      className="p-2 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 border border-slate-200 hover:border-rose-300 rounded-xl transition-all cursor-pointer"
                      title="Delete Member"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD MEMBER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-slate-900">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-orange-600" />
                Add New Team Member
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase block">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ibrahim Abubakar"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-orange-500 focus:bg-white rounded-2xl py-3 px-4 text-xs font-semibold text-slate-900 outline-none"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase block">Phone Number (11 Digits) *</label>
                <input
                  type="tel"
                  placeholder="08012345678"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-orange-500 focus:bg-white rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 font-mono outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase block">Assigned Role *</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-orange-500 focus:bg-white rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 outline-none cursor-pointer"
                >
                  {isCEO && <option value="manager">👔 Manager (Full Park/Fleet Control)</option>}
                  <option value="trip_monitor">👁️ Trip Monitor (View trips, mark loaded, redirect)</option>
                  <option value="driver">🚛 Driver (Silent GPS Location Tracking)</option>
                </select>
              </div>

              {selectedRole === 'driver' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase block">Assign Asset (Optional)</label>
                  <select
                    value={selectedTruckId}
                    onChange={(e) => setSelectedTruckId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 focus:border-orange-500 focus:bg-white rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 outline-none cursor-pointer"
                  >
                    <option value="">-- Select Fleet Asset --</option>
                    {truckList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.plate_number} ({t.driver_name || 'No driver assigned'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="p-3 bg-orange-50 border border-orange-200 rounded-2xl text-xs text-orange-800 space-y-1">
                <p className="font-extrabold">📱 Registration Flow:</p>
                <p className="text-[11px] text-slate-600">
                  Once registered, the team member can open the app, enter their phone number ({newPhone || '080...'}), and set up their secret 6-digit PIN on first sign-in.
                </p>
              </div>

              {addError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 text-center">
                  {addError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs cursor-pointer disabled:opacity-50 flex items-center gap-2 shadow-md shadow-orange-500/20"
                >
                  {addLoading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Save Team Member'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PIN / NOTICE MODAL */}
      {pinNoticeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto text-emerald-700">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-lg">{pinNoticeModal.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {pinNoticeModal.message}
            </p>

            {pinNoticeModal.pin && (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl font-mono text-2xl font-black text-orange-600 tracking-widest">
                {pinNoticeModal.pin}
              </div>
            )}

            <button
              onClick={() => setPinNoticeModal(null)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-2xl text-xs cursor-pointer transition-all shadow-md shadow-orange-500/20"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmModal.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-60 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5 text-slate-900 text-center">
            <div className="w-12 h-12 bg-orange-100 border border-orange-200 rounded-full flex items-center justify-center mx-auto text-orange-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-900 text-sm">{confirmModal.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">{confirmModal.message}</p>
            </div>

            {confirmModal.error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800">
                {confirmModal.error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setConfirmModal(prev => ({ ...prev, submitting: true, error: null }));
                  try {
                    await confirmModal.onConfirm();
                    setConfirmModal(prev => ({ ...prev, open: false, submitting: false }));
                  } catch (err: any) {
                    setConfirmModal(prev => ({
                      ...prev,
                      submitting: false,
                      error: err?.message || 'Operation failed.'
                    }));
                  }
                }}
                disabled={confirmModal.submitting}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20"
              >
                {confirmModal.submitting ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  confirmModal.confirmText
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
