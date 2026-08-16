import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getFleetConfig,
  getFleetTrucks,
  getFleetSuppliers,
  getFleetDrivers,
  getFleetSupplierStaff,
  getFleetTrips,
  getParks,
  updateFleetConfig,
  createFleetTruck,
  createFleetSupplier,
  createFleetDriver,
  createFleetSupplierStaff,
  resetFleetSupplierStaffPin,
  updateFleetSupplierStaffStatus,
  resetFleetDriverPin,
  createFleetTrip,
  initiateFleetTripPayment,
  verifyFleetPaymentSession,
  subscribeFleetTruckMonthly,
  verifyFleetSubscriptionSession,
  updateFleetTruckBilling,
  payTripFee,
  deleteFleetSupplier,
  deleteFleetTruck,
  deleteFleetDriver,
  deleteFleetSupplierStaff,
  getCompanyManagers,
  createCompanyManager,
  toggleCompanyManagerStatus,
  resetCompanyManagerPin,
  deleteCompanyManager
} from '../../lib/api';
import { getFleetTripNarrative } from '../../lib/fleetNarrative';
import { Truck, Building2, Users, Plus, ShieldCheck, DollarSign, Calendar, AlertTriangle, CheckCircle2, Activity, X, Trash2, MapPin, ArrowRight, CreditCard, ExternalLink, UserCheck, AlertCircle } from 'lucide-react';
import { RealtimeFleetBoard } from './RealtimeFleetBoard';

interface FleetManagementViewProps {
  userRole: 'company' | 'manager' | 'staff';
  initialSubTab?: 'live_board' | 'overview' | 'trucks' | 'suppliers' | 'staff_drivers' | 'trips';
  autoOpenCreateTrip?: boolean;
  onTripCreated?: () => void;
}

export const FleetManagementView: React.FC<FleetManagementViewProps> = ({ 
  userRole,
  initialSubTab = 'live_board',
  autoOpenCreateTrip = false,
  onTripCreated
}) => {
  const { token } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'live_board' | 'overview' | 'trucks' | 'suppliers' | 'staff_drivers' | 'trips'>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    if (autoOpenCreateTrip) {
      setActiveSubTab('trips');
      setShowCreateTrip(true);
    }
  }, [autoOpenCreateTrip]);
  
  const [serviceType, setServiceType] = useState<'package' | 'fleet' | 'both'>('package');
  const [trucks, setTrucks] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [supplierStaff, setSupplierStaff] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [parks, setParks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddManager, setShowAddManager] = useState(false);
  const [managerName, setManagerName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [managerParkId, setManagerParkId] = useState('');
  const [submittingManager, setSubmittingManager] = useState(false);
  const [managerError, setManagerError] = useState<string | null>(null);
  const [createdManagerSuccess, setCreatedManagerSuccess] = useState<{
    name: string;
    phone: string;
    park_location: string;
  } | null>(null);

  const [showAddTruck, setShowAddTruck] = useState(false);
  const [newTruckNumber, setNewTruckNumber] = useState('');
  const [newTruckParkId, setNewTruckParkId] = useState('');
  const [newTruckBilling, setNewTruckBilling] = useState<'per_trip' | 'monthly'>('per_trip');
  const [newTruckAutoRenew, setNewTruckAutoRenew] = useState(false);
  const [submittingTruck, setSubmittingTruck] = useState(false);
  const [truckError, setTruckError] = useState<string | null>(null);

  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierFullName, setNewSupplierFullName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');

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
  const [submittingTrip, setSubmittingTrip] = useState(false);
  const [pendingPaystackTrip, setPendingPaystackTrip] = useState<{
    truck_id: string;
    supplier_id: string;
    truck_number: string;
    supplier_name: string;
    fee: number;
  } | null>(null);
  const [verifyingPaymentStatus, setVerifyingPaymentStatus] = useState<string | null>(null);

  // 💳 Monthly Subscription & Billing Switch Modals State
  const [showSubscribeMonthlyModal, setShowSubscribeMonthlyModal] = useState<{
    truck_id: string;
    truck_number: string;
    auto_renew: boolean;
    reference?: string;
    checkout_url?: string;
  } | null>(null);
  const [switchBillingTarget, setSwitchBillingTarget] = useState<{
    truck_id: string;
    truck_number: string;
    current_method: 'per_trip' | 'monthly';
    target_method: 'per_trip' | 'monthly';
    monthly_active_until?: string;
  } | null>(null);
  const [expiredMonthlyPlanTarget, setExpiredMonthlyPlanTarget] = useState<{
    truck_id: string;
    truck_number: string;
    expired_on?: string;
    supplier_id?: string;
  } | null>(null);
  const [submittingSubscription, setSubmittingSubscription] = useState(false);

  // ⚠️ Delete Confirmation Dialog State (Interactive Modal)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'supplier' | 'truck' | 'driver' | 'supplier_staff';
    id: string;
    name: string;
    title: string;
    description: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchData = async () => {
    if (!token) {
      if (isMountedRef.current) setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [cfgRes, trucksRes, suppRes, drvRes, sStaffRes, tripsRes, parksRes, mgrsRes] = await Promise.allSettled([
        getFleetConfig(token),
        getFleetTrucks(token),
        getFleetSuppliers(token),
        getFleetDrivers(token),
        getFleetSupplierStaff(token),
        getFleetTrips(token),
        getParks(token),
        getCompanyManagers(token)
      ]);

      if (!isMountedRef.current) return;

      if (cfgRes.status === 'fulfilled' && cfgRes.value?.success) {
        setServiceType(cfgRes.value.service_type || 'package');
      }
      if (trucksRes.status === 'fulfilled' && trucksRes.value?.success) {
        setTrucks(trucksRes.value.trucks || []);
      }
      if (suppRes.status === 'fulfilled' && suppRes.value?.success) {
        setSuppliers(suppRes.value.suppliers || []);
      }
      if (drvRes.status === 'fulfilled' && drvRes.value?.success) {
        setDrivers(drvRes.value.drivers || []);
      }
      if (sStaffRes.status === 'fulfilled' && sStaffRes.value?.success) {
        setSupplierStaff(sStaffRes.value.supplier_staff || []);
      }
      if (mgrsRes.status === 'fulfilled' && mgrsRes.value?.success) {
        setManagers(mgrsRes.value.managers || []);
      }
      if (tripsRes.status === 'fulfilled' && tripsRes.value?.success) {
        setTrips(tripsRes.value.trips || []);
      }
      if (parksRes.status === 'fulfilled' && parksRes.value) {
        const pVal = parksRes.value;
        if (Array.isArray(pVal)) setParks(pVal);
        else if (pVal.parks) setParks(pVal.parks);
      }
    } catch {
      // Graceful fallback
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const handleUpdateServiceType = async (type: 'package' | 'fleet' | 'both') => {
    if (!token) return;
    try {
      const data = await updateFleetConfig(token, type);
      if (!data || !data.success) throw new Error(data?.error || 'Failed to update service type');
      setServiceType(type);
      alert('Service type updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Error updating service type');
    }
  };

  const handleAddTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!newTruckNumber.trim()) {
      setTruckError("Please enter a valid truck plate or registration number.");
      return;
    }
    setSubmittingTruck(true);
    setTruckError(null);
    try {
      const data = await createFleetTruck(token, {
        truck_number: newTruckNumber.trim(),
        park_id: newTruckParkId || parks[0]?.id || 'main',
        billing_method: newTruckBilling,
        auto_renew: newTruckAutoRenew
      });
      if (!data || !data.success) throw new Error(data?.error || 'Failed to save truck');
      setShowAddTruck(false);
      setNewTruckNumber('');
      setNewTruckAutoRenew(false);
      setTruckError(null);
      await fetchData();
    } catch (err: any) {
      setTruckError(err.message || 'Error saving truck. Please try again.');
    } finally {
      setSubmittingTruck(false);
    }
  };

  const [submittingSupplier, setSubmittingSupplier] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSupplierError(null);
    setSubmittingSupplier(true);
    try {
      const data = await createFleetSupplier(token, { 
        name: newSupplierName.trim(),
        full_name: newSupplierFullName.trim(),
        supplier_full_name: newSupplierFullName.trim(),
        phone: newSupplierPhone.trim(),
        supplier_phone_number: newSupplierPhone.trim()
      });
      if (!data || !data.success) throw new Error(data?.error || 'Failed to add supplier');
      setShowAddSupplier(false);
      setNewSupplierName('');
      setNewSupplierFullName('');
      setNewSupplierPhone('');
      fetchData();
    } catch (err: any) {
      setSupplierError(err.message || 'Failed to add supplier');
      alert(err.message || 'Failed to add supplier');
    } finally {
      setSubmittingSupplier(false);
    }
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const data = await createFleetDriver(token, {
        name: driverName,
        phone_number: driverPhone,
        pin: driverPin,
        truck_id: driverTruckId,
        park_id: driverParkId || parks[0]?.id
      });
      if (!data || !data.success) throw new Error(data?.error || 'Failed to create driver');
      setShowAddDriver(false);
      setDriverName('');
      setDriverPhone('');
      setDriverPin('');
      alert(`Driver Account Created Successfully!\n\nDriver: ${driverName}\nPhone: ${driverPhone}\n6-Digit PIN: ${data.pin}\n\nPlease share this PIN with the driver to sign in.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to create driver');
    }
  };

  const handleAddSupplierStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const data = await createFleetSupplierStaff(token, {
        supplier_id: suppStaffSupplierId,
        name: suppStaffName,
        phone_number: suppStaffPhone,
        pin: suppStaffPin || undefined
      });
      if (!data || !data.success) throw new Error(data?.error || 'Failed to create staff');
      setShowAddSuppStaff(false);
      setSuppStaffName('');
      setSuppStaffPhone('');
      setSuppStaffPin('');
      alert(`Supplier Staff Created Successfully!\n\nStaff: ${suppStaffName}\nPhone: ${suppStaffPhone}\n6-Digit PIN: ${data.pin}\n\nPlease share this PIN with the staff member.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to create staff');
    }
  };

  const handleResetSupplierStaffPin = async (staffId: string, staffName: string) => {
    if (!token) return;
    const choice = prompt(`Reset PIN for staff member ${staffName}:\n\n- Leave blank and click OK to auto-generate a new 6-digit PIN\n- Or enter a custom 6-digit PIN below:`);
    if (choice === null) return; // User cancelled

    const customPin = choice.trim();
    if (customPin && (customPin.length !== 4 && customPin.length !== 6 || !/^\d+$/.test(customPin))) {
      alert("Custom PIN must be 4 or 6 numeric digits.");
      return;
    }

    try {
      const data = await resetFleetSupplierStaffPin(token, staffId, customPin || undefined);
      if (!data || !data.success) throw new Error(data?.error || 'Failed to reset staff PIN.');
      alert(`Staff ${staffName}'s PIN has been reset successfully!\n\nNew 6-Digit PIN: ${data.pin}\n\nPlease share this PIN with the staff member.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to reset PIN');
    }
  };

  const handleToggleStaffStatus = async (staffId: string, currentStatus: string) => {
    if (!token) return;
    const newStatus = currentStatus === 'disabled' ? 'active' : 'disabled';
    try {
      const data = await updateFleetSupplierStaffStatus(token, staffId, newStatus);
      if (!data || !data.success) throw new Error(data?.error || 'Failed to update staff status.');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update staff status');
    }
  };

  const handleResetDriverPin = async (driverId: string, driverName: string) => {
    if (!token) return;
    const choice = prompt(`Reset PIN for driver ${driverName}:\n\n- Leave blank and click OK to auto-generate a new 6-digit PIN\n- Or enter a custom 6-digit PIN below:`);
    if (choice === null) return; // User cancelled
    
    const customPin = choice.trim();
    if (customPin && (customPin.length !== 6 || !/^\d+$/.test(customPin))) {
      alert("Custom PIN must be exactly 6 numeric digits.");
      return;
    }

    try {
      const data = await resetFleetDriverPin(token, driverId, customPin || undefined);
      if (!data || !data.success) throw new Error(data?.error || 'Failed to reset driver PIN.');
      alert(`Driver ${driverName}'s PIN has been reset successfully!\n\nNew 6-Digit PIN: ${data.pin}\n\nPlease share this PIN with the driver.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to reset PIN');
    }
  };

  const handleAddManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const cleanName = managerName.trim();
    const cleanPhone = managerPhone.trim();
    const cleanParkId = managerParkId || parks[0]?.id || 'main';

    if (!cleanName || !cleanPhone || !cleanParkId) {
      setManagerError('Please fill in manager name, phone number, and select a park/branch.');
      return;
    }

    if (!/^\d{11}$/.test(cleanPhone)) {
      setManagerError('Phone number must be a valid 11-digit number (e.g. 08012345678).');
      return;
    }

    setSubmittingManager(true);
    setManagerError(null);

    try {
      const data = await createCompanyManager(token, {
        name: cleanName,
        phone: cleanPhone,
        park_id: cleanParkId
      });

      if (!data || !data.success) throw new Error(data?.error || 'Failed to create manager account.');

      const assignedPark = parks.find(p => p.id === cleanParkId);
      const parkLocationName = assignedPark?.park_location || assignedPark?.park_name || 'Central Depot';

      setShowAddManager(false);
      setManagerName('');
      setManagerPhone('');
      setManagerError(null);

      setCreatedManagerSuccess({
        name: cleanName,
        phone: cleanPhone,
        park_location: parkLocationName
      });

      fetchData();
    } catch (err: any) {
      setManagerError(err.message || 'Error creating manager account');
    } finally {
      setSubmittingManager(false);
    }
  };

  const handleToggleManagerActive = async (managerId: string, managerName: string) => {
    if (!token) return;
    try {
      const data = await toggleCompanyManagerStatus(token, managerId);
      if (!data || !data.success) throw new Error(data?.error || 'Failed to update manager status');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error updating manager status');
    }
  };

  const handleResetManagerPinAction = async (managerId: string, managerName: string) => {
    if (!token) return;
    if (!window.confirm(`Are you sure you want to reset 6-digit PIN for Manager ${managerName}?`)) return;
    try {
      const data = await resetCompanyManagerPin(token, managerId);
      if (!data || !data.success) throw new Error(data?.error || 'Failed to reset PIN.');
      alert(`PIN for Manager ${managerName} has been reset successfully!\n\nThey can now log in using their phone number and set a new 6-digit PIN on the Manager Portal.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error resetting manager PIN');
    }
  };

  const triggerDeleteManager = async (managerId: string, managerName: string) => {
    if (!token) return;
    if (!window.confirm(`Are you sure you want to permanently delete Manager account for "${managerName}"?`)) return;
    try {
      const data = await deleteCompanyManager(token, managerId);
      if (!data || !data.success) throw new Error(data?.error || 'Failed to delete manager.');
      fetchData();
      alert(`Manager "${managerName}" has been deleted.`);
    } catch (err: any) {
      alert(err.message || 'Error deleting manager');
    }
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !tripTruckId || !tripSupplierId) return;

    const selTruck = trucks.find(t => t.id === tripTruckId);
    const selSupplier = suppliers.find(s => s.id === tripSupplierId);
    if (!selTruck || !selSupplier) {
      alert('Selected truck or supplier not found.');
      return;
    }

    if (selTruck.billing_method === 'monthly') {
      const isMonthlyActive = selTruck.monthly_active_until && 
        new Date(selTruck.monthly_active_until) > new Date();

      if (isMonthlyActive) {
        // Monthly subscription is active -> create trip record immediately (₦0 fee)
        setSubmittingTrip(true);
        try {
          const data = await createFleetTrip(token, { truck_id: tripTruckId, supplier_id: tripSupplierId });
          if (!data || !data.success) throw new Error(data?.error || 'Failed to create trip');
          setShowCreateTrip(false);
          setTripTruckId('');
          setTripSupplierId('');
          fetchData();
          alert(`Covered by monthly plan — active until ${new Date(selTruck.monthly_active_until).toLocaleDateString()}`);
        } catch (err: any) {
          alert(err.message || 'Failed to create trip');
        } finally {
          setSubmittingTrip(false);
        }
      } else {
        // Expired monthly plan -> do not create trip, show clear expired modal with options
        setShowCreateTrip(false);
        setExpiredMonthlyPlanTarget({
          truck_id: selTruck.id,
          truck_number: selTruck.truck_number,
          expired_on: selTruck.monthly_active_until,
          supplier_id: tripSupplierId
        });
      }
    } else {
      // Per-trip -> Paystack Payment Gate REQUIRED before trip creation
      setShowCreateTrip(false);
      setPendingPaystackTrip({
        truck_id: tripTruckId,
        supplier_id: tripSupplierId,
        truck_number: selTruck.truck_number,
        supplier_name: selSupplier.name,
        fee: 1000
      });
    }
  };

  const executePaystackSubscribeMonthly = async (forceVerifyOnly?: boolean) => {
    if (!showSubscribeMonthlyModal || !token) return;
    setSubmittingSubscription(true);
    setVerifyingPaymentStatus('Initiating Paystack monthly checkout session...');
    try {
      let reference = showSubscribeMonthlyModal.reference;
      let checkoutUrl = showSubscribeMonthlyModal.checkout_url;

      if (!reference || !checkoutUrl || !forceVerifyOnly) {
        // 1. Initiate Paystack monthly subscription session
        const initData = await subscribeFleetTruckMonthly(token, showSubscribeMonthlyModal.truck_id, {
          auto_renew: showSubscribeMonthlyModal.auto_renew
        });

        if (!initData || !initData.success) {
          throw new Error(initData?.error || 'Failed to initiate Paystack monthly payment.');
        }

        reference = initData.reference;
        checkoutUrl = initData.checkout_url;

        // Save reference & checkout_url in modal state
        setShowSubscribeMonthlyModal(prev => prev ? { ...prev, reference, checkout_url: checkoutUrl } : null);

        // Open Paystack payment window directly
        if (checkoutUrl) {
          window.open(checkoutUrl, '_blank');
        }
      }

      setVerifyingPaymentStatus('Verifying ₦3,500 Monthly Subscription with Paystack... Please hold on.');

      // 2. Poll subscription verification endpoint on server
      let attempts = 0;
      let verified = false;

      while (attempts < 6 && !verified) {
        attempts++;
        await new Promise((r) => setTimeout(r, 1200));
        const subData = await verifyFleetSubscriptionSession(token, {
          truck_id: showSubscribeMonthlyModal.truck_id,
          reference: reference!
        });

        if (subData && subData.success && subData.verified) {
          verified = true;
          break;
        }
      }

      if (!verified) {
        const subData = await verifyFleetSubscriptionSession(token, {
          truck_id: showSubscribeMonthlyModal.truck_id,
          reference: reference!
        });

        if (subData && subData.success && subData.verified) {
          verified = true;
        } else {
          throw new Error(subData?.error || 'Payment verification pending. Please complete ₦3,500 payment on Paystack checkout window.');
        }
      }

      const truckNum = showSubscribeMonthlyModal.truck_number;
      setShowSubscribeMonthlyModal(null);
      fetchData();
      alert(`₦3,500 Paystack Payment Confirmed!\n\nMonthly Plan activated for Truck ${truckNum} for 30 days.\nAuto-Renew is ${showSubscribeMonthlyModal.auto_renew ? 'ON' : 'OFF'}.`);
    } catch (err: any) {
      alert(err.message || 'Monthly subscription payment failed');
    } finally {
      setSubmittingSubscription(false);
      setVerifyingPaymentStatus(null);
    }
  };

  const handleConfirmSwitchBillingMethod = async () => {
    if (!switchBillingTarget || !token) return;
    const { truck_id, truck_number, target_method } = switchBillingTarget;
    try {
      if (target_method === 'monthly') {
        setSwitchBillingTarget(null);
        setShowSubscribeMonthlyModal({
          truck_id,
          truck_number,
          auto_renew: false
        });
      } else {
        const data = await updateFleetTruckBilling(token, truck_id, { billing_method: 'per_trip' });
        if (!data || !data.success) throw new Error(data?.error || 'Failed to switch billing method');
        setSwitchBillingTarget(null);
        fetchData();
        alert(`Truck ${truck_number} switched to Per-Trip (₦1,000). In-progress trips created prior to this switch remain unaffected.`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update billing method');
    }
  };

  const handleToggleTruckAutoRenew = async (truckId: string, currentAutoRenew: boolean) => {
    if (!token) return;
    try {
      const data = await updateFleetTruckBilling(token, truckId, {
        billing_method: 'monthly',
        auto_renew: !currentAutoRenew
      });
      if (!data || !data.success) throw new Error(data?.error || 'Failed to toggle auto-renew');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update auto-renew');
    }
  };

  const executePaystackTripPayment = async (forceVerifyOnly?: boolean) => {
    if (!pendingPaystackTrip || !token) return;
    setSubmittingTrip(true);
    setVerifyingPaymentStatus('Initiating Paystack checkout session...');
    try {
      let reference = pendingPaystackTrip.reference;
      let checkoutUrl = pendingPaystackTrip.checkout_url;

      if (!reference || !checkoutUrl || !forceVerifyOnly) {
        // 1. Initiate Paystack Payment Session on server
        const initData = await initiateFleetTripPayment(token, {
          truck_id: pendingPaystackTrip.truck_id,
          supplier_id: pendingPaystackTrip.supplier_id
        });

        if (!initData || !initData.success) {
          throw new Error(initData?.error || 'Failed to initiate Paystack payment session.');
        }

        reference = initData.reference;
        checkoutUrl = initData.checkout_url;

        // Save reference and checkout_url in modal state
        setPendingPaystackTrip(prev => prev ? { ...prev, reference, checkout_url: checkoutUrl } : null);

        // Automatically open Paystack payment window directly
        if (checkoutUrl) {
          window.open(checkoutUrl, '_blank');
        }
      }

      setVerifyingPaymentStatus('Verifying payment with Paystack... Please hold on while your trip is created.');

      // 2. Poll / verify payment session on server until Paystack webhook or server verification confirms payment
      let attempts = 0;
      let verified = false;

      while (attempts < 6 && !verified) {
        attempts++;
        await new Promise((r) => setTimeout(r, 1200));
        const verifyData = await verifyFleetPaymentSession(token, { reference });
        if (verifyData && verifyData.success && verifyData.verified) {
          verified = true;
          break;
        }
      }

      if (!verified) {
        // Direct trip creation call using reference (runs server-side verifyFleetPayment middleware)
        const tripData = await createFleetTrip(token, {
          truck_id: pendingPaystackTrip.truck_id,
          supplier_id: pendingPaystackTrip.supplier_id,
          payment_reference: reference
        });

        if (tripData && tripData.success) {
          verified = true;
        } else {
          throw new Error(tripData?.error || 'Payment verification pending. Please complete payment on Paystack checkout window.');
        }
      }

      const truckNum = pendingPaystackTrip.truck_number;
      setPendingPaystackTrip(null);
      setTripTruckId('');
      setTripSupplierId('');
      fetchData();
      alert(`₦1,000 Paystack Payment Verified!\n\nTrip created and Stage 1 initiated for Truck ${truckNum}.`);
    } catch (err: any) {
      alert(err.message || 'Payment or trip creation failed. No trip record was created.');
    } finally {
      setSubmittingTrip(false);
      setVerifyingPaymentStatus(null);
    }
  };

  const handlePayTrip = async (tripId: string) => {
    if (!token) return;
    try {
      const data = await payTripFee(token, tripId, `pay_${Date.now()}`);
      if (!data || !data.success) throw new Error(data?.error || 'Failed to process payment');
      fetchData();
      alert('Trip payment confirmed successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to process payment');
    }
  };

  // ⚠️ Open interactive in-app confirmation modal
  const triggerDeleteSupplier = (supplierId: string, supplierName: string) => {
    setDeleteTarget({
      type: 'supplier',
      id: supplierId,
      name: supplierName,
      title: 'Delete Supplier / Depot',
      description: `Are you sure you want to permanently remove "${supplierName}" from your supplier directory?`
    });
  };

  const triggerDeleteTruck = (truckId: string, truckNumber: string) => {
    setDeleteTarget({
      type: 'truck',
      id: truckId,
      name: truckNumber,
      title: 'Delete Truck',
      description: `Are you sure you want to remove truck "${truckNumber}" from your registered fleet?`
    });
  };

  const triggerDeleteDriver = (driverId: string, driverName: string) => {
    setDeleteTarget({
      type: 'driver',
      id: driverId,
      name: driverName,
      title: 'Delete Driver Account',
      description: `Are you sure you want to delete driver profile for "${driverName}"?`
    });
  };

  const triggerDeleteSupplierStaff = (staffId: string, staffName: string) => {
    setDeleteTarget({
      type: 'supplier_staff',
      id: staffId,
      name: staffName,
      title: 'Delete Supplier Staff',
      description: `Are you sure you want to remove access for supplier staff "${staffName}"?`
    });
  };

  // ⚠️ Execute confirmed deletion without relying on browser window.confirm
  const executeConfirmedDelete = async () => {
    if (!token || !deleteTarget) return;
    setDeleting(true);
    try {
      let res: any;
      if (deleteTarget.type === 'supplier') {
        res = await deleteFleetSupplier(token, deleteTarget.id);
      } else if (deleteTarget.type === 'truck') {
        res = await deleteFleetTruck(token, deleteTarget.id);
      } else if (deleteTarget.type === 'driver') {
        res = await deleteFleetDriver(token, deleteTarget.id);
      } else if (deleteTarget.type === 'supplier_staff') {
        res = await deleteFleetSupplierStaff(token, deleteTarget.id);
      }

      if (!res || !res.success) {
        throw new Error(res?.error || 'Failed to delete item.');
      }

      setDeleteTarget(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error occurred while deleting.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Fleet Sub-navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 sm:pb-0 no-scrollbar">
          {[
            { id: 'live_board', label: 'Live Board', icon: Activity },
            { id: 'overview', label: 'Overview', icon: Building2 },
            { id: 'trucks', label: `Trucks (${trucks.length})`, icon: Truck },
            { id: 'suppliers', label: `Suppliers (${suppliers.length})`, icon: Building2 },
            { id: 'staff_drivers', label: `Managers & Staff (${managers.length + drivers.length + supplierStaff.length})`, icon: Users },
            { id: 'trips', label: `Trips (${trips.length})`, icon: Calendar }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap shrink-0 cursor-pointer border-0 ${
                  isActive ? 'bg-[#F2A93B] text-slate-950 shadow-md scale-[1.02]' : 'text-slate-300 hover:bg-slate-800 hover:text-white bg-slate-950/60'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {userRole === 'company' && (
          <div className="flex items-center space-x-3 text-xs">
            <span className="text-slate-500 font-bold">Service Mode:</span>
            <select
              value={serviceType}
              onChange={(e) => handleUpdateServiceType(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-3 py-2 focus:ring-2 focus:ring-slate-900"
            >
              <option value="package">Package Tracking Only</option>
              <option value="fleet">Fleet Tracking Only</option>
              <option value="both">Both Services</option>
            </select>
          </div>
        )}
      </div>

      {/* SUBTAB 0: REAL-TIME FLEET BOARD */}
      {activeSubTab === 'live_board' && (
        <RealtimeFleetBoard userRole={userRole} />
      )}

      {/* TAB 1: OVERVIEW */}
      {activeSubTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0A1F44] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-2 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Tracked Trucks</h3>
            <p className="text-4xl font-black text-white">{trucks.length}</p>
            <p className="text-xs text-amber-400 font-semibold">Active round-trip fleet units</p>
          </div>
          <div className="bg-[#0A1F44] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-2 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Registered Suppliers</h3>
            <p className="text-4xl font-black text-white">{suppliers.length}</p>
            <p className="text-xs text-amber-400 font-semibold">Destination loading points</p>
          </div>
          <div className="bg-[#0A1F44] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-2 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active / Recent Trips</h3>
            <p className="text-4xl font-black text-white">{trips.filter(t => t.status !== 'completed').length}</p>
            <p className="text-xs text-amber-400 font-semibold">En route & pending checkpoints</p>
          </div>
        </div>
      )}

      {/* TAB 2: TRUCKS */}
      {activeSubTab === 'trucks' && (
        <div className="bg-[#0A1F44] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-xl font-black text-white flex items-center space-x-2">
                <Truck className="w-6 h-6 text-[#F2A93B]" />
                <span>Fleet Trucks Management 🚚</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Manage registered haulage trucks, billing plans, and auto-renew status.</p>
            </div>
            <button
              onClick={() => setShowAddTruck(true)}
              className="bg-[#F2A93B] hover:bg-[#d9922b] text-[#0A1F44] font-extrabold px-5 py-3 rounded-2xl text-xs flex items-center space-x-1.5 shadow-lg transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Truck</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {trucks.map(truck => {
              const isMonthly = truck.billing_method === 'monthly';
              const isMonthlyActive = isMonthly && truck.monthly_active_until && new Date(truck.monthly_active_until) > new Date();
              const daysRemaining = (isMonthly && truck.monthly_active_until) ? Math.ceil((new Date(truck.monthly_active_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
              const isExpiringSoon = isMonthlyActive && daysRemaining <= 5 && daysRemaining >= 0;

              return (
                <div key={truck.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-3 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-black text-white tracking-wider">{truck.truck_number}</span>
                      <button
                        type="button"
                        onClick={() => triggerDeleteTruck(truck.id, truck.truck_number)}
                        title={`Delete Truck ${truck.truck_number}`}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      isMonthly ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {isMonthly ? 'Monthly Plan (₦3,500)' : 'Per-Trip (₦1,000)'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 font-medium">Park ID: <strong className="text-slate-200">{truck.park_id}</strong></p>

                  {isMonthly && (
                    <div className="bg-slate-950 p-3.5 rounded-xl text-xs space-y-2 border border-slate-800">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Active Until:</span>
                        <strong className="text-white">{truck.monthly_active_until ? new Date(truck.monthly_active_until).toLocaleDateString() : 'N/A'}</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Auto-Renew:</span>
                        <button
                          type="button"
                          onClick={() => handleToggleTruckAutoRenew(truck.id, Boolean(truck.auto_renew))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            truck.auto_renew ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          Auto-Renew: {truck.auto_renew ? 'ON' : 'OFF'}
                        </button>
                      </div>

                      {isExpiringSoon && (
                        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-200 space-y-2">
                          <div className="flex items-center space-x-2 font-bold text-amber-300">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>🔔 Plan expires in {daysRemaining === 0 ? 'today' : `${daysRemaining} days`}</span>
                          </div>
                          <p className="text-[11px] text-amber-200/80 leading-relaxed">
                            Pay via <strong>Card (Auto-Debit)</strong> or <strong>Bank Transfer (1-Click Renewal)</strong> to prevent haulage tracking interruptions.
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowSubscribeMonthlyModal({ truck_id: truck.id, truck_number: truck.truck_number, auto_renew: Boolean(truck.auto_renew) })}
                            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-2 px-3 rounded-lg text-xs flex items-center justify-center space-x-1 transition-all cursor-pointer shadow-sm"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Renew ₦3,500 Now (Transfer or Card)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs gap-2">
                    {isMonthly ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (isMonthlyActive) {
                              setSwitchBillingTarget({
                                truck_id: truck.id,
                                truck_number: truck.truck_number,
                                current_method: 'monthly',
                                target_method: 'per_trip',
                                monthly_active_until: truck.monthly_active_until
                              });
                            } else {
                              handleConfirmSwitchBillingMethod();
                            }
                          }}
                          className="text-slate-400 hover:text-white underline font-semibold transition-colors cursor-pointer"
                        >
                          Switch to Per-Trip
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSubscribeMonthlyModal({ truck_id: truck.id, truck_number: truck.truck_number, auto_renew: Boolean(truck.auto_renew) })}
                          className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold px-3 py-1.5 rounded-xl flex items-center space-x-1 shadow transition-all cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Renew Monthly (₦3,500)</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowSubscribeMonthlyModal({ truck_id: truck.id, truck_number: truck.truck_number, auto_renew: false })}
                        className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold px-4 py-2 rounded-xl flex items-center space-x-1.5 shadow transition-all cursor-pointer w-full justify-center"
                      >
                        <CreditCard className="w-4 h-4 text-purple-200" />
                        <span>Switch to Monthly Plan (₦3,500/mo)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: SUPPLIERS */}
      {activeSubTab === 'suppliers' && (
        <div className="bg-[#0A1F44] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-xl font-black text-white flex items-center space-x-2">
                <Building2 className="w-6 h-6 text-[#F2A93B]" />
                <span>Suppliers & Destination Depots 🏭</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Manage destination factories, loading points, and supplier contacts.</p>
            </div>
            <button
              onClick={() => setShowAddSupplier(true)}
              className="bg-[#F2A93B] hover:bg-[#d9922b] text-[#0A1F44] font-extrabold px-5 py-3 rounded-2xl text-xs flex items-center space-x-1.5 shadow-lg transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {suppliers.map(supp => (
              <div key={supp.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-2 shadow-md" id={`supplier-card-${supp.id}`}>
                <div className="flex items-center justify-between">
                  <p className="font-black text-white text-base">{supp.name}</p>
                  <button
                    type="button"
                    onClick={() => triggerDeleteSupplier(supp.id, supp.name)}
                    title={`Delete Supplier ${supp.name}`}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {(supp.full_name || supp.supplier_full_name) && (
                  <p className="text-xs text-slate-300">
                    <span className="text-slate-400 font-medium">Contact:</span>{' '}
                    <strong className="text-amber-300">{supp.full_name || supp.supplier_full_name}</strong>
                  </p>
                )}
                {(supp.phone || supp.supplier_phone_number) && (
                  <p className="text-xs text-slate-300">
                    <span className="text-slate-400 font-medium">Phone:</span>{' '}
                    <strong className="font-mono text-white">{supp.phone || supp.supplier_phone_number}</strong>
                  </p>
                )}
                <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                  Added: {new Date(supp.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: MANAGERS, DRIVERS & SUPPLIER STAFF */}
      {activeSubTab === 'staff_drivers' && (
        <div className="space-y-6">
          {/* Company Managers & Park Officers */}
          <div className="bg-[#0A1F44] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <UserCheck className="w-6 h-6 text-amber-400" />
                  <span>Company Managers & Park Officers ({managers.length}) 👔</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Create manager accounts so your park officers can log in, dispatch trucks, and manage daily park operations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setManagerParkId(parks[0]?.id || '');
                  setShowAddManager(true);
                }}
                className="bg-[#F2A93B] hover:bg-[#d9922b] text-[#0A1F44] font-black px-5 py-2.5 rounded-2xl text-xs flex items-center space-x-1.5 shadow-lg transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Manager Account</span>
              </button>
            </div>

            {managers.length === 0 ? (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 text-center space-y-2">
                <UserCheck className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-sm font-bold text-slate-300">No Manager Accounts Created Yet</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Click <strong>"Add Manager Account"</strong> above to assign a park location, phone number, and 6-digit PIN to your manager so they can log in.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {managers.map(mgr => {
                  const isInactive = mgr.active === false;
                  return (
                    <div
                      key={mgr.id}
                      className={`bg-slate-900 border ${
                        isInactive ? 'border-rose-500/30 opacity-75' : 'border-slate-800 hover:border-slate-700'
                      } rounded-2xl p-4 space-y-3 shadow-md`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-black text-white text-base flex items-center gap-2">
                            <span>{mgr.name}</span>
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                isInactive
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {isInactive ? 'Disabled 🔴' : 'Active 🟢'}
                            </span>
                          </p>
                          <p className="text-xs text-slate-400 font-mono mt-1">📞 {mgr.phone || mgr.phone_number}</p>
                          <p className="text-xs text-amber-300 font-bold mt-1 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-amber-400" />
                            <span>{mgr.park_location || 'Central Park Depot'}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => triggerDeleteManager(mgr.id, mgr.name)}
                          title={`Delete Manager ${mgr.name}`}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs gap-2">
                        <button
                          type="button"
                          onClick={() => handleResetManagerPinAction(mgr.id, mgr.name)}
                          className="font-extrabold px-3 py-1.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 transition-colors cursor-pointer text-xs"
                        >
                          Reset PIN
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleManagerActive(mgr.id, mgr.name)}
                          className={`font-extrabold px-3 py-1.5 rounded-xl transition-colors cursor-pointer text-xs ${
                            isInactive
                              ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {isInactive ? 'Enable Access' : 'Disable Access'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Drivers */}
            <div className="bg-[#0A1F44] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" /> Drivers ({drivers.length})
              </h3>
              <button
                onClick={() => setShowAddDriver(true)}
                className="bg-[#F2A93B] hover:bg-[#d9922b] text-[#0A1F44] font-extrabold px-4 py-2 rounded-xl text-xs flex items-center space-x-1 shadow-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Driver</span>
              </button>
            </div>
            <div className="space-y-3">
              {drivers.map(drv => {
                const assignedTruck = trucks.find(t => t.id === drv.truck_id);
                return (
                  <div key={drv.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                    <div className="space-y-1">
                      <p className="font-black text-white text-base">{drv.name}</p>
                      <p className="text-xs text-slate-400 font-mono">📞 {drv.phone_number}</p>
                      {assignedTruck && (
                        <div className="pt-0.5">
                          <span className="text-xs text-amber-300 font-bold bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20 inline-block">
                            Truck: {assignedTruck.truck_number}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                      {drv.initial_pin && (
                        <span className="text-[11px] font-mono bg-slate-950 text-amber-300 border border-slate-800 px-2.5 py-1 rounded-lg font-bold">
                          PIN: {drv.initial_pin}
                        </span>
                      )}
                      <button
                        onClick={() => handleResetDriverPin(drv.id, drv.name)}
                        className="text-xs font-extrabold px-3 py-1.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 transition-colors cursor-pointer"
                      >
                        Reset PIN
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerDeleteDriver(drv.id, drv.name)}
                        title={`Delete Driver ${drv.name}`}
                        className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Supplier Staff */}
          <div className="bg-[#0A1F44] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" /> Supplier Staff ({supplierStaff.length})
              </h3>
              <button
                onClick={() => setShowAddSuppStaff(true)}
                className="bg-[#F2A93B] hover:bg-[#d9922b] text-[#0A1F44] font-extrabold px-4 py-2 rounded-xl text-xs flex items-center space-x-1 shadow-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Staff</span>
              </button>
            </div>
            <div className="space-y-3">
              {supplierStaff.map(st => (
                <div key={st.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <p className="font-black text-white text-base">{st.name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        st.status === 'disabled'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {st.status === 'disabled' ? 'Disabled 🔴' : 'Active 🟢'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">📞 {st.phone_number}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    {st.initial_pin && (
                      <span className="text-[11px] font-mono bg-slate-950 text-amber-300 border border-slate-800 px-2.5 py-1 rounded-lg font-bold">
                        PIN: {st.initial_pin}
                      </span>
                    )}
                    <button
                      onClick={() => handleResetSupplierStaffPin(st.id, st.name)}
                      className="text-xs font-extrabold px-3 py-1.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 transition-colors cursor-pointer"
                    >
                      Reset PIN
                    </button>
                    <button
                      onClick={() => handleToggleStaffStatus(st.id, st.status)}
                      className={`text-xs font-extrabold px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                        st.status === 'disabled'
                          ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {st.status === 'disabled' ? 'Enable' : 'Disable'}
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerDeleteSupplierStaff(st.id, st.name)}
                      title={`Delete Staff ${st.name}`}
                      className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* TAB 5: TRIPS */}
      {activeSubTab === 'trips' && (
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-xl font-black text-[#0A1F44] flex items-center gap-2">
                <Calendar className="w-6 h-6 text-[#F2A93B]" />
                Fleet Round Trips & Journey Tracking 🚚
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Monitor truck transit progress and supplier delivery milestones in real-time.
              </p>
            </div>
            <button
              onClick={() => setShowCreateTrip(true)}
              className="bg-[#0A1F44] hover:bg-blue-900 text-white font-extrabold px-5 py-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#F2A93B]" />
              <span>Initiate New Trip</span>
            </button>
          </div>

          <div className="space-y-4">
            {trips.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                <Truck className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-sm font-bold text-slate-700">No Fleet Trips Initiated Yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Click "Initiate New Trip" above to dispatch a fleet truck to a destination supplier or depot.
                </p>
              </div>
            ) : (
              trips.map(trip => {
                const narrativeInfo = getFleetTripNarrative(trip);
                
                // Determine active 7-stage progress based on status/timestamps
                // 1: Booked, 2: Left Depot, 3: In-Transit to Supplier, 4: Arrived at Supplier, 5: Loaded & Cleared, 6: In-Transit Return, 7: Completed
                const isCompleted = trip.status === 'completed' || trip.status === 'arrived_offloaded';
                const isLoaded = trip.status === 'loaded_departed' || isCompleted;
                const isLeft = trip.status === 'left_warehouse' || isLoaded || isCompleted;
                
                const currentStageNum = isCompleted ? 7 : isLoaded ? 5 : isLeft ? 3 : 1;
                const progressPct = Math.round((currentStageNum / 7) * 100);

                return (
                  <div key={trip.id} className="bg-white border border-slate-200 hover:border-slate-300 rounded-3xl p-6 shadow-xs transition-all space-y-6">
                    {narrativeInfo.isOverdue && narrativeInfo.overdueWarning && (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-amber-900 text-xs flex items-start gap-3 shadow-xs">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-extrabold uppercase tracking-wider text-amber-900">Overdue Checkpoint: </span>
                          <span className="font-medium text-amber-800">{narrativeInfo.overdueWarning}</span>
                        </div>
                      </div>
                    )}

                    {/* Top Status & Payment Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-[#0A1F44] text-[#F2A93B] font-black text-xs px-3 py-1.5 rounded-xl tracking-wider uppercase shadow-xs">
                          Truck: {trip.truck_number}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                          isCompleted ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          isLoaded ? 'bg-blue-100 text-blue-900 border border-blue-200' :
                          'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}>
                          {trip.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 font-medium">
                          Billing: <strong className="text-slate-800">{trip.billing_method.toUpperCase()}</strong> (Fee: ₦{trip.trip_fee})
                        </span>
                        {trip.payment_status === 'pending' && trip.trip_fee > 0 && (
                          <button
                            onClick={() => handlePayTrip(trip.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                          >
                            Pay ₦{trip.trip_fee}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Origin -> Destination Horizontal Header */}
                    <div className="flex items-center justify-between text-sm font-extrabold bg-[#FAFAFA] rounded-2xl p-4 border border-slate-100">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">ORIGIN DEPOT</p>
                          <p className="text-slate-800 mt-0.5">{trip.origin_park || 'Company Headquarters'}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-slate-300" />
                      <div className="flex items-center gap-2 text-right">
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">DESTINATION SUPPLIER</p>
                          <p className="text-slate-800 mt-0.5">{trip.supplier_name}</p>
                        </div>
                        <Building2 className="w-4 h-4 text-[#F2A93B]" />
                      </div>
                    </div>

                    {/* Live Transit Progress Bar with Moving Icon */}
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-xs">
                            <Truck className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Live Journey Progress</p>
                            <p className="text-xs font-black text-[#0A1F44] capitalize">Stage {currentStageNum} of 7 ({progressPct}%)</p>
                          </div>
                        </div>
                        <span className="text-xs font-extrabold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-blue-600" /> Truck {trip.truck_number}
                        </span>
                      </div>

                      {/* Progress Track */}
                      <div className="relative pt-6 pb-2 px-1">
                        <div className="h-3 bg-slate-200/90 rounded-full w-full absolute top-1/2 -translate-y-1/2 left-0 z-0 shadow-inner overflow-hidden">
                          <div 
                            className="h-full transition-all duration-700 ease-out rounded-full bg-gradient-to-r from-blue-600 to-emerald-500"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>

                        {/* Moving Icon Badge */}
                        <div 
                          className="absolute top-1/2 -translate-y-1/2 z-10 transition-all duration-700 ease-out"
                          style={{ left: `calc(${progressPct}% - 18px)` }}
                        >
                          <div className="w-9 h-9 rounded-full flex items-center justify-center shadow-md border-2 border-white text-white bg-blue-600 animate-pulse">
                            <Truck className="w-4 h-4" />
                          </div>
                        </div>

                        <div className="flex justify-between relative z-0 text-[11px] font-bold text-slate-500 pt-1">
                          <span>{trip.origin_park || 'Origin Depot'}</span>
                          <span>{trip.supplier_name}</span>
                        </div>
                      </div>
                    </div>

                    {/* Vertical 7-Stage Timeline */}
                    <div className="border-t border-slate-100 pt-6 space-y-6">
                      <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">
                        7-Stage Fleet Trip Journey Timeline
                      </h4>

                      <div className="relative border-l-2 border-slate-100 ml-4 pl-6 space-y-6">
                        
                        {/* Stage 1: Trip Booked & Assigned */}
                        <div className="relative">
                          <span className="absolute -left-[31px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white border-emerald-500 text-emerald-500 shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 fill-current bg-white rounded-full" />
                          </span>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h5 className="text-sm font-extrabold text-slate-900">
                                1. Trip Booked & Assigned
                              </h5>
                              {trip.created_at && (
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {new Date(trip.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              Truck {trip.truck_number} and driver assigned for haulage to {trip.supplier_name}.
                            </p>
                          </div>
                        </div>

                        {/* Stage 2: Departed Origin Depot */}
                        <div className="relative">
                          <span className={`absolute -left-[31px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white ${trip.left_warehouse_at ? 'border-emerald-500 text-emerald-500' : 'border-slate-200 text-slate-300'}`}>
                            <CheckCircle2 className="w-3.5 h-3.5 fill-current bg-white rounded-full" />
                          </span>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h5 className={`text-sm font-extrabold ${trip.left_warehouse_at ? 'text-slate-900' : 'text-slate-400'}`}>
                                2. Departed Origin Depot
                              </h5>
                              {trip.left_warehouse_at && (
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {new Date(trip.left_warehouse_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              {trip.left_warehouse_at
                                ? `Truck officially departed origin park/warehouse.`
                                : `Pending departure confirmation from origin.`}
                            </p>
                          </div>
                        </div>

                        {/* Stage 3: In-Transit to Supplier */}
                        <div className="relative">
                          <span className={`absolute -left-[31px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white ${trip.left_warehouse_at && !trip.loaded_departed_at ? 'border-blue-500 text-blue-600 animate-pulse' : trip.loaded_departed_at || isCompleted ? 'border-emerald-500 text-emerald-500' : 'border-slate-200 text-slate-300'}`}>
                            <Activity className="w-3 h-3" />
                          </span>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h5 className={`text-sm font-extrabold ${trip.left_warehouse_at ? 'text-slate-900' : 'text-slate-400'}`}>
                                3. In-Transit to Supplier
                              </h5>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              {trip.left_warehouse_at
                                ? `Truck is actively moving on the highway towards ${trip.supplier_name}.`
                                : `Awaiting departure to begin transit.`}
                            </p>
                          </div>
                        </div>

                        {/* Stage 4: Arrived at Supplier / Factory */}
                        <div className="relative">
                          <span className={`absolute -left-[31px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white ${trip.loaded_departed_at || isCompleted ? 'border-emerald-500 text-emerald-500' : 'border-slate-200 text-slate-300'}`}>
                            <CheckCircle2 className="w-3.5 h-3.5 fill-current bg-white rounded-full" />
                          </span>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h5 className={`text-sm font-extrabold ${trip.loaded_departed_at || isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>
                                4. Arrived at Supplier / Factory
                              </h5>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              {trip.loaded_departed_at || isCompleted
                                ? `Truck successfully arrived at ${trip.supplier_name} gates.`
                                : `Pending arrival at supplier depot.`}
                            </p>
                          </div>
                        </div>

                        {/* Stage 5: Loaded & Cleared */}
                        <div className="relative">
                          <span className={`absolute -left-[31px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white ${trip.loaded_departed_at ? 'border-emerald-500 text-emerald-500' : 'border-slate-200 text-slate-300'}`}>
                            <CheckCircle2 className="w-3.5 h-3.5 fill-current bg-white rounded-full" />
                          </span>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h5 className={`text-sm font-extrabold ${trip.loaded_departed_at ? 'text-slate-900' : 'text-slate-400'}`}>
                                5. Loaded & Cleared
                              </h5>
                              {trip.loaded_departed_at && (
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {new Date(trip.loaded_departed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              {trip.loaded_departed_at
                                ? `Cargo fully loaded and exit clearance granted at ${trip.supplier_name}.`
                                : `Pending loading and weighbridge clearance.`}
                            </p>
                          </div>
                        </div>

                        {/* Stage 6: In-Transit Return / Delivering */}
                        <div className="relative">
                          <span className={`absolute -left-[31px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white ${trip.status === 'loaded_departed' && !isCompleted ? 'border-blue-500 text-blue-600 animate-pulse' : isCompleted ? 'border-emerald-500 text-emerald-500' : 'border-slate-200 text-slate-300'}`}>
                            <Activity className="w-3 h-3" />
                          </span>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h5 className={`text-sm font-extrabold ${trip.status === 'loaded_departed' || isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>
                                6. In-Transit Return / Delivering
                              </h5>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              {trip.status === 'loaded_departed'
                                ? `Truck is returning with cargo toward origin/destination warehouse.`
                                : `Awaiting return transit.`}
                            </p>
                          </div>
                        </div>

                        {/* Stage 7: Offloaded & Trip Completed */}
                        <div className="relative">
                          <span className={`absolute -left-[31px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white ${isCompleted ? 'border-emerald-500 text-emerald-500' : 'border-slate-200 text-slate-300'}`}>
                            <CheckCircle2 className="w-3.5 h-3.5 fill-current bg-white rounded-full" />
                          </span>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h5 className={`text-sm font-extrabold ${isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>
                                7. Offloaded & Trip Completed
                              </h5>
                              {trip.arrived_offloaded_at && (
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {new Date(trip.arrived_offloaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              {isCompleted
                                ? `Trip successfully finalized and offloaded!`
                                : `Final offloading confirmation pending.`}
                            </p>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Warm Human Narrative Status Line */}
                    <div className="pt-3 border-t border-slate-100 text-xs text-slate-700 flex items-center gap-2 bg-slate-50/80 p-3.5 rounded-2xl">
                      <span className="font-extrabold text-[#0A1F44] shrink-0">Live Update:</span>
                      <p className="italic font-semibold text-slate-700">"{narrativeInfo.narrative}"</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      {showAddTruck && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Add New Fleet Truck</h3>
            
            {truckError && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/50 rounded-xl text-rose-300 text-xs font-semibold">
                {truckError}
              </div>
            )}

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

              {parks.length > 0 && (
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Depot / Branch (Optional)</label>
                  <select
                    value={newTruckParkId}
                    onChange={(e) => setNewTruckParkId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white"
                  >
                    <option value="">-- Main Depot / Default --</option>
                    {parks.map(p => (
                      <option key={p.id} value={p.id}>{p.park_name || p.name}</option>
                    ))}
                  </select>
                </div>
              )}

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
                      className="w-4 h-4 text-purple-600 rounded border-slate-700 bg-slate-800"
                    />
                    <span className="text-sm font-bold text-white">Auto-renew this truck's monthly plan?</span>
                  </label>
                  <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                    When ON: this truck's monthly plan will automatically renew every month via Paystack so tracking never lapses — you will be charged ₦3,500 again automatically when the current period ends. When OFF (default): you will be warned 5 days before expiry and must manually renew if you want to continue. If you do not renew, the truck falls back to per-trip (₦1,000) automatically.
                  </p>
                </div>
              )}
              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={submittingTruck}
                  className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-2.5 rounded-xl disabled:opacity-50 transition-all cursor-pointer"
                >
                  {submittingTruck ? 'Saving Truck...' : 'Save Truck'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddTruck(false); setTruckError(null); }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddSupplier && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in" id="add-supplier-modal">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                Add Supplier / Depot
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddSupplier(false);
                  setNewSupplierName('');
                  setNewSupplierFullName('');
                  setNewSupplierPhone('');
                  setSupplierError(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
                id="close-add-supplier-modal-btn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSupplier} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Supplier / Depot Name *
                </label>
                <input
                  type="text"
                  required
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="e.g. Dangote Cement Factory / Depot"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  id="supplier-depot-name-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Supplier Full Name
                </label>
                <input
                  type="text"
                  value={newSupplierFullName}
                  onChange={(e) => setNewSupplierFullName(e.target.value)}
                  placeholder="e.g. Alhaji Aliko Dangote"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  id="supplier-full-name-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Supplier Phone Number
                </label>
                <input
                  type="tel"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  placeholder="e.g. 08012345678"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  id="supplier-phone-number-input"
                />
              </div>

              {supplierError && (
                <p className="text-xs font-semibold text-rose-400 bg-rose-950/40 border border-rose-900 p-2.5 rounded-xl">
                  {supplierError}
                </p>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={submittingSupplier}
                  className="flex-1 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-900 font-bold py-2.5 rounded-xl transition-colors cursor-pointer shadow-md text-sm"
                  id="submit-add-supplier-btn"
                >
                  {submittingSupplier ? 'Saving...' : 'Add Supplier'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSupplier(false);
                    setNewSupplierName('');
                    setNewSupplierFullName('');
                    setNewSupplierPhone('');
                    setSupplierError(null);
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-xl transition-colors cursor-pointer text-sm"
                  id="cancel-add-supplier-btn"
                >
                  Cancel
                </button>
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

      {showAddManager && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-400" />
                <span>Create Manager Account</span>
              </h3>
              <button type="button" onClick={() => setShowAddManager(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {managerError && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{managerError}</span>
              </div>
            )}

            <form onSubmit={handleAddManager} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Manager Full Name *</label>
                <input
                  type="text"
                  required
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="e.g. Musa Ibrahim"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Manager Phone Number (11 Digits) *</label>
                <input
                  type="text"
                  required
                  maxLength={11}
                  value={managerPhone}
                  onChange={(e) => setManagerPhone(e.target.value)}
                  placeholder="e.g. 08012345678"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-amber-400"
                />
                <p className="text-[11px] text-slate-400 mt-1">The manager will use this phone number to log in.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Assigned Park / Branch Location *</label>
                <select
                  required
                  value={managerParkId}
                  onChange={(e) => setManagerParkId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400"
                >
                  <option value="">-- Select Park Location --</option>
                  {parks.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.park_name || p.park_location || 'Central Park'} ({p.location || p.city || 'Depot'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-900/80 border border-slate-700/60 p-3 rounded-xl text-xs text-slate-300 leading-relaxed space-y-1">
                <p className="font-bold text-amber-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Manager First-Time PIN Setup</span>
                </p>
                <p className="text-slate-400 text-[11px]">
                  The manager will log in on the <strong>Manager Portal</strong> using their 11-digit phone number. Upon verifying their account, the app will prompt them to set up their custom 6-digit login PIN.
                </p>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={submittingManager}
                  className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black py-2.5 rounded-xl text-sm transition-all shadow cursor-pointer disabled:opacity-50"
                >
                  {submittingManager ? 'Creating Manager...' : 'Create Manager Account'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddManager(false)}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-medium px-4 py-2.5 rounded-xl text-sm cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {createdManagerSuccess && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-emerald-400">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Manager Account Registered!</h3>
                <p className="text-xs text-slate-400">Ready for First-Time Manager Login</p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2.5 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Manager Name:</span>
                <span className="text-white font-bold">{createdManagerSuccess.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Phone Number:</span>
                <span className="text-amber-400 font-bold">{createdManagerSuccess.phone}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Park Location:</span>
                <span className="text-white font-bold">{createdManagerSuccess.park_location}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-900">
                <span className="text-slate-400">PIN Creation:</span>
                <span className="text-emerald-400 font-extrabold text-xs bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-800">
                  Manager will create PIN on login 🔑
                </span>
              </div>
            </div>

            <div className="bg-blue-950/40 border border-blue-900/50 p-3 rounded-xl text-[11px] text-blue-200 leading-relaxed">
              💡 <strong>Next Steps:</strong> Inform <strong>{createdManagerSuccess.name}</strong> to visit the <strong>Manager Portal</strong>, enter phone number <strong className="font-mono text-white">{createdManagerSuccess.phone}</strong>, and set their 6-digit security PIN on first login.
            </div>

            <div className="flex space-x-3 pt-2">
              <a
                href={`https://wa.me/234${createdManagerSuccess.phone.substring(1)}?text=${encodeURIComponent(
                  `Hello ${createdManagerSuccess.name}, your Manager Account for ${createdManagerSuccess.park_location} has been created!\n\nPhone Number: ${createdManagerSuccess.phone}\n\nPlease visit the Manager Portal, enter your phone number, and set up your personal 6-digit security PIN to access your park dashboard.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow transition-all no-underline"
              >
                <span>Share via WhatsApp 💬</span>
              </a>
              <button
                type="button"
                onClick={() => setCreatedManagerSuccess(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-3 rounded-xl text-xs cursor-pointer"
              >
                Done
              </button>
            </div>
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
                <label className="block text-sm text-slate-300 mb-1">6-Digit PIN (Optional)</label>
                <input
                  type="text"
                  maxLength={6}
                  value={driverPin}
                  onChange={(e) => setDriverPin(e.target.value)}
                  placeholder="Leave blank to auto-generate"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white placeholder-slate-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">If left blank, the system will auto-generate a secure 6-digit PIN.</p>
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
                <label className="block text-sm text-slate-300 mb-1">6-Digit PIN (Optional)</label>
                <input
                  type="text"
                  value={suppStaffPin}
                  onChange={(e) => setSuppStaffPin(e.target.value)}
                  placeholder="Leave blank to auto-generate 6-digit PIN"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Leave blank and the system will automatically generate a secure 6-digit PIN.
                </p>
              </div>
              <div className="flex space-x-3 pt-2">
                <button type="submit" className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-2.5 rounded-xl">Create Staff</button>
                <button type="button" onClick={() => setShowAddSuppStaff(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-xl">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 💳 Paystack Mandatory Payment Gate Modal before Trip Creation */}
      {pendingPaystackTrip && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Paystack Trip Gate</h3>
                  <p className="text-xs text-slate-400">Mandatory per-trip haulage fee payment</p>
                </div>
              </div>
              <span className="text-[10px] font-extrabold font-mono text-emerald-400 bg-emerald-950 border border-emerald-800 px-2.5 py-1 rounded-full uppercase">
                Secured
              </span>
            </div>

            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Truck Unit:</span>
                <span className="font-bold text-white font-mono">{pendingPaystackTrip.truck_number}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Supplier Destination:</span>
                <span className="font-bold text-white">{pendingPaystackTrip.supplier_name}</span>
              </div>
              <div className="pt-2 border-t border-slate-900 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-300">Trip Fee Amount:</span>
                <span className="text-xl font-black text-emerald-400 font-mono">₦{pendingPaystackTrip.fee.toLocaleString()}</span>
              </div>
            </div>

            {/* 🛡️ Paystack Security & Anti-Theft Protection Reassurance Box */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Secured by Paystack (CBN Licensed • PCI-DSS Certified)</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                🔒 <strong>100% Security Guarantee:</strong> Waybilla never sees or stores your card details. Payments are encrypted directly by Paystack. Supports <strong>Card</strong>, <strong>Bank Transfer</strong> (OPay, GTB, Zenith), or <strong>USSD</strong>.
              </p>
            </div>

            {pendingPaystackTrip.checkout_url && (
              <a
                href={pendingPaystackTrip.checkout_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#0A1F44] hover:bg-slate-800 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 no-underline border border-emerald-500/50 shadow-md"
              >
                <ExternalLink className="w-4 h-4 text-[#F2A93B]" />
                <span>Open Paystack Live Checkout Portal (₦1,000)</span>
              </a>
            )}

            {verifyingPaymentStatus ? (
              <div className="bg-emerald-950/60 border border-emerald-500/50 p-4 rounded-2xl flex items-center space-x-3 text-emerald-200 text-xs animate-pulse">
                <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="font-semibold leading-relaxed">{verifyingPaymentStatus}</span>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 leading-relaxed bg-blue-950/40 border border-blue-900/50 p-3 rounded-xl">
                💡 Trip record will be created in your fleet registry <strong>only after</strong> Paystack webhook payment confirmation.
              </p>
            )}

            <div className="flex space-x-3 pt-1">
              <button
                type="button"
                disabled={submittingTrip}
                onClick={() => executePaystackTripPayment(Boolean(pendingPaystackTrip.checkout_url))}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 px-4 rounded-xl text-sm transition-all shadow-lg shadow-emerald-950/50 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {submittingTrip ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>{pendingPaystackTrip.checkout_url ? "Confirm Payment & Start Trip" : "Pay ₦1,000 & Start Trip"}</span>
                )}
              </button>
              <button
                type="button"
                disabled={submittingTrip}
                onClick={() => setPendingPaystackTrip(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ Expired Monthly Plan Options Modal */}
      {expiredMonthlyPlanTarget && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
              <div className="p-3 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Monthly Plan Expired</h3>
                <p className="text-xs text-slate-400">Truck: <span className="font-mono text-amber-300 font-bold">{expiredMonthlyPlanTarget.truck_number}</span></p>
              </div>
            </div>

            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-2 text-xs text-slate-300 leading-relaxed">
              <p>
                This truck's monthly plan expired on{' '}
                <strong className="text-amber-300 font-mono">
                  {expiredMonthlyPlanTarget.expired_on ? new Date(expiredMonthlyPlanTarget.expired_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'earlier date'}
                </strong>
                . Please renew your monthly plan or switch to per-trip to continue tracking.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  const target = expiredMonthlyPlanTarget;
                  setExpiredMonthlyPlanTarget(null);
                  setShowSubscribeMonthlyModal({
                    truck_id: target.truck_id,
                    truck_number: target.truck_number,
                    auto_renew: false
                  });
                }}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-extrabold py-3 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition-all shadow-lg cursor-pointer"
              >
                <CreditCard className="w-4 h-4 text-purple-200" />
                <span>Renew Monthly (₦3,500)</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  const target = expiredMonthlyPlanTarget;
                  setExpiredMonthlyPlanTarget(null);
                  if (token) {
                    await updateFleetTruckBilling(token, target.truck_id, { billing_method: 'per_trip' });
                    fetchData();
                    setPendingPaystackTrip({
                      truck_id: target.truck_id,
                      supplier_id: target.supplier_id || '',
                      truck_number: target.truck_number,
                      supplier_name: suppliers.find(s => s.id === target.supplier_id)?.name || 'Selected Depot',
                      fee: 1000
                    });
                  }
                }}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-3 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition-all shadow-lg cursor-pointer"
              >
                <span>Switch to Per-Trip (₦1,000 per trip)</span>
              </button>

              <button
                type="button"
                onClick={() => setExpiredMonthlyPlanTarget(null)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 font-semibold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💳 Subscribe / Renew Monthly Subscription Paystack Modal (₦3,500) */}
      {showSubscribeMonthlyModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Monthly Subscription</h3>
                  <p className="text-xs text-slate-400">Truck: <span className="font-mono text-purple-300 font-bold">{showSubscribeMonthlyModal.truck_number}</span></p>
                </div>
              </div>
              <span className="text-[10px] font-extrabold font-mono text-purple-300 bg-purple-950 border border-purple-800 px-2.5 py-1 rounded-full uppercase">
                30-Day Plan
              </span>
            </div>

            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Coverage Duration:</span>
                <span className="font-bold text-white">30 Days Unlimited Trips</span>
              </div>
              <div className="pt-2 border-t border-slate-900 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-300">Monthly Plan Amount:</span>
                <span className="text-xl font-black text-purple-400 font-mono">₦3,500</span>
              </div>
            </div>

            {/* 🛡️ Card Security & Bank Transfer Reassurance Card */}
            <div className="bg-slate-950/90 rounded-2xl p-4 border border-purple-900/40 space-y-2.5">
              <div className="flex items-center space-x-2 text-purple-300 font-bold text-xs">
                <ShieldCheck className="w-4.5 h-4.5 shrink-0 text-purple-400" />
                <span>100% Security & Bank Transfer Guarantee</span>
              </div>

              <div className="space-y-2 text-[11px] text-slate-300 leading-relaxed">
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 shrink-0" />
                  <div>
                    <strong className="text-white">Card Protection:</strong> Waybilla never sees or stores card numbers. Payments are encrypted by Paystack (CBN Licensed & PCI-DSS Level 1).
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1 shrink-0" />
                  <div>
                    <strong className="text-white">Bank Transfer Auto-Renewal:</strong> Paying via Transfer (OPay, GTB, Zenith)? You will get a 5-day expiry alert with a 1-click renewal prompt.
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0" />
                  <div>
                    <strong className="text-white">Zero-Risk Protection:</strong> If a plan expires without renewal, your truck automatically falls back to Per-Trip (₦1,000) so trips are never blocked.
                  </div>
                </div>
              </div>
            </div>

            {/* Auto-renew toggle with explicit explanation */}
            <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800 space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSubscribeMonthlyModal.auto_renew}
                  onChange={(e) => setShowSubscribeMonthlyModal({ ...showSubscribeMonthlyModal, auto_renew: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-900 border-slate-700"
                />
                <span className="text-xs font-extrabold text-white">Auto-renew this truck's monthly plan?</span>
              </label>

              <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                When ON: card payments auto-renew seamlessly every 30 days via Paystack tokenization. Bank Transfer users receive a 1-click renewal prompt 5 days before expiry. Cancel or toggle OFF anytime in 1 click!
              </p>
            </div>

            {showSubscribeMonthlyModal.checkout_url && (
              <a
                href={showSubscribeMonthlyModal.checkout_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#0A1F44] hover:bg-slate-800 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 no-underline border border-purple-500/50 shadow-md"
              >
                <ExternalLink className="w-4 h-4 text-purple-300" />
                <span>Open Paystack Live Checkout Portal (₦3,500)</span>
              </a>
            )}

            {verifyingPaymentStatus ? (
              <div className="bg-purple-950/60 border border-purple-500/50 p-4 rounded-2xl flex items-center space-x-3 text-purple-200 text-xs animate-pulse">
                <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="font-medium">{verifyingPaymentStatus}</span>
              </div>
            ) : null}

            <div className="flex space-x-3 pt-1">
              <button
                type="button"
                disabled={submittingSubscription}
                onClick={() => executePaystackSubscribeMonthly(Boolean(showSubscribeMonthlyModal.checkout_url))}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-black py-3 px-4 rounded-xl text-sm transition-all shadow-lg shadow-purple-950/50 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {submittingSubscription ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>{showSubscribeMonthlyModal.checkout_url ? "Confirm Payment & Activate Plan" : "Pay ₦3,500 & Activate Monthly"}</span>
                )}
              </button>
              <button
                type="button"
                disabled={submittingSubscription}
                onClick={() => setShowSubscribeMonthlyModal(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ Switch to Per-Trip Active Warning Modal */}
      {switchBillingTarget && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
              <div className="p-3 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Switch to Per-Trip Billing</h3>
                <p className="text-xs text-slate-400">Truck: <span className="font-mono text-amber-300 font-bold">{switchBillingTarget.truck_number}</span></p>
              </div>
            </div>

            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-2 text-xs text-slate-300 leading-relaxed">
              <p>
                This truck's monthly plan is active until{' '}
                <strong className="text-amber-300 font-mono">
                  {switchBillingTarget.monthly_active_until ? new Date(switchBillingTarget.monthly_active_until).toLocaleDateString() : 'N/A'}
                </strong>
                . Switching now means you will lose the remaining days and be charged ₦1,000 per trip going forward. Are you sure?
              </p>
            </div>

            <div className="flex space-x-3 pt-1">
              <button
                type="button"
                onClick={handleConfirmSwitchBillingMethod}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-3 px-4 rounded-xl text-xs transition-all shadow-lg cursor-pointer"
              >
                Confirm Switch to Per-Trip
              </button>
              <button
                type="button"
                onClick={() => setSwitchBillingTarget(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ Interactive Warning & Confirmation Modal for Delete Action */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-amber-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-1.5">
                  <span>{deleteTarget.title}</span>
                </h3>
                <p className="text-xs text-rose-300 font-medium">Warning: This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
              <p className="text-sm text-slate-200 leading-relaxed">
                {deleteTarget.description}
              </p>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 uppercase font-semibold">Target Item:</span>
                <span className="font-bold text-amber-300 font-mono text-sm">{deleteTarget.name}</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 px-4 rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={executeConfirmedDelete}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-lg shadow-rose-900/40 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
