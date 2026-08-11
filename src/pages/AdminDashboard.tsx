import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { RecoveryTabContent } from '../components/admin/RecoveryTabContent';
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
  ChevronLeft
} from 'lucide-react';

// Gray pulsing Skeleton placeholder
const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => (
  <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />
);

export const AdminDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'companies' | 'shipments' | 'revenue' | 'disputes' | 'recovery' | 'managers'>('overview');

  // Managers Read-Only View State (Super Admin)
  const [managers, setManagers] = useState<any[]>([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [managersError, setManagersError] = useState(false);

  const loadManagers = async () => {
    setManagersLoading(true);
    setManagersError(false);
    try {
      const res = await fetchWithTimeout('/api/admin/managers');
      if (res.ok) {
        const data = await res.json();
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
      if (res.ok) {
        const data = await res.json();
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
      if (res.ok) {
        const data = await res.json();
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
      if (res.ok) {
        const data = await res.json();
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
        startDate,
        endDate
      });

      const res = await fetchWithTimeout(`/api/admin/shipments?${queryParams}`);
      if (res.ok) {
        const data = await res.json();
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
  }, [activeTab, searchQuery, statusFilter, companyFilter, startDate, endDate]);

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

  const loadRevenue = async () => {
    setRevenueLoading(true);
    setRevenueError(false);
    try {
      const res = await fetchWithTimeout('/api/admin/revenue');
      if (res.ok) {
        const data = await res.json();
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
      loadRevenue();
    }
  }, [activeTab]);

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
      if (res.ok) {
        const data = await res.json();
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
            <div className="w-10 h-10 bg-[#08152B] rounded-xl flex items-center justify-center border border-amber-400/30 shadow-sm shrink-0">
              <Shield className="text-[#F2A93B] w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-wide block">Waybilla Admin</span>
              <span className="text-[10px] text-amber-400 font-black tracking-widest uppercase block">Internal Control Room</span>
            </div>
          </div>

          {/* Core Navigation Tabs */}
          <nav className="flex flex-wrap justify-center items-center gap-1.5" id="nav-tabs-wrapper">
            {(['overview', 'companies', 'managers', 'shipments', 'revenue', 'disputes', 'recovery'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedCompanyId(null);
                }}
                className={`py-2 px-4 rounded-xl text-xs font-extrabold tracking-wide capitalize cursor-pointer transition-all ${
                  activeTab === tab
                    ? 'bg-[#F2A93B] text-[#0A1F44] shadow-md scale-105'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
                id={`tab-btn-${tab}`}
              >
                {tab === 'recovery' ? 'Account Recovery' : tab}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex flex-col items-end text-right">
              <span className="text-xs text-slate-300 font-medium">Logged in Admin</span>
              <span className="text-[11px] font-bold text-slate-200 block">{user?.email || 'Administrator'}</span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 bg-[#F2A93B] hover:bg-[#d9922b] text-[#0A1F44] font-extrabold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer"
              id="admin-logout-btn"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="overview-metrics-grid">
              
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
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-[#0A1F44]">{overviewData?.stats?.pendingApplications ?? 0}</h2>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">Requires admin review</p>
                    </div>
                  </>
                )}
              </div>

              {/* Card 3: Today Shipments */}
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

              {/* Card 4: Monthly Shipments */}
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
                      <span className="bg-amber-100 text-[#0A1F44] text-[9px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider inline-block">
                        Revenue Target
                      </span>
                      <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block pt-2">This Week's Income</h3>
                      <p className="text-2xl font-black text-[#0A1F44]">₦{overviewData?.stats?.revenueWeek ?? 0}</p>
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
                      <p className="text-2xl font-black text-[#0A1F44]">₦{overviewData?.stats?.revenueMonth ?? 0}</p>
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
                <RefreshCw className="w-4 h-4 text-[#F2A93B] animate-spin" />
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
                          activity.type === 'company_applied' ? 'bg-amber-500' :
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
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                        <span>Pending Company Registrations</span>
                      </h3>
                      <span className="text-[10px] font-extrabold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
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
                              <h4 className="text-sm font-extrabold text-[#0A1F44]">{comp.company_name}</h4>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-[#F2A93B]" /> Owner: {comp.owner_phone}</span>
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

                </div>

                {/* Right Side: Company Details Audit Panel */}
                <div className="lg:col-span-4" id="company-detail-panel">
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-5 sticky top-6">
                    <h3 className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider border-b border-slate-50 pb-3 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-[#F2A93B]" />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3" id="shipments-filter-panel">
                
                {/* Search query */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search tracking code, names..."
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
                                wb.status === 'departed' || wb.status === 'in_transit' ? 'bg-amber-50 text-amber-700' :
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
              
              <div className="flex justify-between items-center border-b border-slate-50 pb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-[#0A1F44] uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle className="w-4.5 h-4.5 text-emerald-600" />
                    <span>Platform Revenue & Settlements</span>
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold mt-1">
                    Live settlement distribution metrics split automatically on-the-fly via Paystack routing.
                  </p>
                </div>
                <button
                  onClick={loadRevenue}
                  className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer"
                >
                  Refresh Data
                </button>
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
                                <td className="py-3 px-4 text-center">{row.transactions_count}</td>
                                <td className="py-3 px-4 text-right font-black">₦{row.total_transactions_value.toLocaleString()}</td>
                                <td className="py-3 px-4 text-right text-blue-600">₦{row.company_share_total.toLocaleString()}</td>
                                <td className="py-3 px-4 text-right text-emerald-600">₦{row.platform_share_total.toLocaleString()}</td>
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

      </main>

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
                <FileText className="w-5 h-5 text-[#F2A93B]" />
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
                <span className="font-extrabold uppercase tracking-widest text-[#F2A93B]">{selectedWaybill.status}</span>
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
                    <p className="text-[10px] text-amber-600 font-bold mt-0.5">
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

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-100 mt-6" id="admin-footer">
        &copy; {new Date().getFullYear()} Waybilla Systems Panel. All rights reserved.
      </footer>
    </div>
  );
};
