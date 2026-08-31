import { User } from '../types';

const API_BASE = '/api';

async function safeFetch(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await res.json().catch(() => ({}));
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

export async function registerFleetUser(phoneNumber: string, password: string, confirmPassword?: string, requestedRole?: string) {
  return safeFetch(`${API_BASE}/auth/fleet/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone_number: phoneNumber,
      password,
      confirm_password: confirmPassword,
      requested_role: requestedRole
    }),
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

export async function getCustomerWaybills(token: string) {
  return safeFetch(`${API_BASE}/customer/waybills`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function confirmCustomerWaybillReceived(token: string, waybillId: string) {
  return safeFetch(`${API_BASE}/customer/waybills/${waybillId}/confirm-received`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
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
export async function checkManagerPhone(phoneNumber: string, requestedRole?: string) {
  return safeFetch(`${API_BASE}/auth/manager/check-phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phoneNumber, requested_role: requestedRole })
  });
}

export async function setManagerPin(phoneNumber: string, pin: string, confirmPin?: string, requestedRole?: string) {
  return safeFetch(`${API_BASE}/auth/manager/set-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phoneNumber, pin, confirm_pin: confirmPin, requested_role: requestedRole })
  });
}

export async function loginManager(phoneNumber: string, pin: string, requestedRole?: string) {
  return safeFetch(`${API_BASE}/auth/manager/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phoneNumber, pin, requested_role: requestedRole })
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

export async function getTeamMembers(token: string) {
  return safeFetch(`${API_BASE}/company/team`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function createTeamMember(token: string, data: { name: string; phone: string; role: 'manager' | 'trip_monitor' | 'driver'; truck_id?: string; park_id?: string }) {
  return safeFetch(`${API_BASE}/company/team`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
}

export async function toggleTeamMemberActive(token: string, memberId: string) {
  return safeFetch(`${API_BASE}/company/team/${memberId}/toggle-active`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function resetTeamMemberPin(token: string, memberId: string) {
  return safeFetch(`${API_BASE}/company/team/${memberId}/reset-pin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function deleteTeamMember(token: string, memberId: string) {
  return safeFetch(`${API_BASE}/company/team/${memberId}`, {
    method: 'DELETE',
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

export async function updateCompanyManagerRole(token: string, managerId: string, serviceMode: 'haulage' | 'parcel' | 'both') {
  return safeFetch(`${API_BASE}/company/managers/${managerId}/update-role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ service_mode: serviceMode, manager_type: serviceMode })
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

export async function getParks(token: string) {
  if (!token) return { success: true, parks: [] };
  return safeFetch(`${API_BASE}/parks`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export async function getTrucks(token: string) {
  if (!token) return { success: true, trucks: [] };
  return safeFetch(`${API_BASE}/fleet-tracking/trucks`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}





