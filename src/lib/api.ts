import { User } from '../types';

const API_BASE = '/api';

export async function loginCustomer(phoneNumber: string, pin: string) {
  const res = await fetch(`${API_BASE}/auth/customer/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phoneNumber, pin }),
  });
  return res.json();
}

export async function registerCustomer(phoneNumber: string, pin: string, confirmPin?: string) {
  const res = await fetch(`${API_BASE}/auth/customer/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phoneNumber, pin, confirm_pin: confirmPin }),
  });
  return res.json();
}

export async function requestCustomerPinReset(phoneNumber: string) {
  const res = await fetch(`${API_BASE}/auth/customer/forgot-pin/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phoneNumber }),
  });
  return res.json();
}

export async function resetCustomerPin(data: {
  phone_number: string;
  code: string;
  new_pin: string;
  confirm_pin: string;
}) {
  const res = await fetch(`${API_BASE}/auth/customer/forgot-pin/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function requestCompanyPasswordReset(ownerPhone: string) {
  const res = await fetch(`${API_BASE}/auth/company/forgot-password/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner_phone: ownerPhone }),
  });
  return res.json();
}

export async function resetCompanyPassword(data: {
  owner_phone: string;
  code: string;
  new_password: string;
  confirm_password: string;
}) {
  const res = await fetch(`${API_BASE}/auth/company/forgot-password/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function loginStaff(pin: string) {
  const res = await fetch(`${API_BASE}/auth/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  return res.json();
}

export async function loginCompany(phoneNumber: string, password: string) {
  try {
    const res = await fetch(`${API_BASE}/auth/company/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phoneNumber, password }),
    });
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Login failed." };
      }
      return { success: true, ...data };
    } else {
      const text = await res.text();
      return { success: false, error: `Server error (${res.status}): ${text.substring(0, 100) || "Unable to read response."}` };
    }
  } catch (err) {
    return { success: false, error: "Network error. Please check your internet connection and try again." };
  }
}

export async function registerCompany(data: {
  company_name: string;
  owner_phone: string;
  password: string;
  park_name: string;
  park_location: string;
}) {
  const res = await fetch(`${API_BASE}/auth/company/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function loginAdmin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function verifyAdminOTP(email: string, code: string) {
  const res = await fetch(`${API_BASE}/auth/admin/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  return res.json();
}

export async function getMe(token: string) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  return res.json();
}

export async function logout(token: string) {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    console.error('Logout request failed:', err);
  }
}

// Staff Portal Endpoints
export async function getStaffCompanyParks(token: string) {
  const res = await fetch(`${API_BASE}/staff/company-parks`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  return res.json();
}

export async function getAvailableBuses(token: string) {
  const res = await fetch(`${API_BASE}/staff/buses/available`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  return res.json();
}

export async function getOutgoingBuses(token: string) {
  const res = await fetch(`${API_BASE}/staff/buses/outgoing`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  return res.json();
}

export async function getIncomingBuses(token: string) {
  const res = await fetch(`${API_BASE}/staff/buses/incoming`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  return res.json();
}

export async function createBus(token: string, data: { bus_number: string; destination_park: string; driver_phone: string; driver_name?: string }) {
  const res = await fetch(`${API_BASE}/staff/buses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function createWaybill(token: string, data: { sender_name: string; sender_phone: string; receiver_name: string; receiver_phone: string; item_description: string; bus_id: string; destination_park: string; waybill_fee?: number }) {
  const res = await fetch(`${API_BASE}/staff/waybills`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function departBus(token: string, busId: string) {
  const res = await fetch(`${API_BASE}/staff/buses/${busId}/depart`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  return res.json();
}

export async function arriveBus(token: string, busId: string) {
  const res = await fetch(`${API_BASE}/staff/buses/${busId}/arrive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  return res.json();
}

export async function verifyWaybillCode(token: string, waybillId: string, code: string) {
  const res = await fetch(`${API_BASE}/staff/waybills/${waybillId}/verify-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ code })
  });
  return res.json();
}

export async function collectWaybill(token: string, waybillId: string, verificationValue: string) {
  const res = await fetch(`${API_BASE}/staff/waybills/${waybillId}/collect`, {
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
  return res.json();
}

export async function getUnassignedWaybills(token: string) {
  const res = await fetch(`${API_BASE}/staff/waybills/unassigned`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  return res.json();
}

export async function assignWaybillToBus(token: string, waybillId: string, busId: string) {
  const res = await fetch(`${API_BASE}/staff/waybills/${waybillId}/assign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ bus_id: busId })
  });
  return res.json();
}

export async function getStaffHistory(token: string) {
  const res = await fetch(`${API_BASE}/staff/history`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  return res.json();
}
