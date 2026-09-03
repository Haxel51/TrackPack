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
  Zap,
  Eye,
  X
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { format } from 'date-fns';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getHumanTripStatusBadge, getHumanTripStatus } from '../utils/statusFormatters';

interface FleetAnalyticsManagementProps {
  token: string;
  role?: string;
  user?: any;
}

// Simple in-memory 5-minute cache layer
const analyticsCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

async function getCachedData(key: string, fetchFn: () => Promise<any>) {
  const cached = analyticsCache.get(key);
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  const data = await fetchFn();
  analyticsCache.set(key, { data, timestamp: now });
  return data;
}

export const FleetAnalyticsManagement: React.FC<FleetAnalyticsManagementProps> = ({ token, role, user }) => {
  const isCEO = role === 'company' || user?.role === 'company' || user?.manager_type === 'CEO';
  const isManager = role === 'manager' || user?.role === 'manager' || user?.manager_type === 'Manager';
  const hasAccess = isCEO || isManager;

  const [trips, setTrips] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  const [tripDisplayLimit, setTripDisplayLimit] = useState<number>(20);
  const [driverSortBy, setDriverSortBy] = useState<'trips' | 'performance' | 'stops' | 'alphabetical'>('trips');
  const [truckSortBy, setTruckSortBy] = useState<'active' | 'revenue' | 'utilized' | 'alphabetical'>('active');

  // Selected trip for detailed granular timestamps view modal
  const [selectedTripDetails, setSelectedTripDetails] = useState<any | null>(null);

  const loadAnalyticsData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tripsRes, trucksRes, paymentsRes, teamRes] = await Promise.all([
        getCachedData('trips_data', () => getTrips(token)),
        getCachedData('trucks_data', () => getTruckProfiles(token)),
        isCEO ? getCachedData('payments_data', () => getPaymentHistory(token)) : Promise.resolve({ success: true, payments: [], total_collected: 0 }),
        getCachedData('team_data', () => fetch('/api/company/team', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => ({ teamMembers: [] })))
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

  // Load initial data & set up real-time listener for trips
  useEffect(() => {
    if (!hasAccess) {
      setIsLoading(false);
      return;
    }

    loadAnalyticsData();

    // Real-time Firestore snapshot listener for trips
    const companyId = user?.companyId || user?.uid || 'default_company';
    const unsubscribeTrips = onSnapshot(
      query(collection(db, 'fleetTracking_trips'), where('companyId', '==', companyId)),
      (snapshot) => {
        const liveTrips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (liveTrips.length > 0) {
          setTrips(liveTrips);
        }
      },
      () => {} // silent fallback on permission/offline
    );

    return () => {
      unsubscribeTrips();
    };
  }, [token, isCEO, user]);

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

  // --- Filtered Trips ---
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

    const totalRevenue = payments.reduce((acc, p) => acc + (Number(p.amount) || Number(p.payment_amount) || 0), 0);
    const avgRevenuePerTrip = completedTrips > 0 ? totalRevenue / completedTrips : 0;

    const totalTrucks = trucks.length;
    const activeTrucks = activeTrips;
    const monthlyPlanTrucks = trucks.filter(t => t.payment_plan === 'monthly').length;
    const perTripTrucks = trucks.filter(t => t.payment_plan === 'per_trip' || !t.payment_plan).length;

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

  // --- Revenue Chart Data (Last 12 Months) & Most Profitable Month ---
  const { revenueChartData, mostProfitableMonth } = useMemo(() => {
    const monthsMap: Record<string, { month: string; perTrip: number; monthlySub: number; total: number }> = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      monthsMap[key] = { month: label, perTrip: 0, monthlySub: 0, total: 0 };
    }

    const monthlyRevenueSum: Record<string, number> = {};

    payments.forEach(p => {
      const rawDate = p.created_at || p.timestamp || p.payment_date;
      const pDate = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate || Date.now());
      const key = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`;
      const amt = Number(p.amount) || Number(p.payment_amount) || 0;

      const monthName = format(pDate, 'MMMM yyyy');
      monthlyRevenueSum[monthName] = (monthlyRevenueSum[monthName] || 0) + amt;

      if (monthsMap[key]) {
        if (p.payment_type === 'monthly' || p.plan === 'monthly') {
          monthsMap[key].monthlySub += amt;
        } else {
          monthsMap[key].perTrip += amt;
        }
        monthsMap[key].total += amt;
      }
    });

    const sortedProfitable = Object.entries(monthlyRevenueSum).sort(([, a], [, b]) => b - a)[0] || ['No Data', 0];

    return {
      revenueChartData: Object.values(monthsMap),
      mostProfitableMonth: sortedProfitable
    };
  }, [payments]);

  // --- Driver Performance Metrics (FIX 1B) ---
  const driverPerformanceList = useMemo(() => {
    const driverMap: Record<string, any> = {};

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
        completedTripsArr: []
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
          completedTripsArr: []
        };
      }
      if (t.status === 'completed') {
        driverMap[dName].tripsCompleted++;
        driverMap[dName].completedTripsArr.push(t);
      }
      if (t.status === 'active' || t.status === 'loaded' || t.status === 'at_supplier') driverMap[dName].tripsActive++;
      if (t.stop_incidents) driverMap[dName].stops += Number(t.stop_incidents) || (t.was_stopped ? 1 : 0);
      if (t.off_route_count) driverMap[dName].offRoutes += Number(t.off_route_count) || (t.went_off_route ? 1 : 0);
      if (t.gps_lost_count) driverMap[dName].gpsLosses += Number(t.gps_lost_count) || 0;
    });

    return Object.values(driverMap).map(driver => {
      const compTrips = driver.completedTripsArr;
      const totalDuration = compTrips.reduce((acc: number, trip: any) => {
        const dep = new Date(trip.departure_time || trip.created_at || Date.now()).getTime();
        const comp = new Date(trip.completion_time || trip.updated_at || Date.now()).getTime();
        return acc + Math.max(0, comp - dep);
      }, 0);

      const avgDurationMs = compTrips.length > 0 ? totalDuration / compTrips.length : 0;
      const avgHours = Math.floor(avgDurationMs / (1000 * 60 * 60));
      const avgMins = Math.floor((avgDurationMs % (1000 * 60 * 60)) / (1000 * 60));
      const avgDurationStr = compTrips.length > 0 ? `${avgHours}h ${avgMins}m average` : 'N/A';

      const onTimeTrips = compTrips.filter((trip: any) => {
        const history = trip.status_history || [];
        const stopEvents = history.filter((h: any) => h.status === 'stopped').length;
        const gpsLostEvents = history.filter((h: any) => h.status === 'gps_lost').length;
        return stopEvents === 0 && gpsLostEvents === 0;
      });

      const onTimeRate = compTrips.length > 0 ? Math.round((onTimeTrips.length / compTrips.length) * 100) : 100;
      const onTimeRateStr = `${onTimeRate}% on-time`;

      return {
        ...driver,
        avgDurationStr,
        onTimeRateStr
      };
    }).sort((a, b) => {
      if (driverSortBy === 'trips') return b.tripsCompleted - a.tripsCompleted;
      if (driverSortBy === 'stops') return b.stops - a.stops;
      if (driverSortBy === 'alphabetical') return a.name.localeCompare(b.name);
      return (b.tripsCompleted * 10 - b.stops * 5) - (a.tripsCompleted * 10 - a.stops * 5);
    });
  }, [teamMembers, trips, driverSortBy]);

  // --- Truck Utilization Metrics (FIX 1C) ---
  const truckUtilizationList = useMemo(() => {
    const truckMap: Record<string, any> = {};
    const now = new Date();
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    trucks.forEach(tr => {
      const plate = tr.plate_number || tr.plate || 'TRK-000';
      truckMap[plate] = {
        plate,
        driver: tr.driver_name || 'Unassigned',
        plan: tr.payment_plan || 'per_trip',
        status: tr.subscription_status || 'Active',
        tripsCompleted: 0,
        tripsMonth: 0,
        revenue: 0,
        stops: 0,
        offRoutes: 0,
        truckTripsArr: []
      };
    });

    trips.forEach(t => {
      const plate = t.truck_plate || 'TRK-000';
      if (!truckMap[plate]) {
        truckMap[plate] = {
          plate,
          driver: t.driver_name || 'Unassigned',
          plan: t.payment_type || 'per_trip',
          status: 'Active',
          tripsCompleted: 0,
          tripsMonth: 0,
          revenue: 0,
          stops: 0,
          offRoutes: 0,
          truckTripsArr: []
        };
      }
      truckMap[plate].truckTripsArr.push(t);
      if (t.status === 'completed') {
        truckMap[plate].tripsCompleted++;
        const tDate = new Date(t.created_at || Date.now()).getTime();
        if (tDate >= startOfMonth) {
          truckMap[plate].tripsMonth++;
        }
        truckMap[plate].revenue += Number(t.amount_paid || t.amount || 0);
      }
      if (t.stop_incidents) truckMap[plate].stops += Number(t.stop_incidents) || 0;
      if (t.off_route_count) truckMap[plate].offRoutes += Number(t.off_route_count) || 0;
    });

    return Object.values(truckMap).map(truck => {
      const last30DaysTrips = truck.truckTripsArr.filter((t: any) => (t.created_at || 0) >= thirtyDaysAgo);
      const avgTripsPerWeek = ((last30DaysTrips.length / 30) * 7).toFixed(1);
      const avgTripsPerWeekStr = `${avgTripsPerWeek} trips/week`;

      const tripsThisMonth = truck.truckTripsArr.filter((t: any) => (t.created_at || 0) >= startOfMonth);
      const activeDays = new Set(tripsThisMonth.map((t: any) => format(new Date(t.created_at || Date.now()), 'yyyy-MM-dd'))).size;
      const utilizationPercent = Math.round((activeDays / daysInMonth) * 100);
      const utilizationRateStr = `${utilizationPercent}% active this month`;

      return {
        ...truck,
        avgTripsPerWeekStr,
        utilizationRateStr
      };
    }).sort((a, b) => {
      if (truckSortBy === 'active') return b.tripsCompleted - a.tripsCompleted;
      if (truckSortBy === 'revenue') return b.revenue - a.revenue;
      if (truckSortBy === 'utilized') return b.tripsMonth - a.tripsMonth;
      return a.plate.localeCompare(b.plate);
    });
  }, [trucks, trips, truckSortBy]);

  // --- Real-time Activity Log ---
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
          message: `🚚 Truck ${t.truck_plate} departed garage (${t.garage_name || 'Garage'})`,
          icon: 'Truck'
        });
      }
      if (t.arrival_supplier_time) {
        events.push({
          id: `${t.id}-arr`,
          time: new Date(t.arrival_supplier_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'supplier',
          message: `📍 Truck ${t.truck_plate} arrived at supplier ${t.supplier_name || ''}`,
          icon: 'MapPin'
        });
      }
      if (t.loaded_time) {
        events.push({
          id: `${t.id}-load`,
          time: new Date(t.loaded_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'loaded',
          message: `📦 Truck ${t.truck_plate} loaded and departing`,
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

  // --- PDF Export Handler (FIX 4) ---
  const handleExportPDF = (reportType: 'trips' | 'revenue' | 'drivers' | 'trucks') => {
    if (reportType === 'revenue' && !isCEO) {
      alert('Revenue report export is restricted to CEO/Owner roles.');
      return;
    }

    const doc = new jsPDF();
    const companyName = user?.company_name || user?.companyName || 'Waybilla Fleet Corp';
    const reportTitles: Record<string, string> = {
      trips: 'Trip History & Dispatch Ledger Report',
      revenue: 'Revenue Reports & Financial Ledger',
      drivers: 'Driver Performance Leaderboard Report',
      trucks: 'Truck Utilization & Haulage Report'
    };
    const title = reportTitles[reportType] || 'Fleet Analytics Report';

    doc.setFontSize(16);
    doc.text(companyName, 14, 20);
    doc.setFontSize(12);
    doc.text(title, 14, 28);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Date Range: ${dateRangePreset.replace('_', ' ').toUpperCase()}`, 14, 35);
    doc.text(`Generated by: ${user?.name || user?.email || 'Administrator'}`, 14, 41);
    doc.text(`Generated at: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 47);

    let headers: string[] = [];
    let body: any[][] = [];

    if (reportType === 'trips') {
      headers = ['Trip ID', 'Date', 'Truck', 'Driver', 'Origin', 'Destination', 'Status', 'Amount'];
      body = filteredTrips.map(t => [
        t.id?.slice(0, 8) || 'TRIP',
        t.created_at ? format(new Date(t.created_at), 'yyyy-MM-dd') : 'N/A',
        t.truck_plate || 'N/A',
        t.driver_name || 'N/A',
        t.garage_name || 'Garage',
        t.supplier_name || 'Supplier',
        t.status || 'Active',
        `₦${Number(t.amount_paid || 0).toLocaleString()}`
      ]);
    } else if (reportType === 'revenue') {
      headers = ['Date', 'Truck Plate', 'Driver', 'Payment Type', 'Amount', 'Reference'];
      body = payments.map(p => [
        p.created_at ? format(new Date(p.created_at), 'yyyy-MM-dd') : 'N/A',
        p.truck_plate || 'N/A',
        p.driver_name || 'N/A',
        p.payment_type || 'Per Trip',
        `₦${Number(p.amount || p.payment_amount || 0).toLocaleString()}`,
        p.reference || 'N/A'
      ]);
    } else if (reportType === 'drivers') {
      headers = ['Driver Name', 'Phone', 'Truck', 'Completed', 'Active', 'Stops', 'Off-Routes', 'Avg Duration', 'On-Time'];
      body = driverPerformanceList.map(d => [
        d.name,
        d.phone,
        d.truck,
        d.tripsCompleted,
        d.tripsActive,
        d.stops,
        d.offRoutes,
        d.avgDurationStr,
        d.onTimeRateStr
      ]);
    } else if (reportType === 'trucks') {
      headers = ['Plate Number', 'Driver', 'Plan', 'Completed', 'This Month', 'Trips/Week', 'Utilization'];
      body = truckUtilizationList.map(tr => [
        tr.plate,
        tr.driver,
        tr.plan,
        tr.tripsCompleted,
        tr.tripsMonth,
        tr.avgTripsPerWeekStr,
        tr.utilizationRateStr
      ]);
    }

    autoTable(doc, {
      head: [headers],
      body,
      startY: 55,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [11, 19, 41], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] }
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    doc.save(`waybilla_fleet_${reportType}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  // --- CSV Export Handler with Metadata (FIX 5) ---
  const handleExportCSV = (type: 'trips' | 'revenue' | 'drivers' | 'trucks') => {
    if (type === 'revenue' && !isCEO) {
      alert('Revenue report export is restricted to CEO/Owner roles.');
      return;
    }

    const companyName = user?.company_name || user?.companyName || 'Waybilla Fleet Corp';
    const reportTitles: Record<string, string> = {
      trips: 'Trip History & Dispatch Ledger Report',
      revenue: 'Revenue Reports & Financial Ledger',
      drivers: 'Driver Performance Leaderboard Report',
      trucks: 'Truck Utilization & Haulage Report'
    };
    const reportTitle = reportTitles[type] || 'Fleet Analytics Report';

    let headers: string[] = [];
    let rows: string[][] = [];

    if (type === 'trips') {
      headers = ['Trip ID', 'Date', 'Truck Plate', 'Driver', 'Origin', 'Destination', 'Status', 'Payment Type', 'Amount'];
      rows = filteredTrips.map(t => [
        t.id || '',
        t.created_at ? format(new Date(t.created_at), 'yyyy-MM-dd HH:mm') : '',
        t.truck_plate || '',
        t.driver_name || '',
        t.garage_name || '',
        t.supplier_name || '',
        t.status || '',
        t.payment_type || '',
        String(t.amount_paid || 0)
      ]);
    } else if (type === 'revenue') {
      headers = ['Date', 'Truck Plate', 'Driver', 'Payment Type', 'Amount', 'Reference', 'Paid By'];
      rows = payments.map(p => [
        p.created_at ? format(new Date(p.created_at), 'yyyy-MM-dd HH:mm') : '',
        p.truck_plate || '',
        p.driver_name || '',
        p.payment_type || '',
        String(p.amount || p.payment_amount || 0),
        p.reference || '',
        p.paid_by || ''
      ]);
    } else if (type === 'drivers') {
      headers = ['Driver Name', 'Phone', 'Truck', 'Completed Trips', 'Active Trips', 'Stops', 'Off-Routes', 'Avg Duration', 'On-Time Rate'];
      rows = driverPerformanceList.map(d => [
        d.name,
        d.phone,
        d.truck,
        String(d.tripsCompleted),
        String(d.tripsActive),
        String(d.stops),
        String(d.offRoutes),
        d.avgDurationStr,
        d.onTimeRateStr
      ]);
    } else if (type === 'trucks') {
      headers = ['Plate Number', 'Driver', 'Payment Plan', 'Completed Trips', 'Trips This Month', 'Trips/Week', 'Utilization Rate'];
      rows = truckUtilizationList.map(tr => [
        tr.plate,
        tr.driver,
        tr.plan,
        String(tr.tripsCompleted),
        String(tr.tripsMonth),
        tr.avgTripsPerWeekStr,
        tr.utilizationRateStr
      ]);
    }

    const metadata = [
      [`Company: ${companyName}`],
      [`Report: ${reportTitle}`],
      [`Date Range: ${dateRangePreset.replace('_', ' ').toUpperCase()}`],
      [`Generated By: ${user?.name || user?.email || 'Administrator'}`],
      [`Generated At: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`],
      [], // empty row separator
      headers,
      ...rows
    ];

    const csvContent = metadata.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `waybilla_fleet_${type}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#091026] via-[#091026] to-[#050914] border border-blue-950/80 p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
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

        {/* Date Range & Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={dateRangePreset}
            onChange={(e) => setDateRangePreset(e.target.value)}
            className="bg-[#050914] border border-blue-950/80 text-slate-200 text-xs font-bold rounded-xl px-4 py-2.5 outline-none focus:border-amber-500"
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
                className="bg-[#050914] border border-blue-950/80 text-slate-200 text-xs rounded-xl px-3 py-2"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-[#050914] border border-blue-950/80 text-slate-200 text-xs rounded-xl px-3 py-2"
              />
            </div>
          )}

          <button
            onClick={() => loadAnalyticsData()}
            className="bg-[#131e3d] hover:bg-slate-700 text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer border border-blue-900/60"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-blue-950/80">
        {[
          { id: 'overview', label: 'Overview Stats', icon: TrendingUp },
          { id: 'trips', label: 'Trip History & Ledger', icon: Navigation },
          { id: 'drivers', label: 'Driver Performance', icon: Users },
          { id: 'trucks', label: 'Truck Utilization', icon: Truck },
          { id: 'activity', label: 'Real-Time Activity Log', icon: Activity },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-5 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-[#050914] shadow-lg shadow-amber-500/20 font-black'
                  : 'bg-[#091026] text-slate-400 hover:text-white border border-blue-950/80'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#050914]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ERROR / LOADING SKELETON (FIX 6) */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl text-rose-400 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => loadAnalyticsData()} className="font-bold underline cursor-pointer">Retry</button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-[#131e3d]/50 rounded-3xl h-28 w-full border border-blue-950/80" />
            ))}
          </div>
          <div className="bg-[#131e3d]/40 rounded-3xl h-80 w-full border border-blue-950/80" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-[#131e3d]/40 rounded-2xl border border-blue-950/80" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* ================= SECTION 1: OVERVIEW STATS ================= */}
          {activeSubTab === 'overview' && (
            <div className="space-y-8 animate-fadeIn">
              {/* Trip Statistics */}
              <div>
                <h3 className="text-sm font-black text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-amber-400" />
                  <span>Trip Statistics</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {[
                    { label: 'Total Trips Recorded', val: stats.totalTrips, color: 'text-white', bg: 'bg-[#091026]' },
                    { label: 'Active Dispatches', val: stats.activeTrips, color: 'text-blue-400', bg: 'bg-[#091026]' },
                    { label: 'Completed Deliveries', val: stats.completedTrips, color: 'text-emerald-400', bg: 'bg-[#091026]' },
                    { label: 'Cancelled / Incomplete', val: stats.cancelledTrips, color: 'text-rose-400', bg: 'bg-[#091026]' }
                  ].map((s, i) => (
                    <div key={i} className={`${s.bg} border border-blue-950/80 p-6 rounded-3xl shadow-xl flex flex-col justify-between`}>
                      <span className="text-xs font-bold text-slate-400">{s.label}</span>
                      <span className={`text-3xl font-black ${s.color} mt-4`}>{s.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fleet & Driver Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#091026] border border-blue-950/80 p-6 rounded-3xl shadow-xl space-y-4">
                  <div className="flex items-center gap-3">
                    <Truck className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-black text-white">Fleet Statistics</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="bg-[#050914] p-4 rounded-2xl border border-blue-950/80">
                      <span className="text-[11px] text-slate-400 font-bold">Total Trucks</span>
                      <span className="text-xl font-black text-white block mt-1">{stats.totalTrucks}</span>
                    </div>
                    <div className="bg-[#050914] p-4 rounded-2xl border border-blue-950/80">
                      <span className="text-[11px] text-slate-400 font-bold">Active On Road</span>
                      <span className="text-xl font-black text-blue-400 block mt-1">{stats.activeTrucks}</span>
                    </div>
                    <div className="bg-[#050914] p-4 rounded-2xl border border-blue-950/80">
                      <span className="text-[11px] text-slate-400 font-bold">Monthly Plan</span>
                      <span className="text-xl font-black text-emerald-400 block mt-1">{stats.monthlyPlanTrucks}</span>
                    </div>
                    <div className="bg-[#050914] p-4 rounded-2xl border border-blue-950/80">
                      <span className="text-[11px] text-slate-400 font-bold">Per Trip Plan</span>
                      <span className="text-xl font-black text-amber-400 block mt-1">{stats.perTripTrucks}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#091026] border border-blue-950/80 p-6 rounded-3xl shadow-xl space-y-4">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-blue-400" />
                    <h3 className="text-sm font-black text-white">Driver Statistics</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="bg-[#050914] p-4 rounded-2xl border border-blue-950/80">
                      <span className="text-[11px] text-slate-400 font-bold">Total Drivers</span>
                      <span className="text-xl font-black text-white block mt-1">{stats.totalDrivers}</span>
                    </div>
                    <div className="bg-[#050914] p-4 rounded-2xl border border-blue-950/80">
                      <span className="text-[11px] text-slate-400 font-bold">On Active Trip</span>
                      <span className="text-xl font-black text-amber-400 block mt-1">{stats.activeDrivers}</span>
                    </div>
                    <div className="bg-[#050914] p-4 rounded-2xl border border-blue-950/80">
                      <span className="text-[11px] text-slate-400 font-bold">Online / Ready</span>
                      <span className="text-xl font-black text-emerald-400 block mt-1">{stats.onlineDrivers}</span>
                    </div>
                    <div className="bg-[#050914] p-4 rounded-2xl border border-blue-950/80">
                      <span className="text-[11px] text-slate-400 font-bold">Offline</span>
                      <span className="text-xl font-black text-slate-400 block mt-1">{stats.offlineDrivers}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= SECTION 2: TRIP HISTORY & LEDGER ================= */}
          {activeSubTab === 'trips' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-[#091026] border border-blue-950/80 p-5 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search plate, driver, or trip ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-[#050914] border border-blue-950/80 text-slate-200 text-xs font-bold rounded-xl px-4 py-2.5 outline-none w-full md:w-64"
                  />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <select
                    value={selectedTruckFilter}
                    onChange={(e) => setSelectedTruckFilter(e.target.value)}
                    className="bg-[#050914] border border-blue-950/80 text-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 outline-none"
                  >
                    <option value="all">All Trucks</option>
                    {trucks.map(t => (
                      <option key={t.id} value={t.plate_number || t.plate}>{t.plate_number || t.plate}</option>
                    ))}
                  </select>

                  <select
                    value={selectedStatusFilter}
                    onChange={(e) => setSelectedStatusFilter(e.target.value)}
                    className="bg-[#050914] border border-blue-950/80 text-slate-200 text-xs font-bold rounded-xl px-3 py-2.5 outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="stopped">Stopped</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  <button
                    onClick={() => handleExportPDF('trips')}
                    className="bg-amber-500 hover:bg-amber-400 text-[#050914] font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    <span>PDF</span>
                  </button>

                  <button
                    onClick={() => handleExportCSV('trips')}
                    className="bg-[#131e3d] hover:bg-slate-700 text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer border border-blue-900/60"
                  >
                    <Download className="w-4 h-4" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              <div className="bg-[#091026] border border-blue-950/80 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#050914]/80 text-[11px] font-black uppercase text-slate-400 border-b border-blue-950/80">
                        <th className="p-4">Trip ID / Date</th>
                        <th className="p-4">Truck Plate</th>
                        <th className="p-4">Driver Name</th>
                        <th className="p-4">Origin & Destination</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Amount</th>
                        <th className="p-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-xs">
                      {filteredTrips.slice(0, tripDisplayLimit).map((trip, idx) => (
                        <tr key={trip.id || idx} className="hover:bg-[#131e3d]/40">
                          <td className="p-4">
                            <div className="font-bold text-white font-mono">{trip.id?.slice(0, 8) || `TRIP-${idx}`}</div>
                            <div className="text-[11px] text-slate-400">
                              {trip.created_at ? format(new Date(trip.created_at), 'dd MMM yyyy, HH:mm') : 'N/A'}
                            </div>
                          </td>
                          <td className="p-4 font-black text-amber-400">{trip.truck_plate || 'N/A'}</td>
                          <td className="p-4 text-slate-200 font-medium">
                            <div>{trip.driver_name || 'Unassigned'}</div>
                            <div className="text-[11px] text-slate-400">{trip.driver_phone}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-slate-200 font-bold">Garage: {trip.garage_name || 'Main Garage'}</div>
                            <div className="text-[11px] text-slate-400">Supplier: {trip.supplier_name || 'Primary Supplier'}</div>
                          </td>
                          <td className="p-4">
                            {(() => {
                              const badge = getHumanTripStatusBadge(trip.status || trip.trip_status, !!trip.redirect_destination);
                              return (
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider border ${badge.bg}`}>
                                  {badge.label}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="p-4 text-right font-black text-emerald-400">₦{Number(trip.amount_paid || 0).toLocaleString()}</td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => setSelectedTripDetails(trip)}
                              className="px-3 py-1.5 bg-[#131e3d] hover:bg-slate-700 text-amber-400 font-bold rounded-xl text-[11px] flex items-center gap-1.5 mx-auto border border-blue-900/60 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Timeline</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredTrips.length > tripDisplayLimit && (
                  <div className="p-4 text-center bg-[#050914] border-t border-blue-950/80">
                    <button
                      onClick={() => setTripDisplayLimit(prev => prev + 20)}
                      className="px-6 py-2.5 bg-[#131e3d] hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl cursor-pointer border border-blue-900/60"
                    >
                      Load More Trips ({filteredTrips.length - tripDisplayLimit} remaining)
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}



          {/* ================= SECTION 4: DRIVER PERFORMANCE ================= */}
          {activeSubTab === 'drivers' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-[#091026] border border-blue-950/80 p-5 rounded-3xl flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-blue-400" />
                  <h3 className="text-sm font-black text-white">Driver Performance Leaderboard</h3>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={driverSortBy}
                    onChange={(e: any) => setDriverSortBy(e.target.value)}
                    className="bg-[#050914] border border-blue-950/80 text-slate-200 text-xs font-bold rounded-xl px-4 py-2.5 outline-none"
                  >
                    <option value="trips">Sort by: Most Completed Trips</option>
                    <option value="stops">Sort by: Most Stops (Incidents)</option>
                    <option value="alphabetical">Sort by: Alphabetical Name</option>
                  </select>

                  <button
                    onClick={() => handleExportPDF('drivers')}
                    className="bg-amber-500 hover:bg-amber-400 text-[#050914] font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    <span>PDF</span>
                  </button>

                  <button
                    onClick={() => handleExportCSV('drivers')}
                    className="bg-[#131e3d] hover:bg-slate-700 text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer border border-blue-900/60"
                  >
                    <Download className="w-4 h-4" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              <div className="bg-[#091026] border border-blue-950/80 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#050914]/80 text-[11px] font-black uppercase text-slate-400 border-b border-blue-950/80">
                        <th className="p-4">Driver Name</th>
                        <th className="p-4">Truck Assigned</th>
                        <th className="p-4 text-center">Completed</th>
                        <th className="p-4 text-center">Active</th>
                        <th className="p-4 text-center">Avg Duration (FIX 1B)</th>
                        <th className="p-4 text-center">On-Time Rate (FIX 1B)</th>
                        <th className="p-4 text-center">Stop Incidents</th>
                        <th className="p-4 text-center">Off-Routes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-xs">
                      {driverPerformanceList.map((d, idx) => (
                        <tr key={idx} className="hover:bg-[#131e3d]/40">
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
                          <td className="p-4 text-center font-bold text-slate-200">{d.avgDurationStr}</td>
                          <td className="p-4 text-center font-bold text-emerald-300">{d.onTimeRateStr}</td>
                          <td className="p-4 text-center font-bold text-amber-300">{d.stops}</td>
                          <td className="p-4 text-center font-bold text-rose-400">{d.offRoutes}</td>
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
              <div className="bg-[#091026] border border-blue-950/80 p-5 rounded-3xl flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-black text-white">Truck Utilization & Haulage Metrics</h3>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={truckSortBy}
                    onChange={(e: any) => setTruckSortBy(e.target.value)}
                    className="bg-[#050914] border border-blue-950/80 text-slate-200 text-xs font-bold rounded-xl px-4 py-2.5 outline-none"
                  >
                    <option value="active">Sort by: Most Active</option>
                    <option value="utilized">Sort by: Most Utilized (Month)</option>
                    <option value="alphabetical">Sort by: Alphabetical</option>
                  </select>

                  <button
                    onClick={() => handleExportPDF('trucks')}
                    className="bg-amber-500 hover:bg-amber-400 text-[#050914] font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    <span>PDF</span>
                  </button>

                  <button
                    onClick={() => handleExportCSV('trucks')}
                    className="bg-[#131e3d] hover:bg-slate-700 text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer border border-blue-900/60"
                  >
                    <Download className="w-4 h-4" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              <div className="bg-[#091026] border border-blue-950/80 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#050914]/80 text-[11px] font-black uppercase text-slate-400 border-b border-blue-950/80">
                        <th className="p-4">Truck Plate</th>
                        <th className="p-4">Driver</th>
                        <th className="p-4">Payment Plan</th>
                        <th className="p-4 text-center">Completed</th>
                        <th className="p-4 text-center">This Month</th>
                        <th className="p-4 text-center">Trips/Week</th>
                        <th className="p-4 text-center">Utilization</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-xs">
                      {truckUtilizationList.map((tr, idx) => (
                        <tr key={idx} className="hover:bg-[#131e3d]/40">
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
                          <td className="p-4 text-center font-bold text-slate-200">{tr.avgTripsPerWeekStr}</td>
                          <td className="p-4 text-center font-bold text-amber-300">{tr.utilizationRateStr}</td>
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
              <div className="bg-[#091026] border border-blue-950/80 p-6 rounded-3xl space-y-4">
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
                      <div key={act.id} className="bg-[#050914] border border-blue-950/80 p-4 rounded-2xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-[#091026] border border-blue-950/80 flex items-center justify-center text-amber-400 shrink-0">
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

      {/* ================= GRANULAR TRIP TIMESTAMPS MODAL (FIX 1D) ================= */}
      {selectedTripDetails && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#091026] border border-blue-950/80 w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-blue-950/80 pb-4">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <span>Trip Timeline & Granular Timestamps</span>
                  <span className="text-amber-400 text-xs font-mono">({selectedTripDetails.truck_plate})</span>
                </h3>
                <p className="text-xs text-slate-400">ID: {selectedTripDetails.id}</p>
              </div>
              <button
                onClick={() => setSelectedTripDetails(null)}
                className="w-8 h-8 rounded-full bg-[#050914] border border-blue-950/80 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-[#050914] p-4 rounded-2xl border border-blue-950/80">
                <div>
                  <span className="text-[11px] text-slate-400 block font-bold">Driver</span>
                  <span className="text-xs text-white font-bold">{selectedTripDetails.driver_name || 'Unassigned'} ({selectedTripDetails.driver_phone})</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-bold">Status</span>
                  <span className="text-xs text-emerald-400 font-bold uppercase">{selectedTripDetails.status || 'Active'}</span>
                </div>
              </div>

              <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider pt-2">Granular Event Timeline</h4>
              
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-[#050914] border border-blue-950/80 rounded-xl flex items-center justify-between">
                  <span className="text-slate-300">✅ Created at</span>
                  <span className="text-amber-400">{selectedTripDetails.created_at ? format(new Date(selectedTripDetails.created_at), 'dd MMM yyyy, HH:mm:ss') : 'N/A'}</span>
                </div>
                <div className="p-3 bg-[#050914] border border-blue-950/80 rounded-xl flex items-center justify-between">
                  <span className="text-slate-300">✅ Payment confirmed at</span>
                  <span className="text-emerald-400">{selectedTripDetails.payment_confirmed_at ? format(new Date(selectedTripDetails.payment_confirmed_at), 'dd MMM yyyy, HH:mm:ss') : 'Instant / Automatic'}</span>
                </div>
                <div className="p-3 bg-[#050914] border border-blue-950/80 rounded-xl flex items-center justify-between">
                  <span className="text-slate-300">✅ Departed garage at</span>
                  <span className="text-blue-400">{selectedTripDetails.departure_time ? format(new Date(selectedTripDetails.departure_time), 'dd MMM yyyy, HH:mm:ss') : 'Pending Departure'}</span>
                </div>
                <div className="p-3 bg-[#050914] border border-blue-950/80 rounded-xl flex items-center justify-between">
                  <span className="text-slate-300">✅ Arrived at supplier at</span>
                  <span className="text-purple-400">{selectedTripDetails.arrival_supplier_time ? format(new Date(selectedTripDetails.arrival_supplier_time), 'dd MMM yyyy, HH:mm:ss') : 'Pending Arrival'}</span>
                </div>
                <div className="p-3 bg-[#050914] border border-blue-950/80 rounded-xl flex items-center justify-between">
                  <span className="text-slate-300">✅ Loaded at supplier at</span>
                  <span className="text-emerald-400">{selectedTripDetails.loaded_time ? format(new Date(selectedTripDetails.loaded_time), 'dd MMM yyyy, HH:mm:ss') : 'Pending Loading'}</span>
                </div>
                <div className="p-3 bg-[#050914] border border-blue-950/80 rounded-xl flex items-center justify-between">
                  <span className="text-slate-300">✅ Trip completed at</span>
                  <span className="text-emerald-400">{selectedTripDetails.completion_time ? format(new Date(selectedTripDetails.completion_time), 'dd MMM yyyy, HH:mm:ss') : 'In Progress'}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-blue-950/80">
              <button
                onClick={() => setSelectedTripDetails(null)}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-[#050914] font-black text-xs rounded-xl cursor-pointer"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
