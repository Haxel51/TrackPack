import { User } from '../types';

const API_BASE = '/api';

async function safeFetch(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await res.json();
      if (!res.ok && data.success === undefined) {
        return { success: false, error: data.error || `Server error (${res.status})` };
      }
      return data;
    } else {
      const text = await res.text();
      return { success: false, error: `Server error (${res.status}): ${text.substring(0, 100) || "Unable to read response."}` };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error. Please try again." };
  }
}

export async function loginCustomer(phoneNumber: string, pin: string) {
  return safeFetch(`${API_BASE}/auth/customer/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phoneNumber, pin }),
  });
}

export async function registerCustomer(phoneNumber: string, pin: string, confirmPin?: string) {
  return safeFetch(`${API_BASE}/auth/customer/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phoneNumber, pin, confirm_pin: confirmPin }),
  });
}

export async function requestCustomerPinReset(phoneNumber: string) {
  return safeFetch(`${API_BASE}/auth/customer/forgot-pin/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phoneNumber }),
  });
}

export async function resetCustomerPin(data: {
  phone_number: string;
  code: string;
  new_pin: string;
  confirm_pin: string;
}) {
  return safeFetch(`${API_BASE}/auth/customer/forgot-pin/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function requestCompanyPasswordReset(ownerPhone: string) {
  return safeFetch(`${API_BASE}/auth/company/forgot-password/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner_phone: ownerPhone }),
  });
}

export async function resetCompanyPassword(data: {
  owner_phone: string;
  code: string;
  new_password: string;
  confirm_password: string;
}) {
  return safeFetch(`${API_BASE}/auth/company/forgot-password/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function loginStaff(pin: string) {
  return safeFetch(`${API_BASE}/auth/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
}

export async function loginCompany(phoneNumber: string, password: string) {
  return safeFetch(`${API_BASE}/auth/company/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phoneNumber, password }),
  });
}

export async function registerCompany(data: {
  company_name: string;
  owner_phone: string;
  password: string;
  park_name: string;
  park_location: string;
  service_mode?: string;
}) {
  return safeFetch(`${API_BASE}/auth/company/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function loginAdmin(email: string, password: string) {
  return safeFetch(`${API_BASE}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function verifyAdminOTP(email: string, code: string) {
  return safeFetch(`${API_BASE}/auth/admin/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
}

export async function getMe(token: string) {
  return safeFetch(`${API_BASE}/auth/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
}

export async function logout(token: string) {
  return safeFetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

// Staff Portal Endpoints
export async function getStaffCompanyParks(token: string) {
  return safeFetch(`${API_BASE}/staff/company-parks`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function getAvailableBuses(token: string) {
  return safeFetch(`${API_BASE}/staff/buses/available`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function getOutgoingBuses(token: string) {
  return safeFetch(`${API_BASE}/staff/buses/outgoing`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function getIncomingBuses(token: string) {
  return safeFetch(`${API_BASE}/staff/buses/incoming`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function createBus(token: string, data: { bus_number: string; destination_park: string; driver_phone: string; driver_name?: string }) {
  return safeFetch(`${API_BASE}/staff/buses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
}

export async function createWaybill(token: string, data: { sender_name: string; sender_phone: string; receiver_name: string; receiver_phone: string; item_description: string; bus_id: string; destination_park: string; waybill_fee?: number; shipping_fee?: number }) {
  return safeFetch(`${API_BASE}/staff/waybills`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
}

export async function departBus(token: string, busId: string) {
  return safeFetch(`${API_BASE}/staff/buses/${busId}/depart`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function arriveBus(token: string, busId: string) {
  return safeFetch(`${API_BASE}/staff/buses/${busId}/arrive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function verifyWaybillCode(token: string, waybillId: string, code: string) {
  return safeFetch(`${API_BASE}/staff/waybills/${waybillId}/verify-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ code })
  });
}

export async function collectWaybill(token: string, waybillId: string, verificationValue: string) {
  return safeFetch(`${API_BASE}/staff/waybills/${waybillId}/collect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ 
      receiver_phone: verificationValue,
      pickup_pin: verificationValue
    })
  });
}

export async function getUnassignedWaybills(token: string) {
  return safeFetch(`${API_BASE}/staff/waybills/unassigned`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function assignWaybillToBus(token: string, waybillId: string, busId: string) {
  return safeFetch(`${API_BASE}/staff/waybills/${waybillId}/assign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ bus_id: busId })
  });
}

export async function getStaffHistory(token: string) {
  return safeFetch(`${API_BASE}/staff/history`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

// Manager Portal & Management Endpoints
export async function checkManagerPhone(phoneNumber: string) {
  return safeFetch(`${API_BASE}/auth/manager/check-phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phoneNumber })
  });
}

export async function setManagerPin(phoneNumber: string, pin: string, confirmPin?: string) {
  return safeFetch(`${API_BASE}/auth/manager/set-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phoneNumber, pin, confirm_pin: confirmPin })
  });
}

export async function loginManager(phoneNumber: string, pin: string) {
  return safeFetch(`${API_BASE}/auth/manager/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phoneNumber, pin })
  });
}

export async function getCompanyManagers(token: string) {
  return safeFetch(`${API_BASE}/company/managers`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function createCompanyManager(token: string, data: { name: string; phone: string; park_id: string; pin?: string; service_mode?: string; manager_type?: string }) {
  return safeFetch(`${API_BASE}/company/managers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
}

export async function toggleCompanyManagerStatus(token: string, managerId: string) {
  return safeFetch(`${API_BASE}/company/managers/${managerId}/toggle-active`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function resetCompanyManagerPin(token: string, managerId: string) {
  return safeFetch(`${API_BASE}/company/managers/${managerId}/reset-pin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function deleteCompanyManager(token: string, managerId: string) {
  return safeFetch(`${API_BASE}/company/managers/${managerId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function getManagerOverview(token: string) {
  return safeFetch(`${API_BASE}/manager/overview`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function getManagerStaff(token: string) {
  return safeFetch(`${API_BASE}/manager/staff`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function createManagerStaff(token: string, data: { name: string; phone?: string }) {
  return safeFetch(`${API_BASE}/manager/staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
}

export async function toggleManagerStaffStatus(token: string, staffId: string) {
  return safeFetch(`${API_BASE}/manager/staff/${staffId}/toggle-active`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function resetManagerStaffPin(token: string, staffId: string) {
  return safeFetch(`${API_BASE}/manager/staff/${staffId}/reset-pin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function deleteManagerStaff(token: string, staffId: string) {
  return safeFetch(`${API_BASE}/manager/staff/${staffId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function getManagerWaybills(token: string) {
  return safeFetch(`${API_BASE}/manager/waybills`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function getAdminManagers(token: string) {
  return safeFetch(`${API_BASE}/admin/managers`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

// ---------------- FLEET API HELPERS ----------------

export async function getFleetTrips(token: string) {
  if (!token) return { success: true, trips: [] };
  return safeFetch(`${API_BASE}/fleet/trips`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function getFleetDrivers(token: string) {
  if (!token) return { success: true, drivers: [] };
  return safeFetch(`${API_BASE}/fleet/drivers`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function getFleetTrucks(token: string) {
  if (!token) return { success: true, trucks: [] };
  return safeFetch(`${API_BASE}/fleet/trucks`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function getFleetSuppliers(token: string) {
  if (!token) return { success: true, suppliers: [] };
  return safeFetch(`${API_BASE}/fleet/suppliers`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function getFleetSupplierStaff(token: string) {
  if (!token) return { success: true, supplier_staff: [] };
  return safeFetch(`${API_BASE}/fleet/supplier-staff`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function getFleetConfig(token: string) {
  if (!token) return { success: true, service_type: 'package' };
  return safeFetch(`${API_BASE}/fleet/config`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function getParks(token: string) {
  if (!token) return { success: true, parks: [] };
  return safeFetch(`${API_BASE}/parks`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function advanceTripCheckpoint(token: string, tripId: string, checkpoint: string) {
  return safeFetch(`${API_BASE}/fleet/trips/${tripId}/checkpoint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ checkpoint })
  });
}

export async function payTripFee(token: string, tripId: string, reference?: string) {
  return safeFetch(`${API_BASE}/fleet/trips/${tripId}/pay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ reference })
  });
}

export async function updateFleetConfig(token: string, serviceType: 'package' | 'parcel' | 'fleet' | 'both') {
  const normalized = serviceType === 'parcel' ? 'package' : serviceType;
  return safeFetch(`${API_BASE}/fleet/config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ service_type: normalized, service_mode: normalized })
  });
}

export async function createFleetTruck(token: string, data: {
  truck_number: string;
  park_id: string;
  billing_method: 'per_trip' | 'monthly';
  auto_renew?: boolean;
}) {
  return safeFetch(`${API_BASE}/fleet/trucks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
}

export async function createFleetSupplier(token: string, data: {
  name: string;
  full_name?: string;
  phone?: string;
  supplier_full_name?: string;
  supplier_phone_number?: string;
  contact_name?: string;
  contact_phone?: string;
}) {
  return safeFetch(`${API_BASE}/fleet/suppliers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
}

export async function createFleetDriver(token: string, data: {
  name: string;
  phone_number: string;
  pin?: string;
  truck_id: string;
  park_id?: string;
}) {
  return safeFetch(`${API_BASE}/fleet/drivers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
}

export async function createFleetSupplierStaff(token: string, data: {
  supplier_id: string;
  name: string;
  phone_number: string;
  pin?: string;
}) {
  return safeFetch(`${API_BASE}/fleet/supplier-staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
}

export async function resetFleetSupplierStaffPin(token: string, staffId: string, newPin?: string) {
  return safeFetch(`${API_BASE}/fleet/supplier-staff/${staffId}/reset-pin`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ new_pin: newPin || undefined })
  });
}

export async function updateFleetSupplierStaffStatus(token: string, staffId: string, status: string) {
  return safeFetch(`${API_BASE}/fleet/supplier-staff/${staffId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status })
  });
}

export async function resetFleetDriverPin(token: string, driverId: string, newPin?: string) {
  return safeFetch(`${API_BASE}/fleet/drivers/${driverId}/reset-pin`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ new_pin: newPin || undefined })
  });
}

export async function createFleetTrip(token: string, data: { truck_id: string; supplier_id: string; payment_reference?: string }) {
  return safeFetch(`${API_BASE}/fleet/trips`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
}

export async function initiateFleetTripPayment(token: string, data: { truck_id: string; supplier_id: string }) {
  return safeFetch(`${API_BASE}/fleet/payments/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
}

export async function verifyFleetPaymentSession(token: string, data: { reference: string }) {
  return safeFetch(`${API_BASE}/fleet/payments/verify-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
}

export async function subscribeFleetTruckMonthly(token: string, truckId: string, data: { auto_renew?: boolean; reference?: string }) {
  return safeFetch(`${API_BASE}/fleet/trucks/${truckId}/subscribe-monthly`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
}

export async function verifyFleetSubscriptionSession(token: string, data: { truck_id: string; reference: string }) {
  return safeFetch(`${API_BASE}/fleet/trucks/${data.truck_id}/verify-subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
}

export async function updateFleetTruckBilling(token: string, truckId: string, data: { billing_method: 'per_trip' | 'monthly'; auto_renew?: boolean }) {
  return safeFetch(`${API_BASE}/fleet/trucks/${truckId}/billing`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
}

export async function getSupplierStaffMyCompanies(token: string) {
  if (!token) return { success: true, companies: [] };
  return safeFetch(`${API_BASE}/fleet/supplier-staff/my-companies`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function checkSupplierStaffPhone(phoneNumber: string) {
  return safeFetch(`${API_BASE}/auth/supplier-staff/check-phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phoneNumber })
  });
}

export async function setSupplierStaffPin(phoneNumber: string, pin: string, confirmPin: string, companyId?: string) {
  return safeFetch(`${API_BASE}/auth/supplier-staff/set-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phoneNumber, pin, confirm_pin: confirmPin, company_id: companyId })
  });
}

export async function switchSupplierStaffCompany(token: string, targetCompanyId: string) {
  return safeFetch(`${API_BASE}/fleet/supplier-staff/switch-company`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ target_company_id: targetCompanyId })
  });
}

export async function changeDriverPin(token: string, currentPin: string, newPin: string) {
  return safeFetch(`${API_BASE}/auth/driver/change-pin`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ current_pin: currentPin, new_pin: newPin })
  });
}

export async function shareDriverLocation(token: string, tripId: string, data: { note?: string; source?: string }) {
  return safeFetch(`${API_BASE}/fleet/trips/${tripId}/share-location`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
}

export async function deleteFleetSupplier(token: string, supplierId: string) {
  return safeFetch(`${API_BASE}/fleet/suppliers/${supplierId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function deleteFleetTruck(token: string, truckId: string) {
  return safeFetch(`${API_BASE}/fleet/trucks/${truckId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function deleteFleetDriver(token: string, driverId: string) {
  return safeFetch(`${API_BASE}/fleet/drivers/${driverId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function deleteFleetSupplierStaff(token: string, staffId: string) {
  return safeFetch(`${API_BASE}/fleet/supplier-staff/${staffId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
}


