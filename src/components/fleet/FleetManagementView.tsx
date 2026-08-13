import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Truck, Building2, Users, Plus, ShieldCheck, DollarSign, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface FleetManagementViewProps {
  userRole: 'company' | 'manager' | 'staff';
}

export const FleetManagementView: React.FC<FleetManagementViewProps> = ({ userRole }) => {
  const { token } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'trucks' | 'suppliers' | 'staff_drivers' | 'trips'>('overview');
  
  const [serviceType, setServiceType] = useState<'package' | 'fleet' | 'both'>('package');
  const [trucks, setTrucks] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [supplierStaff, setSupplierStaff] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [parks, setParks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddTruck, setShowAddTruck] = useState(false);
  const [newTruckNumber, setNewTruckNumber] = useState('');
  const [newTruckParkId, setNewTruckParkId] = useState('');
  const [newTruckBilling, setNewTruckBilling] = useState<'per_trip' | 'monthly'>('per_trip');
  const [newTruckAutoRenew, setNewTruckAutoRenew] = useState(false);

  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');

  const [showAddDriver, setShowAddDriver] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverPin, setDriverPin] = useState('');
  const [driverTruckId, setDriverTruckId] = useState('');
  const [driverParkId, setDriverParkId] = useState('');

  const [showAddSuppStaff, setShowAddSuppStaff] = useState(false);
  const [suppStaffName, setSuppStaffName] = useState('');
  const [suppStaffPhone, setSuppStaffPhone] = useState('');
  const [suppStaffPin, setSuppStaffPin] = useState('');
  const [suppStaffSupplierId, setSuppStaffSupplierId] = useState('');

  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const [tripTruckId, setTripTruckId] = useState('');
  const [tripSupplierId, setTripSupplierId] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [cfgRes, trucksRes, suppRes, drvRes, sStaffRes, tripsRes, parksRes] = await Promise.all([
        fetch('/api/fleet/config', { headers }),
        fetch('/api/fleet/trucks', { headers }),
        fetch('/api/fleet/suppliers', { headers }),
        fetch('/api/fleet/drivers', { headers }),
        fetch('/api/fleet/supplier-staff', { headers }),
        fetch('/api/fleet/trips', { headers }),
        fetch('/api/parks', { headers })
      ]);

      const cfgData = await cfgRes.json();
      const trucksData = await trucksRes.json();
      const suppData = await suppRes.json();
      const drvData = await drvRes.json();
      const sStaffData = await sStaffRes.json();
      const tripsData = await tripsRes.json();
      const parksData = await parksRes.json();

      if (cfgData.success) setServiceType(cfgData.service_type);
      if (trucksData.success) setTrucks(trucksData.trucks);
      if (suppData.success) setSuppliers(suppData.suppliers);
      if (drvData.success) setDrivers(drvData.drivers);
      if (sStaffData.success) setSupplierStaff(sStaffData.supplier_staff);
      if (tripsData.success) setTrips(tripsData.trips);
      if (parksData.success || Array.isArray(parksData)) setParks(Array.isArray(parksData) ? parksData : parksData.parks || []);
    } catch (err) {
      console.error("Error fetching fleet data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const handleUpdateServiceType = async (type: 'package' | 'fleet' | 'both') => {
    try {
      const res = await fetch('/api/fleet/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ service_type: type })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setServiceType(type);
      alert('Service type updated successfully!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/fleet/trucks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          truck_number: newTruckNumber,
          park_id: newTruckParkId || parks[0]?.id,
          billing_method: newTruckBilling,
          auto_renew: newTruckAutoRenew
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowAddTruck(false);
      setNewTruckNumber('');
      setNewTruckAutoRenew(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/fleet/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newSupplierName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowAddSupplier(false);
      setNewSupplierName('');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/fleet/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: driverName,
          phone_number: driverPhone,
          pin: driverPin,
          truck_id: driverTruckId,
          park_id: driverParkId || parks[0]?.id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowAddDriver(false);
      setDriverName('');
      setDriverPhone('');
      setDriverPin('');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddSupplierStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/fleet/supplier-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          supplier_id: suppStaffSupplierId,
          name: suppStaffName,
          phone_number: suppStaffPhone,
          pin: suppStaffPin
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowAddSuppStaff(false);
      setSuppStaffName('');
      setSuppStaffPhone('');
      setSuppStaffPin('');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/fleet/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ truck_id: tripTruckId, supplier_id: tripSupplierId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowCreateTrip(false);
      fetchData();
      alert(`Trip created successfully! Fee: ₦${data.trip_fee}. Status: ${data.payment_status}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePayTrip = async (tripId: string) => {
    try {
      const res = await fetch(`/api/fleet/trips/${tripId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ reference: `pay_${Date.now()}` })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchData();
      alert('Trip payment confirmed successfully!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Fleet Sub-navigation */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'overview', label: 'Overview & Service Type', icon: Building2 },
            { id: 'trucks', label: `Trucks (${trucks.length})`, icon: Truck },
            { id: 'suppliers', label: `Suppliers (${suppliers.length})`, icon: Building2 },
            { id: 'staff_drivers', label: 'Drivers & Supplier Staff', icon: Users },
            { id: 'trips', label: `Trips (${trips.length})`, icon: Calendar }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors whitespace-nowrap cursor-pointer border-0 ${
                  isActive ? 'bg-amber-400 text-slate-900 shadow-lg' : 'text-slate-300 hover:bg-slate-700 bg-slate-900/40'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {userRole === 'company' && (
          <div className="flex items-center space-x-3 text-sm">
            <span className="text-slate-400 font-medium">Service Mode:</span>
            <select
              value={serviceType}
              onChange={(e) => handleUpdateServiceType(e.target.value as any)}
              className="bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-amber-500"
            >
              <option value="package">Package Tracking Only</option>
              <option value="fleet">Fleet Tracking Only</option>
              <option value="both">Both Services</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-400">Total Tracked Trucks</h3>
            <p className="text-3xl font-extrabold text-white mt-2">{trucks.length}</p>
            <p className="text-xs text-amber-400 mt-2">Active round-trip fleet units</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-400">Registered Suppliers</h3>
            <p className="text-3xl font-extrabold text-white mt-2">{suppliers.length}</p>
            <p className="text-xs text-amber-400 mt-2">Destination loading points</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-400">Active / Recent Trips</h3>
            <p className="text-3xl font-extrabold text-white mt-2">{trips.filter(t => t.status !== 'completed').length}</p>
            <p className="text-xs text-amber-400 mt-2">En route & pending checkpoints</p>
          </div>
        </div>
      )}

      {/* TAB 2: TRUCKS */}
      {activeSubTab === 'trucks' && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white flex items-center space-x-2">
              <Truck className="w-6 h-6 text-amber-400" />
              <span>Fleet Trucks Management</span>
            </h3>
            <button
              onClick={() => setShowAddTruck(true)}
              className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-4 py-2 rounded-xl text-sm flex items-center space-x-1 shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Truck</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {trucks.map(truck => (
              <div key={truck.id} className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-white">{truck.truck_number}</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    truck.billing_method === 'monthly' ? 'bg-purple-500/20 text-purple-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {truck.billing_method === 'monthly' ? 'Monthly Plan (₦3,500)' : 'Per-Trip (₦1,000)'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Park ID: {truck.park_id}</p>
                {truck.billing_method === 'monthly' && (
                  <div className="bg-slate-800 p-3 rounded-lg text-xs space-y-1">
                    <p><span className="text-slate-400">Active Until:</span> {truck.monthly_active_until ? new Date(truck.monthly_active_until).toLocaleDateString() : 'N/A'}</p>
                    <p><span className="text-slate-400">Auto-Renew:</span> <span className={truck.auto_renew ? 'text-emerald-400 font-bold' : 'text-slate-400'}>{truck.auto_renew ? 'ON' : 'OFF'}</span></p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SUPPLIERS */}
      {activeSubTab === 'suppliers' && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white flex items-center space-x-2">
              <Building2 className="w-6 h-6 text-amber-400" />
              <span>Suppliers & Destination Depots</span>
            </h3>
            <button
              onClick={() => setShowAddSupplier(true)}
              className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-4 py-2 rounded-xl text-sm flex items-center space-x-1 shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {suppliers.map(supp => (
              <div key={supp.id} className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                <p className="font-bold text-white text-lg">{supp.name}</p>
                <p className="text-xs text-slate-400 mt-1">Added: {new Date(supp.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: DRIVERS & SUPPLIER STAFF */}
      {activeSubTab === 'staff_drivers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Drivers */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Drivers ({drivers.length})</h3>
              <button
                onClick={() => setShowAddDriver(true)}
                className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Driver</span>
              </button>
            </div>
            <div className="space-y-3">
              {drivers.map(drv => (
                <div key={drv.id} className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm">
                  <p className="font-bold text-white">{drv.name}</p>
                  <p className="text-xs text-slate-400">Phone: {drv.phone_number}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Supplier Staff */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Supplier Staff ({supplierStaff.length})</h3>
              <button
                onClick={() => setShowAddSuppStaff(true)}
                className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Staff</span>
              </button>
            </div>
            <div className="space-y-3">
              {supplierStaff.map(st => (
                <div key={st.id} className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm">
                  <p className="font-bold text-white">{st.name}</p>
                  <p className="text-xs text-slate-400">Phone: {st.phone_number}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: TRIPS */}
      {activeSubTab === 'trips' && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white flex items-center space-x-2">
              <Calendar className="w-6 h-6 text-amber-400" />
              <span>Fleet Round Trips</span>
            </h3>
            <button
              onClick={() => setShowCreateTrip(true)}
              className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-4 py-2 rounded-xl text-sm flex items-center space-x-1 shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span>Initiate New Trip</span>
            </button>
          </div>

          <div className="space-y-4">
            {trips.map(trip => (
              <div key={trip.id} className="bg-slate-900 border border-slate-700 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300">
                      Truck: {trip.truck_number}
                    </span>
                    <span className="text-sm font-bold text-white">Destination: {trip.supplier_name}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Billing: {trip.billing_method.toUpperCase()} (Fee: ₦{trip.trip_fee}) | Payment: <span className={trip.payment_status === 'paid' || trip.payment_status === 'active_monthly' ? 'text-emerald-400 font-bold' : 'text-amber-400'}>{trip.payment_status.toUpperCase()}</span>
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    trip.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                    trip.status === 'loaded_departed' ? 'bg-blue-500/20 text-blue-300' :
                    trip.status === 'left_warehouse' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {trip.status.replace('_', ' ').toUpperCase()}
                  </span>

                  {trip.payment_status === 'pending' && trip.trip_fee > 0 && (
                    <button
                      onClick={() => handlePayTrip(trip.id)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-lg transition-colors"
                    >
                      Pay ₦{trip.trip_fee}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODALS */}
      {showAddTruck && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Add New Fleet Truck</h3>
            <form onSubmit={handleAddTruck} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Truck Number / Reg Plate</label>
                <input
                  type="text"
                  required
                  value={newTruckNumber}
                  onChange={(e) => setNewTruckNumber(e.target.value)}
                  placeholder="e.g. LAG-452-XZ"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Billing Method</label>
                <select
                  value={newTruckBilling}
                  onChange={(e) => setNewTruckBilling(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white"
                >
                  <option value="per_trip">Per-Trip (₦1,000 per trip)</option>
                  <option value="monthly">Monthly Flat (₦3,500 unlimited)</option>
                </select>
              </div>
              {newTruckBilling === 'monthly' && (
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-2">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTruckAutoRenew}
                      onChange={(e) => setNewTruckAutoRenew(e.target.checked)}
                      className="w-4 h-4 text-amber-500 rounded border-slate-700 bg-slate-800"
                    />
                    <span className="text-sm font-medium text-white">Auto-renew this truck's monthly plan?</span>
                  </label>
                  <p className="text-xs text-slate-400">When ON: automatically charged ₦3,500 at month end. When OFF: requires manual renewal or falls back to per-trip.</p>
                </div>
              )}
              <div className="flex space-x-3 pt-2">
                <button type="submit" className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-2.5 rounded-xl">Save Truck</button>
                <button type="button" onClick={() => setShowAddTruck(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-xl">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddSupplier && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Add Supplier / Depot</h3>
            <form onSubmit={handleAddSupplier} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Supplier / Depot Name</label>
                <input
                  type="text"
                  required
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="e.g. Dangote Cement Depot Nnewi"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white"
                />
              </div>
              <div className="flex space-x-3 pt-2">
                <button type="submit" className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-2.5 rounded-xl">Add Supplier</button>
                <button type="button" onClick={() => setShowAddSupplier(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-xl">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateTrip && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Initiate Fleet Round Trip</h3>
            <form onSubmit={handleCreateTrip} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Select Truck</label>
                <select
                  required
                  value={tripTruckId}
                  onChange={(e) => setTripTruckId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white"
                >
                  <option value="">-- Choose Truck --</option>
                  {trucks.map(t => (
                    <option key={t.id} value={t.id}>{t.truck_number} ({t.billing_method})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Select Destination Supplier</label>
                <select
                  required
                  value={tripSupplierId}
                  onChange={(e) => setTripSupplierId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white"
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex space-x-3 pt-2">
                <button type="submit" className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-2.5 rounded-xl">Start Trip</button>
                <button type="button" onClick={() => setShowCreateTrip(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-xl">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddDriver && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Create Driver Account</h3>
            <form onSubmit={handleAddDriver} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Driver Name</label>
                <input
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Phone Number (11 Digits)</label>
                <input
                  type="text"
                  required
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="08012345678"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">PIN (4 or 6 Digits)</label>
                <input
                  type="password"
                  required
                  value={driverPin}
                  onChange={(e) => setDriverPin(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Assign Truck</label>
                <select
                  required
                  value={driverTruckId}
                  onChange={(e) => setDriverTruckId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white"
                >
                  <option value="">-- Choose Truck --</option>
                  {trucks.map(t => (
                    <option key={t.id} value={t.id}>{t.truck_number}</option>
                  ))}
                </select>
              </div>
              <div className="flex space-x-3 pt-2">
                <button type="submit" className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-2.5 rounded-xl">Create Driver</button>
                <button type="button" onClick={() => setShowAddDriver(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-xl">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddSuppStaff && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Create Supplier Staff Account</h3>
            <form onSubmit={handleAddSupplierStaff} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Supplier / Depot</label>
                <select
                  required
                  value={suppStaffSupplierId}
                  onChange={(e) => setSuppStaffSupplierId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white"
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Staff Name</label>
                <input
                  type="text"
                  required
                  value={suppStaffName}
                  onChange={(e) => setSuppStaffName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Phone Number (11 Digits)</label>
                <input
                  type="text"
                  required
                  value={suppStaffPhone}
                  onChange={(e) => setSuppStaffPhone(e.target.value)}
                  placeholder="08012345678"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">PIN (4 or 6 Digits)</label>
                <input
                  type="password"
                  required
                  value={suppStaffPin}
                  onChange={(e) => setSuppStaffPin(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white"
                />
              </div>
              <div className="flex space-x-3 pt-2">
                <button type="submit" className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-2.5 rounded-xl">Create Staff</button>
                <button type="button" onClick={() => setShowAddSuppStaff(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-xl">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
