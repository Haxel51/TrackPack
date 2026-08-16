import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Logo } from '../components/Logo';
import {
  LogOut,
  Building2,
  Phone,
  Shield,
  Search,
  Filter,
  Plus,
  Users,
  TrendingUp,
  Calendar,
  MapPin,
  UserPlus,
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle2,
  Power,
  Key,
  DollarSign,
  Package,
  Bus,
  Truck,
  AlertCircle,
  UserCheck,
  Trash2,
  Activity
} from 'lucide-react';
import { ShipmentTimeline } from '../components/ShipmentTimeline';
import { FleetManagementView } from '../components/fleet/FleetManagementView';
import { RealtimeFleetBoard } from '../components/fleet/RealtimeFleetBoard';
import { updateFleetConfig } from '../lib/api';

// Inline Skeleton Component for Progressive Loading
const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />
);

export const CompanyDashboard: React.FC = () => {
  const { user, token, logout, checkSession } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'parks' | 'shipments' | 'earnings' | 'fleet'>('overview');

  const [currentServiceMode, setCurrentServiceMode] = useState<'parcel' | 'fleet' | 'both'>('parcel');
  const [showModeSwitchModal, setShowModeSwitchModal] = useState(false);
  const [updatingMode, setUpdatingMode] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.service_mode || user?.service_type) {
      const mode = (user.service_mode || user.service_type) as string;
      if (mode === 'fleet' || mode === 'haulage') setCurrentServiceMode('fleet');
      else if (mode === 'both' || mode === 'all') setCurrentServiceMode('both');
      else setCurrentServiceMode('parcel');
    }
  }, [user]);

  const isFleetOnly = currentServiceMode === 'fleet';
  const isWaybillOnly = currentServiceMode === 'parcel';
  const isBoth = currentServiceMode === 'both';

  useEffect(() => {
    if (isFleetOnly && ['parks', 'shipments', 'earnings'].includes(activeTab)) {
      setActiveTab('overview');
    }
    if (isWaybillOnly && activeTab === 'fleet') {
      setActiveTab('overview');
    }
  }, [isFleetOnly, isWaybillOnly, activeTab]);

  const handleSwitchServiceMode = async (newMode: 'parcel' | 'fleet' | 'both') => {
    setUpdatingMode(true);
    setModeError(null);
    try {
      const res = await updateFleetConfig(token || '', newMode);
      if (res && res.success) {
        setCurrentServiceMode(newMode);
        setShowModeSwitchModal(false);
        if (checkSession) checkSession();
        if (newMode === 'fleet') {
          setActiveTab('overview');
        } else if (newMode === 'parcel' && activeTab === 'fleet') {
          setActiveTab('overview');
        }
      } else {
        setModeError(res.error || 'Failed to update operation mode.');
      }
    } catch (err) {
      setModeError('Network error while updating mode.');
    } finally {
      setUpdatingMode(false);
    }
  };

  const navTabs = isFleetOnly
    ? [
        { id: 'overview', label: t('overview'), icon: TrendingUp },
        { id: 'fleet', label: 'Fleet Trip Tracking', icon: Truck }
      ]
    : isWaybillOnly
    ? [
        { id: 'overview', label: t('overview'), icon: TrendingUp },
        { id: 'parks', label: `${t('myBranches')} & ${t('staffMembers')}`, icon: Building2 },
        { id: 'shipments', label: t('waybillHistory'), icon: Package },
        { id: 'earnings', label: t('analytics'), icon: DollarSign }
      ]
    : [
        { id: 'overview', label: t('overview'), icon: TrendingUp },
        { id: 'parks', label: `${t('myBranches')} & ${t('staffMembers')}`, icon: Building2 },
        { id: 'shipments', label: t('waybillHistory'), icon: Package },
        { id: 'earnings', label: t('analytics'), icon: DollarSign },
        { id: 'fleet', label: 'Fleet Trip Tracking', icon: Truck }
      ];

  // --- TAB 1: OVERVIEW STATE ---
  const [overviewState, setOverviewState] = useState<{
    loading: boolean;
    error: boolean;
    stats: {
      total_shipments_week: number;
      total_shipments_month: number;
      total_active_staff: number;
      total_earnings_month: number;
    } | null;
    recentActivity: any[];
  }>({
    loading: true,
    error: false,
    stats: null,
    recentActivity: []
  });

  // --- TAB 2: PARKS & STAFF STATE ---
  const [parksState, setParksState] = useState<{
    loading: boolean;
    error: boolean;
    parks: any[];
  }>({
    loading: true,
    error: false,
    parks: []
  });

  // --- TAB 3: SHIPMENTS STATE ---
  const [shipmentsState, setShipmentsState] = useState<{
    loading: boolean;
    error: boolean;
    waybills: any[];
    total: number;
    page: number;
    pages: number;
  }>({
    loading: true,
    error: false,
    waybills: [],
    total: 0,
    page: 1,
    pages: 1
  });

  // Filters for Shipments
  const [shipmentFilters, setShipmentFilters] = useState({
    search: '',
    status: 'all',
    startDate: '',
    endDate: ''
  });

  // --- MODAL STATES ---
  const [newParkModal, setNewParkModal] = useState({
    open: false,
    name: '',
    location: '',
    submitting: false,
    error: null as string | null
  });

  const [newStaffModal, setNewStaffModal] = useState({
    open: false,
    parkId: '',
    parkName: '',
    name: '',
    phone: '',
    submitting: false,
    error: null as string | null
  });

  // One-time PIN success screen state
  const [pinSuccessState, setPinSuccessState] = useState<{
    open: boolean;
    name: string;
    pin: string;
  } | null>(null);

  // Reset PIN modal states
  const [resetPinConfirmModal, setResetPinConfirmModal] = useState<{
    open: boolean;
    staffId: string;
    staffName: string;
    submitting: boolean;
    error: string | null;
  }>({
    open: false,
    staffId: '',
    staffName: '',
    submitting: false,
    error: null,
  });

  const [resetPinSuccessState, setResetPinSuccessState] = useState<{
    open: boolean;
    name: string;
    pin: string;
  } | null>(null);

  // New Manager Modal state
  const [newManagerModal, setNewManagerModal] = useState({
    open: false,
    parkId: '',
    parkName: '',
    name: '',
    phone: '',
    submitting: false,
    error: null as string | null
  });

  // Manager 6-digit PIN success modal state
  const [managerPinSuccessState, setManagerPinSuccessState] = useState<{
    open: boolean;
    name: string;
    pin: string;
  } | null>(null);

  // Selected manager profile slide-over panel
  const [selectedManagerProfile, setSelectedManagerProfile] = useState<{
    id: string;
    name: string;
    phone: string;
    active: boolean;
    parkId: string;
    parkName: string;
  } | null>(null);

  // Quick Trip Launch State for CEO Overview
  const [fleetInitialSubTab, setFleetInitialSubTab] = useState<'live_board' | 'overview' | 'trucks' | 'suppliers' | 'staff_drivers' | 'trips'>('live_board');
  const [autoOpenCreateTrip, setAutoOpenCreateTrip] = useState(false);

  const handleLaunchNewTripFromOverview = () => {
    setFleetInitialSubTab('trips');
    setAutoOpenCreateTrip(true);
    setActiveTab('fleet');
  };

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

  // --- TAB 4: EARNINGS STATE ---
  const [earningsState, setEarningsState] = useState<{
    loading: boolean;
    error: boolean;
    subaccount: {
      bank_name: string | null;
      account_number: string | null;
      account_name: string | null;
      paystack_subaccount_code: string | null;
      split_percentage: number | null;
    } | null;
    stats: {
      earnings_week: number;
      earnings_month: number;
      earnings_all_time: number;
      pending_earnings_week: number;
      pending_earnings_month: number;
      pending_earnings_all_time: number;
    } | null;
    history: any[];
  }>({
    loading: true,
    error: false,
    subaccount: null,
    stats: null,
    history: []
  });

  const handleSettlePayment = async (paymentId: string) => {
    try {
      const res = await fetch(`/api/company/settlements/${paymentId}/settle`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to settle payment');
      fetchEarningsData();
    } catch (err) {
      console.error(err);
      alert('Failed to mark payment as settled.');
    }
  };

  const [banksList, setBanksList] = useState<any[]>([]);
  const [selectedBankCode, setSelectedBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [resolvedAccountName, setResolvedAccountName] = useState('');
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [savingSubaccount, setSavingSubaccount] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [successSetupMessage, setSuccessSetupMessage] = useState<string | null>(null);

  // Waybill Detail Modal state (for timeline view)
  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    waybill: any | null;
    route: any | null;
    driver: any | null;
    loading: boolean;
  }>({
    open: false,
    waybill: null,
    route: null,
    driver: null,
    loading: false
  });

  // --- FETCHING ACTIONS ---

  const fetchOverview = async () => {
    setOverviewState(prev => ({ ...prev, loading: true, error: false }));
    try {
      const response = await fetch('/api/company/overview', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to load overview data');
      const data = await response.json();
      setOverviewState({
        loading: false,
        error: false,
        stats: data.stats,
        recentActivity: data.recent_activity || []
      });
    } catch (err) {
      console.error(err);
      setOverviewState(prev => ({ ...prev, loading: false, error: true }));
    }
  };

  const fetchParksAndStaff = async () => {
    setParksState(prev => ({ ...prev, loading: true, error: false }));
    const activeToken = token || localStorage.getItem('auth_token');
    try {
      const response = await fetch('/api/company/parks-and-staff', {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });
      if (!response.ok) throw new Error('Failed to load parks and staff');
      const data = await response.json();
      setParksState({
        loading: false,
        error: false,
        parks: data.parks || []
      });
    } catch (err) {
      console.error(err);
      setParksState(prev => ({ ...prev, loading: false, error: true }));
    }
  };

  const fetchShipments = async (pageToFetch: number = 1) => {
    setShipmentsState(prev => ({ ...prev, loading: true, error: false }));
    try {
      const queryParams = new URLSearchParams({
        page: pageToFetch.toString(),
        limit: '20',
        search: shipmentFilters.search,
        status: shipmentFilters.status,
        startDate: shipmentFilters.startDate,
        endDate: shipmentFilters.endDate
      });

      const response = await fetch(`/api/company/waybills?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to load shipments');
      const data = await response.json();
      setShipmentsState({
        loading: false,
        error: false,
        waybills: data.waybills || [],
        total: data.total || 0,
        page: data.page || 1,
        pages: data.pages || 1
      });
    } catch (err) {
      console.error(err);
      setShipmentsState(prev => ({ ...prev, loading: false, error: true }));
    }
  };

  const fetchEarningsData = async () => {
    setEarningsState(prev => ({ ...prev, loading: true, error: false }));
    try {
      const response = await fetch('/api/company/earnings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to load earnings');
      const data = await response.json();
      setEarningsState({
        loading: false,
        error: false,
        subaccount: data.bank_setup,
        stats: {
          earnings_week: data.stats.earnings_week,
          earnings_month: data.stats.earnings_month,
          earnings_all_time: data.stats.earnings_all_time
        },
        history: data.history || []
      });

      if (data.bank_setup && data.bank_setup.account_number) {
        setAccountNumber(data.bank_setup.account_number);
        setResolvedAccountName(data.bank_setup.account_name || '');
        setIsEditingBank(false);
      } else {
        setIsEditingBank(true);
      }
    } catch (err) {
      console.error(err);
      setEarningsState(prev => ({ ...prev, loading: false, error: true }));
    }
  };

  const fetchBanksList = async () => {
    try {
      const response = await fetch('/api/paystack/banks', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setBanksList(data.banks || []);
        if (data.banks && data.banks.length > 0) {
          setSelectedBankCode(data.banks[0].code);
        }
      }
    } catch (err) {
      console.error('Failed to fetch banks list:', err);
    }
  };

  // Handle bank account resolution verification
  const handleVerifyAccount = async () => {
    if (accountNumber.length !== 10) {
      setSetupError('Account number must be exactly 10 digits.');
      return;
    }
    setVerifyingAccount(true);
    setSetupError(null);
    setResolvedAccountName('');
    try {
      const response = await fetch('/api/paystack/resolve-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          account_number: accountNumber,
          bank_code: selectedBankCode
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setResolvedAccountName(data.account_name);
      } else {
        setSetupError(data.error || 'Failed to resolve bank account name. Please check details.');
      }
    } catch (err) {
      setSetupError('Failed to connect to verification server.');
    } finally {
      setVerifyingAccount(false);
    }
  };

  // Handle saving subaccount settings
  const handleSaveSubaccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedAccountName) return;
    setSavingSubaccount(true);
    setSetupError(null);
    setSuccessSetupMessage(null);
    try {
      const bankObj = banksList.find(b => b.code === selectedBankCode);
      const bankName = bankObj ? bankObj.name : 'Unknown Bank';

      const response = await fetch('/api/paystack/setup-subaccount', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bank_name: bankName,
          bank_code: selectedBankCode,
          account_number: accountNumber,
          account_name: resolvedAccountName
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSuccessSetupMessage('Your subaccount has been configured successfully. All settlements will be automatically routed here.');
        fetchEarningsData();
      } else {
        setSetupError(data.error || 'Failed to set up subaccount.');
      }
    } catch (err) {
      setSetupError('Failed to connect to the server.');
    } finally {
      setSavingSubaccount(false);
    }
  };

  // Trigger loads on tab changes or active state
  useEffect(() => {
    if (!token) return;
    if (activeTab === 'overview') {
      fetchOverview();
    } else if (activeTab === 'parks') {
      fetchParksAndStaff();
    } else if (activeTab === 'shipments') {
      fetchShipments(1);
    } else if (activeTab === 'earnings') {
      fetchEarningsData();
      fetchBanksList();
    }
  }, [activeTab, token]);

  // Handle Shipment Filters change
  const handleApplyShipmentFilters = (e: React.FormEvent) => {
    e.preventDefault();
    fetchShipments(1);
  };

  // --- BUSINESS LOGIC SUBMISSIONS ---

  // 1. Create New Park
  const handleCreatePark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParkModal.location.trim()) {
      setNewParkModal(prev => ({ ...prev, error: 'Branch location is required.' }));
      return;
    }
    setNewParkModal(prev => ({ ...prev, submitting: true, error: null }));
    try {
      const locationVal = newParkModal.location.trim();
      const generatedName = `${locationVal} Branch`;

      const response = await fetch('/api/company/parks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          park_name: generatedName,
          park_location: locationVal
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create park');
      }

      // Close modal and refresh parks list
      setNewParkModal({
        open: false,
        name: '',
        location: '',
        submitting: false,
        error: null
      });
      fetchParksAndStaff();
    } catch (err: any) {
      setNewParkModal(prev => ({ ...prev, submitting: false, error: err.message || 'An error occurred' }));
    }
  };

  // 2. Add Staff Member
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffModal.name.trim()) {
      setNewStaffModal(prev => ({ ...prev, error: 'Staff name is required.' }));
      return;
    }
    const cleanPhone = (newStaffModal.phone || '').replace(/[\s-]/g, '');
    if (cleanPhone && !/^[0-9]{11}$/.test(cleanPhone)) {
      setNewStaffModal(prev => ({ ...prev, error: 'Please enter a valid 11-digit phone number (e.g., 08012345678).' }));
      return;
    }
    setNewStaffModal(prev => ({ ...prev, submitting: true, error: null }));
    try {
      const response = await fetch('/api/company/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newStaffModal.name,
          phone: cleanPhone,
          park_id: newStaffModal.parkId
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add staff member');
      }

      // Store in success state for ONE-TIME clear-text PIN screen
      setPinSuccessState({
        open: true,
        name: data.staff.name,
        pin: data.pin
      });

      // Close staff modal
      setNewStaffModal({
        open: false,
        parkId: '',
        parkName: '',
        name: '',
        phone: '',
        submitting: false,
        error: null
      });

      // Refresh list
      fetchParksAndStaff();
    } catch (err: any) {
      setNewStaffModal(prev => ({ ...prev, submitting: false, error: err.message || 'An error occurred' }));
    }
  };

  // 3. Toggle Staff Active Status
  const handleToggleStaffActive = async (staffId: string) => {
    const activeToken = token || localStorage.getItem('auth_token');
    try {
      const response = await fetch(`/api/company/staff/${staffId}/toggle-active`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });
      if (response.ok) {
        fetchParksAndStaff();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to toggle staff active status');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to connect to the server');
    }
  };

  // 3.5 Confirm Reset Staff PIN
  const handleConfirmResetPin = async () => {
    const activeToken = token || localStorage.getItem('auth_token');
    const { staffId } = resetPinConfirmModal;
    if (!staffId) return;

    setResetPinConfirmModal(prev => ({ ...prev, submitting: true, error: null }));
    try {
      const response = await fetch(`/api/company/staff/${staffId}/reset-pin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setResetPinConfirmModal({
          open: false,
          staffId: '',
          staffName: '',
          submitting: false,
          error: null
        });
        setResetPinSuccessState({
          open: true,
          name: data.name,
          pin: data.pin
        });
      } else {
        setResetPinConfirmModal(prev => ({
          ...prev,
          submitting: false,
          error: data.error || 'Failed to reset PIN.'
        }));
      }
    } catch (err) {
      console.error(err);
      setResetPinConfirmModal(prev => ({
        ...prev,
        submitting: false,
        error: 'Failed to connect to the server.'
      }));
    }
  };

  // Manager Handlers
  const handleCreateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeToken = token || localStorage.getItem('auth_token');
    if (!newManagerModal.name.trim() || !newManagerModal.phone.trim()) {
      setNewManagerModal(prev => ({ ...prev, error: 'Manager name and 11-digit phone number are required.' }));
      return;
    }

    if (!/^\d{11}$/.test(newManagerModal.phone.trim())) {
      setNewManagerModal(prev => ({ ...prev, error: 'Phone number must be a valid 11-digit number (e.g. 08012345678).' }));
      return;
    }

    setNewManagerModal(prev => ({ ...prev, submitting: true, error: null }));

    try {
      const response = await fetch('/api/company/managers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeToken}`
        },
        body: JSON.stringify({
          park_id: newManagerModal.parkId,
          name: newManagerModal.name.trim(),
          phone: newManagerModal.phone.trim()
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create manager');
      }

      setManagerPinSuccessState({
        open: true,
        name: data.manager.name,
        pin: data.pin
      });

      setNewManagerModal({
        open: false,
        parkId: '',
        parkName: '',
        name: '',
        phone: '',
        submitting: false,
        error: null
      });

      fetchParksAndStaff();
    } catch (err: any) {
      setNewManagerModal(prev => ({ ...prev, submitting: false, error: err.message || 'An error occurred' }));
    }
  };

  const handleToggleManagerActive = (managerId: string, managerName: string, currentActive: boolean) => {
    const activeToken = token || localStorage.getItem('auth_token');
    const actionText = currentActive ? 'deactivate' : 'activate';
    
    showCustomConfirm({
      title: `${currentActive ? 'Suspend' : 'Activate'} Manager Access?`,
      message: `Are you sure you want to ${actionText} manager "${managerName}"?`,
      confirmText: currentActive ? 'Yes, Suspend' : 'Yes, Activate',
      onConfirm: async () => {
        const response = await fetch(`/api/company/managers/${managerId}/toggle-active`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeToken}`
          }
        });
        if (response.ok) {
          fetchParksAndStaff();
          if (selectedManagerProfile && selectedManagerProfile.id === managerId) {
            setSelectedManagerProfile(prev => prev ? { ...prev, active: !currentActive } : null);
          }
        } else {
          const err = await response.json();
          throw new Error(err.error || 'Failed to toggle manager active status');
        }
      },
    });
  };

  const handleDeleteManager = (managerId: string, managerName: string) => {
    const activeToken = token || localStorage.getItem('auth_token');
    
    showCustomConfirm({
      title: 'Permanently Delete Manager?',
      message: `Are you sure you want to permanently delete manager "${managerName}"? This action cannot be undone. They will lose all access immediately.`,
      confirmText: 'Delete Permanently',
      onConfirm: async () => {
        const response = await fetch(`/api/company/managers/${managerId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${activeToken}`
          }
        });
        const data = await response.json();
        if (response.ok) {
          fetchParksAndStaff();
          if (selectedManagerProfile && selectedManagerProfile.id === managerId) {
            setSelectedManagerProfile(null);
          }
        } else {
          throw new Error(data.error || 'Failed to delete manager');
        }
      },
    });
  };

  const handleDeleteStaffByCompany = (staffId: string, staffName: string) => {
    const activeToken = token || localStorage.getItem('auth_token');
    
    showCustomConfirm({
      title: 'Delete Staff Member?',
      message: `Are you sure you want to permanently delete staff member "${staffName}"? They will lose all access immediately and cannot sign in.`,
      confirmText: 'Delete Permanently',
      onConfirm: async () => {
        const response = await fetch(`/api/company/staff/${staffId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${activeToken}`
          }
        });
        const data = await response.json();
        if (response.ok) {
          fetchParksAndStaff();
        } else {
          throw new Error(data.error || 'Failed to delete staff member');
        }
      },
    });
  };

  // 4. Open Waybill Timeline Detail Modal
  const handleOpenWaybillTimeline = async (waybill: any) => {
    setDetailModal({
      open: true,
      waybill,
      route: null,
      driver: null,
      loading: true
    });
    try {
      const response = await fetch(`/api/track/${encodeURIComponent(waybill.tracking_code)}`);
      if (response.ok) {
        const data = await response.json();
        setDetailModal(prev => ({
          ...prev,
          route: data.route,
          driver: data.driver,
          loading: false
        }));
      } else {
        setDetailModal(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error('Failed to fetch route/driver details:', err);
      setDetailModal(prev => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between text-slate-800">
      
      {/* HEADER NAVBAR (Scrolls up naturally, Navy Blue) */}
      <header className="bg-[#0A1F44] text-white px-3 sm:px-6 py-3 sm:py-4 shadow-md sticky top-0 z-30 w-full">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Logo size="sm" showText={false} />
            <div className="min-w-0 flex-1">
              <span className="font-extrabold text-[9px] sm:text-[10px] text-amber-300 uppercase tracking-widest block leading-none truncate">
                {t('companyPortalTitle')}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                <span className="font-black text-sm sm:text-base text-white tracking-wide truncate max-w-[130px] xs:max-w-[180px] sm:max-w-[280px] md:max-w-none">
                  {user?.company_name || 'Waybilla Partner'}
                </span>
                <button
                  onClick={() => setShowModeSwitchModal(true)}
                  className="inline-flex items-center gap-1 bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-extrabold transition-all cursor-pointer shrink-0"
                  id="change-operation-mode-btn"
                  title="Click to switch operation mode"
                >
                  {isFleetOnly ? (
                    <>
                      <Truck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                      <span className="text-amber-300">🚛 Fleet</span>
                    </>
                  ) : isWaybillOnly ? (
                    <>
                      <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400 shrink-0" />
                      <span className="text-blue-300">📦 Waybills</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-emerald-300">⚡ Both</span>
                    </>
                  )}
                  <span className="text-[9px] sm:text-[10px] text-amber-400 hover:underline ml-0.5 font-normal">Change</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <LanguageSwitcher />
            <button
              onClick={logout}
              className="flex items-center gap-1.5 bg-[#F2A93B] hover:bg-[#d9922b] text-[#0A1F44] font-black px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs transition-all shadow-xs cursor-pointer border-0 shrink-0"
              id="header-logout-btn"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden xs:inline sm:inline">{t('signOut')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-8 flex-grow grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 min-w-0 overflow-x-hidden">
        
        {/* MOBILE NAVIGATION BAR (Horizontal Scrollable Pills) */}
        <div className="block lg:hidden col-span-1 bg-white border border-slate-200 rounded-2xl p-2 sm:p-2.5 shadow-xs overflow-x-auto flex items-center gap-1.5 w-full">
          {navTabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={`mob-tab-${tab.id}-${index}`}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer border-0 shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* DESKTOP SIDEBAR NAVIGATION TABS */}
        <nav className="hidden lg:block lg:col-span-3 space-y-2" id="owner-navigation-sidebar">
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-4 mb-2">Navigation Menu</p>
          {navTabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={`cmp-tab-${tab.id || index}-${index}`}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-extrabold flex items-center gap-3 transition-all cursor-pointer border-0 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                id={`tab-btn-${tab.id}`}
              >
                <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}

          <div className="pt-6 border-t border-slate-200 mt-6">
            <button
              onClick={logout}
              className="w-full text-left px-4 py-3.5 rounded-xl text-sm font-extrabold text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-all cursor-pointer border-0"
              id="sidebar-logout-btn"
            >
              <LogOut className="w-4.5 h-4.5 text-rose-500" />
              <span>Secure Logout</span>
            </button>
          </div>
        </nav>

        {/* WORKSPACE AREA (Progressive/skeleton loadings inside here) */}
        <main className="lg:col-span-9 space-y-6" id="dashboard-tab-content">
          
          {/* TAB: FLEET TRIP TRACKING */}
          {activeTab === 'fleet' && (
            <FleetManagementView 
              userRole="company" 
              initialSubTab={fleetInitialSubTab}
              autoOpenCreateTrip={autoOpenCreateTrip}
              onTripCreated={() => {
                setAutoOpenCreateTrip(false);
                fetchOverview();
              }}
            />
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6" id="overview-tab">
              
              {/* CEO EXECUTIVE ACTION BANNER / LAUNCH NEW TRIP */}
              <div 
                className="bg-gradient-to-br from-[#0A1F44] via-[#0E2756] to-[#15346A] text-white rounded-3xl p-5 sm:p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-indigo-950/40" 
                id="ceo-overview-dispatch-banner"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black flex items-center gap-2 tracking-tight text-white">
                      <Truck className="text-[#F2A93B] w-5 h-5 shrink-0" />
                      Executive Haulage & Fleet Dispatch
                    </h2>
                    <span className="bg-[#F2A93B]/20 text-[#F2A93B] border border-[#F2A93B]/30 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Instant Dispatch
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 max-w-2xl font-medium leading-relaxed">
                    Instantly launch a haulage round-trip, connect trucks with suppliers, and monitor live road milestones across your entire company network.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full md:w-auto shrink-0">
                  <button
                    onClick={handleLaunchNewTripFromOverview}
                    className="flex-1 md:flex-initial bg-[#F2A93B] hover:bg-[#d9922b] text-[#0A1F44] font-black px-5 py-3 sm:px-6 sm:py-3.5 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl transform active:scale-95 cursor-pointer border-0 shrink-0"
                    id="ceo-launch-new-trip-btn"
                  >
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5 stroke-[3]" />
                    <span>Launch New Trip</span>
                  </button>
                  <button
                    onClick={() => {
                      setFleetInitialSubTab('live_board');
                      setAutoOpenCreateTrip(false);
                      setActiveTab('fleet');
                    }}
                    className="flex-1 md:flex-initial bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer border border-white/20 shrink-0"
                    id="ceo-view-live-board-btn"
                  >
                    <Activity className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-400" />
                    <span>Live Board</span>
                  </button>
                </div>
              </div>

              {/* TOP SUMMARY CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                
                {isFleetOnly ? (
                  <>
                    {/* 1. Total Trucks Card */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm" id="stats-trucks-card">
                      {overviewState.loading ? (
                        <div className="space-y-3">
                          <Skeleton className="w-16 h-4" />
                          <Skeleton className="w-24 h-8" />
                        </div>
                      ) : overviewState.error ? (
                        <button onClick={fetchOverview} className="text-left w-full h-full text-rose-600 hover:text-rose-700 focus:outline-none">
                          <p className="text-xs font-bold text-slate-400">TOTAL TRUCKS</p>
                          <p className="text-xs font-semibold mt-2">Couldn't load this section. Tap to retry.</p>
                        </button>
                      ) : (
                        <div>
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">TOTAL TRUCKS</p>
                          <p className="text-3xl font-black text-[#0A1F44] mt-2">{(overviewState.stats as any)?.total_trucks ?? 0}</p>
                          <span className="text-[11px] font-extrabold text-blue-600 block mt-1.5 uppercase">Registered Fleet</span>
                        </div>
                      )}
                    </div>

                    {/* 2. Active Trips Card */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm" id="stats-trips-card">
                      {overviewState.loading ? (
                        <div className="space-y-3">
                          <Skeleton className="w-16 h-4" />
                          <Skeleton className="w-24 h-8" />
                        </div>
                      ) : overviewState.error ? (
                        <button onClick={fetchOverview} className="text-left w-full h-full text-rose-600 hover:text-rose-700 focus:outline-none">
                          <p className="text-xs font-bold text-slate-400">ACTIVE TRIPS</p>
                          <p className="text-xs font-semibold mt-2">Couldn't load this section. Tap to retry.</p>
                        </button>
                      ) : (
                        <div>
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">ACTIVE TRIPS</p>
                          <p className="text-3xl font-black text-[#0A1F44] mt-2">{(overviewState.stats as any)?.active_trips ?? 0}</p>
                          <span className="text-[11px] font-extrabold text-emerald-600 block mt-1.5 uppercase">In Transit</span>
                        </div>
                      )}
                    </div>

                    {/* 3. Total Drivers Card */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm" id="stats-drivers-card">
                      {overviewState.loading ? (
                        <div className="space-y-3">
                          <Skeleton className="w-16 h-4" />
                          <Skeleton className="w-24 h-8" />
                        </div>
                      ) : overviewState.error ? (
                        <button onClick={fetchOverview} className="text-left w-full h-full text-rose-600 hover:text-rose-700 focus:outline-none">
                          <p className="text-xs font-bold text-slate-400">TOTAL DRIVERS</p>
                          <p className="text-xs font-semibold mt-2">Couldn't load this section. Tap to retry.</p>
                        </button>
                      ) : (
                        <div>
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">TOTAL DRIVERS</p>
                          <p className="text-3xl font-black text-[#0A1F44] mt-2">{(overviewState.stats as any)?.total_drivers ?? 0}</p>
                          <span className="text-[11px] font-extrabold text-indigo-600 block mt-1.5 uppercase">Assigned Staff</span>
                        </div>
                      )}
                    </div>
                  </>
                ) : isBoth ? (
                  <>
                    {/* 1. Month Shipments Card */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm" id="stats-month-card">
                      {overviewState.loading ? (
                        <div className="space-y-3">
                          <Skeleton className="w-16 h-4" />
                          <Skeleton className="w-24 h-8" />
                        </div>
                      ) : (
                        <div>
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">WAYBILLS (30 DAYS)</p>
                          <p className="text-3xl font-black text-[#0A1F44] mt-2">{overviewState.stats?.total_shipments_month ?? 0}</p>
                          <span className="text-[11px] font-extrabold text-blue-600 block mt-1.5 uppercase">Waybills Dispatched</span>
                        </div>
                      )}
                    </div>

                    {/* 2. Active Staff Card */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm" id="stats-staff-card">
                      {overviewState.loading ? (
                        <div className="space-y-3">
                          <Skeleton className="w-16 h-4" />
                          <Skeleton className="w-24 h-8" />
                        </div>
                      ) : (
                        <div>
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">PARK STAFF</p>
                          <p className="text-3xl font-black text-[#0A1F44] mt-2">{overviewState.stats?.total_active_staff ?? 0}</p>
                          <span className="text-[11px] font-extrabold text-indigo-600 block mt-1.5 uppercase">Active Members</span>
                        </div>
                      )}
                    </div>

                    {/* 3. Total Trucks Card */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm" id="stats-trucks-card">
                      {overviewState.loading ? (
                        <div className="space-y-3">
                          <Skeleton className="w-16 h-4" />
                          <Skeleton className="w-24 h-8" />
                        </div>
                      ) : (
                        <div>
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">FLEET TRUCKS</p>
                          <p className="text-3xl font-black text-[#0A1F44] mt-2">{(overviewState.stats as any)?.total_trucks ?? 0}</p>
                          <span className="text-[11px] font-extrabold text-amber-600 block mt-1.5 uppercase">Registered Trucks</span>
                        </div>
                      )}
                    </div>

                    {/* 4. Active Fleet Trips */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm" id="stats-trips-card">
                      {overviewState.loading ? (
                        <div className="space-y-3">
                          <Skeleton className="w-16 h-4" />
                          <Skeleton className="w-24 h-8" />
                        </div>
                      ) : (
                        <div>
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">ACTIVE TRIPS</p>
                          <p className="text-3xl font-black text-[#0A1F44] mt-2">{(overviewState.stats as any)?.active_trips ?? 0}</p>
                          <span className="text-[11px] font-extrabold text-emerald-600 block mt-1.5 uppercase">In Transit</span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {/* 1. Week Shipments Card */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm" id="stats-week-card">
                      {overviewState.loading ? (
                        <div className="space-y-3">
                          <Skeleton className="w-16 h-4" />
                          <Skeleton className="w-24 h-8" />
                        </div>
                      ) : overviewState.error ? (
                        <button onClick={fetchOverview} className="text-left w-full h-full text-rose-600 hover:text-rose-700 focus:outline-none">
                          <p className="text-xs font-bold text-slate-400">SHIPMENTS (7 DAYS)</p>
                          <p className="text-xs font-semibold mt-2">Couldn't load this section. Tap to retry.</p>
                        </button>
                      ) : (
                        <div>
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">SHIPMENTS (7 DAYS)</p>
                          <p className="text-3xl font-black text-[#0A1F44] mt-2">{overviewState.stats?.total_shipments_week ?? 0}</p>
                          <span className="text-[11px] font-extrabold text-[#F2A93B] block mt-1.5 uppercase">Last 7 Days</span>
                        </div>
                      )}
                    </div>

                    {/* 2. Month Shipments Card */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm" id="stats-month-card">
                      {overviewState.loading ? (
                        <div className="space-y-3">
                          <Skeleton className="w-16 h-4" />
                          <Skeleton className="w-24 h-8" />
                        </div>
                      ) : overviewState.error ? (
                        <button onClick={fetchOverview} className="text-left w-full h-full text-rose-600 hover:text-rose-700 focus:outline-none">
                          <p className="text-xs font-bold text-slate-400">SHIPMENTS (30 DAYS)</p>
                          <p className="text-xs font-semibold mt-2">Couldn't load this section. Tap to retry.</p>
                        </button>
                      ) : (
                        <div>
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">SHIPMENTS (30 DAYS)</p>
                          <p className="text-3xl font-black text-[#0A1F44] mt-2">{overviewState.stats?.total_shipments_month ?? 0}</p>
                          <span className="text-[11px] font-extrabold text-emerald-600 block mt-1.5 uppercase">Last 30 Days</span>
                        </div>
                      )}
                    </div>

                    {/* 3. Active Staff Card */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm" id="stats-staff-card">
                      {overviewState.loading ? (
                        <div className="space-y-3">
                          <Skeleton className="w-16 h-4" />
                          <Skeleton className="w-24 h-8" />
                        </div>
                      ) : overviewState.error ? (
                        <button onClick={fetchOverview} className="text-left w-full h-full text-rose-600 hover:text-rose-700 focus:outline-none">
                          <p className="text-xs font-bold text-slate-400">ACTIVE STAFF</p>
                          <p className="text-xs font-semibold mt-2">Couldn't load this section. Tap to retry.</p>
                        </button>
                      ) : (
                        <div>
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">ACTIVE STAFF</p>
                          <p className="text-3xl font-black text-[#0A1F44] mt-2">{overviewState.stats?.total_active_staff ?? 0}</p>
                          <span className="text-[11px] font-extrabold text-indigo-600 block mt-1.5 uppercase">Enrolled Members</span>
                        </div>
                      )}
                    </div>

                    {/* 4. Earnings Card */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm" id="stats-earnings-card">
                      {overviewState.loading ? (
                        <div className="space-y-3">
                          <Skeleton className="w-16 h-4" />
                          <Skeleton className="w-24 h-8" />
                        </div>
                      ) : overviewState.error ? (
                        <button onClick={fetchOverview} className="text-left w-full h-full text-rose-600 hover:text-rose-700 focus:outline-none">
                          <p className="text-xs font-bold text-slate-400">EARNINGS (30 DAYS)</p>
                          <p className="text-xs font-semibold mt-2">Couldn't load this section. Tap to retry.</p>
                        </button>
                      ) : (
                        <div>
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">EARNINGS (30 DAYS)</p>
                          <p className="text-3xl font-black text-[#0A1F44] mt-2">₦{(overviewState.stats as any)?.total_earnings_month ?? 0}</p>
                          <span className="text-[11px] font-extrabold text-emerald-600 block mt-1.5 uppercase">Company Share</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

              </div>

              {/* REAL-TIME FLEET BOARD FOR FLEET MODE */}
              {isFleetOnly ? (
                <RealtimeFleetBoard userRole="company" />
              ) : (
                /* RECENT ACTIVITY CARD FOR PACKAGE MODE */
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6" id="overview-recent-activity">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-base font-extrabold text-[#0A1F44]">Recent Shipments</h2>
                    <p className="text-xs text-slate-500 mt-1">Last 5 waybills dispatched by your team</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('shipments')}
                    className="text-xs font-extrabold text-blue-600 hover:text-blue-700 bg-blue-50 px-3.5 py-2 rounded-xl transition-all cursor-pointer border-0"
                  >
                    View All
                  </button>
                </div>

                {overviewState.loading ? (
                  <div className="space-y-4">
                    <Skeleton className="w-full h-12" />
                    <Skeleton className="w-full h-12" />
                    <Skeleton className="w-full h-12" />
                  </div>
                ) : overviewState.error ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-slate-500">Couldn't load this section.</p>
                    <button
                      onClick={fetchOverview}
                      className="text-xs font-extrabold text-blue-600 hover:underline mt-2 cursor-pointer bg-transparent border-0"
                    >
                      Tap here to retry
                    </button>
                  </div>
                ) : overviewState.recentActivity.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-sm">
                    No recent waybill activity found for your company.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {overviewState.recentActivity.map((wb: any, index: number) => (
                      <div
                        key={`cmp-act-${wb.id || index}-${index}`}
                        onClick={() => handleOpenWaybillTimeline(wb)}
                        className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 -mx-6 px-6 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                            <Package className="w-4.5 h-4.5 text-[#0A1F44]" />
                          </div>
                          <div>
                            <p className="text-sm font-extrabold text-[#0A1F44]">{wb.tracking_code}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{wb.item_description || 'Waybill Package'}</p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:items-end gap-1">
                          <p className="text-xs font-semibold text-slate-600">
                            To: <span className="font-extrabold text-[#0A1F44]">{wb.destination_park}</span>
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(wb.created_at || wb.booked_at).toLocaleString()}
                          </p>
                        </div>

                        <div>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                            wb.status === 'collected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            wb.status === 'arrived' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            wb.status === 'departed' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-slate-50 text-slate-700 border-slate-200'
                          }`}>
                            {wb.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}

              {/* IF BOTH MODE: ALSO SHOW REAL-TIME FLEET BOARD */}
              {isBoth && (
                <div className="pt-4 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <Truck className="w-5 h-5 text-amber-500" />
                    <h3 className="text-base font-extrabold text-[#0A1F44]">Real-Time Fleet Operations</h3>
                  </div>
                  <RealtimeFleetBoard userRole="company" />
                </div>
              )}

            </div>
          )}

          {/* TAB 2: PARKS & STAFF */}
          {activeTab === 'parks' && (
            <div className="space-y-6" id="parks-tab">
              
              {/* TOP HEADER CONTROLS */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[#0A1F44]">Motor Parks & Branches</h2>
                  <p className="text-sm text-slate-500 mt-1">Manage your motor park locations and assign staff</p>
                </div>
                <button
                  onClick={() => setNewParkModal(prev => ({ ...prev, open: true }))}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-5 py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer border-0 shrink-0"
                  id="create-park-modal-btn"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Branch</span>
                </button>
              </div>

              {/* MAIN BODY LIST */}
              {parksState.loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Skeleton className="w-full h-48" />
                  <Skeleton className="w-full h-48" />
                </div>
              ) : parksState.error ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center shadow-sm">
                  <p className="text-slate-500 text-sm">Couldn't load company branches and staff lists.</p>
                  <button
                    onClick={fetchParksAndStaff}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-5 py-3 rounded-xl text-xs mt-4 transition-all shadow-sm cursor-pointer border-0"
                  >
                    Tap to Retry
                  </button>
                </div>
              ) : parksState.parks.length === 0 ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-10 text-center shadow-sm text-slate-500 space-y-4">
                  <p className="text-sm">You haven't added any motor park branches yet.</p>
                  <button
                    onClick={() => setNewParkModal(prev => ({ ...prev, open: true }))}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition-all border-0 cursor-pointer"
                  >
                    Add Your First Branch
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="parks-list-grid">
                  {parksState.parks.map((park: any, index: number) => (
                    <div key={`cmp-park-${park.id || index}-${index}`} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-6" id={`park-card-${park.id}`}>
                      
                      {/* PARK INFO */}
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                              <Building2 className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="font-extrabold text-base text-[#0A1F44]">{park.park_name}</h3>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span>Park location: <strong className="text-slate-700">{park.park_location}</strong></span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* PARK MANAGER SECTION */}
                        <div className="pt-4 border-t border-slate-100 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              ASSIGNED MANAGER ({park.managers?.length ?? 0})
                            </p>
                            {(!park.managers || park.managers.length === 0) && (
                              <button
                                onClick={() => setNewManagerModal({
                                  open: true,
                                  parkId: park.id,
                                  parkName: park.park_name,
                                  name: '',
                                  phone: '',
                                  submitting: false,
                                  error: null
                                })}
                                className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border-0"
                              >
                                + Add Manager
                              </button>
                            )}
                          </div>

                          {!park.managers || park.managers.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-1">No manager assigned to this park yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {park.managers.map((mgr: any) => (
                                <div
                                  key={mgr.id}
                                  onClick={() => setSelectedManagerProfile({
                                    id: mgr.id,
                                    name: mgr.name,
                                    phone: mgr.phone,
                                    active: mgr.active !== false,
                                    parkId: park.id,
                                    parkName: park.park_name
                                  })}
                                  className="flex items-center justify-between bg-indigo-50/60 hover:bg-indigo-100/60 border border-indigo-100 p-2.5 rounded-xl cursor-pointer transition-all hover:shadow-sm"
                                  title="Click to view profile & actions"
                                  id={`manager-item-${mgr.id}`}
                                >
                                  <div>
                                    <p className="text-xs font-extrabold text-[#0A1F44] flex items-center gap-1.5 flex-wrap">
                                      {mgr.name}
                                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                                        mgr.active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                      }`}>
                                        {mgr.active !== false ? 'Active' : 'Deactivated'}
                                      </span>
                                    </p>
                                    <p className="text-[10px] font-mono text-slate-600 mt-0.5">{mgr.phone}</p>
                                  </div>

                                  <div className="flex items-center text-slate-400">
                                    <ChevronRight className="w-4 h-4" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* STAFF LIST */}
                        <div className="pt-4 border-t border-slate-100">
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">
                            ASSIGNED STAFF ({park.staff?.length ?? 0})
                          </p>

                          {!park.staff || park.staff.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-2">No staff added to this park yet.</p>
                          ) : (
                            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                              {park.staff.map((st: any, index: number) => (
                                <div key={`cmp-stf-${st.id || index}-${index}`} className="flex items-center justify-between bg-slate-50 hover:bg-slate-100/70 p-2.5 rounded-xl transition-all">
                                  <div>
                                    <p className="text-xs font-extrabold text-[#0A1F44]">{st.name}</p>
                                    {st.phone && (
                                      <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{st.phone}</p>
                                    )}
                                    <p className="text-[9px] text-slate-400 mt-0.5">
                                      Added: {new Date(st.created_at).toLocaleDateString()}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase border ${
                                      st.active 
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                        : 'bg-rose-50 text-rose-700 border-rose-200'
                                    }`}>
                                      {st.active ? 'Active' : 'Inactive'}
                                    </span>
                                    
                                    <button
                                      onClick={() => handleToggleStaffActive(st.id)}
                                      className={`p-1.5 rounded-lg border-0 cursor-pointer transition-all ${
                                        st.active
                                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                                      }`}
                                      title={st.active ? "Deactivate PIN login" : "Activate PIN login"}
                                      id={`toggle-staff-btn-${st.id}`}
                                    >
                                      <Power className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      onClick={() => setResetPinConfirmModal({
                                        open: true,
                                        staffId: st.id,
                                        staffName: st.name,
                                        submitting: false,
                                        error: null
                                      })}
                                      className="p-1.5 rounded-lg border-0 cursor-pointer transition-all bg-blue-50 hover:bg-blue-100 text-blue-600"
                                      title="Reset PIN"
                                      id={`reset-staff-pin-btn-${st.id}`}
                                    >
                                      <Key className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      onClick={() => handleDeleteStaffByCompany(st.id, st.name)}
                                      className="p-1.5 rounded-lg border-0 cursor-pointer transition-all bg-red-50 hover:bg-red-100 text-red-600"
                                      title="Permanently Delete Staff Member"
                                      id={`delete-staff-btn-${st.id}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ADD STAFF BUTTON FOR THIS PARK */}
                      <button
                        onClick={() => setNewStaffModal({
                          open: true,
                          parkId: park.id,
                          parkName: park.park_name,
                          name: '',
                          submitting: false,
                          error: null
                        })}
                        className="w-full bg-slate-100 hover:bg-blue-600 hover:text-white text-[#0A1F44] font-extrabold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border-0 mt-2"
                        id={`add-staff-btn-park-${park.id}`}
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Add Staff to This Branch</span>
                      </button>

                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* TAB 3: SHIPMENTS */}
          {activeTab === 'shipments' && (
            <div className="space-y-6" id="shipments-tab">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[#0A1F44]">Shipment Catalog</h2>
                  <p className="text-sm text-slate-500 mt-1">Audit, search, and page through all company waybills</p>
                </div>
              </div>

              {/* SEARCH & FILTER CONTROLS */}
              <form onSubmit={handleApplyShipmentFilters} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-4 items-end" id="shipments-filter-form">
                
                {/* Search */}
                <div className="md:col-span-4 space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Search</label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Code, sender, receiver name/phone..."
                      value={shipmentFilters.search || ''}
                      onChange={e => setShipmentFilters(prev => ({ ...prev, search: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Status</label>
                  <select
                    value={shipmentFilters.status || 'all'}
                    onChange={e => setShipmentFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 px-3.5 text-xs font-bold text-slate-600 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="all">All Statuses</option>
                    <option value="booked">Booked</option>
                    <option value="departed">Departed</option>
                    <option value="arrived">Arrived</option>
                    <option value="collected">Collected</option>
                  </select>
                </div>

                {/* Start Date */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">From Date</label>
                  <input
                    type="date"
                    value={shipmentFilters.startDate || ''}
                    onChange={e => setShipmentFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2 pl-3 pr-3 text-xs font-semibold text-slate-600 focus:outline-none"
                  />
                </div>

                {/* End Date */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">To Date</label>
                  <input
                    type="date"
                    value={shipmentFilters.endDate || ''}
                    onChange={e => setShipmentFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2 pl-3 pr-3 text-xs font-semibold text-slate-600 focus:outline-none"
                  />
                </div>

                {/* Apply Button */}
                <div className="md:col-span-1">
                  <button
                    type="submit"
                    className="w-full bg-[#0A1F44] hover:bg-slate-800 text-white font-extrabold p-2.5 rounded-xl text-xs flex items-center justify-center transition-all cursor-pointer border-0"
                    id="apply-filters-btn"
                  >
                    <Filter className="w-3.5 h-3.5" />
                  </button>
                </div>

              </form>

              {/* TABLE CONTAINER */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden" id="shipments-table-card">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-extrabold uppercase tracking-wider">
                        <th className="p-4 pl-6">Tracking Code</th>
                        <th className="p-4">Item</th>
                        <th className="p-4">Origin</th>
                        <th className="p-4">Destination</th>
                        <th className="p-4">Created Date</th>
                        <th className="p-4">Vehicle Plate</th>
                        <th className="p-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shipmentsState.loading ? (
                        [...Array(5)].map((_, i) => (
                          <tr key={`cmp-skel-${i}`}>
                            <td className="p-4 pl-6"><Skeleton className="w-24 h-4" /></td>
                            <td className="p-4"><Skeleton className="w-32 h-4" /></td>
                            <td className="p-4"><Skeleton className="w-16 h-4" /></td>
                            <td className="p-4"><Skeleton className="w-16 h-4" /></td>
                            <td className="p-4"><Skeleton className="w-20 h-4" /></td>
                            <td className="p-4"><Skeleton className="w-16 h-4" /></td>
                            <td className="p-4"><Skeleton className="w-14 h-4" /></td>
                          </tr>
                        ))
                      ) : shipmentsState.error ? (
                        <tr>
                          <td colSpan={7} className="text-center py-10 text-rose-600">
                            <p>Couldn't load shipments data.</p>
                            <button
                              onClick={() => fetchShipments(1)}
                              className="text-xs font-extrabold text-blue-600 hover:underline mt-2 cursor-pointer bg-transparent border-0 animate-pulse"
                            >
                              Tap to Retry
                            </button>
                          </td>
                        </tr>
                      ) : shipmentsState.waybills.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-500 font-medium">
                            No shipments matching your search filters.
                          </td>
                        </tr>
                      ) : (
                        shipmentsState.waybills.map((wb: any, index: number) => (
                          <tr
                            key={`cmp-wb-${wb.id || index}-${index}`}
                            onClick={() => handleOpenWaybillTimeline(wb)}
                            className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                            id={`waybill-row-${wb.tracking_code}`}
                          >
                            <td className="p-4 pl-6 font-extrabold text-blue-600 group-hover:underline">
                              {wb.tracking_code}
                            </td>
                            <td className="p-4 font-semibold text-[#0A1F44] max-w-[180px] truncate">
                              {wb.item_description || 'Waybill Package'}
                            </td>
                            <td className="p-4 text-slate-600 font-semibold">{wb.origin_park}</td>
                            <td className="p-4 text-slate-600 font-semibold">{wb.destination_park}</td>
                            <td className="p-4 text-slate-400">
                              {new Date(wb.created_at || wb.booked_at).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-slate-700 font-extrabold">{wb.bus_number || 'N/A'}</td>
                            <td className="p-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                                wb.status === 'collected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                wb.status === 'arrived' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                wb.status === 'departed' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-slate-50 text-slate-700 border-slate-200'
                              }`}>
                                {wb.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* PAGINATION PANEL */}
                {!shipmentsState.loading && !shipmentsState.error && shipmentsState.pages > 1 && (
                  <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      Showing Page <strong>{shipmentsState.page}</strong> of <strong>{shipmentsState.pages}</strong> ({shipmentsState.total} total shipments)
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fetchShipments(shipmentsState.page - 1)}
                        disabled={shipmentsState.page <= 1}
                        className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white text-slate-600 transition-all cursor-pointer shrink-0"
                        id="prev-page-btn"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => fetchShipments(shipmentsState.page + 1)}
                        disabled={shipmentsState.page >= shipmentsState.pages}
                        className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white text-slate-600 transition-all cursor-pointer shrink-0"
                        id="next-page-btn"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

              </div>

            </div>
          )}

          {/* TAB 4: EARNINGS */}
          {activeTab === 'earnings' && (
            <div className="space-y-6" id="earnings-tab">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[#0A1F44]">Revenue & Automated Settlements</h2>
                  <p className="text-sm text-slate-500 mt-1">Real-time split revenue metrics and Paystack settlement subaccount routing</p>
                </div>
              </div>

              {earningsState.loading ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="w-full h-28" />
                    <Skeleton className="w-full h-28" />
                    <Skeleton className="w-full h-28" />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <Skeleton className="lg:col-span-5 h-80" />
                    <Skeleton className="lg:col-span-7 h-80" />
                  </div>
                </div>
              ) : earningsState.error ? (
                <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm space-y-4">
                  <div className="mx-auto w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center border border-rose-100">
                    <AlertCircle className="w-6 h-6 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-[#0A1F44]">Failed to load Earnings data</h3>
                    <p className="text-xs text-slate-500 mt-1">Check your connection or try again shortly.</p>
                  </div>
                  <button
                    onClick={fetchEarningsData}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-5 py-3 rounded-xl text-xs transition-all shadow-sm cursor-pointer border-0"
                  >
                    Tap to Retry
                  </button>
                </div>
              ) : (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* METRIC COUNTERS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Settled / Received Bank Balance */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between" id="earnings-card-settled">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider">Settled & Received (Bank)</p>
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full">T+1 Cleared</span>
                        </div>
                        <p className="text-3xl font-black text-emerald-700">₦{earningsState.stats?.earnings_month ?? 0}</p>
                      </div>
                      <span className="text-[11px] font-extrabold text-slate-400 block mt-4 uppercase">Last 30 Days Settled</span>
                    </div>

                    {/* Pending Settlement (T+1 Payout) */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between" id="earnings-card-pending">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider">Pending Settlement</p>
                          <span className="bg-amber-50 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full">Awaiting Next Day</span>
                        </div>
                        <p className="text-3xl font-black text-amber-600">₦{earningsState.stats?.pending_earnings_month ?? 0}</p>
                      </div>
                      <span className="text-[11px] font-extrabold text-slate-400 block mt-4 uppercase">In Paystack T+1 Queue</span>
                    </div>

                    {/* All-Time Settled Revenue */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between" id="earnings-card-alltime">
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">All-Time Settled Bank</p>
                        <p className="text-3xl font-black text-[#0A1F44]">₦{earningsState.stats?.earnings_all_time ?? 0}</p>
                      </div>
                      <span className="text-[11px] font-extrabold text-indigo-600 block mt-4 uppercase">Total Received</span>
                    </div>

                  </div>

                  {/* SUBACCOUNT SETUP & HISTORIC LOGS GRID */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* LEFT COLUMN: SETUP CARD */}
                    <div className="lg:col-span-5 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6" id="bank-subaccount-setup-panel">
                      <div className="border-b border-slate-100 pb-4">
                        <h3 className="font-extrabold text-base text-[#0A1F44]">Paystack Subaccount Setup</h3>
                        <p className="text-xs text-slate-500 mt-1">Configure where your split earnings are routed</p>
                      </div>

                      {successSetupMessage && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-xs font-semibold text-emerald-700">
                          {successSetupMessage}
                        </div>
                      )}

                      {!isEditingBank && earningsState.subaccount?.paystack_subaccount_code ? (
                        /* CONFIGURED STATE SCREEN */
                        <div className="space-y-5" id="subaccount-active-view">
                          <div className="flex items-center gap-3 bg-emerald-50/50 border border-emerald-100/50 p-4 rounded-xl">
                            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0 border border-emerald-200">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div>
                              <p className="text-xs font-extrabold text-emerald-900">Settlements Routing Active</p>
                              <p className="text-[10px] text-emerald-700 mt-0.5">Your automated splits are running live</p>
                            </div>
                          </div>

                          <div className="space-y-3.5 bg-slate-50/50 border border-slate-100 rounded-xl p-4.5 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Bank Name</span>
                              <span className="font-extrabold text-[#0A1F44]">{earningsState.subaccount.bank_name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Account Number</span>
                              <span className="font-extrabold text-[#0A1F44] tracking-wider">{earningsState.subaccount.account_number}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Account Name</span>
                              <span className="font-extrabold text-[#0A1F44] truncate max-w-[200px]">{earningsState.subaccount.account_name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Subaccount Code</span>
                              <span className="font-extrabold text-blue-600 select-all tracking-wider font-mono">{earningsState.subaccount.paystack_subaccount_code}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2.5 border-t border-slate-200/50 mt-1">
                              <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Your Profit Split</span>
                              <span className="bg-blue-50 text-blue-700 font-black px-2 py-0.5 rounded-md text-[11px]">{earningsState.subaccount.split_percentage}% Share</span>
                            </div>
                          </div>

                          <button
                            onClick={() => setIsEditingBank(true)}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-[#0A1F44] font-extrabold py-3 px-4 rounded-xl text-xs transition-all cursor-pointer border-0"
                            id="edit-bank-btn"
                          >
                            Update Settlement Account
                          </button>
                        </div>
                      ) : (
                        /* EDIT/FORM STATE SCREEN */
                        <form onSubmit={handleSaveSubaccount} className="space-y-4" id="subaccount-setup-form">
                          <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                            The Senders' flat Waybill Fee (₦200) is paid via secure online payment. Your configured split share (e.g. 30%) is paid straight to your Nigerian bank subaccount automatically.
                          </p>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Settlement Bank</label>
                            <select
                              value={selectedBankCode}
                              onChange={e => {
                                setSelectedBankCode(e.target.value);
                                setResolvedAccountName('');
                              }}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-3.5 text-xs font-bold text-slate-600 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                              id="settlement-bank-select"
                            >
                              {banksList.length === 0 ? (
                                <option value="">Loading banks...</option>
                              ) : (
                                banksList.map((bank, index) => (
                                  <option key={`cmp-bank-${bank.code || index}-${index}`} value={bank.code}>{bank.name}</option>
                                ))
                              )}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">10-Digit Account Number</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                maxLength={10}
                                placeholder="0123456789"
                                value={accountNumber}
                                onChange={e => {
                                  setAccountNumber(e.target.value.replace(/[^0-9]/g, ''));
                                  setResolvedAccountName('');
                                }}
                                className="flex-1 bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 tracking-widest"
                                required
                                id="bank-account-input"
                              />
                              <button
                                type="button"
                                onClick={handleVerifyAccount}
                                disabled={verifyingAccount || accountNumber.length !== 10}
                                className="bg-[#0A1F44] hover:bg-slate-800 disabled:opacity-40 text-white font-extrabold px-4.5 py-3 rounded-xl text-xs transition-all border-0 cursor-pointer shrink-0"
                                id="verify-account-btn"
                              >
                                {verifyingAccount ? 'Verifying...' : 'Verify'}
                              </button>
                            </div>
                          </div>

                          {resolvedAccountName && (
                            <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3.5 space-y-1 animate-fade-in" id="verified-account-name-box">
                              <p className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-widest leading-none">VERIFIED ACCOUNT NAME</p>
                              <p className="text-xs font-black text-[#0A1F44] mt-1">{resolvedAccountName}</p>
                            </div>
                          )}

                          {setupError && (
                            <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                              {setupError}
                            </p>
                          )}

                          <div className="flex gap-3 pt-2">
                            {earningsState.subaccount?.paystack_subaccount_code && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsEditingBank(false);
                                  setSetupError(null);
                                }}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-[#0A1F44] font-extrabold py-3.5 px-4 rounded-xl text-xs transition-all cursor-pointer border-0"
                                id="cancel-edit-bank-btn"
                              >
                                Cancel
                              </button>
                            )}
                            <button
                              type="submit"
                              disabled={savingSubaccount || !resolvedAccountName}
                              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs transition-all shadow-sm cursor-pointer border-0"
                              id="save-subaccount-btn"
                            >
                              {savingSubaccount ? 'Saving Routing...' : 'Register Settlement Hub'}
                            </button>
                          </div>
                        </form>
                      )}

                    </div>

                    {/* RIGHT COLUMN: HISTORIC TRANSACTIONS LOG */}
                    <div className="lg:col-span-7 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6" id="earnings-history-panel">
                      <div className="border-b border-slate-100 pb-4">
                        <h3 className="font-extrabold text-base text-[#0A1F44]">Historic Settlement Logs</h3>
                        <p className="text-xs text-slate-500 mt-1">Audit log of your split shares processed successfully by Paystack</p>
                      </div>

                      {earningsState.history.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-xs">
                          No settled split transactions have been recorded yet.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-left text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-extrabold uppercase tracking-wider">
                                <th className="p-3 pl-4">Date/Time</th>
                                <th className="p-3">Waybill Code</th>
                                <th className="p-3">Settlement Status</th>
                                <th className="p-3 text-right">Fee</th>
                                <th className="p-3 text-right text-[#0A1F44]">Your Split</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {earningsState.history.map((item, index) => {
                                const isSettled = item.settlement_status === "settled";
                                return (
                                  <tr key={`cmp-earn-${item.id || index}-${index}`} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-3 pl-4 text-slate-500">
                                      {new Date(item.confirmed_at).toLocaleDateString()}
                                      <span className="block text-[10px] text-slate-400 mt-0.5">
                                        {new Date(item.confirmed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </td>
                                    <td className="p-3">
                                      <span className="font-extrabold text-blue-600 block">{item.waybill_code}</span>
                                      <span className="text-[10px] text-slate-400 block mt-0.5 truncate max-w-[140px]">Ref: {item.reference}</span>
                                    </td>
                                    <td className="p-3">
                                      {isSettled ? (
                                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full text-[10px]">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Settled / Received
                                        </span>
                                      ) : (
                                        <div className="space-y-1">
                                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-full text-[10px]">
                                            Pending T+1 Payout
                                          </span>
                                          <button
                                            onClick={() => handleSettlePayment(item.id)}
                                            className="block text-[10px] font-extrabold text-blue-600 hover:text-blue-800 underline cursor-pointer bg-transparent border-0 p-0"
                                            title="Confirm bank settlement received"
                                          >
                                            Mark Received
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-3 text-right font-semibold text-slate-600">
                                      ₦{item.amount}
                                    </td>
                                    <td className={`p-3 text-right font-black text-sm ${isSettled ? 'text-emerald-600' : 'text-amber-600'}`}>
                                      {isSettled ? `+₦${item.company_share}` : `₦${item.company_share} (Pending)`}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                    </div>

                  </div>

                </div>
              )}

            </div>
          )}

        </main>
      </div>

      {/* FOOTER */}
      <footer className="py-6 text-center text-xs text-slate-400 border-t border-slate-100 bg-white">
        &copy; {new Date().getFullYear()} Waybilla Partner Portal. All rights reserved.
      </footer>

      {/* --- POPUPS & MODALS --- */}

      {/* 1. CREATE NEW PARK MODAL */}
      {newParkModal.open && (
        <div className="fixed inset-0 bg-[#0A1F44]/40 backdrop-blur-xs flex items-center justify-center p-6 z-50 animate-fade-in" id="create-park-modal">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-6">
            <button
              onClick={() => setNewParkModal(prev => ({ ...prev, open: false }))}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-all cursor-pointer border-0"
              id="close-park-modal-btn"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-lg font-extrabold text-[#0A1F44]">Create New Branch</h3>
              <p className="text-xs text-slate-500 mt-1">Register a new motor park or branch location in Nigeria</p>
            </div>

            <form onSubmit={handleCreatePark} className="space-y-4">

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Branch Location / State / Town</label>
                <input
                  type="text"
                  placeholder="e.g. Lagos, Abuja, Port Harcourt, Nnewi"
                  value={newParkModal.location}
                  onChange={e => setNewParkModal(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              {newParkModal.error && (
                <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                  {newParkModal.error}
                </p>
              )}

              <button
                type="submit"
                disabled={newParkModal.submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs transition-colors shadow-sm cursor-pointer border-0 disabled:opacity-50"
                id="submit-park-btn"
              >
                {newParkModal.submitting ? 'Creating Branch...' : 'Create Branch'}
              </button>

            </form>
          </div>
        </div>
      )}

      {/* 2. ADD STAFF MEMBER MODAL */}
      {newStaffModal.open && (
        <div className="fixed inset-0 bg-[#0A1F44]/40 backdrop-blur-xs flex items-center justify-center p-6 z-50 animate-fade-in" id="add-staff-modal">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-6">
            <button
              onClick={() => setNewStaffModal(prev => ({ ...prev, open: false }))}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-all cursor-pointer border-0"
              id="close-staff-modal-btn"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-lg font-extrabold text-[#0A1F44]">Assign New Staff Member</h3>
              <p className="text-xs text-slate-500 mt-1">Assign an operator to <strong>{newStaffModal.parkName}</strong></p>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Staff Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Obi"
                  value={newStaffModal.name}
                  onChange={e => setNewStaffModal(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Staff Phone Number (Optional)</label>
                <input
                  type="tel"
                  placeholder="e.g. 08012345678"
                  value={newStaffModal.phone}
                  onChange={e => setNewStaffModal(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {newStaffModal.error && (
                <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                  {newStaffModal.error}
                </p>
              )}

              <button
                type="submit"
                disabled={newStaffModal.submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs transition-all shadow-sm cursor-pointer border-0 disabled:opacity-50"
                id="submit-staff-btn"
              >
                {newStaffModal.submitting ? 'Registering Staff...' : 'Add Staff Operator'}
              </button>

            </form>
          </div>
        </div>
      )}

      {/* 2.5 RESET PIN CONFIRMATION MODAL */}
      {resetPinConfirmModal.open && (
        <div className="fixed inset-0 bg-[#0A1F44]/40 backdrop-blur-xs flex items-center justify-center p-6 z-50 animate-fade-in" id="reset-pin-confirm-modal">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-6">
            <button
              onClick={() => setResetPinConfirmModal(prev => ({ ...prev, open: false }))}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-all cursor-pointer border-0"
              id="close-reset-confirm-modal-btn"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center border border-amber-100">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#0A1F44]">Reset Staff PIN?</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Are you sure you want to reset <strong>{resetPinConfirmModal.staffName}</strong>'s PIN? Their current PIN will stop working immediately.
                </p>
              </div>
            </div>

            {resetPinConfirmModal.error && (
              <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                {resetPinConfirmModal.error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setResetPinConfirmModal(prev => ({ ...prev, open: false }))}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-[#0A1F44] font-extrabold py-3.5 px-4 rounded-xl text-xs transition-all cursor-pointer border-0"
                id="cancel-reset-pin-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResetPin}
                disabled={resetPinConfirmModal.submitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs transition-all shadow-sm cursor-pointer border-0 disabled:opacity-50"
                id="submit-reset-pin-btn"
              >
                {resetPinConfirmModal.submitting ? 'Resetting...' : 'Yes, Reset PIN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2.6 RESET PIN SUCCESS DIALOG */}
      {resetPinSuccessState && resetPinSuccessState.open && (
        <div className="fixed inset-0 bg-[#0A1F44]/50 backdrop-blur-xs flex items-center justify-center p-6 z-55 animate-fade-in" id="reset-pin-success-modal">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl text-center space-y-6 border border-emerald-100">
            <div className="mx-auto w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-[#0A1F44]">PIN Reset Successfully!</h3>
              <p className="text-xs text-slate-500">
                You reset <strong>{resetPinSuccessState.name}</strong>'s PIN. Their new secure login PIN is:
              </p>
            </div>

            {/* LARGE PIN PIN DISPLAY */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl py-5 px-6 space-y-2">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">NEW SECURE PASSCODE PIN</p>
              <p className="text-4xl font-black text-[#0A1F44] tracking-widest mt-2">{resetPinSuccessState.pin}</p>
            </div>

            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex gap-3 text-left">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-extrabold text-rose-900">Write This Down Now</h4>
                <p className="text-[11px] text-rose-700 mt-1 leading-relaxed">
                  Write this down now — it will not be shown again. After closing this screen, the new PIN cannot be retrieved.
                </p>
              </div>
            </div>

            <button
              onClick={() => setResetPinSuccessState(null)}
              className="w-full bg-[#0A1F44] hover:bg-slate-800 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs transition-all shadow-sm cursor-pointer border-0"
              id="confirm-reset-pin-close-btn"
            >
              I Have Written It Down
            </button>
          </div>
        </div>
      )}

      {/* 3. ONE-TIME PIN SUCCESS DIALOG */}
      {pinSuccessState && pinSuccessState.open && (
        <div className="fixed inset-0 bg-[#0A1F44]/50 backdrop-blur-xs flex items-center justify-center p-6 z-55 animate-fade-in" id="pin-success-modal">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl text-center space-y-6 border border-emerald-100">
            <div className="mx-auto w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-[#0A1F44]">Staff Registered Successfully!</h3>
              <p className="text-xs text-slate-500">
                You registered operator <strong>{pinSuccessState.name}</strong>. Their secure login PIN has been generated:
              </p>
            </div>

            {/* LARGE PIN PIN DISPLAY */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl py-5 px-6 space-y-2">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">SECURE PASSCODE PIN</p>
              <p className="text-4xl font-black text-[#0A1F44] tracking-widest mt-2">{pinSuccessState.pin}</p>
            </div>

            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex gap-3 text-left">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-extrabold text-rose-900">One-Time Warning</h4>
                <p className="text-[11px] text-rose-700 mt-1 leading-relaxed">
                  Write this passcode PIN down now. It will not be shown again. To maintain absolute login security, our database only stores cryptographic hashes.
                </p>
              </div>
            </div>

            <button
              onClick={() => setPinSuccessState(null)}
              className="w-full bg-[#0A1F44] hover:bg-slate-800 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs transition-all shadow-sm cursor-pointer border-0"
              id="confirm-pin-btn"
            >
              I Have Written It Down
            </button>
          </div>
        </div>
      )}

      {/* 4. WAYBILL TIMELINE DETAIL MODAL */}
      {detailModal.open && detailModal.waybill && (
        <div className="fixed inset-0 bg-[#0A1F44]/40 backdrop-blur-xs flex items-center justify-center p-6 z-50 animate-fade-in" id="waybill-timeline-modal">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setDetailModal({ open: false, waybill: null, route: null, driver: null, loading: false })}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-all cursor-pointer border-0"
              id="close-timeline-modal-btn"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-lg font-extrabold text-[#0A1F44]">Waybill Dispatch Timeline</h3>
              <p className="text-xs text-slate-500 mt-1">
                Tracking code: <strong className="text-blue-600">{detailModal.waybill.tracking_code}</strong>
              </p>
              {detailModal.waybill.creator_staff_name && (
                <div className="mt-2.5 p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs flex items-center justify-between">
                  <span className="font-bold text-blue-900">Issued by Park Staff:</span>
                  <span className="font-black text-blue-800">
                    {detailModal.waybill.creator_staff_name} {detailModal.waybill.creator_staff_phone ? `(${detailModal.waybill.creator_staff_phone})` : ''}
                  </span>
                </div>
              )}
            </div>

            {detailModal.loading ? (
              <div className="space-y-4 py-6">
                <Skeleton className="w-full h-8" />
                <Skeleton className="w-full h-24" />
                <Skeleton className="w-full h-12" />
              </div>
            ) : (
              <ShipmentTimeline
                waybill={detailModal.waybill}
                route={detailModal.route}
                driver={detailModal.driver}
                showConfirmButton={false}
              />
            )}
          </div>
        </div>
      )}


      {/* 5. ADD MANAGER MODAL */}
      {newManagerModal.open && (
        <div className="fixed inset-0 bg-[#0A1F44]/40 backdrop-blur-xs flex items-center justify-center p-6 z-50 animate-fade-in" id="add-manager-modal">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-6">
            <button
              onClick={() => setNewManagerModal(prev => ({ ...prev, open: false }))}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-all cursor-pointer border-0"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-lg font-extrabold text-[#0A1F44]">Assign Park Manager</h3>
              <p className="text-xs text-slate-500 mt-1">Assign a Manager for <strong>{newManagerModal.parkName}</strong></p>
            </div>

            <form onSubmit={handleCreateManager} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Manager Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Chidi Nnamdi"
                  value={newManagerModal.name}
                  onChange={e => setNewManagerModal(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">11-Digit Phone Number (Login ID) *</label>
                <input
                  type="tel"
                  placeholder="e.g. 08012345678"
                  value={newManagerModal.phone}
                  onChange={e => setNewManagerModal(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900 font-semibold space-y-1">
                <p>• Managers create their own secret 6-digit PIN on sign-in.</p>
                <p>• The system automatically verifies their phone number against your transport company.</p>
              </div>

              {newManagerModal.error && (
                <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                  {newManagerModal.error}
                </p>
              )}

              <button
                type="submit"
                disabled={newManagerModal.submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs transition-all shadow-sm cursor-pointer border-0 disabled:opacity-50"
              >
                {newManagerModal.submitting ? 'Assigning Manager...' : 'Assign Manager'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 6. MANAGER ASSIGNED SUCCESS MODAL */}
      {managerPinSuccessState?.open && (
        <div className="fixed inset-0 bg-[#0A1F44]/40 backdrop-blur-xs flex items-center justify-center p-6 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-6 text-center">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-[#0A1F44]">Manager Assigned Successfully</h3>
              <p className="text-xs text-slate-500 mt-1">
                <strong>{managerPinSuccessState.name}</strong> has been assigned as Park Manager.
              </p>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl text-xs text-indigo-950 font-semibold space-y-2 text-left">
              <p className="font-extrabold text-indigo-900 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-indigo-600" /> Instructions for {managerPinSuccessState.name}:
              </p>
              <p>1. Go to the <strong>Manager Sign In</strong> page.</p>
              <p>2. Enter their 11-digit phone number.</p>
              <p>3. The system will recognize their transport company assignment and prompt them to <strong>create their own private 6-digit PIN</strong>.</p>
            </div>

            <button
              onClick={() => setManagerPinSuccessState(null)}
              className="w-full bg-[#0A1F44] text-white font-bold py-3.5 rounded-xl text-xs hover:bg-[#07152e] cursor-pointer transition-all border-0"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* 7. MANAGER PROFILE SLIDE-OVER PANEL */}
      {selectedManagerProfile && (
        <div className="fixed inset-0 bg-[#0A1F44]/40 backdrop-blur-xs flex justify-end z-50 overflow-hidden" id="manager-profile-slideover">
          <style>{`
            @keyframes slideInRight {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
            .animate-slide-in {
              animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>
          {/* Backdrop */}
          <div 
            className="absolute inset-0 cursor-pointer"
            onClick={() => setSelectedManagerProfile(null)}
          />

          {/* Slide-over Container */}
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col justify-between h-full relative z-10 animate-slide-in">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#0A1F44]">Manager Profile</h3>
                  <p className="text-[10px] text-slate-500 font-medium">View details and manage permissions</p>
                </div>
              </div>
              
              <button
                onClick={() => setSelectedManagerProfile(null)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors border-0 cursor-pointer bg-transparent"
                id="close-profile-slideover-btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Visual Header card */}
              <div className="text-center p-6 bg-gradient-to-b from-indigo-50/40 to-white border border-indigo-100/50 rounded-2xl relative overflow-hidden">
                <div className="w-16 h-16 bg-indigo-100/80 rounded-full flex items-center justify-center mx-auto mb-3 text-indigo-700 text-lg font-black border-4 border-white shadow-sm">
                  {selectedManagerProfile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <h4 className="text-base font-black text-[#0A1F44]">{selectedManagerProfile.name}</h4>
                <p className="text-xs text-slate-500 font-mono mt-1 flex items-center justify-center gap-1.5">
                  <Phone className="w-3 h-3 text-slate-400" /> {selectedManagerProfile.phone}
                </p>

                <div className="mt-4 flex justify-center">
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                    selectedManagerProfile.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {selectedManagerProfile.active ? 'Active Access' : 'Access Suspended'}
                  </span>
                </div>
              </div>

              {/* Detail specs */}
              <div className="space-y-4">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                  Assignment & Authority
                </p>
                
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Assigned Park</span>
                    <span className="font-extrabold text-[#0A1F44] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                      {selectedManagerProfile.parkName}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Authority Level</span>
                    <span className="font-extrabold text-slate-700">
                      Park Administrator
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Access Status</span>
                    <span className={`font-black uppercase text-[10px] ${selectedManagerProfile.active ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {selectedManagerProfile.active ? 'Full Access Allowed' : 'No Access'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Info advice box */}
              <div className="bg-amber-50/50 border border-amber-100/80 p-4 rounded-xl text-xs text-amber-900 font-medium space-y-1.5">
                <p className="font-black text-amber-950 flex items-center gap-1.5">
                  💡 Security Note:
                </p>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Managers can create, approve, and track waybills for this park. If you suspect any malicious activity, you should immediately deactivate their access below.
                </p>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-3">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 text-center">
                Administrative Controls
              </p>

              {/* Active Toggle Switch */}
              <div className="flex items-center justify-between bg-white border border-slate-100 rounded-xl p-3">
                <div>
                  <p className="text-xs font-extrabold text-[#0A1F44]">Allow Sign-in Access</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Toggle sign-in permissions</p>
                </div>
                <button
                  onClick={() => handleToggleManagerActive(selectedManagerProfile.id, selectedManagerProfile.name, selectedManagerProfile.active)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    selectedManagerProfile.active ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                  role="switch"
                  aria-checked={selectedManagerProfile.active}
                  id="toggle-manager-access-switch"
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      selectedManagerProfile.active ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Delete button */}
              <button
                onClick={() => handleDeleteManager(selectedManagerProfile.id, selectedManagerProfile.name)}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border-0 shadow-sm"
                id="panel-delete-manager-btn"
              >
                <Trash2 className="w-4 h-4" /> Delete Manager Permanently
              </button>
            </div>
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

      {/* SERVICE MODE SELECTION MODAL */}
      {showModeSwitchModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" id="service-mode-switch-modal">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-700">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#0A1F44]">Operation & Service Mode</h3>
                  <p className="text-xs text-slate-500">Customize what modules your company uses</p>
                </div>
              </div>
              <button
                onClick={() => setShowModeSwitchModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-all cursor-pointer border-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modeError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modeError}</span>
              </div>
            )}

            <div className="space-y-3">
              {/* Option 1: Waybills & Parks */}
              <button
                type="button"
                disabled={updatingMode}
                onClick={() => handleSwitchServiceMode('parcel')}
                className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  currentServiceMode === 'parcel'
                    ? 'bg-[#0A1F44] text-white border-[#0A1F44] shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                }`}
                id="mode-option-parcel"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${currentServiceMode === 'parcel' ? 'bg-white/10 text-blue-300' : 'bg-white text-blue-600 shadow-xs'}`}>
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-extrabold text-xs sm:text-sm">📦 Motor Park & Waybills Only</p>
                    <p className={`text-[11px] mt-0.5 ${currentServiceMode === 'parcel' ? 'text-slate-300' : 'text-slate-500'}`}>
                      Hides fleet tracking; focus strictly on passenger waybills & motor parks.
                    </p>
                  </div>
                </div>
                {currentServiceMode === 'parcel' && <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />}
              </button>

              {/* Option 2: Fleet Operations Only */}
              <button
                type="button"
                disabled={updatingMode}
                onClick={() => handleSwitchServiceMode('fleet')}
                className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  currentServiceMode === 'fleet'
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                }`}
                id="mode-option-fleet"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${currentServiceMode === 'fleet' ? 'bg-slate-950/10 text-slate-950' : 'bg-white text-amber-600 shadow-xs'}`}>
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-extrabold text-xs sm:text-sm">🚛 Fleet Trip Tracking Only</p>
                    <p className={`text-[11px] mt-0.5 ${currentServiceMode === 'fleet' ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                      Hides waybilling & analytics; focus strictly on heavy truck trips & checkpoints.
                    </p>
                  </div>
                </div>
                {currentServiceMode === 'fleet' && <CheckCircle2 className="w-5 h-5 text-slate-950 shrink-0" />}
              </button>

              {/* Option 3: Both (Waybills & Fleet) */}
              <button
                type="button"
                disabled={updatingMode}
                onClick={() => handleSwitchServiceMode('both')}
                className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  currentServiceMode === 'both'
                    ? 'bg-[#0A1F44] text-white border-[#0A1F44] shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                }`}
                id="mode-option-both"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${currentServiceMode === 'both' ? 'bg-white/10 text-amber-300' : 'bg-white text-emerald-600 shadow-xs'}`}>
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-extrabold text-xs sm:text-sm">⚡ Both (Waybills & Fleet Operations)</p>
                    <p className={`text-[11px] mt-0.5 ${currentServiceMode === 'both' ? 'text-amber-200/80' : 'text-slate-500'}`}>
                      Full access to both passenger park waybills AND heavy fleet trip tracking.
                    </p>
                  </div>
                </div>
                {currentServiceMode === 'both' && <CheckCircle2 className="w-5 h-5 text-amber-300 shrink-0" />}
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowModeSwitchModal(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer border-0"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
