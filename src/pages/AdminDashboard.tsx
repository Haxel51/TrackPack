import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Logo } from '../components/Logo';
import { RecoveryTabContent } from '../components/admin/RecoveryTabContent';
import { RemittanceTabContent } from '../components/admin/RemittanceTabContent';
import {
  Shield,
  LogOut,
  Mail,
  Search,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Users,
  Building,
  ChevronRight,
  X,
  RefreshCw,
  FileText,
  MapPin,
  Calendar,
  DollarSign,
  AlertCircle,
  Check,
  Building2,
  ChevronLeft,
  Truck,
  XCircle,
  Code2,
  Key,
  ShieldCheck,
  CheckCircle2,
  BadgeAlert,
  PhoneCall,
  Eye,
  ExternalLink,
  Zap,
  Megaphone
} from 'lucide-react';
import { MarketingFlyerStudio } from '../components/MarketingFlyerStudio';

// Gray pulsing Skeleton placeholder
const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => (
  <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />
);

export const AdminDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'companies' | 'shipments' | 'revenue' | 'disputes' | 'recovery' | 'managers' | 'fleetTrips' | 'remittances' | 'developers' | 'marketing'>('overview');

  // Developer Compliance & Go-Live State (Super Admin)
  const [devSubmissions, setDevSubmissions] = useState<any[]>([]);
  const [devLoading, setDevLoading] = useState(false);
  const [devError, setDevError] = useState(false);
  const [devPendingCount, setDevPendingCount] = useState(0);
  const [reviewingDevId, setReviewingDevId] = useState<string | null>(null);
  const [rejectModalSub, setRejectModalSub] = useState<any | null>(null);
  const [rejectionReasonText, setRejectionReasonText] = useState('');
  const [devActionSuccess, setDevActionSuccess] = useState<string | null>(null);
  const [viewingDocModal, setViewingDocModal] = useState<{
    title: string;
    docName: string;
    docData?: string;
    sub: any;
    type: 'id' | 'cac';
  } | null>(null);

  // Government NIMC Live ID Verification State
  const [ninLookupResult, setNinLookupResult] = useState<any | null>(null);
  const [isVerifyingNin, setIsVerifyingNin] = useState(false);

  const handleVerifyNin = async (ninNumber: string, directorName: string, businessName: string, idType: string) => {
    setIsVerifyingNin(true);
    try {
      const res = await fetch('/api/v1/admin/developer/verify-nin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nin_number: ninNumber,
          director_name: directorName,
          business_name: businessName,
          id_type: idType
        })
      });
      const json = await res.json();
      if (json.status) {
        setNinLookupResult(json);
      } else {
        alert(json.error || 'Failed to verify NIN with NIMC portal');
      }
    } catch {
      alert('Network error verifying NIN record');
    } finally {
      setIsVerifyingNin(false);
    }
  };

  const loadDevCompliance = async () => {
    setDevLoading(true);
    setDevError(false);
    try {
      const res = await fetchWithTimeout('/api/v1/admin/developer/compliance');
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status) {
        setDevSubmissions(data.data || []);
        setDevPendingCount(data.pending_count ?? (data.data || []).filter((d: any) => d.status === 'under_review' || d.status === 'pending_verification').length);
      } else {
        setDevError(true);
      }
    } catch {
      setDevError(true);
    } finally {
      setDevLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch to get badge counts
    loadDevCompliance();
  }, []);

  useEffect(() => {
    if (activeTab === 'developers') {
      loadDevCompliance();
    }
  }, [activeTab]);

  const handleReviewDeveloper = async (sub: any, decision: 'approve' | 'reject', reason = '') => {
    setReviewingDevId(sub.id);
    setDevActionSuccess(null);
    try {
      const res = await fetch('/api/v1/admin/developer/compliance/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          compliance_id: sub.id,
          developer_id: sub.developer_id,
          decision,
          rejection_reason: reason
        })
      });
      const data = await res.json();
      if (data.status) {
        setDevActionSuccess(
          decision === 'approve'
            ? `Successfully approved ${sub.business_legal_name}! The developer can now generate their Live Production API Key.`
            : `Compliance for ${sub.business_legal_name} marked as Action Required.`
        );
        setRejectModalSub(null);
        setRejectionReasonText('');
        loadDevCompliance();
      } else {
        alert(data.error || 'Failed to complete compliance review.');
      }
    } catch (e: any) {
      alert(e.message || 'Error processing compliance review.');
    } finally {
      setReviewingDevId(null);
    }
  };

  const getWhatsAppNotificationUrl = (sub: any, type: 'approval' | 'correction', reason?: string) => {
    const rawPhone = (sub.contact_phone || sub.director_phone || sub.phone || '').replace(/[^0-9]/g, '');
    let phone = rawPhone;
    if (phone.startsWith('0')) {
      phone = '234' + phone.slice(1);
    } else if (!phone.startsWith('234') && phone.length === 10) {
      phone = '234' + phone;
    }

    let text = '';
    if (type === 'approval') {
      text = `Hello ${sub.business_legal_name || 'Developer'},\n\n🎉 Great news! Your Waybilla Developer KYC dossier has been APPROVED by the Super Admin team.\n\nYou can now log in to the Waybilla Developer Portal, fund your Cargo Wallet, and issue your Production Live Secret API Key:\nhttps://waybilla.ng/developer\n\nWelcome to Waybilla Live Fleet Network!\n- Waybilla Compliance Team`;
    } else {
      text = `Hello ${sub.business_legal_name || 'Developer'},\n\nRegarding your Waybilla Developer KYC submission for ${sub.business_legal_name}:\n\nAction Required: ${reason || 'Please provide updated identification documents.'}\n\nPlease update your details on the Developer Portal: https://waybilla.ng/developer\n\nThank you,\n- Waybilla Compliance Team`;
    }

    return `https://wa.me/${phone || '2348000000000'}?text=${encodeURIComponent(text)}`;
  };

  // Managers Read-Only View State (Super Admin)
  const [managers, setManagers] = useState<any[]>([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [managersError, setManagersError] = useState(false);

  const loadManagers = async () => {
    setManagersLoading(true);
    setManagersError(false);
    try {
      const res = await fetchWithTimeout('/api/admin/managers');
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setManagers(data.managers || []);
      } else {
        setManagersError(true);
      }
    } catch (err) {
      setManagersError(true);
    } finally {
      setManagersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'managers') {
      loadManagers();
    }
  }, [activeTab]);

  // Fleet Trips Super Admin State
  const [fleetTripsData, setFleetTripsData] = useState<any | null>(null);
  const [fleetTripsLoading, setFleetTripsLoading] = useState(false);
  const [fleetTripsError, setFleetTripsError] = useState(false);
  const [fleetSubTab, setFleetSubTab] = useState<'companies' | 'trucks' | 'trips' | 'team'>('companies');

  const loadFleetTrips = async () => {
    setFleetTripsLoading(true);
    setFleetTripsError(false);
    try {
      const res = await fetchWithTimeout('/api/admin/fleet-trips');
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFleetTripsData(data);
      } else {
        setFleetTripsError(true);
      }
    } catch (err) {
      setFleetTripsError(true);
    } finally {
      setFleetTripsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'fleetTrips') {
      loadFleetTrips();
    }
  }, [activeTab]);

  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow, noarchive, nosnippet');
  }, []);

  // Unified company detail view state
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompanyDetails, setSelectedCompanyDetails] = useState<any | null>(null);
  const [loadingCompanyDetails, setLoadingCompanyDetails] = useState(false);
  const [errorCompanyDetails, setErrorCompanyDetails] = useState<string | null>(null);

  // Waybill detail modal state
  const [selectedWaybill, setSelectedWaybill] = useState<any | null>(null);

  // Confirmation Modals State
  const [confirmAction, setConfirmAction] = useState<{
    type: 'suspend' | 'reinstate' | 'reject';
    companyId: string;
    companyName: string;
  } | null>(null);

  const [rejectionReason, setRejectionReason] = useState('');

  // Standard fetch-with-timeout wrapper (10s limit)
  const fetchWithTimeout = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`
        }
      });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  };

  // ==========================================
  // TAB 1: OVERVIEW STATE & ACTIONS
  // ==========================================
  const [overviewData, setOverviewData] = useState<any | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState(false);

  const loadOverview = async () => {
    setOverviewLoading(true);
    setOverviewError(false);
    try {
      const res = await fetchWithTimeout('/api/admin/overview');
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOverviewData(data);
      } else {
        setOverviewError(true);
      }
    } catch (err) {
      setOverviewError(true);
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overview') {
      loadOverview();
    }
  }, [activeTab]);

  // ==========================================
  // TAB 2: COMPANIES STATE & ACTIONS
  // ==========================================
  const [companies, setCompanies] = useState<any[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState(false);

  const loadCompanies = async () => {
    setCompaniesLoading(true);
    setCompaniesError(false);
    try {
      const res = await fetchWithTimeout('/api/admin/companies');
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCompanies(data.companies || []);
      } else {
        setCompaniesError(true);
      }
    } catch (err) {
      setCompaniesError(true);
    } finally {
      setCompaniesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'companies') {
      loadCompanies();
    }
  }, [activeTab]);

  // Handle Approve Company
  const handleApproveCompany = async (id: string) => {
    try {
      const res = await fetchWithTimeout(`/api/admin/companies/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        loadCompanies();
        // If viewing active details, reload details
        if (selectedCompanyId === id) {
          loadCompanyDetails(id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Suspend/Reinstate Company
  const handleToggleSuspendCompany = async (id: string) => {
    try {
      const res = await fetchWithTimeout(`/api/admin/companies/${id}/toggle-suspend`, { method: 'POST' });
      if (res.ok) {
        loadCompanies();
        setConfirmAction(null);
        if (selectedCompanyId === id) {
          loadCompanyDetails(id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Reject (Reject Application with Reason)
  const handleRejectCompany = async (id: string, reason: string) => {
    try {
      const res = await fetchWithTimeout(`/api/admin/companies/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        loadCompanies();
        setConfirmAction(null);
        setSelectedCompanyId(null);
        setRejectionReason('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Load individual company detail view
  const loadCompanyDetails = async (id: string) => {
    setLoadingCompanyDetails(true);
    setErrorCompanyDetails(null);
    try {
      const res = await fetchWithTimeout(`/api/admin/companies/${id}/details`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSelectedCompanyDetails(data);
      } else {
        setErrorCompanyDetails('Could not load profile. Tap to retry.');
      }
    } catch (err) {
      setErrorCompanyDetails('Could not load profile. Tap to retry.');
    } finally {
      setLoadingCompanyDetails(false);
    }
  };

  useEffect(() => {
    if (selectedCompanyId) {
      loadCompanyDetails(selectedCompanyId);
    } else {
      setSelectedCompanyDetails(null);
    }
  }, [selectedCompanyId]);

  // ==========================================
  // TAB 3: SHIPMENTS STATE & ACTIONS
  // ==========================================
  const [shipments, setShipments] = useState<any[]>([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [shipmentsError, setShipmentsError] = useState(false);
  const [shipmentsPage, setShipmentsPage] = useState(1);
  const [shipmentsPages, setShipmentsPages] = useState(1);
  const [shipmentsTotal, setShipmentsTotal] = useState(0);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [parkFilter, setParkFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [csvData, setCsvData] = useState<any[]>([]); // stores full filtered records for CSV export

  const loadShipments = async (page: number = 1) => {
    setShipmentsLoading(true);
    setShipmentsError(false);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search: searchQuery,
        status: statusFilter,
        company: companyFilter,
        park: parkFilter,
        startDate,
        endDate
      });

      const res = await fetchWithTimeout(`/api/admin/shipments?${queryParams}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setShipments(data.waybills || []);
        setShipmentsPage(data.page || 1);
        setShipmentsPages(data.pages || 1);
        setShipmentsTotal(data.total || 0);
        setCsvData(data.allFiltered || []);
      } else {
        setShipmentsError(true);
      }
    } catch (err) {
      setShipmentsError(true);
    } finally {
      setShipmentsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'shipments') {
      loadShipments(1);
    }
  }, [activeTab, searchQuery, statusFilter, companyFilter, parkFilter, startDate, endDate]);

  const handleDownloadCSV = () => {
    if (csvData.length === 0) return;
    const headers = ['Tracking Code', 'Company', 'Origin Park', 'Destination Park', 'Status', 'Sender Name', 'Sender Phone', 'Receiver Name', 'Receiver Phone', 'Date Booked'];
    const rows = csvData.map(wb => [
      wb.tracking_code || '',
      wb.company_name || '',
      wb.origin_park || '',
      wb.destination_park || '',
      wb.status || '',
      wb.sender_name || '',
      wb.sender_phone || '',
      wb.receiver_name || '',
      wb.receiver_phone || '',
      wb.booked_at || wb.created_at || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `waybilla_shipments_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================
  // TAB 4: REVENUE STATE & ACTIONS
  // ==========================================
  const [revenueData, setRevenueData] = useState<any | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revenueError, setRevenueError] = useState(false);
  const [revenuePeriod, setRevenuePeriod] = useState<'all' | 'day' | 'week' | 'month'>('all');

  const loadRevenue = async (period: string = revenuePeriod) => {
    setRevenueLoading(true);
    setRevenueError(false);
    try {
      const res = await fetchWithTimeout(`/api/admin/revenue?period=${period}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRevenueData(data);
      } else {
        setRevenueError(true);
      }
    } catch (err) {
      setRevenueError(true);
    } finally {
      setRevenueLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'revenue') {
      loadRevenue(revenuePeriod);
    }
  }, [activeTab, revenuePeriod]);

  // ==========================================
  // TAB 5: DISPUTES STATE & ACTIONS
  // ==========================================
  const [disputes, setDisputes] = useState<any[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(false);
  const [disputesError, setDisputesError] = useState(false);

  const loadDisputes = async () => {
    setDisputesLoading(true);
    setDisputesError(false);
    try {
      const res = await fetchWithTimeout('/api/admin/disputes');
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDisputes(data.disputes || []);
      } else {
        setDisputesError(true);
      }
    } catch (err) {
      setDisputesError(true);
    } finally {
      setDisputesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'disputes') {
      loadDisputes();
    }
  }, [activeTab]);

  const handleResolveDispute = async (id: string) => {
    try {
      const res = await fetchWithTimeout(`/api/admin/waybills/${id}/resolve-dispute`, { method: 'POST' });
      if (res.ok) {
        loadDisputes();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col justify-between text-slate-800 font-sans" id="admin-panel-container">
      {/* Instant Main Header Navigation Layer */}
      <header className="bg-[#0A1F44] text-white px-6 py-4 shadow-xl select-none" id="admin-main-nav">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          
          <div className="flex items-center gap-3">
            <Logo size="sm" showText={false} />
            <div>
              <span className="font-extrabold text-base tracking-wide block">Waybilla Admin</span>
              <span className="text-[10px] text-orange-400 font-black tracking-widest uppercase block">Internal Control Room</span>
            </div>
          </div>

          {/* Core Navigation Tabs */}
          <nav className="flex flex-wrap justify-center items-center gap-1.5" id="nav-tabs-wrapper">
            {(['overview', 'companies', 'managers', 'shipments', 'fleetTrips', 'remittances', 'revenue', 'disputes', 'developers', 'recovery', 'marketing'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedCompanyId(null);
                }}
                className={`py-2 px-3.5 rounded-xl text-xs font-extrabold tracking-wide capitalize cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === tab
                    ? 'bg-[#F7941D] text-[#0A1F44] shadow-md scale-105'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
                id={`tab-btn-${tab}`}
              >
                {tab === 'recovery' ? 'Account Recovery' : tab === 'fleetTrips' ? 'Fleet Trips & Revenue' : tab === 'remittances' ? 'Cash Remittances (70/30)' : tab === 'developers' ? 'Developer KYC' : tab === 'marketing' ? '📢 Ad Flyers & Media' : tab}
                {tab === 'developers' && devPendingCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-black rounded-full shadow-sm animate-pulse">
                    {devPendingCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <div className="hidden lg:flex flex-col items-end text-right">
              <span className="text-xs text-slate-300 font-medium">{t('adminPortalTitle')}</span>
              <span className="text-[11px] font-bold text-slate-200 block">{user?.email || 'Administrator'}</span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 bg-[#F7941D] hover:bg-[#e07d0f] text-[#0A1F44] font-extrabold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer"
              id="admin-logout-btn"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t('signOut')}</span>
            </button>
          </div>

        </div>
      </header>

      {/* Primary Workspace Dashboard Layer */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6" id="admin-workspace-layer">
        
        {/* ==========================================
            TAB 1: OVERVIEW TAB CONTENT
            ========================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6" id="overview-tab-content">
            {/* Summary Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" id="overview-metrics-grid">
              
              {/* Card 1: Total Companies */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm min-h-[140px] flex flex-col justify-between relative">
                {overviewLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-1/4" />
                  </div>
                ) : overviewError ? (
                  <button onClick={loadOverview} className="absolute inset-0 flex flex-col items-center justify-center text-xs font-bold text-red-500 bg-red-50/50 hover:bg-red-50 rounded-3xl p-4 gap-1">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Couldn't load. Tap to retry.</span>
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-xs font-extrabold tracking-wider uppercase">Approved Companies</span>
                      <Building className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-[#0A1F44]">{overviewData?.stats?.totalCompaniesOnboarded ?? 0}</h2>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">Platform-verified partners</p>
                    </div>
                  </>
                )}
              </div>

              {/* Card 2: Pending Applications */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm min-h-[140px] flex flex-col justify-between relative">
                {overviewLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-1/4" />
                  </div>
                ) : overviewError ? (
                  <button onClick={loadOverview} className="absolute inset-0 flex flex-col items-center justify-center text-xs font-bold text-red-500 bg-red-50/50 hover:bg-red-50 rounded-3xl p-4 gap-1">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Couldn't load. Tap to retry.</span>
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-xs font-extrabold tracking-wider uppercase">Pending Applications</span>
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-[#0A1F44]">{overviewData?.stats?.pendingApplications ?? 0}</h2>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">Requires admin review</p>
                    </div>
                  </>
                )}
              </div>

              {/* Card 3: Active Disputes */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm min-h-[140px] flex flex-col justify-between relative">
                {overviewLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-1/4" />
                  </div>
                ) : overviewError ? (
                  <button onClick={loadOverview} className="absolute inset-0 flex flex-col items-center justify-center text-xs font-bold text-red-500 bg-red-50/50 hover:bg-red-50 rounded-3xl p-4 gap-1">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Couldn't load. Tap to retry.</span>
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-xs font-extrabold tracking-wider uppercase">Active Disputes</span>
                      <AlertTriangle className={`w-4 h-4 ${(overviewData?.stats?.activeDisputes ?? 0) > 0 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <h2 className={`text-3xl font-black ${(overviewData?.stats?.activeDisputes ?? 0) > 0 ? 'text-red-600' : 'text-[#0A1F44]'}`}>
                        {overviewData?.stats?.activeDisputes ?? 0}
                      </h2>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">Overdue shipments</p>
                    </div>
                  </>
                )}
              </div>

              {/* Card 4: Today Shipments */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm min-h-[140px] flex flex-col justify-between relative">
                {overviewLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-1/4" />
                  </div>
                ) : overviewError ? (
                  <button onClick={loadOverview} className="absolute inset-0 flex flex-col items-center justify-center text-xs font-bold text-red-500 bg-red-50/50 hover:bg-red-50 rounded-3xl p-4 gap-1">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Couldn't load. Tap to retry.</span>
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-xs font-extrabold tracking-wider uppercase">Shipments Today</span>
                      <TrendingUp className="w-4 h-4 text-[#0A1F44]" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-[#0A1F44]">{overviewData?.stats?.shipmentsToday ?? 0}</h2>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">Booked across all stations</p>
                    </div>
                  </>
                )}
              </div>

              {/* Card 5: Active Staff */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm min-h-[140px] flex flex-col justify-between relative">
                {overviewLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-1/4" />
                  </div>
                ) : overviewError ? (
                  <button onClick={loadOverview} className="absolute inset-0 flex flex-col items-center justify-center text-xs font-bold text-red-500 bg-red-50/50 hover:bg-red-50 rounded-3xl p-4 gap-1">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Couldn't load. Tap to retry.</span>
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-xs font-extrabold tracking-wider uppercase">Active Fleet Staff</span>
                      <Users className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-[#0A1F44]">{overviewData?.stats?.activeStaff ?? 0}</h2>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">On-duty motor park staff</p>
                    </div>
                  </>
                )}
              </div>

            </div>

            {/* Platform Revenue Secondary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="revenue-secondary-grid">
              
              <div className="md:col-span-1 bg-gradient-to-br from-emerald-50/80 to-emerald-100/40 border border-emerald-200/70 rounded-3xl p-6 shadow-sm flex flex-col justify-between relative min-h-[180px]">
                {overviewLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-1/4" />
                  </div>
                ) : overviewError ? (
                  <button onClick={loadOverview} className="absolute inset-0 flex flex-col items-center justify-center text-xs font-bold text-red-500 bg-red-50/50 hover:bg-red-50 rounded-3xl p-4 gap-1">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Couldn't load. Tap to retry.</span>
                  </button>
                ) : (
                  <>
                    <div className="space-y-2">
                      <span className="bg-emerald-200/80 text-emerald-900 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider inline-block">
                        All-Time Platform Revenue
                      </span>
                      <h3 className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider block pt-2">Total Commission Earned</h3>
                      <p className="text-2xl font-black text-emerald-950">₦{(overviewData?.stats?.totalRevenue ?? 0).toLocaleString()}</p>
                    </div>
                    <p className="text-[10px] text-emerald-700/80 font-bold leading-relaxed pt-3">
                      Cumulative Waybilla platform net earnings across all registered transport operators.
                    </p>
                  </>
                )}
              </div>

              <div className="md:col-span-1 bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col justify-between relative min-h-[180px]">
                {overviewLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-1/4" />
                  </div>
                ) : overviewError ? (
                  <button onClick={loadOverview} className="absolute inset-0 flex flex-col items-center justify-center text-xs font-bold text-red-500 bg-red-50/50 hover:bg-red-50 rounded-3xl p-4 gap-1">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Couldn't load. Tap to retry.</span>
                  </button>
                ) : (
                  <>
                    <div className="space-y-2">
                      <span className="bg-orange-100 text-[#0A1F44] text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider inline-block">
                        Weekly Period
                      </span>
                      <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block pt-2">This Week's Income</h3>
                      <p className="text-2xl font-black text-[#0A1F44]">₦{(overviewData?.stats?.revenueWeek ?? 0).toLocaleString()}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold leading-relaxed pt-3">
                      Real-time revenue tracked securely via Paystack live subaccount payment settlement.
                    </p>
                  </>
                )}
              </div>

              <div className="md:col-span-1 bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col justify-between relative min-h-[180px]">
                {overviewLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-1/4" />
                  </div>
                ) : overviewError ? (
                  <button onClick={loadOverview} className="absolute inset-0 flex flex-col items-center justify-center text-xs font-bold text-red-500 bg-red-50/50 hover:bg-red-50 rounded-3xl p-4 gap-1">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Couldn't load. Tap to retry.</span>
                  </button>
                ) : (
                  <>
                    <div className="space-y-2">
                      <span className="bg-blue-100 text-blue-800 text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider inline-block">
                        Monthly Period
                      </span>
                      <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block pt-2">This Month's Income</h3>
                      <p className="text-2xl font-black text-[#0A1F44]">₦{(overviewData?.stats?.revenueMonth ?? 0).toLocaleString()}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold leading-relaxed pt-3">
                      Automatic platform commission split calculated on every successful transaction.
                    </p>
                  </>
                )}
              </div>

              {/* Extra summary card: Shipment volume trend this week/month */}
              <div className="md:col-span-1 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between relative min-h-[180px]">
                {overviewLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-1/4" />
                  </div>
                ) : overviewError ? (
                  <button onClick={loadOverview} className="absolute inset-0 flex flex-col items-center justify-center text-xs font-bold text-red-500 bg-red-50/50 hover:bg-red-50 rounded-3xl p-4 gap-1">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Couldn't load. Tap to retry.</span>
                  </button>
                ) : (
                  <>
                    <div className="space-y-1">
                      <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Shipment History Volume</h3>
                      <div className="space-y-2 pt-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-semibold">This Week</span>
                          <span className="font-extrabold text-[#0A1F44]">{overviewData?.stats?.shipmentsWeek ?? 0} waybills</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-semibold">This Month</span>
                          <span className="font-extrabold text-[#0A1F44]">{overviewData?.stats?.shipmentsMonth ?? 0} waybills</span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-bold">
                      Aggregated across all registered logistic operators.
                    </div>
                  </>
                )}
              </div>

            </div>

            {/* Recent Activity Feed */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm relative" id="activity-feed-container">
              <h3 className="text-sm font-extrabold text-[#0A1F44] uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-[#F7941D] animate-spin" />
                <span>Centralized Platform Activity Feed</span>
              </h3>

              {overviewLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : overviewError ? (
                <div className="flex flex-col items-center justify-center py-10 text-red-500 gap-1">
                  <AlertTriangle className="w-6 h-6" />
                  <span className="text-xs font-bold">Failed to load platform activities.</span>
                </div>
              ) : !overviewData?.recentActivity || overviewData.recentActivity.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-10 font-bold">No recent activities on the platform.</p>
              ) : (
                <div className="divide-y divide-slate-100" id="activity-feed-items">
                  {overviewData.recentActivity.map((activity: any, index: number) => (
                    <div key={`adm-act-${activity.id || index}-${index}`} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                          activity.type === 'company_approved' ? 'bg-emerald-500' :
                          activity.type === 'company_applied' ? 'bg-orange-500' :
                          activity.type === 'waybill_created' ? 'bg-blue-500' :
                          activity.type === 'package_collected' ? 'bg-indigo-500' :
                          activity.type === 'bus_departed' ? 'bg-[#0A1F44]' :
                          'bg-purple-500'
                        }`} />
                        <div>
                          <p className="text-xs font-extrabold text-[#0A1F44]">{activity.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{activity.detail}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">
                        {new Date(activity.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ==========================================
            TAB 2: COMPANIES TAB CONTENT
            ========================================== */}
        {activeTab === 'companies' && (
          <div className="space-y-6" id="companies-tab-content">
            {companiesLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : companiesError ? (
              <button onClick={loadCompanies} className="w-full flex flex-col items-center justify-center p-12 text-sm font-bold text-red-500 bg-red-50 rounded-3xl border border-red-100 gap-2 cursor-pointer">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
                <span>Could not load companies list. Tap to retry.</span>
              </button>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Side: Pending & Approved Lists */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {/* SECTION A — PENDING APPLICATIONS */}
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                      <h3 className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                        <span>Pending Company Registrations</span>
                      </h3>
                      <span className="text-[10px] font-extrabold bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">
                        {companies.filter(c => c.approved === false && c.rejected !== true).length} waiting review
                      </span>
                    </div>

                    {companies.filter(c => c.approved === false && c.rejected !== true).length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400 font-bold">
                        No pending applications. All registration applications reviewed. ✓
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-50" id="pending-applications-list">
                        {companies.filter(c => c.approved === false && c.rejected !== true).map((comp: any, index: number) => (
                          <div key={`adm-pcomp-${comp.id || index}-${index}`} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-extrabold text-[#0A1F44]">{comp.company_name}</h4>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                  comp.service_mode === 'fleet' ? 'bg-orange-100 text-orange-900 border border-orange-300' :
                                  comp.service_mode === 'both' ? 'bg-blue-100 text-blue-900 border border-blue-300' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {comp.service_mode === 'fleet' ? '🚛 Fleet Only' : comp.service_mode === 'both' ? '⚡ Parcel & Fleet' : '📦 Parcel Waybills'}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-[#F7941D]" /> Owner: {comp.owner_phone}</span>
                                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-blue-500" /> Park: {comp.park_location || comp.park_name || 'N/A'}</span>
                                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-indigo-500" /> Applied: {comp.created_at ? new Date(comp.created_at).toLocaleDateString() : 'N/A'}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleApproveCompany(comp.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => setConfirmAction({ type: 'reject', companyId: comp.id, companyName: comp.company_name })}
                                className="bg-red-50 hover:bg-red-100 text-red-600 font-extrabold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SECTION B — APPROVED COMPANIES */}
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                      <h3 className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span>Approved Transport Companies</span>
                      </h3>
                      <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                        {companies.filter(c => c.approved === true).length} active partners
                      </span>
                    </div>

                    {companies.filter(c => c.approved === true).length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400 font-bold">
                        No approved companies yet. Approve applications from the section above.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse" id="approved-companies-table">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                              <th className="py-3 px-2">Company Name</th>
                              <th className="py-3 px-2">Owner Contact</th>
                              <th className="py-3 px-2 text-center">Parks</th>
                              <th className="py-3 px-2 text-center">Staff</th>
                              <th className="py-3 px-2 text-center">Shipments</th>
                              <th className="py-3 px-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {companies.filter(c => c.approved === true).map((comp: any, index: number) => (
                              <tr key={`adm-acomp-${comp.id || index}-${index}`} className="hover:bg-slate-50/50 transition-all text-xs">
                                <td className="py-3.5 px-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-[#0A1F44]">{comp.company_name}</span>
                                    {(comp.suspended === true || comp.suspended === "true") && (
                                      <span className="bg-red-100 text-red-700 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                                        Suspended
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">Approved: {comp.created_at ? new Date(comp.created_at).toLocaleDateString() : 'N/A'}</div>
                                </td>
                                <td className="py-3.5 px-2 font-semibold text-slate-600">{comp.owner_phone}</td>
                                <td className="py-3.5 px-2 text-center font-bold text-slate-700">{comp.total_parks ?? 0}</td>
                                <td className="py-3.5 px-2 text-center font-bold text-slate-700">{comp.total_staff ?? 0}</td>
                                <td className="py-3.5 px-2 text-center font-bold text-slate-700">{comp.total_shipments ?? 0}</td>
                                <td className="py-3.5 px-2 text-right space-x-1 whitespace-nowrap">
                                  <button
                                    onClick={() => setSelectedCompanyId(comp.id)}
                                    className={`text-[11px] font-extrabold px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                                      selectedCompanyId === comp.id
                                        ? 'bg-[#0A1F44] text-white'
                                        : 'bg-slate-100 hover:bg-slate-200 text-[#0A1F44]'
                                    }`}
                                  >
                                    View Details
                                  </button>
                                  {comp.suspended === true || comp.suspended === "true" ? (
                                    <button
                                      onClick={() => setConfirmAction({ type: 'reinstate', companyId: comp.id, companyName: comp.company_name })}
                                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-[11px] font-extrabold px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                                    >
                                      Reinstate
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setConfirmAction({ type: 'suspend', companyId: comp.id, companyName: comp.company_name })}
                                      className="bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-extrabold px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                                    >
                                      Suspend
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* SECTION C — REJECTED APPLICATIONS */}
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                      <h3 className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider flex items-center gap-1.5">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span>Rejected Applications</span>
                      </h3>
                      <span className="text-[10px] font-extrabold bg-red-50 text-red-700 px-2 py-0.5 rounded-full">
                        {companies.filter(c => c.rejected === true).length} rejected
                      </span>
                    </div>

                    {companies.filter(c => c.rejected === true).length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400 font-bold">
                        No rejected applications.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-50" id="rejected-applications-list">
                        {companies.filter(c => c.rejected === true).map((comp: any, index: number) => (
                          <div key={`adm-rejcomp-${comp.id || index}-${index}`} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-extrabold text-[#0A1F44]">{comp.company_name}</h4>
                                <span className="text-[9px] font-black bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                  Rejected
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-[#F7941D]" /> Owner: {comp.owner_phone}</span>
                                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-blue-500" /> Park: {comp.park_location || comp.park_name || 'N/A'}</span>
                                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-indigo-500" /> Date: {comp.rejected_at ? new Date(comp.rejected_at).toLocaleDateString() : (comp.created_at ? new Date(comp.created_at).toLocaleDateString() : 'N/A')}</span>
                              </div>
                              {comp.rejection_reason && (
                                <p className="text-[11px] text-red-600 font-medium bg-red-50/70 rounded-lg px-2.5 py-1 mt-1 inline-block">
                                  <strong>Reason:</strong> {comp.rejection_reason}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleApproveCompany(comp.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" /> Re-Approve
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

                {/* Right Side: Company Details Audit Panel */}
                <div className="lg:col-span-4" id="company-detail-panel">
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-5 sticky top-6">
                    <h3 className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider border-b border-slate-50 pb-3 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-[#F7941D]" />
                      <span>Company Profile Details</span>
                    </h3>

                    {!selectedCompanyId ? (
                      <div className="text-center py-12 text-xs text-slate-400 font-medium">
                        Select an approved company from the table to view their motor parks, staff, and shipment records.
                      </div>
                    ) : loadingCompanyDetails ? (
                      <div className="space-y-4 py-4">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-20" />
                        <Skeleton className="h-4" />
                        <Skeleton className="h-4" />
                      </div>
                    ) : errorCompanyDetails ? (
                      <button onClick={() => loadCompanyDetails(selectedCompanyId)} className="w-full text-center py-10 text-xs font-bold text-red-500 bg-red-50 rounded-2xl gap-2 cursor-pointer">
                        <AlertTriangle className="w-5 h-5 mx-auto mb-1" />
                        <span>{errorCompanyDetails}</span>
                      </button>
                    ) : selectedCompanyDetails ? (
                      <div className="space-y-5 text-xs">
                        
                        {/* Summary Header */}
                        <div>
                          <h4 className="text-base font-black text-[#0A1F44]">{selectedCompanyDetails.company.company_name}</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">Database ID: <code className="bg-slate-100 p-0.5 rounded text-[10px]">{selectedCompanyDetails.company.id}</code></p>
                        </div>

                        {/* Revenue Share Stats & Custom Split Setup */}
                        <div className="bg-gradient-to-br from-[#0A1F44]/5 to-slate-100 rounded-2xl p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[10px] font-extrabold text-slate-500 uppercase block">Total Commission Share</span>
                              <span className="text-lg font-black text-[#0A1F44]">₦{selectedCompanyDetails.earnings?.platform_share ?? 0}</span>
                              <span className="text-[9px] text-slate-400 font-bold block mt-1">
                                Platform Share ({(100 - (selectedCompanyDetails.company?.split_percentage ?? 30))}%) from ₦{selectedCompanyDetails.earnings?.total_earnings ?? 0} total fees
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-extrabold text-slate-500 uppercase block">Operator Share</span>
                              <span className="text-sm font-black text-[#0A1F44]">₦{selectedCompanyDetails.earnings?.company_share ?? 0}</span>
                              <span className="text-[9px] text-slate-500 font-bold block mt-1">
                                Operator ({(selectedCompanyDetails.company?.split_percentage ?? 30)}%)
                              </span>
                            </div>
                          </div>

                          <div className="border-t border-slate-200/60 pt-3 space-y-2">
                            <span className="text-[10px] font-black text-[#0A1F44] uppercase tracking-wider block">Adjust Revenue Share Split</span>
                            <div className="flex items-center gap-1.5">
                              <div className="relative flex-grow">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  id="operator-split-input"
                                  defaultValue={selectedCompanyDetails.company?.split_percentage ?? 30}
                                  key={selectedCompanyDetails.company?.id + '-' + (selectedCompanyDetails.company?.split_percentage ?? 30)}
                                  placeholder="30"
                                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-black text-[#0A1F44] pr-8 focus:border-blue-500 focus:outline-none"
                                />
                                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">%</span>
                              </div>
                              <button
                                onClick={async () => {
                                  const inputEl = document.getElementById('operator-split-input') as HTMLInputElement;
                                  if (!inputEl) return;
                                  const val = parseInt(inputEl.value, 10);
                                  if (isNaN(val) || val < 0 || val > 100) return;
                                  
                                  try {
                                    const response = await fetch(`/api/admin/companies/${selectedCompanyDetails.company.id}/adjust-split`, {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                      },
                                      body: JSON.stringify({ split_percentage: val })
                                    });
                                    if (response.ok) {
                                      loadCompanyDetails(selectedCompanyDetails.company.id);
                                      loadCompanies();
                                    }
                                  } catch (e) {
                                    console.error(e);
                                  }
                                }}
                                className="bg-[#0A1F44] hover:bg-blue-950 text-white font-bold text-xs px-3 py-2.5 rounded-xl cursor-pointer shrink-0"
                              >
                                Save
                              </button>
                            </div>
                            <span className="text-[9px] text-slate-400 font-semibold block leading-normal mt-1">
                              Determines the % allocated directly to their Paystack subaccount. The remainder (platform share) goes to your main account.
                            </span>
                          </div>
                        </div>

                        {/* Terminals & Parks */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-extrabold text-[#0A1F44] uppercase tracking-wider block">Parks ({selectedCompanyDetails.parks.length})</span>
                          {selectedCompanyDetails.parks.length === 0 ? (
                            <p className="text-slate-400 italic">No parks configured.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                              {selectedCompanyDetails.parks.map((p: any, index: number) => (
                                <div key={`adm-park-${p.id || index}-${index}`} className="bg-slate-50/60 border border-slate-100 rounded-xl p-2.5 flex justify-between items-center">
                                  <span className="font-extrabold text-slate-700">{p.park_name}</span>
                                  <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{p.park_location}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Registered Staff */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-extrabold text-[#0A1F44] uppercase tracking-wider block">Registered Staff ({selectedCompanyDetails.staff.length})</span>
                          {selectedCompanyDetails.staff.length === 0 ? (
                            <p className="text-slate-400 italic">No staff registered.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                              {selectedCompanyDetails.staff.map((s: any, index: number) => (
                                <div key={`adm-stf-${s.id || index}-${index}`} className="bg-slate-50/60 border border-slate-100 rounded-xl p-2.5 flex justify-between items-center">
                                  <div>
                                    <span className="font-extrabold text-slate-700 block">{s.name}</span>
                                    {s.phone && (
                                      <span className="text-[10px] font-semibold text-slate-500 block">{s.phone}</span>
                                    )}
                                    <span className="text-[10px] text-slate-400 font-medium">Location: {s.park_location}</span>
                                  </div>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.active !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                    {s.active !== false ? 'Active' : 'Inactive'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Recent Shipments */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-extrabold text-[#0A1F44] uppercase tracking-wider block">Waybills ({selectedCompanyDetails.shipments.length})</span>
                          {selectedCompanyDetails.shipments.length === 0 ? (
                            <p className="text-slate-400 italic">No shipments registered.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                              {selectedCompanyDetails.shipments.slice(0, 5).map((wb: any, index: number) => (
                                <button
                                  key={`adm-subwb-${wb.id || index}-${index}`}
                                  onClick={() => setSelectedWaybill(wb)}
                                  className="w-full text-left bg-slate-50/60 border border-slate-100 rounded-xl p-2.5 hover:bg-slate-100/50 transition-colors cursor-pointer flex justify-between items-center"
                                >
                                  <div>
                                    <span className="font-black text-slate-800 block">{wb.tracking_code}</span>
                                    <span className="text-[10px] text-slate-400 font-semibold">{wb.origin_park} → {wb.destination_park}</span>
                                  </div>
                                  <span className="text-[10px] font-extrabold text-slate-500 capitalize">{wb.status}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                      </div>
                    ) : null}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB 3: SHIPMENTS TAB CONTENT
            ========================================== */}
        {activeTab === 'shipments' && (
          <div className="space-y-6" id="shipments-tab-content">
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-50 pb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-[#0A1F44] uppercase tracking-wider">
                    All Registered Waybills
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold mt-1">
                    Showing {shipmentsTotal} total waybills across all transport companies.
                  </p>
                </div>
                <button
                  onClick={handleDownloadCSV}
                  disabled={csvData.length === 0}
                  className="bg-[#0A1F44] hover:bg-[#143265] text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  id="csv-download-btn"
                >
                  <Download className="w-4 h-4" />
                  <span>Download as CSV</span>
                </button>
              </div>

              {/* Filters Panel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3" id="shipments-filter-panel">
                
                {/* Search query */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search tracking, names..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50/70 border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-xl py-2.5 pl-9 pr-3 text-xs font-semibold outline-none transition-all"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-50/70 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-semibold outline-none focus:border-[#0A1F44] cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="booked">Booked</option>
                  <option value="departed">Departed/In Transit</option>
                  <option value="arrived">Arrived</option>
                  <option value="collected">Collected</option>
                </select>

                {/* Company Filter */}
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="bg-slate-50/70 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-semibold outline-none focus:border-[#0A1F44] cursor-pointer"
                >
                  <option value="all">All Companies</option>
                  {companies.filter(c => c.approved === true).map((c, index) => (
                    <option key={`adm-copt-${c.id || index}-${index}`} value={c.id}>{c.company_name}</option>
                  ))}
                </select>

                {/* Park Selector / Filter */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <MapPin className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Filter by Park..."
                    value={parkFilter === 'all' ? '' : parkFilter}
                    onChange={(e) => setParkFilter(e.target.value || 'all')}
                    className="w-full bg-slate-50/70 border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-xl py-2.5 pl-9 pr-3 text-xs font-semibold outline-none transition-all"
                  />
                </div>

                {/* Date range filter */}
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-50/70 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-semibold outline-none focus:border-[#0A1F44] cursor-pointer"
                  placeholder="Start Date"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-50/70 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-semibold outline-none focus:border-[#0A1F44] cursor-pointer"
                  placeholder="End Date"
                />

              </div>

              {/* Waybills list table */}
              {shipmentsLoading ? (
                <div className="space-y-3 py-4">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : shipmentsError ? (
                <div className="text-center py-10">
                  <button onClick={() => loadShipments(shipmentsPage)} className="bg-red-50 border border-red-100 text-red-600 font-extrabold text-xs px-4 py-2 rounded-xl cursor-pointer">
                    Could not fetch waybills. Tap to retry.
                  </button>
                </div>
              ) : shipments.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400 font-bold">
                  No shipments match the selected filters.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse" id="global-shipments-table">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                          <th className="py-3 px-2">Tracking Code</th>
                          <th className="py-3 px-2">Operator</th>
                          <th className="py-3 px-2">Route</th>
                          <th className="py-3 px-2">Status</th>
                          <th className="py-3 px-2">Created Date</th>
                          <th className="py-3 px-2 text-center">Tracking Active</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs">
                        {shipments.map((wb: any, index: number) => (
                          <tr
                            key={`adm-wb-${wb.id || index}-${index}`}
                            onClick={() => setSelectedWaybill(wb)}
                            className="hover:bg-slate-50 cursor-pointer transition-all"
                          >
                            <td className="py-3.5 px-2 font-black text-[#0A1F44] tracking-wider">{wb.tracking_code}</td>
                            <td className="py-3.5 px-2 font-semibold text-slate-600">{wb.company_name}</td>
                            <td className="py-3.5 px-2 font-bold text-[#0A1F44]">{wb.origin_park} → {wb.destination_park}</td>
                            <td className="py-3.5 px-2">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider inline-block ${
                                wb.status === 'collected' ? 'bg-indigo-50 text-indigo-700' :
                                wb.status === 'arrived' ? 'bg-emerald-50 text-emerald-700' :
                                wb.status === 'departed' || wb.status === 'in_transit' ? 'bg-orange-50 text-orange-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {wb.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-2 text-slate-500 font-medium">
                              {new Date(wb.created_at || wb.booked_at || 0).toLocaleDateString()}
                            </td>
                            <td className="py-3.5 px-2 text-center font-bold">
                              {wb.tracking_active !== false ? (
                                <span className="text-emerald-600">Yes</span>
                              ) : (
                                <span className="text-red-500">No</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  {shipmentsPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-50 pt-4" id="pagination-controls">
                      <p className="text-xs text-slate-500 font-semibold">
                        Showing page <strong className="text-slate-700">{shipmentsPage}</strong> of <strong className="text-slate-700">{shipmentsPages}</strong> ({shipmentsTotal} total records)
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => loadShipments(shipmentsPage - 1)}
                          disabled={shipmentsPage <= 1}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 font-extrabold text-xs px-3 py-1.5 rounded-xl cursor-pointer"
                        >
                          Prev
                        </button>
                        {Array.from({ length: shipmentsPages }, (_, i) => i + 1).map((p, index) => (
                          <button
                            key={`adm-page-${p}-${index}`}
                            onClick={() => loadShipments(p)}
                            className={`text-xs font-black w-8 h-8 rounded-xl cursor-pointer transition-all ${
                              shipmentsPage === p
                                ? 'bg-[#0A1F44] text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                        <button
                          onClick={() => loadShipments(shipmentsPage + 1)}
                          disabled={shipmentsPage >= shipmentsPages}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 font-extrabold text-xs px-3 py-1.5 rounded-xl cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          </div>
        )}

        {/* ==========================================
            TAB 4: REVENUE TAB CONTENT
            ========================================== */}
        {activeTab === 'revenue' && (
          <div className="space-y-6" id="revenue-tab-content">
            <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm space-y-6">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-50 pb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-[#0A1F44] uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle className="w-4.5 h-4.5 text-emerald-600" />
                    <span>Platform Revenue & Settlements</span>
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold mt-1">
                    Live settlement distribution metrics split automatically on-the-fly via Paystack routing.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Period Filter Buttons */}
                  <div className="flex bg-slate-100 p-1 rounded-xl gap-1" id="revenue-period-selector">
                    <button
                      onClick={() => setRevenuePeriod('day')}
                      className={`text-xs font-black px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        revenuePeriod === 'day' ? 'bg-[#0A1F44] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Day
                    </button>
                    <button
                      onClick={() => setRevenuePeriod('week')}
                      className={`text-xs font-black px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        revenuePeriod === 'week' ? 'bg-[#0A1F44] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Week
                    </button>
                    <button
                      onClick={() => setRevenuePeriod('month')}
                      className={`text-xs font-black px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        revenuePeriod === 'month' ? 'bg-[#0A1F44] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Month
                    </button>
                    <button
                      onClick={() => setRevenuePeriod('all')}
                      className={`text-xs font-black px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        revenuePeriod === 'all' ? 'bg-[#0A1F44] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All Time
                    </button>
                  </div>
                  <button
                    onClick={() => loadRevenue(revenuePeriod)}
                    className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold text-xs px-3 py-2 rounded-xl cursor-pointer"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {revenueLoading ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                  </div>
                  <Skeleton className="h-64 rounded-2xl" />
                </div>
              ) : revenueError ? (
                <div className="text-center py-12">
                  <button onClick={loadRevenue} className="bg-red-50 border border-red-100 text-red-600 font-extrabold text-xs px-5 py-3 rounded-2xl cursor-pointer">
                    Couldn't load revenue analytics. Tap to retry.
                  </button>
                </div>
              ) : !revenueData ? (
                <div className="text-center py-12 text-xs text-slate-400 font-bold">
                  No revenue data loaded.
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Revenue Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="revenue-cards">
                    
                    <div className="bg-emerald-50/40 border border-emerald-100/50 p-5 rounded-2xl space-y-1">
                      <span className="text-[10px] text-emerald-800 font-extrabold uppercase block">Platform Commission</span>
                      <span className="text-2xl font-black text-emerald-900">₦{(revenueData.stats?.total_platform_revenue ?? 0).toLocaleString()}</span>
                      <span className="text-[10px] text-emerald-700 font-semibold block mt-1">Our Net Earnings</span>
                    </div>

                    <div className="bg-blue-50/40 border border-blue-100/50 p-5 rounded-2xl space-y-1">
                      <span className="text-[10px] text-blue-800 font-extrabold uppercase block">Operators' Share</span>
                      <span className="text-2xl font-black text-blue-900">₦{(revenueData.stats?.total_company_revenue ?? 0).toLocaleString()}</span>
                      <span className="text-[10px] text-blue-700 font-semibold block mt-1">Routed to Subaccounts</span>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-1">
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase block">Total Processed Volume</span>
                      <span className="text-2xl font-black text-[#0A1F44]">
                        ₦{((revenueData.stats?.total_platform_revenue ?? 0) + (revenueData.stats?.total_company_revenue ?? 0)).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold block mt-1">Gross Booking Fees</span>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-1">
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase block">Successful Settlements</span>
                      <span className="text-2xl font-black text-[#0A1F44]">{(revenueData.stats?.total_transactions_count ?? 0).toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 font-semibold block mt-1">Virtual Bank Transfers</span>
                    </div>

                  </div>

                  {/* Table Structure */}
                  <div className="space-y-3 pt-4">
                    <span className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">Operator Fee Distribution (Billing Splits)</span>
                    
                    <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                            <th className="py-3 px-4">Operator Name</th>
                            <th className="py-3 px-4 text-center">Shipments Tracked</th>
                            <th className="py-3 px-4 text-right">Total Fees</th>
                            <th className="py-3 px-4 text-right">Their Share</th>
                            <th className="py-3 px-4 text-right">Platform Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!revenueData.breakdown || revenueData.breakdown.length === 0 ? (
                            <tr className="border-b border-slate-50 text-slate-400 italic">
                              <td className="py-4 px-4 font-bold" colSpan={5}>
                                No transactions found yet. Revenue splits and fee distributions will appear automatically here when bookings are paid via Paystack.
                              </td>
                            </tr>
                          ) : (
                            revenueData.breakdown.map((row: any, idx: number) => (
                              <tr key={`adm-rev-${row.company_id || idx}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50/40 text-[#0A1F44] font-semibold">
                                <td className="py-3 px-4 font-extrabold">{row.company_name}</td>
                                <td className="py-3 px-4 text-center">{row.transactions_count ?? 0}</td>
                                <td className="py-3 px-4 text-right font-black">₦{Number(row.total_transactions_value || 0).toLocaleString()}</td>
                                <td className="py-3 px-4 text-right text-blue-600">₦{Number(row.company_share_total || 0).toLocaleString()}</td>
                                <td className="py-3 px-4 text-right text-emerald-600">₦{Number(row.platform_share_total || 0).toLocaleString()}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Recent Verified Settlements List */}
                  <div className="space-y-3 pt-4">
                    <span className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">Recent Verified Settlements Log (Last 50)</span>
                    
                    <div className="overflow-x-auto border border-slate-100 rounded-2xl max-h-96">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider sticky top-0">
                            <th className="py-3 px-4">Reference</th>
                            <th className="py-3 px-4">Operator</th>
                            <th className="py-3 px-4">Confirmed At</th>
                            <th className="py-3 px-4">Virtual Bank info</th>
                            <th className="py-3 px-4 text-right">Fee</th>
                            <th className="py-3 px-4 text-right">Company Share</th>
                            <th className="py-3 px-4 text-right">Platform Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!revenueData.recent_payments || revenueData.recent_payments.length === 0 ? (
                            <tr className="border-b border-slate-50 text-slate-400 italic">
                              <td className="py-4 px-4 font-bold" colSpan={7}>
                                No settled transactions found.
                              </td>
                            </tr>
                          ) : (
                            revenueData.recent_payments.map((p: any, index: number) => (
                              <tr key={`adm-pmt-${p.id || index}-${index}`} className="border-b border-slate-100 hover:bg-slate-50/40 text-slate-600 font-semibold">
                                <td className="py-3 px-4 font-mono text-[10px] text-slate-700">{p.paystack_reference}</td>
                                <td className="py-3 px-4 font-bold text-[#0A1F44]">{p.company_name}</td>
                                <td className="py-3 px-4 text-slate-400 text-[10px]">{new Date(p.confirmed_at || p.created_at).toLocaleString()}</td>
                                <td className="py-3 px-4 text-slate-500 text-[10px]">
                                  {p.virtual_account_bank} • {p.virtual_account_number}
                                </td>
                                <td className="py-3 px-4 text-right text-slate-700 font-bold">₦{p.amount}</td>
                                <td className="py-3 px-4 text-right text-blue-600">₦{p.company_share}</td>
                                <td className="py-3 px-4 text-right text-emerald-600">₦{p.platform_share}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>
        )}

        {/* ==========================================
            TAB 5: DISPUTES TAB CONTENT
            ========================================== */}
        {activeTab === 'disputes' && (
          <div className="space-y-6" id="disputes-tab-content">
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-5">
              
              <div className="border-b border-slate-50 pb-3">
                <h3 className="text-sm font-extrabold text-[#0A1F44] uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4.5 h-4.5 text-red-500" />
                  <span>Platform Dispute Resolution center</span>
                </h3>
                <p className="text-xs text-slate-400 font-semibold mt-1">
                  Waybills flagged automatically when transit hours exceed 24 hours longer than the estimated journey time.
                </p>
              </div>

              {disputesLoading ? (
                <div className="space-y-3 py-4">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : disputesError ? (
                <div className="text-center py-10">
                  <button onClick={loadDisputes} className="bg-red-50 border border-red-100 text-red-600 font-extrabold text-xs px-4 py-2 rounded-xl cursor-pointer">
                    Could not load disputes list. Tap to retry.
                  </button>
                </div>
              ) : disputes.length === 0 ? (
                <div className="text-center py-12 text-xs text-emerald-600 bg-emerald-50 rounded-2xl font-bold leading-relaxed space-y-1">
                  <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                  <div>No active disputes. All shipments are running normally. ✓</div>
                </div>
              ) : (
                <div className="space-y-4" id="disputes-list">
                  {disputes.map((disp: any, index: number) => (
                    <div key={`adm-disp-${disp.id || index}-${index}`} className="border border-red-100 bg-red-50/20 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-[#0A1F44] text-sm tracking-wide">{disp.tracking_code}</span>
                          <span className="bg-red-100 text-red-800 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                            Overdue {disp.overdue_hours} Hours
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-1 gap-x-6 text-xs text-slate-500">
                          <div><strong>Operator:</strong> {disp.company_name}</div>
                          <div><strong>Route:</strong> {disp.origin_park} → {disp.destination_park}</div>
                          <div><strong>Departure:</strong> {new Date(disp.departed_at).toLocaleString()}</div>
                          <div><strong>Elapsed:</strong> {disp.elapsed_hours} Hours ({disp.estimated_hours}h estimated)</div>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600 pt-1 border-t border-red-100/60">
                          <div><span className="text-slate-400 font-semibold">Sender:</span> <strong>{disp.sender_name || 'N/A'}</strong> ({disp.sender_phone || 'N/A'})</div>
                          <div><span className="text-slate-400 font-semibold">Receiver:</span> <strong>{disp.receiver_name || 'N/A'}</strong> ({disp.receiver_phone || 'N/A'})</div>
                          {disp.item_description && disp.item_description !== 'N/A' && (
                            <div><span className="text-slate-400 font-semibold">Item:</span> <em>{disp.item_description}</em></div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-stretch md:self-auto">
                        <button
                          onClick={() => handleResolveDispute(disp.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm w-full md:w-auto"
                        >
                          Mark as Resolved
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        )}

        {activeTab === 'recovery' && (
          <RecoveryTabContent token={token} />
        )}

        {/* ==========================================
            TAB: DAILY CASH REMITTANCE & 70/30 SPLIT
            ========================================== */}
        {activeTab === 'remittances' && (
          <RemittanceTabContent token={token} />
        )}

        {/* ==========================================
            TAB: MANAGERS READ-ONLY VISIBILITY (SUPER ADMIN)
            ========================================== */}
        {activeTab === 'managers' && (
          <div className="space-y-6" id="managers-tab-content">
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#0A1F44] uppercase tracking-wider flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-600" />
                    <span>All Managers Read-Only Visibility</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Super Admin overview of all Managers assigned across all transport companies and motor parks.
                  </p>
                </div>
                <button
                  onClick={loadManagers}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer border-0 self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${managersLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh List</span>
                </button>
              </div>

              {managersLoading ? (
                <div className="space-y-3 py-4">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : managersError ? (
                <div className="text-center py-10">
                  <button onClick={loadManagers} className="bg-red-50 border border-red-100 text-red-600 font-extrabold text-xs px-4 py-2 rounded-xl cursor-pointer border-0">
                    Could not load managers list. Tap to retry.
                  </button>
                </div>
              ) : managers.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400 font-bold">
                  No managers created across any company yet.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Manager Name</th>
                        <th className="py-3 px-4">Phone Number</th>
                        <th className="py-3 px-4">Company Name</th>
                        <th className="py-3 px-4">Park Location</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Created Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                      {managers.map((m: any, idx: number) => (
                        <tr key={`adm-mgr-${m.id || idx}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 font-extrabold text-[#0A1F44]">{m.name}</td>
                          <td className="py-3 px-4 font-mono">{m.phone}</td>
                          <td className="py-3 px-4 font-bold text-slate-800">{m.company_name}</td>
                          <td className="py-3 px-4">{m.park_location}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              m.active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {m.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[10px]">
                            {m.created_at ? new Date(m.created_at).toLocaleDateString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            TAB: FLEET TRIPS & REVENUE (SUPER ADMIN)
            ========================================== */}
        {activeTab === 'fleetTrips' && (
          <div className="space-y-6" id="fleet-trips-tab-content">
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#0A1F44] uppercase tracking-wider flex items-center gap-2">
                    <Truck className="w-5 h-5 text-orange-500" />
                    <span>God-Tier Fleet Tracking, Trucks, Teams & Revenue Control</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Complete 360-degree Super Admin visibility of all registered transport companies, trucks, managers, trip monitors, dispatches, and profit margins.
                  </p>
                </div>
                <button
                  onClick={loadFleetTrips}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer border-0 self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${fleetTripsLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh Fleet Data</span>
                </button>
              </div>

              {/* Fleet Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl space-y-1">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase block truncate">Transport Cos</span>
                  <span className="text-lg font-black text-[#0A1F44]">{fleetTripsData?.stats?.totalCompanies ?? 0}</span>
                  <span className="text-[8px] text-slate-400 font-semibold block truncate">Operators</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl space-y-1">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase block truncate">Total Trucks</span>
                  <span className="text-lg font-black text-[#0A1F44]">{fleetTripsData?.stats?.totalTrucks ?? 0}</span>
                  <span className="text-[8px] text-slate-400 font-semibold block truncate">{fleetTripsData?.stats?.activeTrucks ?? 0} Active</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl space-y-1">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase block truncate">Total Trips</span>
                  <span className="text-lg font-black text-[#0A1F44]">{fleetTripsData?.stats?.totalTrips ?? 0}</span>
                  <span className="text-[8px] text-slate-400 font-semibold block truncate">Dispatches</span>
                </div>
                <div className="bg-orange-50/50 border border-orange-100 p-3 rounded-2xl space-y-1">
                  <span className="text-[9px] text-orange-800 font-extrabold uppercase block truncate">Active Transit</span>
                  <span className="text-lg font-black text-orange-900">{fleetTripsData?.stats?.activeTrips ?? 0}</span>
                  <span className="text-[8px] text-orange-700 font-semibold block truncate">On Route</span>
                </div>
                <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-2xl space-y-1">
                  <span className="text-[9px] text-blue-800 font-extrabold uppercase block truncate">Fleet Revenue</span>
                  <span className="text-base font-black text-blue-900 truncate">₦{(fleetTripsData?.stats?.totalFleetRevenue ?? 0).toLocaleString()}</span>
                  <span className="text-[8px] text-blue-700 font-semibold block truncate">Haulage</span>
                </div>
                <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-2xl space-y-1">
                  <span className="text-[9px] text-emerald-800 font-extrabold uppercase block truncate">App Revenue</span>
                  <span className="text-base font-black text-emerald-900 truncate">₦{(fleetTripsData?.stats?.appTotalRevenue ?? fleetTripsData?.stats?.totalFleetRevenue ?? 0).toLocaleString()}</span>
                  <span className="text-[8px] text-emerald-700 font-semibold block truncate">100% App</span>
                </div>
              </div>

              {/* Fleet Sub-Navigation Tabs */}
              <div className="flex flex-wrap border-b border-slate-100 gap-1.5 pt-2">
                <button
                  onClick={() => setFleetSubTab('companies')}
                  className={`px-3 py-2 text-[11px] font-extrabold rounded-t-xl transition-all cursor-pointer border-b-2 ${
                    fleetSubTab === 'companies' ? 'bg-[#0A1F44] text-white border-orange-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 border-transparent bg-slate-50'
                  }`}
                >
                  Companies ({fleetTripsData?.companies?.length ?? 0})
                </button>
                <button
                  onClick={() => setFleetSubTab('trucks')}
                  className={`px-3 py-2 text-[11px] font-extrabold rounded-t-xl transition-all cursor-pointer border-b-2 ${
                    fleetSubTab === 'trucks' ? 'bg-[#0A1F44] text-white border-orange-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 border-transparent bg-slate-50'
                  }`}
                >
                  Trucks ({fleetTripsData?.trucks?.length ?? 0})
                </button>
                <button
                  onClick={() => setFleetSubTab('trips')}
                  className={`px-3 py-2 text-[11px] font-extrabold rounded-t-xl transition-all cursor-pointer border-b-2 ${
                    fleetSubTab === 'trips' ? 'bg-[#0A1F44] text-white border-orange-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 border-transparent bg-slate-50'
                  }`}
                >
                  Dispatches ({fleetTripsData?.trips?.length ?? 0})
                </button>
                <button
                  onClick={() => setFleetSubTab('team')}
                  className={`px-3 py-2 text-[11px] font-extrabold rounded-t-xl transition-all cursor-pointer border-b-2 ${
                    fleetSubTab === 'team' ? 'bg-[#0A1F44] text-white border-orange-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 border-transparent bg-slate-50'
                  }`}
                >
                  Team ({((fleetTripsData?.managers?.length ?? 0) + (fleetTripsData?.staff?.length ?? 0))})
                </button>
              </div>

              {fleetTripsLoading ? (
                <div className="space-y-3 py-6">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : fleetTripsError ? (
                <div className="text-center py-10">
                  <button onClick={loadFleetTrips} className="bg-red-50 border border-red-100 text-red-600 font-extrabold text-xs px-4 py-2 rounded-xl cursor-pointer border-0">
                    Could not load fleet data. Tap to retry.
                  </button>
                </div>
              ) : (
                <div className="pt-2">
                  {/* SUBTAB 1: COMPANIES & OPERATORS */}
                  {fleetSubTab === 'companies' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Transport Companies & Fleet Breakdown</h4>
                      {!fleetTripsData?.companies || fleetTripsData.companies.length === 0 ? (
                        <div className="text-center py-10 text-xs text-slate-400 font-bold">No registered transport companies found.</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {fleetTripsData.companies.map((c: any) => (
                            <div key={`comp-sum-${c.id}`} className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h5 className="text-sm font-black text-[#0A1F44]">{c.company_name}</h5>
                                  <p className="text-[11px] text-slate-500">Owner: {c.owner_name} ({c.owner_phone})</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${c.approved ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}`}>
                                  {c.approved ? 'Approved' : 'Pending'}
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-2 bg-white p-3 rounded-xl border border-slate-100 text-center">
                                <div>
                                  <span className="text-[9px] text-slate-400 uppercase block font-bold">Trucks</span>
                                  <span className="text-sm font-black text-slate-800">{c.totalTrucks} ({c.activeTrucks} active)</span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-slate-400 uppercase block font-bold">Trips</span>
                                  <span className="text-sm font-black text-[#0A1F44]">{c.totalTrips} ({c.activeTrips} live)</span>
                                </div>
                                <div>
                                  <span className="text-[9px] text-slate-400 uppercase block font-bold">Revenue</span>
                                  <span className="text-sm font-black text-emerald-600">₦{Number(c.totalRevenue || 0).toLocaleString()}</span>
                                </div>
                              </div>

                              <div className="text-[11px] text-slate-600 space-y-1">
                                <p><strong className="text-slate-800">Managers Assigned:</strong> {c.managers.length > 0 ? c.managers.map((m: any) => m.name || m.phone).join(', ') : 'None'}</p>
                                <p><strong className="text-slate-800">Trip Monitors / Staff:</strong> {c.staff.length > 0 ? c.staff.map((s: any) => s.name || s.phone).join(', ') : 'None'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUBTAB 2: REGISTERED TRUCKS */}
                  {fleetSubTab === 'trucks' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">All Registered Trucks Across Companies</h4>
                      {!fleetTripsData?.trucks || fleetTripsData.trucks.length === 0 ? (
                        <div className="text-center py-10 text-xs text-slate-400 font-bold">No trucks registered yet.</div>
                      ) : (
                        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                                <th className="py-3 px-4">Company</th>
                                <th className="py-3 px-4">Truck Plate No.</th>
                                <th className="py-3 px-4">Assigned Driver</th>
                                <th className="py-3 px-4">Payment Plan</th>
                                <th className="py-3 px-4 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                              {fleetTripsData.trucks.map((tr: any, idx: number) => (
                                <tr key={`adm-truck-${tr.id || idx}`} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-3 px-4 font-extrabold text-[#0A1F44]">{tr.company_name}</td>
                                  <td className="py-3 px-4 font-mono font-bold text-slate-800">{tr.plate_number}</td>
                                  <td className="py-3 px-4">{tr.driver_name}</td>
                                  <td className="py-3 px-4 capitalize">
                                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 text-[10px] font-bold">
                                      {tr.payment_plan === 'monthly' ? 'Monthly Sub' : 'Per Trip'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800">
                                      {tr.status || 'Active'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUBTAB 3: TRIP DISPATCHES */}
                  {fleetSubTab === 'trips' && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Complete Fleet Trip Dispatches & Haulage Ledger</h4>
                      {!fleetTripsData?.trips || fleetTripsData.trips.length === 0 ? (
                        <div className="text-center py-12 text-xs text-slate-400 font-bold">No fleet tracking trips recorded across any company yet.</div>
                      ) : (
                        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                                <th className="py-3 px-4">Company</th>
                                <th className="py-3 px-4">Truck Plate</th>
                                <th className="py-3 px-4">Driver Name</th>
                                <th className="py-3 px-4">Route (Origin → Destination)</th>
                                <th className="py-3 px-4 text-center">Status</th>
                                <th className="py-3 px-4 text-right">Fare / Amount</th>
                                <th className="py-3 px-4">Dispatched At</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                              {fleetTripsData.trips.map((t: any, idx: number) => (
                                <tr key={`adm-ftrip-${t.id || idx}`} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-3 px-4 font-extrabold text-[#0A1F44]">{t.company_name}</td>
                                  <td className="py-3 px-4 font-mono font-bold text-slate-800">{t.truck_plate || t.truck || 'N/A'}</td>
                                  <td className="py-3 px-4">{t.driver_name || t.driver || 'N/A'}</td>
                                  <td className="py-3 px-4 text-slate-600">{t.origin} → {t.destination}</td>
                                  <td className="py-3 px-4 text-center">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                      t.status === 'in_transit' ? 'bg-orange-100 text-orange-800' :
                                      t.status === 'arrived' || t.status === 'completed' || t.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                                      'bg-slate-100 text-slate-800'
                                    }`}>
                                      {t.status || 'Active'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right font-black text-[#0A1F44]">
                                    ₦{(Number(t.payment_amount) || Number(t.amount) || Number(t.fare) || 0).toLocaleString()}
                                  </td>
                                  <td className="py-3 px-4 text-slate-400 text-[10px]">
                                    {t.created_at || t.dispatch_time ? new Date(t.created_at || t.dispatch_time).toLocaleString() : 'N/A'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUBTAB 4: MANAGERS & STAFF */}
                  {fleetSubTab === 'team' && (
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Company Managers</h4>
                        {!fleetTripsData?.managers || fleetTripsData.managers.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-400 font-bold bg-slate-50 rounded-2xl">No managers recorded.</div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {fleetTripsData.managers.map((m: any, idx: number) => (
                              <div key={`adm-mgr-${m.id || idx}`} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-1">
                                <span className="text-sm font-black text-[#0A1F44]">{m.name || m.full_name || 'Manager'}</span>
                                <p className="text-xs text-slate-600">Phone: {m.phone || 'N/A'}</p>
                                <span className="text-[10px] text-slate-400 font-semibold block">Company ID: {m.companyId}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Trip Monitors & Staff</h4>
                        {!fleetTripsData?.staff || fleetTripsData.staff.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-400 font-bold bg-slate-50 rounded-2xl">No trip monitors or staff recorded.</div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {fleetTripsData.staff.map((s: any, idx: number) => (
                              <div key={`adm-staff-${s.id || idx}`} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-1">
                                <span className="text-sm font-black text-[#0A1F44]">{s.name || s.full_name || 'Staff'}</span>
                                <p className="text-xs text-slate-600">Role: <span className="capitalize font-bold text-orange-600">{s.role}</span></p>
                                <p className="text-xs text-slate-600">Phone: {s.phone || 'N/A'}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            TAB: DEVELOPER KYC & GO-LIVE APPROVALS (SUPER ADMIN)
            ========================================== */}
        {activeTab === 'developers' && (
          <div className="space-y-6" id="developers-tab-content">
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#0A1F44] uppercase tracking-wider flex items-center gap-2">
                    <Code2 className="w-5 h-5 text-indigo-600" />
                    <span>Developer KYC Verification & Go-Live Approvals</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Review and verify developer CAC registrations, Director NIN/ID credentials, and authorize production API key access.
                  </p>
                </div>
                <button
                  onClick={loadDevCompliance}
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer border-0 self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${devLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh Applications</span>
                </button>
              </div>

              {/* Status Alert */}
              {devActionSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{devActionSuccess}</span>
                  </div>
                  <button onClick={() => setDevActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Metric Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Applications</span>
                  <span className="text-xl font-black text-[#0A1F44] mt-0.5 block">{devSubmissions.length}</span>
                </div>
                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                  <span className="text-[10px] font-bold text-orange-600 uppercase block">Pending Verification</span>
                  <span className="text-xl font-black text-orange-700 mt-0.5 block">
                    {devSubmissions.filter(s => s.status === 'under_review' || s.status === 'pending_verification').length}
                  </span>
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase block">Live Verified</span>
                  <span className="text-xl font-black text-emerald-700 mt-0.5 block">
                    {devSubmissions.filter(s => s.status === 'approved').length}
                  </span>
                </div>
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
                  <span className="text-[10px] font-bold text-rose-600 uppercase block">Action Required</span>
                  <span className="text-xl font-black text-rose-700 mt-0.5 block">
                    {devSubmissions.filter(s => s.status === 'action_required' || s.status === 'rejected').length}
                  </span>
                </div>
              </div>

              {/* Submissions Table */}
              {devLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : devError ? (
                <div className="text-center py-8 text-rose-600 text-xs font-bold">
                  Failed to load developer compliance records. Please try refreshing.
                </div>
              ) : devSubmissions.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <Code2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-black text-slate-700">No Developer Compliance Submissions Yet</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    When merchants or logistics software developers submit their business KYC and Director identification from the Developer Portal, their dossiers will appear here for verification.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-extrabold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-3">Business & Merchant</th>
                        <th className="py-3 px-3">CAC Registration</th>
                        <th className="py-3 px-3">Director & ID</th>
                        <th className="py-3 px-3">Cargo Wallet</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Verification Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {devSubmissions.map((sub) => {
                        const isPending = sub.status === 'under_review' || sub.status === 'pending_verification';
                        const isApproved = sub.status === 'approved';
                        const isProcessing = reviewingDevId === sub.id;
                        const isStartupTier = sub.kyc_tier === 'startup' || sub.cac_rc_number === 'STARTUP-TIER-1';

                        return (
                          <tr key={sub.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <div className="font-extrabold text-[#0A1F44]">{sub.business_legal_name}</div>
                                {isStartupTier ? (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                                    Startup / Indie
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                                    Enterprise CAC
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 font-medium">{sub.merchant_email}</div>
                              <div className="text-[10px] text-slate-600 mt-1 flex items-center gap-1.5 font-bold">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  💬 WA: {sub.contact_phone || 'Not provided'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-800 font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded-md inline-block">
                                {isStartupTier ? 'National ID Verification' : sub.cac_rc_number}
                              </div>
                              <button
                                type="button"
                                onClick={() => setViewingDocModal({
                                  title: isStartupTier ? 'National ID Document' : 'CAC Registration Certificate',
                                  docName: isStartupTier ? (sub.id_document_name || 'National_ID_Slip.png') : (sub.cac_document_name || 'CAC_Certificate.png'),
                                  docData: sub.cac_document_data || sub.director_id_document_data,
                                  sub,
                                  type: 'cac'
                                })}
                                className="mt-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer group"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-600 group-hover:scale-110 transition-transform" />
                                <span>View {isStartupTier ? 'National ID Doc' : 'CAC Cert'}</span>
                              </button>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-800">{sub.director_name}</div>
                              <div className="text-[10px] text-slate-500">
                                <span className="font-semibold text-slate-700">{sub.director_id_type || sub.id_type || 'NIN Slip'}:</span> {sub.director_id_number || sub.id_number}
                              </div>
                              <button
                                type="button"
                                onClick={() => setViewingDocModal({
                                  title: `${sub.director_id_type || 'National Identity'} Document Image`,
                                  docName: sub.director_id_document_name || sub.id_document_name || 'Screenshot 2026-08-07 225008.png',
                                  docData: sub.director_id_document_data || sub.cac_document_data,
                                  sub,
                                  type: 'id'
                                })}
                                className="mt-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer group"
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                                <span>View ID Image</span>
                              </button>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-extrabold text-slate-900">
                                ₦{Number(sub.cargo_wallet_balance || 0).toLocaleString()}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {sub.has_live_key ? (
                                  <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                                    <Key className="w-2.5 h-2.5" /> Live Key Active
                                  </span>
                                ) : (
                                  <span>No Live Key Yet</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              {isApproved ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-black">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Approved
                                </span>
                              ) : isPending ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-200 rounded-full text-[10px] font-black">
                                  <AlertCircle className="w-3 h-3" />
                                  Pending Review
                                </span>
                              ) : (
                                <div>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[10px] font-black">
                                    <AlertTriangle className="w-3 h-3" />
                                    Action Required
                                  </span>
                                  {sub.rejection_reason && (
                                    <p className="text-[10px] text-rose-600 font-semibold mt-1 max-w-[160px] truncate" title={sub.rejection_reason}>
                                      {sub.rejection_reason}
                                    </p>
                                  )}
                                </div>
                              )}
                              <div className="text-[9px] text-slate-400 mt-1">
                                {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : ''}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* 1-Click WhatsApp Direct Notification Button */}
                                <a
                                  href={getWhatsAppNotificationUrl(sub, isApproved ? 'approval' : 'correction', sub.rejection_reason)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Send WhatsApp Notification to Developer"
                                  className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                                >
                                  <PhoneCall className="w-3 h-3" />
                                  <span className="hidden sm:inline">WhatsApp</span>
                                </a>

                                {isPending ? (
                                  <>
                                    <button
                                      onClick={() => handleReviewDeveloper(sub, 'approve')}
                                      disabled={isProcessing}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                    >
                                      {isProcessing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                      <span>Approve</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setRejectModalSub(sub);
                                        setRejectionReasonText('');
                                      }}
                                      disabled={isProcessing}
                                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                    >
                                      <X className="w-3 h-3" />
                                      <span>Reject</span>
                                    </button>
                                  </>
                                ) : isApproved ? (
                                  <button
                                    onClick={() => {
                                      setRejectModalSub(sub);
                                      setRejectionReasonText('Re-verification required: ');
                                    }}
                                    className="px-2.5 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                  >
                                    Re-evaluate
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleReviewDeveloper(sub, 'approve')}
                                    disabled={isProcessing}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Re-Approve</span>
                                  </button>
                                )}
                              </div>
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
        )}

        {/* ==========================================
            TAB 11: MARKETING & PROMO FLYER STUDIO
            ========================================== */}
        {activeTab === 'marketing' && (
          <div className="space-y-6" id="marketing-flyers-tab-content">
            <MarketingFlyerStudio />
          </div>
        )}

      </main>

      {/* Developer KYC Rejection / Feedback Modal */}
      {rejectModalSub && (
        <div className="fixed inset-0 z-50 bg-[#0A1F44]/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-rose-50 rounded-2xl flex items-center justify-center shrink-0">
                <AlertTriangle className="text-rose-600 w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-[#0A1F44]">
                  Reject / Request Correction
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Business: <strong className="text-slate-800">{rejectModalSub.business_legal_name}</strong>
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                Feedback / Reason for Developer
              </label>
              <textarea
                value={rejectionReasonText}
                onChange={(e) => setRejectionReasonText(e.target.value)}
                placeholder="e.g. Identification slip is blurry. Please upload a clear photo of your National ID or Driver's License."
                className="w-full h-28 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-[#0A1F44] placeholder-slate-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all resize-none"
                required
              />
            </div>

            <div className="flex flex-wrap gap-2 justify-between items-center">
              <a
                href={getWhatsAppNotificationUrl(rejectModalSub, 'correction', rejectionReasonText)}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Notify via WhatsApp</span>
              </a>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setRejectModalSub(null);
                    setRejectionReasonText('');
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-[#0A1F44] font-extrabold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReviewDeveloper(rejectModalSub, 'reject', rejectionReasonText)}
                  disabled={!rejectionReasonText.trim() || reviewingDevId === rejectModalSub.id}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {reviewingDevId === rejectModalSub.id && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Status</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Overlay Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-[#0A1F44]/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-sm w-full shadow-2xl space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-50 rounded-2xl flex items-center justify-center shrink-0">
                <AlertTriangle className="text-red-600 w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-[#0A1F44]">
                  {confirmAction.type === 'suspend' && 'Suspend Company'}
                  {confirmAction.type === 'reinstate' && 'Reinstate Company'}
                  {confirmAction.type === 'reject' && 'Reject Application'}
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {confirmAction.type === 'suspend' && `Are you sure you want to suspend [${confirmAction.companyName}]? This will immediately lock out the owner and all their registered motor park staff.`}
                  {confirmAction.type === 'reject' && `Are you sure you want to reject [${confirmAction.companyName}]? Please provide a reason to help them correct any issues and resubmit.`}
                  {confirmAction.type === 'reinstate' && `Are you sure you want to reinstate [${confirmAction.companyName}]? They will be able to log back into the system.`}
                </p>
              </div>
            </div>

            {confirmAction.type === 'reject' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Rejection Reason</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Please upload a clearer registration certificate or verify your initial motor park address."
                  className="w-full h-24 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-[#0A1F44] placeholder-slate-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all resize-none"
                  required
                />
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setConfirmAction(null);
                  setRejectionReason('');
                }}
                className="bg-slate-100 hover:bg-slate-200 text-[#0A1F44] font-extrabold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmAction.type === 'suspend' || confirmAction.type === 'reinstate') {
                    handleToggleSuspendCompany(confirmAction.companyId);
                  } else if (confirmAction.type === 'reject') {
                    handleRejectCompany(confirmAction.companyId, rejectionReason.trim());
                  }
                }}
                disabled={confirmAction.type === 'reject' && !rejectionReason.trim()}
                className={`${confirmAction.type === 'reinstate' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                id="modal-confirm-btn"
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waybill Detail Modal Drawer */}
      {selectedWaybill && (
        <div className="fixed inset-0 z-50 bg-[#0A1F44]/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 max-w-lg w-full shadow-2xl p-6 relative space-y-6">
            
            <button
              onClick={() => setSelectedWaybill(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="bg-slate-100 text-[#0A1F44] text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider inline-block">
                Waybill Details
              </span>
              <h4 className="text-lg font-black text-[#0A1F44] mt-2 tracking-wider flex items-center gap-1.5">
                <FileText className="w-5 h-5 text-[#F7941D]" />
                <span>Tracking: {selectedWaybill.tracking_code}</span>
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-100/50">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Sender Information</span>
                <p className="font-extrabold text-[#0A1F44]">{selectedWaybill.sender_name}</p>
                <p className="font-semibold text-slate-600">{selectedWaybill.sender_phone}</p>
              </div>

              <div className="space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-100/50">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Receiver Information</span>
                <p className="font-extrabold text-[#0A1F44]">{selectedWaybill.receiver_name}</p>
                <p className="font-semibold text-slate-600">{selectedWaybill.receiver_phone}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-bold">Transport Company</span>
                <span className="font-extrabold text-[#0A1F44]">{selectedWaybill.company_name}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-bold">Departure Park</span>
                <span className="font-extrabold text-[#0A1F44]">{selectedWaybill.origin_park}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-bold">Arrival Park</span>
                <span className="font-extrabold text-[#0A1F44]">{selectedWaybill.destination_park}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-bold">Item Description</span>
                <span className="font-extrabold text-slate-700">{selectedWaybill.item_description}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-bold">Current Status</span>
                <span className="font-extrabold uppercase tracking-widest text-[#F7941D]">{selectedWaybill.status}</span>
              </div>

            </div>

            {/* Waybill Timeline Tracker */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold text-[#0A1F44] uppercase tracking-wider block">Waybill Timeline Logs</span>
              
              <div className="space-y-3 pl-2 border-l-2 border-[#0A1F44]/10">
                
                <div className="relative pl-4">
                  <div className="absolute left-[-21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <p className="text-xs font-extrabold text-slate-700">Waybill Booked</p>
                  <p className="text-[10px] text-slate-400 font-bold">{selectedWaybill.booked_at ? new Date(selectedWaybill.booked_at).toLocaleString() : 'N/A'}</p>
                  {selectedWaybill.creator_staff_name && (
                    <p className="text-[10px] text-blue-600 font-bold mt-0.5">
                      Issued by Staff: {selectedWaybill.creator_staff_name} {selectedWaybill.creator_staff_phone ? `(${selectedWaybill.creator_staff_phone})` : ''}
                    </p>
                  )}
                </div>

                <div className="relative pl-4">
                  <div className={`absolute left-[-21px] top-1 w-2.5 h-2.5 rounded-full ${
                    selectedWaybill.departed_at ? 'bg-emerald-500' : 'bg-slate-300'
                  }`} />
                  <p className="text-xs font-extrabold text-slate-700">Bus Departed Motor Park</p>
                  <p className="text-[10px] text-slate-400 font-bold">{selectedWaybill.departed_at ? new Date(selectedWaybill.departed_at).toLocaleString() : 'Not Departed'}</p>
                  {selectedWaybill.departed_by_staff_name && (
                    <p className="text-[10px] text-orange-600 font-bold mt-0.5">
                      Departed by Staff: {selectedWaybill.departed_by_staff_name} {selectedWaybill.departed_by_staff_phone ? `(${selectedWaybill.departed_by_staff_phone})` : ''}
                    </p>
                  )}
                </div>

                <div className="relative pl-4">
                  <div className={`absolute left-[-21px] top-1 w-2.5 h-2.5 rounded-full ${
                    selectedWaybill.arrived_at ? 'bg-emerald-500' : 'bg-slate-300'
                  }`} />
                  <p className="text-xs font-extrabold text-slate-700">Bus Arrived Destination</p>
                  <p className="text-[10px] text-slate-400 font-bold">{selectedWaybill.arrived_at ? new Date(selectedWaybill.arrived_at).toLocaleString() : 'Not Arrived'}</p>
                  {selectedWaybill.arrived_by_staff_name && (
                    <p className="text-[10px] text-blue-600 font-bold mt-0.5">
                      Arrived by Staff: {selectedWaybill.arrived_by_staff_name} {selectedWaybill.arrived_by_staff_phone ? `(${selectedWaybill.arrived_by_staff_phone})` : ''}
                    </p>
                  )}
                </div>

                <div className="relative pl-4">
                  <div className={`absolute left-[-21px] top-1 w-2.5 h-2.5 rounded-full ${
                    selectedWaybill.collected_at ? 'bg-indigo-500' : 'bg-slate-300'
                  }`} />
                  <p className="text-xs font-extrabold text-slate-700">Waybill Collected</p>
                  <p className="text-[10px] text-slate-400 font-bold">{selectedWaybill.collected_at ? new Date(selectedWaybill.collected_at).toLocaleString() : 'Not Collected'}</p>
                  {selectedWaybill.collected_by_staff_name && (
                    <p className="text-[10px] text-indigo-600 font-bold mt-0.5">
                      Collected by Staff: {selectedWaybill.collected_by_staff_name} {selectedWaybill.collected_by_staff_phone ? `(${selectedWaybill.collected_by_staff_phone})` : ''}
                    </p>
                  )}
                </div>

              </div>
            </div>

            <button
              onClick={() => setSelectedWaybill(null)}
              className="w-full bg-[#0A1F44] hover:bg-[#143265] text-white font-extrabold py-3 rounded-2xl text-xs transition-all cursor-pointer"
            >
              Close Details
            </button>
          </div>
        </div>
      )}

      {/* Document & Image Inspection Modal */}
      {viewingDocModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl border border-slate-200 my-8">
            {/* Header */}
            <div className="bg-[#0A1F44] text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    {viewingDocModal.title}
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                      {viewingDocModal.sub.kyc_tier === 'startup' ? 'Startup National ID' : 'Enterprise CAC'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 font-semibold">
                    {viewingDocModal.sub.business_legal_name} • {viewingDocModal.sub.merchant_email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingDocModal(null)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body: Two Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-slate-50">
              {/* Left Column (2 cols): Document / Image Canvas */}
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5 truncate max-w-[320px]">
                    <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="truncate">{viewingDocModal.docName}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {viewingDocModal.docData && viewingDocModal.docData.startsWith('data:') && (
                      <a
                        href={viewingDocModal.docData}
                        download={viewingDocModal.docName}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    )}
                    {viewingDocModal.docData && viewingDocModal.docData.startsWith('data:') && (
                      <a
                        href={viewingDocModal.docData}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Open
                      </a>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900 rounded-2xl p-4 min-h-[380px] max-h-[520px] flex items-center justify-center overflow-auto border border-slate-800 shadow-inner relative group">
                  {(() => {
                    const rawData = viewingDocModal.docData || '';
                    let imageSrc: string | null = null;
                    if (rawData.startsWith('data:') || rawData.startsWith('http://') || rawData.startsWith('https://')) {
                      imageSrc = rawData;
                    } else if (rawData.length > 50 && !rawData.includes(' ') && (rawData.startsWith('iVBOR') || rawData.startsWith('/9j/') || rawData.startsWith('AAAA'))) {
                      imageSrc = `data:image/jpeg;base64,${rawData}`;
                    }

                    if (imageSrc) {
                      if (imageSrc.includes('application/pdf')) {
                        return (
                          <iframe
                            src={imageSrc}
                            title="PDF Preview"
                            className="w-full h-[460px] rounded-xl border-0"
                          />
                        );
                      }
                      return (
                        <div className="space-y-3 text-center">
                          <img
                            src={imageSrc}
                            alt={viewingDocModal.docName}
                            className="max-h-[440px] w-auto max-w-full object-contain rounded-xl shadow-2xl border border-slate-700/80 mx-auto"
                            onError={(e) => {
                              // Fallback if image load fails
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <p className="text-[10px] text-emerald-400 font-extrabold bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-700/60 inline-block shadow-xs">
                            ✓ Verified Live Image Document
                          </p>
                        </div>
                      );
                    }

                    return (
                      /* Clean Notice when developer hasn't uploaded image data */
                      <div className="w-full max-w-md bg-slate-800 rounded-3xl p-6 border border-slate-700 shadow-2xl space-y-4 text-slate-200 text-center my-4 animate-fadeIn">
                        <div className="w-14 h-14 bg-amber-500/20 rounded-2xl border border-amber-400/30 flex items-center justify-center text-amber-400 mx-auto">
                          <AlertTriangle className="w-7 h-7" />
                        </div>
                        <div>
                          <h4 className="text-base font-extrabold text-white">Physical Document Image Required</h4>
                          <p className="text-xs text-slate-300 mt-1">
                            This record only contains the text metadata (<span className="font-mono text-amber-300">{viewingDocModal.docName}</span>). The developer did not attach an image file.
                          </p>
                        </div>

                        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700/60 text-left text-xs space-y-2">
                          <div className="flex justify-between border-b border-slate-800 pb-1.5">
                            <span className="text-slate-400">Director Name:</span>
                            <span className="font-bold text-white">{viewingDocModal.sub.director_name}</span>
                          </div>
                          <div className="flex justify-between border-b border-slate-800 pb-1.5">
                            <span className="text-slate-400">ID / NIN Code:</span>
                            <span className="font-mono font-bold text-indigo-300">{viewingDocModal.sub.director_id_number || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Business Name:</span>
                            <span className="font-bold text-slate-300">{viewingDocModal.sub.business_legal_name}</span>
                          </div>
                        </div>

                        <a
                          href={`https://wa.me/${(viewingDocModal.sub.contact_phone || '2349031940521').replace(/\D/g, '')}?text=${encodeURIComponent(
                            `Hello ${viewingDocModal.sub.director_name || 'Developer'}, please re-upload a clear photo of your ${viewingDocModal.sub.director_id_type || 'NIN / ID document'} in the Developer Portal to complete your verification.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full bg-[#25D366] hover:bg-[#20ba59] text-white font-extrabold py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
                        >
                          <PhoneCall className="w-4 h-4" />
                          <span>Request ID Photo on WhatsApp</span>
                        </a>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Right Column (1 col): Verification Panel & Quick Actions */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-[#0A1F44] uppercase tracking-wider border-b border-slate-100 pb-2">
                    Developer Verification Data
                  </h4>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block">Business Legal Name</label>
                      <p className="font-extrabold text-slate-800 text-sm">{viewingDocModal.sub.business_legal_name}</p>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block">Director / ID Owner</label>
                      <p className="font-extrabold text-slate-800">{viewingDocModal.sub.director_name}</p>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block">ID Type & Number</label>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="font-mono font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 inline-block text-xs">
                          {viewingDocModal.sub.director_id_type || 'NIN'}: {viewingDocModal.sub.director_id_number || '777777777'}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleVerifyNin(
                            viewingDocModal.sub.director_id_number || '777777777',
                            viewingDocModal.sub.director_name,
                            viewingDocModal.sub.business_legal_name,
                            viewingDocModal.sub.director_id_type || 'NIN'
                          )}
                          disabled={isVerifyingNin}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-extrabold rounded-lg text-[10px] flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                        >
                          <Zap className="w-3 h-3 text-slate-900 fill-current" />
                          <span>{isVerifyingNin ? 'Verifying...' : 'NIMC Live Lookup'}</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block">WhatsApp Contact</label>
                      <a
                        href={getWhatsAppNotificationUrl(viewingDocModal.sub, 'approval')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-extrabold text-emerald-700 hover:underline flex items-center gap-1.5 mt-0.5 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 inline-block"
                      >
                        💬 {viewingDocModal.sub.contact_phone || 'Not provided'}
                      </a>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase block">Developer Work Email</label>
                      <p className="font-semibold text-slate-600 truncate">{viewingDocModal.sub.merchant_email}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      const sub = viewingDocModal.sub;
                      setViewingDocModal(null);
                      handleReviewDeveloper(sub, 'approve');
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve & Issue Production Live Key</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const sub = viewingDocModal.sub;
                      setViewingDocModal(null);
                      setRejectModalSub(sub);
                      setRejectionReasonText('');
                    }}
                    className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    <span>Request Re-upload / Reject</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NIMC & CAC Verification Inspector Modal */}
      {ninLookupResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border-2 border-[#0A1F44] my-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#0A1F44] to-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white font-black text-sm">
                  🇳🇬
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    ID Document & NIN Inspector
                  </h3>
                  <p className="text-xs text-slate-300 font-medium">
                    National Identity & CAC Corporate Cross-Check
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNinLookupResult(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 bg-slate-50 text-slate-800 text-xs">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-bold">Queried Number:</span>
                  <span className="font-mono font-black text-indigo-700 text-sm">{ninLookupResult.queried_nin}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-bold">Document Type:</span>
                  <span className="font-bold text-slate-900 uppercase">{ninLookupResult.id_type || 'NIN'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-bold">11-Digit Standard NIN Format:</span>
                  <span className={`font-black ${ninLookupResult.is_11_digits ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {ninLookupResult.is_11_digits ? '✓ Valid 11-Digit Format' : `${ninLookupResult.character_count} Characters (Non-Standard NIN)`}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-bold">Developer Director:</span>
                  <span className="font-bold text-slate-900">{ninLookupResult.director_submitted_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Business Name:</span>
                  <span className="font-bold text-slate-900">{ninLookupResult.business_submitted_name || 'N/A'}</span>
                </div>
              </div>

              {/* Official External Search Portals */}
              <div className="space-y-2">
                <p className="font-extrabold text-slate-700 text-[11px] uppercase">
                  Direct Government Verification Portals:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="https://search.cac.gov.ng/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-900 font-bold flex items-center justify-between transition-colors"
                  >
                    <span>CAC Public Search</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href="https://nimc.gov.ng/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 rounded-xl text-indigo-900 font-bold flex items-center justify-between transition-colors"
                  >
                    <span>NIMC Portal</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-amber-950">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Manual Visual Inspection Policy</span>
                </p>
                <p className="text-amber-800 leading-relaxed">
                  Always inspect the developer's <strong>live uploaded physical photo document</strong> inside the document viewer to confirm face, name, and NIN match before granting Live Key approval.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setNinLookupResult(null)}
                className="w-full bg-[#0A1F44] hover:bg-blue-950 text-white font-extrabold py-3 rounded-2xl text-xs cursor-pointer transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-100 mt-6 space-y-0.5" id="admin-footer">
        <div>Waybilla is a product of <span className="text-slate-800 font-bold">Haxel Tech-Solutions</span></div>
        <div className="text-[11px] text-slate-400">&copy; {new Date().getFullYear()} Haxel Tech-Solutions. All rights reserved.</div>
      </footer>
    </div>
  );
};
