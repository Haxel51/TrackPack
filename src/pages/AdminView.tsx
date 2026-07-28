import { FormEvent, useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import { getCompanyStaff, createStaff, getCompanyByPhone, addParkToCompany, deleteWaybill, fetchRouteDistance, saveRouteDistance, getStoredRoutes } from '../lib/api';
import { getRouteTransitInfo } from '../lib/eta';
import { Staff, Waybill, Company } from '../types';
import { Button, Input, Badge } from '../components/ui';
import { formatTimestamp } from '../lib/helpers';
import { MapPin, Users, ShieldCheck, ArrowRightLeft, UserPlus, KeyRound, Building2, Info, PlusCircle, CheckCircle2, Route, Compass, RefreshCw, Edit3, Save } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function AdminView() {
  const { user } = useAuthStore();
  const [company, setCompany] = useState<Company | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [waybills, setWaybills] = useState<Waybill[]>([]);
  const [tab, setTab] = useState<'overview' | 'staff' | 'parks' | 'routes'>('overview');
  const [deletingWaybillId, setDeletingWaybillId] = useState<string | null>(null);
  
  // New staff form state
  const [newStaffName, setNewStaffName] = useState('');
  const [selectedParkOption, setSelectedParkOption] = useState<string>('');
  const [customParkName, setCustomParkName] = useState<string>('');

  // Direct Park addition state
  const [directParkInput, setDirectParkInput] = useState<string>('');
  const [parkSuccessMsg, setParkSuccessMsg] = useState<string>('');
  const [parkErrorMsg, setParkErrorMsg] = useState<string>('');
  const [isAddingPark, setIsAddingPark] = useState<boolean>(false);

  // Route distance/estimate state
  const [storedRoutesList, setStoredRoutesList] = useState<any[]>([]);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [manualHoursInputs, setManualHoursInputs] = useState<Record<string, string>>({});
  const [routeMsg, setRouteMsg] = useState<string>('');
  const [loadingRoutePair, setLoadingRoutePair] = useState<string | null>(null);

  // Quick route form state
  const [calcOrigin, setCalcOrigin] = useState('');
  const [calcDest, setCalcDest] = useState('');
  const [calcInitialHours, setCalcInitialHours] = useState('6');
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  const handleCalculateQuickRoute = async (e: FormEvent) => {
    e.preventDefault();
    if (!calcOrigin || !calcDest) {
      alert('Please select both Origin and Destination motor parks.');
      return;
    }
    if (calcOrigin === calcDest) {
      alert('Origin and Destination parks cannot be the same.');
      return;
    }

    const hoursVal = Number(calcInitialHours);
    if (!calcInitialHours || isNaN(hoursVal) || hoursVal <= 0) {
      alert('Please enter a valid positive journey time in hours.');
      return;
    }

    setIsCalculatingRoute(true);
    setRouteMsg('');
    try {
      const res = await fetchRouteDistance(calcOrigin, calcDest, undefined, hoursVal);
      await loadStoredRoutes();
      setRouteMsg(`Route successfully registered. Initial Typical Journey Time set to ${res.initialEstimateHours || hoursVal} hours for "${calcOrigin} → ${calcDest}".`);
      setCalcOrigin('');
      setCalcDest('');
      setCalcInitialHours('6');
    } catch (err) {
      console.error('Error saving route estimate:', err);
      alert('Failed to register route typical journey time.');
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  useEffect(() => {
    if (user?.phone) {
      loadData();
    }
  }, [user?.phone]);

  useEffect(() => {
    if (tab === 'routes' || company?.parks) {
      loadStoredRoutes();
    }
  }, [tab, company?.parks]);

  const loadStoredRoutes = async () => {
    const list = await getStoredRoutes();
    setStoredRoutesList(list);
  };

  const handleFetchRouteDistance = async (origin: string, dest: string) => {
    const pairKey = `${origin}__to__${dest}`;
    setLoadingRoutePair(pairKey);
    setRouteMsg('');
    try {
      const res = await fetchRouteDistance(origin, dest);
      await loadStoredRoutes();
      setRouteMsg(`Route initialized with typical journey time: ${res.initialEstimateHours || 6} hours for "${origin} → ${dest}".`);
    } catch (err) {
      console.error('Error fetching route:', err);
      setRouteMsg('Failed to initialize route.');
    } finally {
      setLoadingRoutePair(null);
    }
  };

  const handleSaveManualRouteDistance = async (origin: string, dest: string) => {
    const key = `${origin}__to__${dest}`;
    const rawVal = manualHoursInputs[key];
    const val = Number(rawVal);
    if (!rawVal || isNaN(val) || val <= 0) {
      alert('Please enter a valid positive typical journey time in hours (e.g. 6.5).');
      return;
    }

    setLoadingRoutePair(key);
    setRouteMsg('');
    try {
      await saveRouteDistance(origin, dest, 0, val);
      await loadStoredRoutes();
      setEditingRouteId(null);
      setRouteMsg(`Route typical journey time permanently saved as ${val} hours for "${origin} → ${dest}".`);
    } catch (err) {
      console.error('Error saving typical journey time:', err);
      alert('Failed to save route typical journey time.');
    } finally {
      setLoadingRoutePair(null);
    }
  };

  useEffect(() => {
    if (user?.phone) {
      loadData();
    }
  }, [user?.phone]);

  useEffect(() => {
    if (!company) return;
    const unsub = onSnapshot(collection(db, 'waybills'), (snapshot) => {
      const list: Waybill[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Waybill;
        const w = { ...data, id: docSnap.id };
        if (
          company.parks.includes(w.originPark) ||
          company.parks.includes(w.destinationPark) ||
          w.companyName === company.name ||
          w.companyId === company.id
        ) {
          list.push(w);
        }
      });
      list.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
      setWaybills(list);
    });
    return () => unsub();
  }, [company]);

  const loadData = async () => {
    if (!user?.phone) return;
    const comp = await getCompanyByPhone(user.phone);
    if (comp) {
      setCompany(comp);
      const staffData = await getCompanyStaff(comp.id!);
      setStaffList(staffData);
      if (comp.parks.length > 0) {
        setSelectedParkOption(comp.parks[0]);
      } else {
        setSelectedParkOption('__NEW__');
      }
    }
  };

  const handleAddDirectPark = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    const trimmed = directParkInput.trim();
    if (!trimmed) {
      setParkErrorMsg('Please enter a valid motor park station name.');
      return;
    }

    setIsAddingPark(true);
    setParkErrorMsg('');
    setParkSuccessMsg('');

    try {
      await addParkToCompany(company.id!, trimmed);
      
      // Update local company parks state immediately
      setCompany(prev => {
        if (!prev) return prev;
        const updatedParks = Array.from(new Set([...(prev.parks || []), trimmed]));
        return { ...prev, parks: updatedParks };
      });

      setSelectedParkOption(trimmed);
      setDirectParkInput('');
      setParkSuccessMsg(`New motor park station "${trimmed}" added successfully!`);
    } catch (err) {
      console.error('Error adding park:', err);
      setParkErrorMsg('Failed to add motor park station. Please try again.');
    } finally {
      setIsAddingPark(false);
    }
  };

  const handleAddStaff = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;

    const finalPark = selectedParkOption === '__NEW__' ? customParkName.trim() : selectedParkOption.trim();
    if (!finalPark) {
      alert('Please specify an assigned motor park station for this staff member.');
      return;
    }
    
    // Auto-generate PIN
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Add park to company if it's new
    if (!company.parks.includes(finalPark)) {
      await addParkToCompany(company.id!, finalPark);
      setCompany(prev => {
        if (!prev) return prev;
        const updatedParks = Array.from(new Set([...(prev.parks || []), finalPark]));
        return { ...prev, parks: updatedParks };
      });
    }
    
    const newStaff = await createStaff({
      name: newStaffName,
      park: finalPark,
      role: 'sender',
      pin,
      companyId: company.id!,
      isActive: true
    });
    
    setStaffList(prev => [...prev, newStaff]);
    setNewStaffName('');
    if (selectedParkOption === '__NEW__') {
      setSelectedParkOption(finalPark);
      setCustomParkName('');
    }
  };

  const handleToggleStaffStatus = async (staffId: string, currentStatus: boolean = true) => {
    const newStatus = !currentStatus;
    await import('../lib/api').then(m => m.updateStaffStatus(staffId, newStatus));
    setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, isActive: newStatus } : s));
  };

  if (!company) return <div className="text-center py-12">Loading Company Dashboard...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-navy flex items-center gap-2">
            <Building2 className="w-6 h-6 text-navy" /> {company.name} Dashboard
          </h1>
          <p className="text-xs text-gray-700 mt-1">
            Official Company Owner Panel • CAC Reg: <span className="font-semibold text-navy">{company.cacNumber || 'N/A'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-navy/5 px-3 py-1.5 rounded-xl border border-navy/10 text-xs font-bold text-navy flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-navy" /> {company.parks.length} Park Stations
          </div>
          <div className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-emerald-600" /> {staffList.length} Active Staff
          </div>
        </div>
      </div>

      <div className="flex bg-gray-100 p-1 rounded-xl w-fit flex-wrap gap-1">
        <button
          onClick={() => setTab('overview')}
          className={`px-5 py-2 text-xs font-bold rounded-lg transition-colors ${tab === 'overview' ? 'bg-white shadow-sm text-navy' : 'text-gray-700 hover:text-navy'}`}
        >
          Waybills Overview
        </button>
        <button
          onClick={() => setTab('staff')}
          className={`px-5 py-2 text-xs font-bold rounded-lg transition-colors ${tab === 'staff' ? 'bg-white shadow-sm text-navy' : 'text-gray-700 hover:text-navy'}`}
        >
          Manage Staff ({staffList.length})
        </button>
        <button
          onClick={() => setTab('parks')}
          className={`px-5 py-2 text-xs font-bold rounded-lg transition-colors ${tab === 'parks' ? 'bg-white shadow-sm text-navy' : 'text-gray-700 hover:text-navy'}`}
        >
          Motor Parks & Terminals ({company.parks.length})
        </button>
        <button
          onClick={() => setTab('routes')}
          className={`px-5 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${tab === 'routes' ? 'bg-white shadow-sm text-navy' : 'text-gray-700 hover:text-navy'}`}
        >
          <Route className="w-3.5 h-3.5" /> Route Distances
        </button>
      </div>

      {tab === 'overview' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-navy text-sm">Company Waybills Across All Stations</h2>
            <span className="text-xs text-gray-700">{waybills.length} total waybills</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-bg-light text-gray-700 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">Tracking</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Bus</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {waybills.map(wb => (
                  <tr key={wb.id} className="hover:bg-bg-light">
                    <td className="px-4 py-3 font-mono text-lg font-bold text-navy">{wb.trackingCode || 'DRAFT'}</td>
                    <td className="px-4 py-3 text-gray-700">{wb.originPark} → {wb.destinationPark}</td>
                    <td className="px-4 py-3 text-gray-700">{wb.busNumber}</td>
                    <td className="px-4 py-3"><Badge status={wb.status}>{wb.status}</Badge></td>
                    <td className="px-4 py-3 text-gray-700">{formatTimestamp(wb.createdTimestamp)}</td>
                    <td className="px-4 py-3 text-right">
                      {deletingWaybillId === wb.id ? (
                        <div className="inline-flex items-center gap-1.5 bg-red-100 p-1 rounded-lg border border-red-200">
                          <span className="text-[10px] font-bold text-red-900 pl-1">Delete?</span>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                if (!wb.id) {
                                  alert("Error: Waybill ID is missing.");
                                  return;
                                }
                                await deleteWaybill(wb.id);
                                setDeletingWaybillId(null);
                              } catch (err) {
                                console.error("Failed to delete waybill:", err);
                                alert("Failed to delete waybill. Please try again.");
                              }
                            }}
                            className="text-[10px] bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-1 rounded transition"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingWaybillId(null)}
                            className="text-[10px] bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-2 py-1 rounded transition"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeletingWaybillId(wb.id!)}
                          className="text-xs bg-red-50 hover:bg-red-100 text-red-700 font-bold px-2.5 py-1.5 rounded-lg border border-red-200 transition"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {waybills.length === 0 && (
              <div className="p-8 text-center text-gray-700">No waybills found across your stations.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'staff' && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-navy flex items-center gap-2">
                  <Users className="w-5 h-5 text-navy" /> Motor Park Staff Directory
                </h2>
                <p className="text-xs text-gray-700">All registered station personnel across your company's motor parks.</p>
              </div>
              <span className="text-xs font-bold text-navy bg-navy/5 px-3 py-1 rounded-full border border-navy/10">
                {staffList.length} Active Staff
              </span>
            </div>

            <div className="bg-blue-50/80 border border-blue-200 p-4 rounded-xl text-xs text-blue-900 leading-relaxed flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-navy font-bold text-sm mb-0.5">Equal Station Operational Rights:</strong>
                All staff members have full rights to <strong>book outgoing waybills</strong> leaving their assigned park (e.g. Nnewi Park) AND <strong>receive, store & verify incoming waybills</strong> arriving at their park (e.g. Imo / Owerri Park).
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {staffList.map(staff => (
                <div key={staff.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative hover:border-gray-300 transition">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-navy text-base">{staff.name}</h3>
                      <p className="text-xs text-gray-700 font-semibold flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-navy" /> {staff.park} Station
                      </p>
                    </div>
                    <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                      <ArrowRightLeft className="w-3 h-3" /> Send & Receive
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                      <span className="text-[10px] font-bold text-gray-700 block uppercase tracking-wider">LOGIN PIN</span>
                      <span className="font-mono font-bold text-sm text-navy tracking-widest">{staff.pin}</span>
                    </div>
                    <Button 
                      variant={staff.isActive === false ? 'primary' : 'danger'} 
                      size="sm"
                      onClick={() => handleToggleStaffStatus(staff.id!, staff.isActive)}
                      className="text-xs font-bold"
                    >
                      {staff.isActive === false ? 'Activate' : 'Deactivate'}
                    </Button>
                  </div>
                </div>
              ))}

              {staffList.length === 0 && (
                <div className="sm:col-span-2 p-8 text-center text-gray-700 bg-white rounded-xl border border-dashed border-gray-300">
                  <UserPlus className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold">No staff members created yet.</p>
                  <p className="text-xs text-gray-700">Use the form on the right to assign staff to your motor parks.</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm h-fit">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="w-5 h-5 text-navy" />
              <h2 className="text-base font-bold text-navy">Add Motor Park Staff</h2>
            </div>
            <p className="text-xs text-gray-700 mb-4 leading-relaxed">
              Assign a staff member to a specific park branch (e.g., Nnewi, Imo / Owerri, Lagos). They will use their 4-digit PIN to manage shipments at that park station.
            </p>

            <form onSubmit={handleAddStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Staff Full Name</label>
                <Input 
                  required 
                  placeholder="e.g. Chinedu Okafor" 
                  value={newStaffName} 
                  onChange={e => setNewStaffName(e.target.value)} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Select Motor Park Station
                </label>
                
                <select
                  value={selectedParkOption}
                  onChange={e => setSelectedParkOption(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy focus:border-navy"
                  required
                >
                  {company.parks.map(p => (
                    <option key={p} value={p}>
                      📍 {p} Station
                    </option>
                  ))}
                  <option value="__NEW__" className="font-bold text-navy bg-navy/5">
                    ➕ Add a New Motor Park Station...
                  </option>
                </select>

                {selectedParkOption === '__NEW__' && (
                  <div className="mt-2.5 space-y-1">
                    <Input
                      required
                      placeholder="e.g. Imo / Owerri Main Park"
                      value={customParkName}
                      onChange={e => setCustomParkName(e.target.value)}
                      className="border-navy/40 focus:border-navy"
                    />
                    <p className="text-[11px] text-gray-700 font-medium">Type the exact town or park name to register this station.</p>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs text-gray-700 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-navy">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Auto-Generated PIN & Access
                </div>
                <p className="text-[11px]">A unique 4-digit PIN will be generated automatically upon creation.</p>
              </div>

              <Button type="submit" className="w-full font-bold py-3 text-xs bg-navy hover:bg-navy/90 text-white">
                Create Staff Member & Generate PIN
              </Button>
            </form>
          </div>
        </div>
      )}

      {tab === 'parks' && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-navy flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-navy" /> Registered Motor Park Stations
                </h2>
                <p className="text-xs text-gray-700">Official dispatch and reception terminals operated by {company.name}.</p>
              </div>
              <span className="text-xs font-bold text-navy bg-navy/5 px-3 py-1 rounded-full border border-navy/10">
                {company.parks.length} Stations Active
              </span>
            </div>

            {parkSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {parkSuccessMsg}
              </div>
            )}

            {parkErrorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-900 p-3.5 rounded-xl text-xs font-semibold">
                {parkErrorMsg}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              {company.parks.map(park => {
                const parkStaffCount = staffList.filter(s => s.park === park).length;
                return (
                  <div key={park} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:border-gray-300 transition">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-navy/5 rounded-xl flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-navy" />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        Active Terminal
                      </span>
                    </div>

                    <h3 className="font-extrabold text-navy text-base mb-1">{park}</h3>
                    <p className="text-xs text-gray-700 font-medium mb-3">Official Station Branch</p>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-700">
                      <span className="flex items-center gap-1 font-semibold text-navy">
                        <Users className="w-3.5 h-3.5 text-navy" /> {parkStaffCount} Station Staff
                      </span>
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                        Operational
                      </span>
                    </div>
                  </div>
                );
              })}

              {company.parks.length === 0 && (
                <div className="sm:col-span-2 p-8 text-center text-gray-700 bg-white rounded-xl border border-dashed border-gray-300">
                  <MapPin className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold">No motor park stations registered yet.</p>
                  <p className="text-xs text-gray-700">Use the form on the right to register your company's stations (e.g., Nnewi, Imo / Owerri, Lagos).</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm h-fit space-y-4">
            <div className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-navy" />
              <h2 className="text-base font-bold text-navy">Add Motor Park Station</h2>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">
              Register a new town branch or motor park terminal for your transport company (e.g., "Nnewi Main Park", "Imo / Owerri Terminal", "Lagos Park").
            </p>

            <form onSubmit={handleAddDirectPark} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Motor Park / Station Name
                </label>
                <Input 
                  required 
                  placeholder="e.g. Imo / Owerri Main Terminal" 
                  value={directParkInput} 
                  onChange={e => setDirectParkInput(e.target.value)} 
                />
              </div>

              <Button 
                type="submit" 
                disabled={isAddingPark || !directParkInput.trim()} 
                className="w-full font-bold py-3 text-xs bg-navy hover:bg-navy/90 text-white flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                {isAddingPark ? 'Registering Station...' : 'Register Station'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {tab === 'routes' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-navy flex items-center gap-2">
                <Compass className="w-5 h-5 text-navy" /> Park Routes & Real Distance Matrix
              </h2>
              <p className="text-xs text-gray-700 mt-0.5">
                Calculates real road distances between motor park stations (e.g. Nnewi to Imo / Owerri) using Google Distance Matrix API and permanently stores them.
              </p>
            </div>
            <Button
              onClick={loadStoredRoutes}
              variant="secondary"
              size="sm"
              className="text-xs font-bold flex items-center gap-1.5 shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Saved Routes
            </Button>
          </div>

          {company.parks.length >= 2 && (
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div>
                <h3 className="text-xs font-extrabold text-navy uppercase tracking-wider">Configure Route Typical Journey Time</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">Define your rough initial travel estimate. TrackPack will replace this guess entirely with self-learned historical transit times as real shipments complete.</p>
              </div>
              <form onSubmit={handleCalculateQuickRoute} className="flex flex-col sm:flex-row items-end gap-3">
                <div className="w-full sm:w-1/3">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Origin Park</label>
                  <select
                    value={calcOrigin}
                    onChange={e => setCalcOrigin(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-navy font-semibold text-navy"
                  >
                    <option value="">Select Origin...</option>
                    {company.parks.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="w-full sm:w-1/3">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Destination Park</label>
                  <select
                    value={calcDest}
                    onChange={e => setCalcDest(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-navy font-semibold text-navy"
                  >
                    <option value="">Select Destination...</option>
                    {company.parks.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="w-full sm:w-1/4">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Typical Duration <span className="text-navy font-bold">(Hours)</span></label>
                  <Input
                    type="number"
                    step={0.1}
                    placeholder="e.g. 6"
                    value={calcInitialHours}
                    onChange={e => setCalcInitialHours(e.target.value)}
                    className="w-full h-10 px-3 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-navy font-semibold"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isCalculatingRoute}
                  className="w-full sm:w-auto h-10 px-5 text-xs font-bold bg-navy hover:bg-navy/90 text-white shrink-0 flex items-center justify-center gap-1.5"
                >
                  {isCalculatingRoute ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>
                      <Compass className="w-3.5 h-3.5" />
                      Save Route Config
                    </>
                  )}
                </Button>
              </form>
            </div>
          )}

          {routeMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {routeMsg}
            </div>
          )}

          <div className="grid gap-4">
            {company.parks.length < 2 ? (
              <div className="p-8 text-center text-gray-700 bg-white rounded-2xl border border-dashed border-gray-300">
                <Route className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-semibold">At least 2 registered park stations are needed to form routes.</p>
                <p className="text-xs text-gray-700 mt-1">
                  Add more stations (e.g., "Nnewi", "Imo / Owerri", "Lagos") in the Motor Parks tab to view and calculate route distances.
                </p>
              </div>
            ) : (
              (() => {
                const pairs: { origin: string; dest: string }[] = [];
                for (let i = 0; i < company.parks.length; i++) {
                  for (let j = 0; j < company.parks.length; j++) {
                    if (i !== j) {
                      pairs.push({ origin: company.parks[i], dest: company.parks[j] });
                    }
                  }
                }

                return pairs.map(({ origin, dest }) => {
                  const pairKey = `${origin}__to__${dest}`;
                  const stored = storedRoutesList.find(
                    r => (r.originPark === origin && r.destinationPark === dest) ||
                         (r.id && r.id.toLowerCase().includes(origin.toLowerCase().trim().slice(0, 4)) && r.id.toLowerCase().includes(dest.toLowerCase().trim().slice(0, 4)))
                  );

                  const isLoading = loadingRoutePair === pairKey;
                  const isEditing = editingRouteId === pairKey;

                  // Perform dynamic self-learning route transit info calculation
                  const routeInfo = getRouteTransitInfo(
                    origin,
                    dest,
                    undefined,
                    stored?.distanceKm,
                    stored?.completedTrips || [],
                    stored?.initialEstimateHours
                  );

                  return (
                    <div key={pairKey} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-navy text-base">{origin}</span>
                          <span className="text-gray-400 font-bold">→</span>
                          <span className="font-extrabold text-navy text-base">{dest}</span>
                        </div>
                        
                        {/* Self-Learning ETA stats card */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100 max-w-xl text-left">
                          <div>
                            <span className="block text-[8px] uppercase tracking-wider text-gray-400 font-bold">Initial Guess</span>
                            <span className="text-xs font-bold text-gray-700">{stored?.initialEstimateHours || '6.0'} hrs</span>
                          </div>
                          <div>
                            <span className="block text-[8px] uppercase tracking-wider text-gray-400 font-bold">Completed Trips</span>
                            <span className="text-xs font-bold text-gray-700">{routeInfo.completedTripsCount} logged</span>
                          </div>
                          <div>
                            <span className="block text-[8px] uppercase tracking-wider text-gray-400 font-bold">Learned ETA</span>
                            <span className="text-xs font-extrabold text-navy">{routeInfo.durationHours} hrs</span>
                          </div>
                          <div>
                            <span className="block text-[8px] uppercase tracking-wider text-gray-400 font-bold">Expected Range</span>
                            <span className="text-xs font-extrabold text-emerald-700">{routeInfo.minDurationHours} - {routeInfo.maxDurationHours} hrs</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono font-extrabold text-navy bg-navy/5 px-2 py-0.5 rounded-md border border-navy/10">
                            ~ {routeInfo.distanceKm} km (Local Map)
                          </span>

                          {routeInfo.isSelfLearned ? (
                            <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              ✨ Fully Self-Learned
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              Blended (Initial Estimate + {routeInfo.completedTripsCount} Trips)
                            </span>
                          )}

                          {routeInfo.patternUsed && (
                            <span className="text-[9px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              🕒 Matches {routeInfo.patternUsed} pattern
                            </span>
                          )}

                          <span className="text-[9px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                            Punctuality Index: {routeInfo.punctualityScore}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        {isEditing ? (
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <input
                              type="number"
                              step="0.1"
                              placeholder="Typical Hours"
                              value={manualHoursInputs[pairKey] || ''}
                              onChange={e => setManualHoursInputs({ ...manualHoursInputs, [pairKey]: e.target.value })}
                              className="w-28 h-9 px-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-navy"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSaveManualRouteDistance(origin, dest)}
                              disabled={isLoading}
                              className="text-xs font-bold py-1.5 px-3 bg-navy hover:bg-navy/90 text-white flex items-center gap-1"
                            >
                              <Save className="w-3.5 h-3.5" /> Save
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setEditingRouteId(null)}
                              className="text-xs font-bold py-1.5 px-2.5"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleFetchRouteDistance(origin, dest)}
                              disabled={isLoading}
                              className="text-xs font-bold py-1.5 px-3 bg-navy hover:bg-navy/90 text-white flex items-center gap-1.5"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                              Re-Initialize
                            </Button>

                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setEditingRouteId(pairKey);
                                setManualHoursInputs({ ...manualHoursInputs, [pairKey]: String(stored?.initialEstimateHours || '') });
                              }}
                              className="text-xs font-bold py-1.5 px-2.5 text-gray-700 flex items-center gap-1"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-gray-500" /> Adjust Estimate
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
}


