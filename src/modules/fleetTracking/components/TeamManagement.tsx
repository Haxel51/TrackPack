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
  Power,
  KeyRound,
  Trash2,
  AlertCircle,
  Eye,
  Truck,
  CheckCircle2,
  Phone,
  Clock,
  Sparkles,
  PhoneCall,
  UserCheck,
  Lock,
  Building2,
  Radio,
  ExternalLink
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
  branch_tag?: string;
  active: boolean;
  account_created?: boolean;
  truck_id?: string;
  truck_plate?: string;
  created_at?: string;
  lastHeartbeatAt?: any;
  locationPermission?: 'granted' | 'denied' | 'prompt' | string;
  loginCount?: number;
  lastLoginAt?: any;
}

export const TeamManagement: React.FC<TeamManagementProps> = ({ token, role, user }) => {
  const isCEO = role === 'company' || user?.manager_type === 'CEO';

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
  const [newBranchTag, setNewBranchTag] = useState('All Fleet / Main Office');
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
      setAddError('Only the company owner (CEO) can add Operations Managers.');
      return;
    }

    setAddLoading(true);
    try {
      const res = await createTeamMember(token, {
        name: cleanName,
        phone: cleanPhone,
        role: selectedRole,
        truck_id: selectedRole === 'driver' ? selectedTruckId : undefined,
        park_id: 'default_park'
      });

      if (res.success) {
        setShowAddModal(false);
        setNewName('');
        setNewPhone('');
        setSelectedTruckId('');
        setNewBranchTag('All Fleet / Main Office');
        setPinNoticeModal({
          title: 'Team Member Registered Successfully',
          name: cleanName,
          message: `${cleanName} has been granted access as ${
            selectedRole === 'manager' ? 'Fleet / Operations Manager' : selectedRole === 'trip_monitor' ? 'Trip Monitor' : 'Driver'
          }. They can log into the app using their phone number (${cleanPhone}) and choose their secret PIN on first sign-in.`
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
      alert('Only company owners can deactivate Operations Managers.');
      return;
    }

    const nextActive = !member.active;
    const actionText = member.active ? 'deactivate' : 'activate';

    setConfirmModal({
      open: true,
      title: `${member.active ? 'Deactivate' : 'Activate'} ${member.name}?`,
      message: `Are you sure you want to ${actionText} ${member.name}? ${
        member.active ? 'When deactivated, this staff member will be immediately blocked from logging into the app.' : 'They will regain app login access.'
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
      message: `This will clear any passcode locks for ${member.name} and allow them to set a fresh 6-digit PIN upon entering their phone number.`,
      confirmText: 'Reset Access PIN',
      submitting: false,
      error: null,
      onConfirm: async () => {
        const res = await resetTeamMemberPin(token, member.id);
        if (res.success) {
          setPinNoticeModal({
            title: 'PIN Reset Ready',
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
      message: `Are you sure you want to remove ${member.name} from the company roster? This action cannot be undone.`,
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
        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
          <Truck className="w-3 h-3 text-emerald-600" /> Driver / Operator
        </span>
      );
    }
    if (r.includes('trip')) {
      return (
        <span className="bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
          <Eye className="w-3 h-3 text-amber-600" /> Trip Monitor
        </span>
      );
    }
    return (
      <span className="bg-blue-50 text-blue-900 border border-blue-200 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
        <ShieldCheck className="w-3 h-3 text-blue-600" /> Operations Manager
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="team-management-view">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0A1F44] to-[#15346A] text-white rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl border border-white/10">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#F7941D] text-[#0A1F44] flex items-center justify-center font-black shadow-md">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                Universal Team & Staff Roles
              </h2>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/10 text-slate-200 border border-white/20">
                Private Company Workspace ({team.length} Staff)
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl font-medium leading-relaxed">
            Manage your company's Fleet Managers, Control Room Monitors, and Drivers. Every staff member logs in securely with their phone number and 6-digit PIN.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedRole(isCEO ? 'manager' : 'trip_monitor');
            setShowAddModal(true);
          }}
          className="bg-gradient-to-r from-[#F7941D] to-amber-500 hover:from-amber-500 hover:to-[#F7941D] text-slate-950 font-black px-5 py-3 rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#F7941D]/25 active:scale-95 shrink-0"
          id="add-team-member-btn"
        >
          <Plus className="w-4 h-4 text-slate-950" />
          <span>+ Add Staff Member</span>
        </button>
      </div>

      {/* Role Counts Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Operations Managers Stat */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 flex items-center justify-between shadow-xs hover:border-blue-300 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider block">👔 Operations Managers</span>
            <p className="text-2xl font-black text-slate-900">{managers.length}</p>
            <p className="text-[11px] text-blue-700 font-bold">{managers.filter(m => m.active).length} Active with Full Dispatch Rights</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center text-blue-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Trip Monitors Stat */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 flex items-center justify-between shadow-xs hover:border-amber-300 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider block">👁️ Trip Monitors</span>
            <p className="text-2xl font-black text-slate-900">{tripMonitors.length}</p>
            <p className="text-[11px] text-amber-700 font-bold">{tripMonitors.filter(m => m.active).length} Live Map & Customer Desk</p>
          </div>
          <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center text-amber-600">
            <Eye className="w-6 h-6" />
          </div>
        </div>

        {/* Field Drivers Stat */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 flex items-center justify-between shadow-xs hover:border-emerald-300 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider block">🚛 Drivers & Operators</span>
            <p className="text-2xl font-black text-slate-900">{drivers.length}</p>
            <p className="text-[11px] text-emerald-700 font-bold">{drivers.filter(m => m.active).length} Assigned for 1-Tap Dialing</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center text-emerald-600">
            <Truck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by staff name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-[#F7941D] focus:bg-white rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold text-slate-900 placeholder-slate-400 outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === 'all'
                ? 'bg-[#0A1F44] text-[#F7941D] shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            All Staff ({team.length})
          </button>
          <button
            onClick={() => setRoleFilter('manager')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === 'manager'
                ? 'bg-[#0A1F44] text-[#F7941D] shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            Managers ({managers.length})
          </button>
          <button
            onClick={() => setRoleFilter('trip_monitor')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === 'trip_monitor'
                ? 'bg-[#0A1F44] text-[#F7941D] shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            Trip Monitors ({tripMonitors.length})
          </button>
          <button
            onClick={() => setRoleFilter('driver')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === 'driver'
                ? 'bg-[#0A1F44] text-[#F7941D] shadow-xs'
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
          <div className="w-8 h-8 border-3 border-[#F7941D]/30 border-t-[#F7941D] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading company team roster...</p>
        </div>
      ) : filteredTeam.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-3 shadow-xs">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-black text-slate-900">No staff members found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm || roleFilter !== 'all'
              ? 'No team members match your filter criteria.'
              : 'Add your first Operations Manager, Trip Monitor, or Driver to grant them secure app access.'}
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
                className={`bg-white border rounded-3xl p-5 space-y-4 transition-all shadow-xs relative flex flex-col justify-between ${
                  m.active ? 'border-slate-200 hover:border-slate-300' : 'border-rose-200 bg-rose-50/20'
                }`}
              >
                <div>
                  {/* Top Member Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="font-black text-slate-900 text-base leading-tight">{m.name}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-600 font-bold">{m.phone}</span>
                        <a
                          href={`tel:${m.phone}`}
                          className="text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 p-1 rounded-md transition-colors"
                          title="Call Staff"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                        </a>
                      </div>
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
                    </div>
                  </div>

                  {/* Capabilities & Info Card */}
                  <div className="mt-3 bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs space-y-2 text-slate-600">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-medium">Company Account:</span>
                      <span className="font-extrabold text-[#0A1F44]">{user?.company_name || 'Fleet Organization'}</span>
                    </div>

                    {m.truck_plate && (
                      <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200/60">
                        <span className="flex items-center gap-1 font-bold text-slate-600">
                          <Truck className="w-3.5 h-3.5 text-emerald-600" /> Assigned Vehicle:
                        </span>
                        <span className="font-black text-orange-600 font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200">
                          {m.truck_plate}
                        </span>
                      </div>
                    )}

                    {/* Role Permissions Summary */}
                    <div className="pt-1 border-t border-slate-200/60 text-[11px] space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Access Rights:</span>
                      {isMemberManager ? (
                        <p className="text-blue-900 font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-blue-600 shrink-0" />
                          <span>Dispatch Trips, Add GPS Assets, Redirection</span>
                        </p>
                      ) : (m.role === 'trip_monitor' || m.manager_type === 'Trip Monitor') ? (
                        <p className="text-amber-900 font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Live Road Tracking, Customer Link & Driver Calling</span>
                        </p>
                      ) : (
                        <p className="text-emerald-900 font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Assigned Truck Operator & Customer Contact</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleResetPin(m)}
                    disabled={!canManageThisMember}
                    className="flex-1 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                    title="Reset PIN"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-orange-600" />
                    <span>Reset PIN</span>
                  </button>

                  <button
                    onClick={() => handleToggleActive(m)}
                    disabled={!canManageThisMember}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer border disabled:opacity-40 ${
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
                      className="p-2.5 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 border border-slate-200 hover:border-rose-300 rounded-xl transition-all cursor-pointer"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-slate-900">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Add Staff Member</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Universal access for any company branch</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ibrahim Abubakar"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-[#F7941D] focus:bg-white rounded-2xl py-3 px-4 text-xs font-bold text-slate-900 outline-none"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">Phone Number (11 Digits for Login) *</label>
                <input
                  type="tel"
                  placeholder="08012345678"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-[#F7941D] focus:bg-white rounded-2xl py-3 px-4 text-xs font-black text-slate-900 font-mono outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">Assign Role *</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 focus:border-[#F7941D] rounded-2xl py-3 px-4 text-xs font-black text-slate-900 outline-none cursor-pointer"
                >
                  {isCEO && <option value="manager">👔 Operations / Fleet Manager (Dispatches & GPS Assets)</option>}
                  <option value="trip_monitor">👁️ Trip Monitor (Live Map, Customer Links & Driver Calling)</option>
                  <option value="driver">🚛 Assigned Driver (Truck Operator)</option>
                </select>
              </div>

              {selectedRole === 'driver' && (
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">Assign Vehicle / Truck (Optional)</label>
                  <select
                    value={selectedTruckId}
                    onChange={(e) => setSelectedTruckId(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-[#F7941D] rounded-2xl py-3 px-4 text-xs font-black text-slate-900 outline-none cursor-pointer"
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

              <div className="p-3.5 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl text-xs text-orange-950 space-y-1">
                <p className="font-black flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                  <span>Instant Login Ready</span>
                </p>
                <p className="text-[11px] text-slate-600 font-medium">
                  Once saved, the staff member opens the app, enters <span className="font-bold text-slate-900">{newPhone || 'their phone number'}</span>, and sets their 6-digit PIN on first sign-in.
                </p>
              </div>

              {addError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-black text-rose-800 text-center">
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
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#F7941D] to-amber-500 hover:from-amber-500 hover:to-[#F7941D] text-slate-950 font-black text-xs cursor-pointer disabled:opacity-50 flex items-center gap-2 shadow-md shadow-[#F7941D]/20"
                >
                  {addLoading ? (
                    <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                  ) : (
                    'Save Staff Member'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PIN / NOTICE MODAL */}
      {pinNoticeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-50 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto text-emerald-700">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-900 text-base">{pinNoticeModal.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {pinNoticeModal.message}
            </p>

            {pinNoticeModal.pin && (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl font-mono text-2xl font-black text-[#F7941D] tracking-widest">
                {pinNoticeModal.pin}
              </div>
            )}

            <button
              onClick={() => setPinNoticeModal(null)}
              className="w-full bg-[#0A1F44] hover:bg-[#15346A] text-[#F7941D] font-black py-3 rounded-2xl text-xs cursor-pointer transition-all shadow-md"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmModal.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4 z-60 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5 text-slate-900 text-center">
            <div className="w-12 h-12 bg-orange-100 border border-orange-200 rounded-full flex items-center justify-center mx-auto text-[#F7941D]">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-slate-900 text-sm">{confirmModal.title}</h3>
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
                className="flex-1 py-2.5 rounded-xl bg-[#0A1F44] hover:bg-[#15346A] text-[#F7941D] font-black text-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md"
              >
                {confirmModal.submitting ? (
                  <span className="w-4 h-4 border-2 border-[#F7941D]/30 border-t-[#F7941D] rounded-full animate-spin" />
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

export default TeamManagement;
