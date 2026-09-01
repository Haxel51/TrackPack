import React, { useState, useEffect, useMemo } from 'react';
import { getTrips, getTruckProfiles, getPaymentHistory } from '../api';
import { 
  BarChart3, 
  TrendingUp, 
  Truck, 
  Users, 
  Navigation, 
  DollarSign, 
  Calendar, 
  Download, 
  Search, 
  Filter, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  MapPin, 
  FileText, 
  ArrowUpDown,
  Activity,
  Layers,
  Award,
  Zap
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

interface FleetAnalyticsManagementProps {
  token: string;
  role?: string;
  user?: any;
}

export const FleetAnalyticsManagement: React.FC<FleetAnalyticsManagementProps> = ({ token, role, user }) => {
  const isCEO = role === 'company' || user?.role === 'company' || user?.manager_type === 'CEO';
  const isManager = role === 'manager' || user?.role === 'manager' || user?.manager_type === 'Manager';
  const isTripMonitor = role === 'trip_monitor' || user?.role === 'trip_monitor' || user?.manager_type === 'Trip Monitor';
  const isDriver = role === 'driver' || user?.role === 'driver' || user?.manager_type === 'Driver';

  // Access check: CEO and Manager only
  const hasAccess = isCEO || isManager;

  const [trips, setTrips] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active sub-section tab inside analytics
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'trips' | 'revenue' | 'drivers' | 'trucks' | 'activity'>('overview');

  // Filters
  const [dateRangePreset, setDateRangePreset] = useState<string>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedTruckFilter, setSelectedTruckFilter] = useState<string>('all');
  const [selectedDriverFilter, setSelectedDriverFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination for trip history
  const [tripDisplayLimit, setTripDisplayLimit] = useState<number>(20);

  // Sorting states
  const [driverSortBy, setDriverSortBy] = useState<'trips' | 'performance' | 'stops' | 'alphabetical'>('trips');
  const [truckSortBy, setTruckSortBy] = useState<'active' | 'revenue' | 'utilized' | 'alphabetical'>('active');

  useEffect(() => {
    if (!hasAccess) {
      setIsLoading(false);
      return;
    }
    loadAnalyticsData();
  }, [token]);

  const loadAnalyticsData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tripsRes, trucksRes, paymentsRes, teamRes] = await Promise.all([
        getTrips(token),
        getTruckProfiles(token),
        isCEO ? getPaymentHistory(token) : Promise.resolve({ success: true, payments: [], total_collected: 0 }),
        fetch('/api/company/team', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ teamMembers: [] }))
      ]);

      if (tripsRes.success) setTrips(tripsRes.trips || []);
      if (trucksRes.success) setTrucks(trucksRes.trucks || []);
      if (paymentsRes.success) setPayments(paymentsRes.payments || []);
      if (teamRes.success && Array.isArray(teamRes.teamMembers)) {
        setTeamMembers(teamRes.teamMembers);
      } else if (Array.isArray(teamRes)) {
        setTeamMembers(teamRes);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="p-12 text-center bg-[#0b1329] border border-blue-950/60 rounded-3xl space-y-4 my-8">
        <ShieldAlert className="w-12 h-12 text-amber-400 mx-auto" />
        <h3 className="text-lg font-black text-white">Access Restricted</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Fleet Analytics and Reports are restricted to CEO/Owner and Manager roles only.
        </p>
      </div>
    );
  }

  // --- Date Filtering Helper ---
  const filteredTrips = useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = new Date();

    if (dateRangePreset === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (dateRangePreset === 'this_week') {
      const day = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - day);
      startDate.setHours(0, 0, 0, 0);
    } else if (dateRangePreset === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateRangePreset === 'last_month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (dateRangePreset === 'last_3_months') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    } else if (dateRangePreset === 'last_6_months') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    } else if (dateRangePreset === 'last_12_months') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    } else if (dateRangePreset === 'custom' && customStartDate) {
      startDate = new Date(customStartDate);
      if (customEndDate) endDate = new Date(customEndDate);
    }

    return trips.filter(trip => {
      const tripDate = new Date(trip.created_at || trip.departure_time || Date.now());
      if (startDate && tripDate < startDate) return false;
      if (endDate && tripDate > endDate) return false;

      if (selectedTruckFilter !== 'all' && trip.truck_plate !== selectedTruckFilter) return false;
      if (selectedDriverFilter !== 'all' && trip.driver_name !== selectedDriverFilter) return false;
      if (selectedStatusFilter !== 'all' && trip.status !== selectedStatusFilter) return false;
      if (selectedPaymentFilter !== 'all' && (trip.payment_type || 'per_trip') !== selectedPaymentFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPlate = (trip.truck_plate || '').toLowerCase().includes(q);
        const matchDriver = (trip.driver_name || '').toLowerCase().includes(q);
        const matchId = (trip.id || '').toLowerCase().includes(q);
        if (!matchPlate && !matchDriver && !matchId) return false;
      }

      return true;
    });
  }, [trips, dateRangePreset, customStartDate, customEndDate, selectedTruckFilter, selectedDriverFilter, selectedStatusFilter, selectedPaymentFilter, searchQuery]);

  // --- Calculated Statistics ---
  const stats = useMemo(() => {
    const totalTrips = trips.length;
    const activeTrips = trips.filter(t => t.status === 'active' || t.status === 'loaded' || t.status === 'at_supplier').length;
    const completedTrips = trips.filter(t => t.status === 'completed').length;
    const cancelledTrips = trips.filter(t => t.status === 'cancelled' || t.status === 'stopped').length;

    // Financials
    const totalRevenue = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const avgRevenuePerTrip = completedTrips > 0 ? totalRevenue / completedTrips : 0;

    // Fleet
    const totalTrucks = trucks.length;
    const activeTrucks = activeTrips;
    const monthlyPlanTrucks = trucks.filter(t => t.payment_plan === 'monthly').length;
    const perTripTrucks = trucks.filter(t => t.payment_plan === 'per_trip' || !t.payment_plan).length;

    // Drivers
    const driversList = teamMembers.filter(m => m.role === 'driver' || m.manager_type === 'Driver');
    const totalDrivers = driversList.length;
    const activeDrivers = activeTrips;
    const onlineDrivers = driversList.filter(d => d.is_online || d.status === 'active').length;
    const offlineDrivers = Math.max(0, totalDrivers - onlineDrivers);

    return {
      totalTrips,
      activeTrips,
      completedTrips,
      cancelledTrips,
      totalRevenue,
      avgRevenuePerTrip,
      totalTrucks,
      activeTrucks,
      monthlyPlanTrucks,
      perTripTrucks,
      totalDrivers,
      activeDrivers,
      onlineDrivers,
      offlineDrivers
    };
  }, [trips, trucks, payments, teamMembers]);

  // --- Revenue Chart Data (Last 12 Months) ---
  const revenueChartData = useMemo(() => {
    const monthsMap: Record<string, { month: string; perTrip: number; monthlySub: number; total: number }> = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      monthsMap[key] = { month: label, perTrip: 0, monthlySub: 0, total: 0 };
    }

    payments.forEach(p => {
      const pDate = new Date(p.created_at || p.timestamp || Date.now());
      const key = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthsMap[key]) {
        const amt = Number(p.amount) || 0;
        if (p.payment_type === 'monthly' || p.plan === 'monthly') {
          monthsMap[key].monthlySub += amt;
        } else {
          monthsMap[key].perTrip += amt;
        }
        monthsMap[key].total += amt;
      }
    });

    return Object.values(monthsMap);
  }, [payments]);

  // --- Driver Performance Metrics ---
  const driverPerformanceList = useMemo(() => {
    const driverMap: Record<string, { name: string; phone: string; truck: string; tripsCompleted: number; tripsActive: number; stops: number; offRoutes: number; gpsLosses: number; lastActive: string }> = {};

    teamMembers.filter(m => m.role === 'driver' || m.manager_type === 'Driver').forEach(d => {
      const name = d.name || d.full_name || 'Driver';
      const phone = d.phone || d.phone_number || '';
      driverMap[name] = {
        name,
        phone,
        truck: d.truck_plate || 'Unassigned',
        tripsCompleted: 0,
        tripsActive: 0,
        stops: 0,
        offRoutes: 0,
        gpsLosses: 0,
        lastActive: d.updated_at || d.created_at || 'Recently'
      };
    });

    trips.forEach(t => {
      const dName = t.driver_name || 'Unassigned';
      if (!driverMap[dName]) {
        driverMap[dName] = {
          name: dName,
          phone: t.driver_phone || '',
          truck: t.truck_plate || 'Assigned',
          tripsCompleted: 0,
          tripsActive: 0,
          stops: 0,
          offRoutes: 0,
          gpsLosses: 0,
          lastActive: t.created_at || 'Recently'
        };
      }
      if (t.status === 'completed') driverMap[dName].tripsCompleted++;
      if (t.status === 'active' || t.status === 'loaded' || t.status === 'at_supplier') driverMap[dName].tripsActive++;
      if (t.stop_incidents) driverMap[dName].stops += Number(t.stop_incidents) || (t.was_stopped ? 1 : 0);
      if (t.off_route_count) driverMap[dName].offRoutes += Number(t.off_route_count) || (t.went_off_route ? 1 : 0);
      if (t.gps_lost_count) driverMap[dName].gpsLosses += Number(t.gps_lost_count) || 0;
    });

    const list = Object.values(driverMap);
    list.sort((a, b) => {
      if (driverSortBy === 'trips') return b.tripsCompleted - a.tripsCompleted;
      if (driverSortBy === 'stops') return b.stops - a.stops;
      if (driverSortBy === 'alphabetical') return a.name.localeCompare(b.name);
      return (b.tripsCompleted * 10 - b.stops * 5) - (a.tripsCompleted * 10 - a.stops * 5);
    });

    return list;
  }, [teamMembers, trips, driverSortBy]);

  // --- Truck Utilization Metrics ---
  const truckUtilizationList = useMemo(() => {
    const truckMap: Record<string, { plate: string; driver: string; plan: string; status: string; expiry: string; tripsCompleted: number; tripsMonth: number; revenue: number; stops: number; offRoutes: number; lastTrip: string }> = {};

    trucks.forEach(tr => {
      const plate = tr.plate_number || tr.plate || 'TRK-000';
      truckMap[plate] = {
        plate,
        driver: tr.driver_name || 'Unassigned',
        plan: tr.payment_plan || 'per_trip',
        status: tr.subscription_status || 'Active',
        expiry: tr.subscription_expiry || 'N/A',
        tripsCompleted: 0,
        tripsMonth: 0,
        revenue: 0,
        stops: 0,
        offRoutes: 0,
        lastTrip: tr.updated_at || 'N/A'
      };
    });

    const currentMonth = new Date().getMonth();
    trips.forEach(t => {
      const plate = t.truck_plate || 'TRK-000';
      if (!truckMap[plate]) {
        truckMap[plate] = {
          plate,
          driver: t.driver_name || 'Unassigned',
          plan: t.payment_type || 'per_trip',
          status: 'Active',
          expiry: 'N/A',
          tripsCompleted: 0,
          tripsMonth: 0,
          revenue: 0,
          stops: 0,
          offRoutes: 0,
          lastTrip: t.created_at || 'N/A'
        };
      }
      if (t.status === 'completed') {
        truckMap[plate].tripsCompleted++;
        const tDate = new Date(t.created_at || Date.now());
        if (tDate.getMonth() === currentMonth) {
          truckMap[plate].tripsMonth++;
        }
        truckMap[plate].revenue += Number(t.amount_paid || t.amount || 0);
      }
      if (t.stop_incidents) truckMap[plate].stops += Number(t.stop_incidents) || 0;
      if (t.off_route_count) truckMap[plate].offRoutes += Number(t.off_route_count) || 0;
    });

    const list = Object.values(truckMap);
    list.sort((a, b) => {
      if (truckSortBy === 'active') return b.tripsCompleted - a.tripsCompleted;
      if (truckSortBy === 'revenue') return b.revenue - a.revenue;
      if (truckSortBy === 'utilized') return b.tripsMonth - a.tripsMonth;
      return a.plate.localeCompare(b.plate);
    });

    return list;
  }, [trucks, trips, truckSortBy]);

  // --- Real-time Activity Log (Last 50 Events) ---
  const activityLog = useMemo(() => {
    const events: Array<{ id: string; time: string; type: string; message: string; icon: string }> = [];
    
    trips.forEach(t => {
      const timeStr = new Date(t.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      events.push({
        id: `${t.id}-create`,
        time: timeStr,
        type: 'create',
        message: `Trip created for Truck ${t.truck_plate || 'Truck'} heading to ${t.supplier_name || 'Supplier'}`,
        icon: 'Navigation'
      });
      if (t.departure_time) {
        events.push({
          id: `${t.id}-dep`,
          time: new Date(t.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'depart',
          message: `Truck ${t.truck_plate} departed garage (${t.garage_name || 'Garage'})`,
          icon: 'Truck'
        });
      }
      if (t.arrival_supplier_time) {
        events.push({
          id: `${t.id}-arr`,
          time: new Date(t.arrival_supplier_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'supplier',
          message: `Truck ${t.truck_plate} arrived at ${t.supplier_name || 'Supplier'}`,
          icon: 'MapPin'
        });
      }
      if (t.loaded_time) {
        events.push({
          id: `${t.id}-load`,
          time: new Date(t.loaded_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'loaded',
          message: `Truck ${t.truck_plate} loaded and heading out`,
          icon: 'CheckCircle2'
        });
      }
      if (t.was_stopped) {
        events.push({
          id: `${t.id}-stop`,
          time: timeStr,
          type: 'stop',
          message: `⚠️ Truck ${t.truck_plate} stopped for ${t.stop_duration_mins || 30} minutes`,
          icon: 'AlertTriangle'
        });
      }
      if (t.went_off_route) {
        events.push({
          id: `${t.id}-off`,
          time: timeStr,
          type: 'offroute',
          message: `↪️ Truck ${t.truck_plate} went off route`,
          icon: 'AlertTriangle'
        });
      }
      if (t.status === 'completed') {
        events.push({
          id: `${t.id}-comp`,
          time: new Date(t.completion_time || t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'complete',
          message: `✅ Truck ${t.truck_plate} successfully completed trip`,
          icon: 'CheckCircle2'
        });
      }
    });

    return events.slice(0, 50);
  }, [trips]);

  // --- Export Handler ---
  const handleExport = (type: 'trips' | 'revenue' | 'drivers' | 'trucks') => {
    if (type === 'revenue' && !isCEO) {
      alert('Revenue report export is restricted to CEO/Owner roles.');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    if (type === 'trips') {
      csvContent += "Trip ID,Date,Truck Plate,Driver,Origin,Destination,Status,Payment Type,Amount\r\n";
      filteredTrips.forEach(t => {
        csvContent += `"${t.id}","${t.created_at || ''}","${t.truck_plate || ''}","${t.driver_name || ''}","${t.garage_name || ''}","${t.supplier_name || ''}","${t.status || ''}","${t.payment_type || ''}","${t.amount_paid || 0}"\r\n`;
      });
    } else if (type === 'revenue') {
      csvContent += "Date,Truck Plate,Driver,Payment Type,Amount,Reference,Paid By\r\n";
      payments.forEach(p => {
        csvContent += `"${p.created_at || ''}","${p.truck_plate || ''}","${p.driver_name || ''}","${p.payment_type || ''}","${p.amount || 0}","${p.reference || ''}","${p.paid_by || ''}"\r\n`;
      });
    } else if (type === 'drivers') {
      csvContent += "Driver Name,Phone,Truck,Trips Completed,Active Trips,Stops,Off-Routes\r\n";
      driverPerformanceList.forEach(d => {
        csvContent += `"${d.name}","${d.phone}","${d.truck}","${d.tripsCompleted}","${d.tripsActive}","${d.stops}","${d.offRoutes}"\r\n`;
      });
    } else if (type === 'trucks') {
      csvContent += "Plate Number,Driver,Payment Plan,Status,Trips Completed,Trips This Month,Revenue Generated\r\n";
      truckUtilizationList.forEach(tr => {
        csvContent += `"${tr.plate}","${tr.driver}","${tr.plan}","${tr.status}","${tr.tripsCompleted}","${tr.tripsMonth}","${tr.revenue}"\r\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `waybilla_fleet_${type}_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-blue-950/60 p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <BarChart3 className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">Fleet Analytics & Reports</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Comprehensive operations, trip history, driver performance, and financial analytics.
            </p>
          </div>
        </div>

        {/* Date Range & Export Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={dateRangePreset}
            onChange={(e) => setDateRangePreset(e.target.value)}
            className="bg-[#070b19] border border-blue-950/60 text-slate-200 text-xs font-bold rounded-xl px-4 py-2.5 outline-none focus:border-amber-500"
          >
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="last_3_months">Last 3 Months</option>
            <option value="last_6_months">Last 6 Months</option>
            <option value="last_12_months">Last 12 Months</option>
            <option value="custom">Custom Range</option>
          </select>

          {dateRangePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-[#070b19] border border-blue-950/60 text-slate-200 text-xs rounded-xl px-3 py-2"
              />
              <span className="text-slate-500 text-xs">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-[#070b19] border border-blue-950/60 text-slate-200 text-xs rounded-xl px-3 py-2"
              />
            </div>
          )}
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none border-b border-blue-950/60 pb-2">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
            activeSubTab === 'overview' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-[#0b1329] text-slate-300 hover:bg-slate-800 border border-blue-950/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Overview Stats</span>
        </button>

        <button
          onClick={() => setActiveSubTab('trips')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
            activeSubTab === 'trips' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-[#0b1329] text-slate-300 hover:bg-slate-800 border border-blue-950/60'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>Trip History ({filteredTrips.length})</span>
        </button>

        {isCEO && (
          <button
            onClick={() => setActiveSubTab('revenue')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              activeSubTab === 'revenue' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-[#0b1329] text-slate-300 hover:bg-slate-800 border border-blue-950/60'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Revenue Reports</span>
          </button>
        )}

        <button
          onClick={() => setActiveSubTab('drivers')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
            activeSubTab === 'drivers' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-[#0b1329] text-slate-300 hover:bg-slate-800 border border-blue-950/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Driver Performance</span>
        </button>

        <button
          onClick={() => setActiveSubTab('trucks')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
            activeSubTab === 'trucks' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-[#0b1329] text-slate-300 hover:bg-slate-800 border border-blue-950/60'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Truck Utilization</span>
        </button>

        <button
          onClick={() => setActiveSubTab('activity')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
            activeSubTab === 'activity' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-[#0b1329] text-slate-300 hover:bg-slate-800 border border-blue-950/60'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Real-Time Activity Log</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-24 text-center bg-[#0b1329] border border-blue-950/60 rounded-3xl space-y-3">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-bold text-slate-400">Loading analytics insights...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-3xl text-rose-300 text-xs font-bold">
          {error}
        </div>
      ) : (
        <>
          {/* ================= SECTION 1: OVERVIEW STATS ================= */}
          {activeSubTab === 'overview' && (
            <div className="space-y-8 animate-fadeIn">
              {/* Row 1: Trip Stats */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-amber-400" />
                  <span>Trip Statistics</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl shadow-sm">
                    <span className="text-xs text-slate-400 font-bold uppercase">Total Trips</span>
                    <div className="text-2xl font-black text-white mt-1">{stats.totalTrips}</div>
                    <span className="text-[10px] text-slate-500 mt-1 block">All-time haulage dispatches</span>
                  </div>
                  <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl shadow-sm">
                    <span className="text-xs text-emerald-400 font-bold uppercase">Active Trips</span>
                    <div className="text-2xl font-black text-emerald-300 mt-1">{stats.activeTrips}</div>
                    <span className="text-[10px] text-slate-500 mt-1 block">Currently on transit</span>
                  </div>
                  <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl shadow-sm">
                    <span className="text-xs text-blue-400 font-bold uppercase">Completed Trips</span>
                    <div className="text-2xl font-black text-blue-300 mt-1">{stats.completedTrips}</div>
                    <span className="text-[10px] text-slate-500 mt-1 block">Successfully delivered</span>
                  </div>
                  <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl shadow-sm">
                    <span className="text-xs text-rose-400 font-bold uppercase">Cancelled / Stopped</span>
                    <div className="text-2xl font-black text-rose-300 mt-1">{stats.cancelledTrips}</div>
                    <span className="text-[10px] text-slate-500 mt-1 block">Requires attention</span>
                  </div>
                </div>
              </div>

              {/* Row 2: Financial Stats (CEO only) */}
              {isCEO && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span>Financial Statistics</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl shadow-sm">
                      <span className="text-xs text-slate-400 font-bold uppercase">Total Revenue Collected</span>
                      <div className="text-2xl font-black text-emerald-400 mt-1">₦{stats.totalRevenue.toLocaleString()}</div>
                      <span className="text-[10px] text-slate-500 mt-1 block">Paystack verified payments</span>
                    </div>
                    <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl shadow-sm">
                      <span className="text-xs text-slate-400 font-bold uppercase">Revenue This Month</span>
                      <div className="text-2xl font-black text-white mt-1">
                        ₦{payments.filter(p => new Date(p.created_at || Date.now()).getMonth() === new Date().getMonth()).reduce((a, b) => a + (Number(b.amount) || 0), 0).toLocaleString()}
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block">Current calendar month</span>
                    </div>
                    <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl shadow-sm">
                      <span className="text-xs text-slate-400 font-bold uppercase">Revenue This Week</span>
                      <div className="text-2xl font-black text-white mt-1">
                        ₦{payments.filter(p => {
                          const d = new Date(p.created_at || Date.now());
                          const now = new Date();
                          return d >= new Date(now.setDate(now.getDate() - 7));
                        }).reduce((a, b) => a + (Number(b.amount) || 0), 0).toLocaleString()}
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block">Last 7 days</span>
                    </div>
                    <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl shadow-sm">
                      <span className="text-xs text-slate-400 font-bold uppercase">Avg Revenue Per Trip</span>
                      <div className="text-2xl font-black text-white mt-1">₦{Math.round(stats.avgRevenuePerTrip).toLocaleString()}</div>
                      <span className="text-[10px] text-slate-500 mt-1 block">Per completed delivery</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Row 3: Fleet Stats */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <span>Fleet Statistics</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl shadow-sm">
                    <span className="text-xs text-slate-400 font-bold uppercase">Total Trucks</span>
                    <div className="text-2xl font-black text-white mt-1">{stats.totalTrucks}</div>
                    <span className="text-[10px] text-slate-500 mt-1 block">Registered haulage trucks</span>
                  </div>
                  <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl shadow-sm">
                    <span className="text-xs text-amber-400 font-bold uppercase">Active Trucks</span>
                    <div className="text-2xl font-black text-amber-300 mt-1">{stats.activeTrucks}</div>
                    <span className="text-[10px] text-slate-500 mt-1 block">Currently on active trip</span>
                  </div>
                  <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl shadow-sm">
                    <span className="text-xs text-slate-400 font-bold uppercase">Monthly Plan Trucks</span>
                    <div className="text-2xl font-black text-white mt-1">{stats.monthlyPlanTrucks}</div>
                    <span className="text-[10px] text-slate-500 mt-1 block">Unlimited subscription</span>
                  </div>
                  <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl shadow-sm">
                    <span className="text-xs text-slate-400 font-bold uppercase">Per Trip Trucks</span>
                    <div className="text-2xl font-black text-white mt-1">{stats.perTripTrucks}</div>
                    <span className="text-[10px] text-slate-500 mt-1 block">Pay-per-dispatch</span>
                  </div>
                </div>
              </div>

              {/* Row 4: Driver Stats */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>Driver Statistics</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl shadow-sm">
                    <span className="text-xs text-slate-400 font-bold uppercase">Total Drivers</span>
                    <div className="text-2xl font-black text-white mt-1">{stats.totalDrivers}</div>
                    <span className="text-[10px] text-slate-500 mt-1 block">Registered drivers</span>
                  </div>
                  <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl shadow-sm">
                    <span className="text-xs text-emerald-400 font-bold uppercase">Active Drivers</span>
                    <div className="text-2xl font-black text-emerald-300 mt-1">{stats.activeDrivers}</div>
                    <span className="text-[10px] text-slate-500 mt-1 block">On active trip now</span>
                  </div>
                  <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl shadow-sm">
                    <span className="text-xs text-blue-400 font-bold uppercase">Drivers Online</span>
                    <div className="text-2xl font-black text-blue-300 mt-1">{stats.onlineDrivers}</div>
                    <span className="text-[10px] text-slate-500 mt-1 block">App installed & active</span>
                  </div>
                  <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl shadow-sm">
                    <span className="text-xs text-slate-400 font-bold uppercase">Drivers Offline</span>
                    <div className="text-2xl font-black text-slate-300 mt-1">{stats.offlineDrivers}</div>
                    <span className="text-[10px] text-slate-500 mt-1 block">Not logged in</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= SECTION 2: TRIP HISTORY ================= */}
          {activeSubTab === 'trips' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Filter Toolbar */}
              <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="Search plate number or driver..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#070b19] border border-blue-950/60 text-slate-200 pl-10 pr-4 py-2.5 rounded-xl text-xs font-medium outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
                  <select
                    value={selectedTruckFilter}
                    onChange={(e) => setSelectedTruckFilter(e.target.value)}
                    className="bg-[#070b19] border border-blue-950/60 text-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 outline-none"
                  >
                    <option value="all">All Trucks</option>
                    {trucks.map(tr => (
                      <option key={tr.id || tr.plate_number} value={tr.plate_number}>{tr.plate_number}</option>
                    ))}
                  </select>

                  <select
                    value={selectedStatusFilter}
                    onChange={(e) => setSelectedStatusFilter(e.target.value)}
                    className="bg-[#070b19] border border-blue-950/60 text-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="stopped">Stopped</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  <select
                    value={selectedPaymentFilter}
                    onChange={(e) => setSelectedPaymentFilter(e.target.value)}
                    className="bg-[#070b19] border border-blue-950/60 text-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 outline-none"
                  >
                    <option value="all">All Payment Plans</option>
                    <option value="per_trip">Per Trip</option>
                    <option value="monthly">Monthly Subscription</option>
                  </select>

                  <button
                    onClick={() => handleExport('trips')}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-blue-900/65 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Trips Table */}
              <div className="bg-[#0b1329] border border-blue-950/60 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#070b19]/80 text-[11px] font-black uppercase text-slate-400 border-b border-blue-950/60 tracking-wider">
                        <th className="p-4">Trip ID / Date</th>
                        <th className="p-4">Truck & Driver</th>
                        <th className="p-4">Origin & Destination</th>
                        <th className="p-4">Status & Plan</th>
                        <th className="p-4">Incidents</th>
                        <th className="p-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-xs">
                      {filteredTrips.slice(0, tripDisplayLimit).map(trip => (
                        <tr key={trip.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-white font-mono">#{trip.id ? trip.id.slice(-6).toUpperCase() : 'TRP'}</div>
                            <div className="text-[10px] text-slate-400">{new Date(trip.created_at || Date.now()).toLocaleString()}</div>
                          </td>
                          <td className="p-4">
                            <div className="font-extrabold text-amber-400">{trip.truck_plate || 'N/A'}</div>
                            <div className="text-[11px] text-slate-300">{trip.driver_name || 'Unassigned'}</div>
                            <div className="text-[10px] text-slate-400">{trip.driver_phone}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-slate-200 font-medium">📍 {trip.garage_name || 'Garage'}</div>
                            <div className="text-slate-400 text-[11px]">➔ {trip.supplier_name || 'Destination'}</div>
                            {trip.redirect_destination && (
                              <div className="text-amber-300 text-[10px]">↪️ Redirected to {trip.redirect_destination}</div>
                            )}
                          </td>
                          <td className="p-4">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              trip.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                              trip.status === 'active' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                              'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}>
                              {trip.status || 'Active'}
                            </span>
                            <div className="text-[10px] text-slate-400 mt-1 capitalize">{trip.payment_type || 'Per Trip'}</div>
                          </td>
                          <td className="p-4 space-y-1">
                            {trip.was_stopped ? (
                              <span className="text-[10px] text-amber-400 block">⚠️ Stopped ({trip.stop_duration_mins || 30}m)</span>
                            ) : (
                              <span className="text-[10px] text-slate-500 block">No stops</span>
                            )}
                            {trip.went_off_route && (
                              <span className="text-[10px] text-rose-400 block">↪️ Off Route</span>
                            )}
                          </td>
                          <td className="p-4 text-right font-black text-white">
                            ₦{(Number(trip.amount_paid || trip.amount) || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredTrips.length > tripDisplayLimit && (
                  <div className="p-4 bg-[#070b19]/60 border-t border-blue-950/60 text-center">
                    <button
                      onClick={() => setTripDisplayLimit(prev => prev + 20)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-6 py-2.5 rounded-xl text-xs cursor-pointer transition-all"
                    >
                      Load More Trips ({filteredTrips.length - tripDisplayLimit} remaining)
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= SECTION 3: REVENUE REPORTS (CEO only) ================= */}
          {activeSubTab === 'revenue' && isCEO && (
            <div className="space-y-8 animate-fadeIn">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl">
                  <span className="text-xs text-slate-400 font-bold uppercase">Total Revenue All Time</span>
                  <div className="text-2xl font-black text-emerald-400 mt-1">₦{stats.totalRevenue.toLocaleString()}</div>
                </div>
                <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl">
                  <span className="text-xs text-slate-400 font-bold uppercase">Per Trip Payments</span>
                  <div className="text-2xl font-black text-white mt-1">
                    ₦{payments.filter(p => p.payment_type !== 'monthly').reduce((a, b) => a + (Number(b.amount) || 0), 0).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">{payments.filter(p => p.payment_type !== 'monthly').length} dispatches</span>
                </div>
                <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl">
                  <span className="text-xs text-slate-400 font-bold uppercase">Monthly Subscriptions</span>
                  <div className="text-2xl font-black text-white mt-1">
                    ₦{payments.filter(p => p.payment_type === 'monthly').reduce((a, b) => a + (Number(b.amount) || 0), 0).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">{payments.filter(p => p.payment_type === 'monthly').length} subscriptions</span>
                </div>
                <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl">
                  <span className="text-xs text-slate-400 font-bold uppercase">Average Monthly Revenue</span>
                  <div className="text-2xl font-black text-white mt-1">
                    ₦{Math.round(stats.totalRevenue / 12).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Monthly Revenue Chart */}
              <div className="bg-[#0b1329] border border-blue-950/60 p-6 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>Monthly Revenue Breakdown (Last 12 Months)</span>
                  </h3>
                  <button
                    onClick={() => handleExport('revenue')}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Revenue Report</span>
                  </button>
                </div>

                <div className="h-72 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem', color: '#fff' }}
                        formatter={(val: any) => [`₦${Number(val).toLocaleString()}`, '']}
                      />
                      <Legend />
                      <Bar dataKey="perTrip" name="Per Trip Revenue" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="monthlySub" name="Monthly Subscription" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Payment History Table */}
              <div className="bg-[#0b1329] border border-blue-950/60 rounded-3xl overflow-hidden shadow-xl">
                <div className="p-5 border-b border-blue-950/60 font-black text-sm text-white">Payment Transactions Ledger</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#070b19]/80 text-[11px] font-black uppercase text-slate-400 border-b border-blue-950/60">
                        <th className="p-4">Date & Time</th>
                        <th className="p-4">Truck & Driver</th>
                        <th className="p-4">Payment Type</th>
                        <th className="p-4">Paystack Reference</th>
                        <th className="p-4">Paid By</th>
                        <th className="p-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-xs">
                      {payments.map(p => (
                        <tr key={p.id || p.reference} className="hover:bg-slate-800/40">
                          <td className="p-4 text-slate-300">{new Date(p.created_at || Date.now()).toLocaleString()}</td>
                          <td className="p-4">
                            <div className="font-bold text-amber-400">{p.truck_plate || 'N/A'}</div>
                            <div className="text-[11px] text-slate-400">{p.driver_name || 'Driver'}</div>
                          </td>
                          <td className="p-4 capitalize font-bold text-slate-200">{p.payment_type || 'Per Trip'}</td>
                          <td className="p-4 font-mono text-slate-400">{p.reference || 'PSK_REF'}</td>
                          <td className="p-4 text-slate-300">{p.paid_by || 'User'}</td>
                          <td className="p-4 text-right font-black text-emerald-400">₦{(Number(p.amount) || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= SECTION 4: DRIVER PERFORMANCE ================= */}
          {activeSubTab === 'drivers' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-black text-white">Driver Performance Rankings</h3>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={driverSortBy}
                    onChange={(e: any) => setDriverSortBy(e.target.value)}
                    className="bg-[#070b19] border border-blue-950/60 text-slate-200 text-xs font-bold rounded-xl px-4 py-2.5 outline-none"
                  >
                    <option value="trips">Sort by: Most Trips</option>
                    <option value="performance">Sort by: Best Performance</option>
                    <option value="stops">Sort by: Most Stops</option>
                    <option value="alphabetical">Sort by: Alphabetical</option>
                  </select>

                  <button
                    onClick={() => handleExport('drivers')}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                  </button>
                </div>
              </div>

              <div className="bg-[#0b1329] border border-blue-950/60 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#070b19]/80 text-[11px] font-black uppercase text-slate-400 border-b border-blue-950/60">
                        <th className="p-4">Driver Name</th>
                        <th className="p-4">Truck Assigned</th>
                        <th className="p-4 text-center">Completed Trips</th>
                        <th className="p-4 text-center">Active Trips</th>
                        <th className="p-4 text-center">Stop Incidents</th>
                        <th className="p-4 text-center">Off-Routes</th>
                        <th className="p-4 text-center">GPS Losses</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-xs">
                      {driverPerformanceList.map((d, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="p-4">
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{d.name}</span>
                              {idx === 0 && <Award className="w-4 h-4 text-amber-400" />}
                            </div>
                            <div className="text-[11px] text-slate-400">{d.phone}</div>
                          </td>
                          <td className="p-4 font-bold text-amber-400">{d.truck}</td>
                          <td className="p-4 text-center font-bold text-emerald-400">{d.tripsCompleted}</td>
                          <td className="p-4 text-center font-bold text-blue-400">{d.tripsActive}</td>
                          <td className="p-4 text-center font-bold text-amber-300">{d.stops}</td>
                          <td className="p-4 text-center font-bold text-rose-400">{d.offRoutes}</td>
                          <td className="p-4 text-center font-bold text-slate-300">{d.gpsLosses}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= SECTION 5: TRUCK UTILIZATION ================= */}
          {activeSubTab === 'trucks' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-[#0b1329] border border-blue-950/60 p-5 rounded-3xl flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-black text-white">Truck Utilization & Haulage Metrics</h3>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={truckSortBy}
                    onChange={(e: any) => setTruckSortBy(e.target.value)}
                    className="bg-[#070b19] border border-blue-950/60 text-slate-200 text-xs font-bold rounded-xl px-4 py-2.5 outline-none"
                  >
                    <option value="active">Sort by: Most Active</option>
                    <option value="revenue">Sort by: Most Revenue</option>
                    <option value="utilized">Sort by: Most Utilized (Month)</option>
                    <option value="alphabetical">Sort by: Alphabetical</option>
                  </select>

                  <button
                    onClick={() => handleExport('trucks')}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                  </button>
                </div>
              </div>

              <div className="bg-[#0b1329] border border-blue-950/60 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#070b19]/80 text-[11px] font-black uppercase text-slate-400 border-b border-blue-950/60">
                        <th className="p-4">Truck Plate</th>
                        <th className="p-4">Driver</th>
                        <th className="p-4">Payment Plan</th>
                        <th className="p-4 text-center">Trips Completed</th>
                        <th className="p-4 text-center">Trips This Month</th>
                        <th className="p-4 text-center">Incidents</th>
                        <th className="p-4 text-right">Revenue Generated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-xs">
                      {truckUtilizationList.map((tr, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="p-4 font-black text-amber-400">{tr.plate}</td>
                          <td className="p-4 text-slate-200">{tr.driver}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              tr.plan === 'monthly' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            }`}>
                              {tr.plan || 'Per Trip'}
                            </span>
                          </td>
                          <td className="p-4 text-center font-bold text-white">{tr.tripsCompleted}</td>
                          <td className="p-4 text-center font-bold text-emerald-300">{tr.tripsMonth}</td>
                          <td className="p-4 text-center text-amber-400">{tr.stops + tr.offRoutes}</td>
                          <td className="p-4 text-right font-black text-emerald-400">₦{tr.revenue.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= SECTION 6: REAL-TIME ACTIVITY LOG ================= */}
          {activeSubTab === 'activity' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-[#0b1329] border border-blue-950/60 p-6 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
                    <div>
                      <h3 className="text-sm font-black text-white">Live Fleet Activity Feed</h3>
                      <p className="text-xs text-slate-400">Real-time event log across all active haulage trips</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-[11px] font-black">
                    ● LIVE FEED
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  {activityLog.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">No activity recorded yet today.</div>
                  ) : (
                    activityLog.map(act => (
                      <div key={act.id} className="bg-[#070b19] border border-blue-950/60/80 p-4 rounded-2xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-[#0b1329] border border-blue-950/60 flex items-center justify-center text-amber-400 shrink-0">
                            <Navigation className="w-4 h-4" />
                          </div>
                          <span className="text-xs text-slate-200 font-medium">{act.message}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 shrink-0">{act.time}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
