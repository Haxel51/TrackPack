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
  Clock
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
        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
          <Truck className="w-3 h-3" /> Driver
        </span>
      );
    }
    if (r.includes('trip')) {
      return (
        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
          <Eye className="w-3 h-3" /> Trip Monitor
        </span>
      );
    }
    return (
      <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
        <ShieldCheck className="w-3 h-3" /> Manager
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in" id="team-management-view">
      
      {/* Header Banner */}
      <div className="bg-[#070b19] border border-blue-950/60 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-amber-400" /> Team & Roles Management
            </h2>
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
              {team.length} Members
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-xl">
            Register and manage your fleet managers, trip monitors, and drivers. Deactivated team members will be blocked from logging in.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedRole(isCEO ? 'manager' : 'trip_monitor');
            setShowAddModal(true);
          }}
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black px-5 py-3 rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-amber-500/20 active:scale-95"
          id="add-team-member-btn"
        >
          <Plus className="w-4 h-4" />
          <span>Add Team Member</span>
        </button>
      </div>

      {/* Role Counts Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Managers Stat */}
        <div className="bg-[#070b19] border border-blue-950/60/80 rounded-2xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">👔 Managers</span>
            <p className="text-2xl font-black text-white">{managers.length}</p>
            <p className="text-[11px] text-indigo-400 font-semibold">{managers.filter(m => m.active).length} Active Managers</p>
          </div>
          <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Trip Monitors Stat */}
        <div className="bg-[#070b19] border border-blue-950/60/80 rounded-2xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">👁️ Trip Monitors</span>
            <p className="text-2xl font-black text-white">{tripMonitors.length}</p>
            <p className="text-[11px] text-amber-400 font-semibold">{tripMonitors.filter(m => m.active).length} Active Monitors</p>
          </div>
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400">
            <Eye className="w-6 h-6" />
          </div>
        </div>

        {/* Drivers Stat */}
        <div className="bg-[#070b19] border border-blue-950/60/80 rounded-2xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">🚛 Drivers</span>
            <p className="text-2xl font-black text-white">{drivers.length}</p>
            <p className="text-[11px] text-emerald-400 font-semibold">{drivers.filter(m => m.active).length} Active Drivers</p>
          </div>
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400">
            <Truck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#070b19] border border-blue-950/60/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search member by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0b1329] border border-blue-950/60 rounded-xl py-2 pl-10 pr-4 text-xs font-medium text-white placeholder-slate-500 outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-[#0b1329] text-slate-400 hover:text-white border border-blue-950/60'
            }`}
          >
            All Roles ({team.length})
          </button>
          <button
            onClick={() => setRoleFilter('manager')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === 'manager'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-[#0b1329] text-slate-400 hover:text-white border border-blue-950/60'
            }`}
          >
            Managers ({managers.length})
          </button>
          <button
            onClick={() => setRoleFilter('trip_monitor')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === 'trip_monitor'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-[#0b1329] text-slate-400 hover:text-white border border-blue-950/60'
            }`}
          >
            Trip Monitors ({tripMonitors.length})
          </button>
          <button
            onClick={() => setRoleFilter('driver')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === 'driver'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-[#0b1329] text-slate-400 hover:text-white border border-blue-950/60'
            }`}
          >
            Drivers ({drivers.length})
          </button>
        </div>
      </div>

      {/* Team Cards Grid */}
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading team roster...</p>
        </div>
      ) : filteredTeam.length === 0 ? (
        <div className="bg-[#070b19] border border-blue-950/60/80 rounded-3xl p-10 text-center space-y-3">
          <Users className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No team members found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
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
                className={`bg-[#070b19] border rounded-2xl p-5 space-y-4 transition-all relative ${
                  m.active ? 'border-blue-950/60' : 'border-rose-900/50 bg-rose-950/10'
                }`}
              >
                {/* Top Member Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-white text-base leading-tight">{m.name}</h3>
                    <p className="text-xs font-mono text-slate-400">{m.phone}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    {getRoleBadge(m)}
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      m.active
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {m.active ? 'Active' : 'Deactivated'}
                    </span>
                    <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md flex items-center gap-1 ${
                      m.account_created
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {m.account_created ? (
                        <>
                          <CheckCircle2 className="w-2.5 h-2.5 text-blue-400" />
                          <span>Registered</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-2.5 h-2.5 text-amber-400" />
                          <span>Pending Sign-Up</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Additional Info Box */}
                <div className="bg-[#0b1329]/80 border border-blue-950/60/60 rounded-xl p-3 text-xs space-y-1.5 text-slate-400">
                  <div className="flex justify-between items-center">
                    <span>Company:</span>
                    <span className="font-bold text-slate-200">{user?.company_name || 'Transport Company'}</span>
                  </div>
                  {m.truck_plate && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="flex items-center gap-1"><Truck className="w-3 h-3 text-emerald-400" /> Assigned Truck:</span>
                      <span className="font-bold text-amber-300 font-mono">{m.truck_plate}</span>
                    </div>
                  )}
                  {m.created_at && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span>Added:</span>
                      <span className="font-mono text-slate-400">{new Date(m.created_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-blue-950/60/80">
                  <button
                    onClick={() => handleResetPin(m)}
                    disabled={!canManageThisMember}
                    className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                    title="Reset PIN"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    <span>Reset PIN</span>
                  </button>

                  <button
                    onClick={() => handleToggleActive(m)}
                    disabled={!canManageThisMember}
                    className={`flex-1 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer border disabled:opacity-40 ${
                      m.active
                        ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{m.active ? 'Deactivate' : 'Activate'}</span>
                  </button>

                  {isCEO && (
                    <button
                      onClick={() => handleDelete(m)}
                      className="p-2 bg-[#0b1329] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-blue-950/60 hover:border-rose-500/40 rounded-xl transition-all cursor-pointer"
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
        <div className="fixed inset-0 bg-[#070b19]/80 backdrop-blur-xs flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="bg-[#0b1329] border border-blue-950/60 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-slate-100">
            <div className="flex justify-between items-center pb-3 border-b border-blue-950/60">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-400" />
                Add New Team Member
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 uppercase block">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ibrahim Abubakar"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#070b19] border border-blue-950/60 focus:border-amber-500 rounded-2xl py-3 px-4 text-xs font-semibold text-white outline-none"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 uppercase block">Phone Number (11 Digits) *</label>
                <input
                  type="tel"
                  placeholder="08012345678"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-[#070b19] border border-blue-950/60 focus:border-amber-500 rounded-2xl py-3 px-4 text-xs font-bold text-white font-mono outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 uppercase block">Assigned Role *</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as any)}
                  className="w-full bg-[#070b19] border border-blue-950/60 focus:border-amber-500 rounded-2xl py-3 px-4 text-xs font-bold text-white outline-none cursor-pointer"
                >
                  {isCEO && <option value="manager">👔 Manager (Full Park/Fleet Control)</option>}
                  <option value="trip_monitor">👁️ Trip Monitor (View trips, mark loaded, redirect)</option>
                  <option value="driver">🚛 Driver (Silent GPS Location Tracking)</option>
                </select>
              </div>

              {selectedRole === 'driver' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 uppercase block">Assign Truck (Optional)</label>
                  <select
                    value={selectedTruckId}
                    onChange={(e) => setSelectedTruckId(e.target.value)}
                    className="w-full bg-[#070b19] border border-blue-950/60 focus:border-amber-500 rounded-2xl py-3 px-4 text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    <option value="">-- Select Fleet Truck --</option>
                    {truckList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.plate_number} ({t.driver_name || 'No driver assigned'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-300 space-y-1">
                <p className="font-extrabold">📱 Registration Flow:</p>
                <p className="text-[11px] text-slate-300">
                  Once registered, the team member can open the app, enter their phone number ({newPhone || '080...'}), and set up their secret 6-digit PIN on first sign-in.
                </p>
              </div>

              {addError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs font-bold text-rose-300 text-center">
                  {addError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-blue-950/60 text-xs font-bold text-slate-400 hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {addLoading ? (
                    <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
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
        <div className="fixed inset-0 bg-[#070b19]/80 backdrop-blur-xs flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="bg-[#0b1329] border border-blue-950/60 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-white text-lg">{pinNoticeModal.title}</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {pinNoticeModal.message}
            </p>

            {pinNoticeModal.pin && (
              <div className="bg-[#070b19] border border-blue-950/60 p-4 rounded-2xl font-mono text-2xl font-black text-amber-400 tracking-widest">
                {pinNoticeModal.pin}
              </div>
            )}

            <button
              onClick={() => setPinNoticeModal(null)}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 rounded-2xl text-xs cursor-pointer transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmModal.open && (
        <div className="fixed inset-0 bg-[#070b19]/80 backdrop-blur-xs flex justify-center items-center p-4 z-60 animate-fade-in">
          <div className="bg-[#0b1329] border border-blue-950/60 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5 text-slate-100 text-center">
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto text-amber-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold text-white text-sm">{confirmModal.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{confirmModal.message}</p>
            </div>

            {confirmModal.error && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-bold text-rose-300">
                {confirmModal.error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}
                className="flex-1 py-2.5 rounded-xl border border-blue-950/60 text-xs font-bold text-slate-400 hover:bg-slate-800 cursor-pointer"
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
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {confirmModal.submitting ? (
                  <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
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
