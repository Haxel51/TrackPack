import { GarageLocation, SupplierLocation, ConfirmLocationPayload } from './types';

const API_BASE = '/api/fleet-tracking';

const getHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const activeToken =
    token ||
    localStorage.getItem('token') ||
    localStorage.getItem('company_token') ||
    localStorage.getItem('manager_token') ||
    localStorage.getItem('staff_token') ||
    sessionStorage.getItem('token') ||
    '';
  if (activeToken) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  }
  return headers;
};

// 1. Get Company Garage Location
export async function getGarageLocation(token: string): Promise<{ success: boolean; garage: GarageLocation | null; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/garage`, {
      headers: getHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, garage: null, error: data.error || `HTTP ${res.status}: Failed to fetch garage location` };
    }
    return data;
  } catch (err: any) {
    return { success: false, garage: null, error: err?.message || 'Network error fetching garage' };
  }
}

// 2. Save / Update Garage Location Address
export async function saveGarageLocation(
  token: string,
  payload: { address_text: string; lat?: number | null; lng?: number | null }
): Promise<{ success: boolean; garage?: GarageLocation; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/garage`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to save garage location` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error saving garage' };
  }
}

// 3. Confirm Garage Location Coordinates
export async function confirmGarageLocation(
  token: string,
  payload: ConfirmLocationPayload
): Promise<{ success: boolean; garage?: GarageLocation; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/garage/confirm`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to confirm garage location` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error confirming garage location' };
  }
}

// 4. Get All Suppliers
export async function getSupplierLocations(token: string): Promise<{ success: boolean; suppliers: SupplierLocation[]; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/suppliers`, {
      headers: getHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, suppliers: [], error: data.error || `HTTP ${res.status}: Failed to fetch suppliers` };
    }
    return data;
  } catch (err: any) {
    return { success: false, suppliers: [], error: err?.message || 'Network error fetching suppliers' };
  }
}

// 5. Create Supplier Location
export async function createSupplierLocation(
  token: string,
  payload: { name: string; address_text: string; lat?: number | null; lng?: number | null }
): Promise<{ success: boolean; supplier?: SupplierLocation; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/suppliers`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to create supplier` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error creating supplier' };
  }
}

// 6. Update Supplier Location
export async function updateSupplierLocation(
  token: string,
  supplierId: string,
  payload: { name?: string; address_text?: string; lat?: number | null; lng?: number | null }
): Promise<{ success: boolean; supplier?: SupplierLocation; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/suppliers/${supplierId}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to update supplier` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error updating supplier' };
  }
}

// 7. Confirm Supplier Coordinates
export async function confirmSupplierLocation(
  token: string,
  supplierId: string,
  payload: ConfirmLocationPayload
): Promise<{ success: boolean; supplier?: SupplierLocation; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/suppliers/${supplierId}/confirm`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to confirm supplier location` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error confirming supplier location' };
  }
}

// 8. Delete Supplier Location
export async function deleteSupplierLocation(
  token: string,
  supplierId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/suppliers/${supplierId}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to delete supplier` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error deleting supplier' };
  }
}

// 9. Fetch Google Maps API Configuration
export async function getGoogleMapsConfig(): Promise<{ success: boolean; apiKey: string; source?: string }> {
  try {
    const res = await fetch(`${API_BASE}/google-maps-config`);
    const data = await res.json().catch(() => ({ success: false, apiKey: '' }));
    return data || { success: false, apiKey: '' };
  } catch (err: any) {
    return { success: false, apiKey: '' };
  }
}

// 9b. Save Google Maps API Configuration
export async function saveGoogleMapsConfig(
  token: string,
  apiKey: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/google-maps-config`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ apiKey }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to save Google Maps key` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error saving Google Maps key' };
  }
}

// 10. Server-side Geocode & Location Search
export async function searchLocationGeocode(
  query: string
): Promise<{ success: boolean; results?: Array<{ id: string; name: string; lat: number; lng: number }> }> {
  try {
    const res = await fetch(`${API_BASE}/geocode?query=${encodeURIComponent(query)}`);
    const data = await res.json().catch(() => ({ success: false, results: [] }));
    return data || { success: false, results: [] };
  } catch (err: any) {
    return { success: false, results: [] };
  }
}

// 11. Get All Truck Profiles
export async function getTruckProfiles(token: string): Promise<{ success: boolean; trucks: any[]; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/trucks`, {
      headers: getHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, trucks: [], error: data.error || `HTTP ${res.status}: Failed to fetch trucks` };
    }
    return data;
  } catch (err: any) {
    return { success: false, trucks: [], error: err?.message || 'Network error fetching trucks' };
  }
}

// 12. Create Truck Profile
export async function createTruckProfile(
  token: string,
  payload: { plate_number: string; driver_name: string; driver_phone: string; payment_plan?: 'per_trip' | 'monthly' }
): Promise<{ success: boolean; truck?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/trucks`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to create truck profile` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error creating truck profile' };
  }
}

// 13. Update Truck Profile
export async function updateTruckProfile(
  token: string,
  truckId: string,
  payload: { plate_number?: string; driver_name?: string; driver_phone?: string; payment_plan?: 'per_trip' | 'monthly' }
): Promise<{ success: boolean; truck?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/trucks/${truckId}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to update truck profile` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error updating truck profile' };
  }
}

// 14. Change Truck Payment Plan
export async function changeTruckPaymentPlan(
  token: string,
  truckId: string,
  payment_plan: 'per_trip' | 'monthly'
): Promise<{ success: boolean; truck?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/trucks/${truckId}/payment-plan`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify({ payment_plan }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to change payment plan` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error changing payment plan' };
  }
}

// 15. Delete Truck Profile
export async function deleteTruckProfile(
  token: string,
  truckId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/trucks/${truckId}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to delete truck profile` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error deleting truck profile' };
  }
}

// 16. Get All Trips
export async function getTrips(token: string): Promise<{ success: boolean; trips: any[]; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/trips`, {
      headers: getHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, trips: [], error: data.error || `HTTP ${res.status}: Failed to fetch trips` };
    }
    return data;
  } catch (err: any) {
    return { success: false, trips: [], error: err?.message || 'Network error fetching trips' };
  }
}

// 17. Create Trip
export async function createTrip(
  token: string,
  payload: { truck_id: string; supplier_id: string }
): Promise<{ success: boolean; trip?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/trips`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to create trip` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error creating trip' };
  }
}

// 18. Redirect Trip
export async function redirectTrip(
  token: string,
  tripId: string,
  payload: {
    type: 'saved_customer' | 'manual';
    customer_id?: string;
    name: string;
    address: string;
    lat?: number | null;
    lng?: number | null;
    save_as_new_customer?: boolean;
  }
): Promise<{ success: boolean; trip?: any; message?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/trips/${tripId}/redirect`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to redirect trip` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error redirecting trip' };
  }
}

// 19. Get Saved Customer Destinations
export async function getSavedCustomers(token: string): Promise<{ success: boolean; customers: any[]; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/customers`, {
      headers: getHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, customers: [], error: data.error || `HTTP ${res.status}: Failed to fetch saved customers` };
    }
    return data;
  } catch (err: any) {
    return { success: false, customers: [], error: err?.message || 'Network error fetching saved customers' };
  }
}

// 20. Create Saved Customer Destination
export async function createSavedCustomer(
  token: string,
  payload: { name: string; address_text: string; lat?: number | null; lng?: number | null }
): Promise<{ success: boolean; customer?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to create saved customer` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error creating saved customer' };
  }
}

// 21. Manual Trip Status Update (Departed, Loaded, Completed, etc.)
export async function updateTripStatus(
  token: string,
  tripId: string,
  status: string,
  note?: string
): Promise<{ success: boolean; trip?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/trips/${tripId}/status`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify({ status, note }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to update trip status` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error updating trip status' };
  }
}

// 22. Driver GPS Location Update (Triggers automatic state machine evaluation)
export async function updateTripGpsLocation(
  token: string,
  tripId: string,
  lat: number,
  lng: number
): Promise<{ success: boolean; trip?: any; status_changed?: boolean; new_status?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/trips/${tripId}/gps`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ lat, lng }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to send GPS location update` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error updating GPS location' };
  }
}

export async function updateTripGps(
  token: string,
  tripId: string,
  payload: { lat: number; lng: number }
): Promise<{ success: boolean; trip?: any; status_changed?: boolean; new_status?: string; error?: string }> {
  return updateTripGpsLocation(token, tripId, payload.lat, payload.lng);
}

// 23. Acknowledge Stopped Alert / Warning
export async function acknowledgeStoppedAlert(
  token: string,
  tripId: string
): Promise<{ success: boolean; trip?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/trips/${tripId}/acknowledge-stopped`, {
      method: 'POST',
      headers: getHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to acknowledge stopped alert` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error acknowledging alert' };
  }
}

// 24. Initialize Trip Payment
export async function initializeTripPayment(
  token: string,
  tripId: string,
  payment_type: 'per_trip' | 'monthly'
): Promise<{ success: boolean; reference?: string; checkout_url?: string; amount?: number; payment_plan?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/trips/${tripId}/payment/initialize`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ payment_type }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to initialize payment` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error initializing payment' };
  }
}

// 25. Verify Trip Payment
export async function verifyTripPayment(
  token: string,
  tripId: string,
  reference: string,
  payment_type: 'per_trip' | 'monthly'
): Promise<{ success: boolean; trip?: any; message?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/trips/${tripId}/payment/verify`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ reference, payment_type }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to verify payment` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error verifying payment' };
  }
}

// 26. Initialize Trip Creation Payment
export async function initializeTripCreationPayment(
  token: string,
  truck_id: string,
  supplier_id: string,
  payment_type: 'per_trip' | 'monthly'
): Promise<{ success: boolean; requires_payment?: boolean; reference?: string; checkout_url?: string; amount?: number; payment_plan?: string; message?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/trips/initialize-payment`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ truck_id, supplier_id, payment_type }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to initialize trip payment` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error initializing trip payment' };
  }
}

// 27. Verify Payment and Create Trip
export async function verifyTripPaymentAndCreate(
  token: string,
  truck_id: string,
  supplier_id: string,
  payment_type: 'per_trip' | 'monthly',
  reference: string
): Promise<{ success: boolean; trip?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/trips/verify-and-create`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ truck_id, supplier_id, payment_type, reference }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to verify payment and create trip` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error verifying payment' };
  }
}

// 28. Create Trip Directly (Monthly Active)
export async function createTripDirectly(
  token: string,
  truck_id: string,
  supplier_id: string
): Promise<{ success: boolean; trip?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/trips/create-direct`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ truck_id, supplier_id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to create trip` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error creating trip' };
  }
}

// 29. Get Payment History
export async function getPaymentHistory(
  token: string
): Promise<{ success: boolean; payments?: any[]; total_collected?: number; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/payments/history`, {
      method: 'GET',
      headers: getHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to fetch payment history` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error fetching payment history' };
  }
}

// 30. Get Driver Active Trip (for Driver GPS Background Tracking)
export async function getDriverActiveTrip(
  token: string
): Promise<{ success: boolean; trip?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/driver-active-trip`, {
      method: 'GET',
      headers: getHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to fetch active trip` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error fetching active trip' };
  }
}

// 31. Keep Trip Open (Dismiss 60min GPS Loss Alert)
export async function keepTripOpen(
  token: string,
  tripId: string
): Promise<{ success: boolean; trip?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/trips/${tripId}/keep-open`, {
      method: 'POST',
      headers: getHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to dismiss alert` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error dismissing alert' };
  }
}

// 32. End Trip Manually (Manager / CEO)
export async function endTripManually(
  token: string,
  tripId: string,
  reason?: string
): Promise<{ success: boolean; trip?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/trips/${tripId}/end-manually`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to end trip` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error ending trip' };
  }
}

// 33. Get Subscription Alerts & Reminders
export async function getSubscriptionAlerts(
  token: string
): Promise<{ success: boolean; alerts?: any[]; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/subscription-alerts`, {
      method: 'GET',
      headers: getHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${res.status}: Failed to fetch subscription alerts` };
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error fetching alerts' };
  }
}

// 34. Get Fleet Notifications
export async function getFleetNotifications(
  token?: string
): Promise<{ success: boolean; notifications: any[]; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/notifications`, {
      method: 'GET',
      headers: getHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return { success: false, notifications: [], error: data.error || `HTTP ${res.status}: Failed to fetch notifications` };
    }
    return { success: true, notifications: Array.isArray(data.notifications) ? data.notifications : [] };
  } catch (err: any) {
    return { success: false, notifications: [], error: err?.message || 'Network error fetching notifications' };
  }
}

// 35. Mark Notification As Read
export async function markNotificationAsRead(
  id: string,
  token?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    return { success: res.ok && data.success !== false };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

// 36. Mark All Notifications As Read
export async function markAllNotificationsAsRead(
  token?: string,
  ids?: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ ids }),
    });
    const data = await res.json().catch(() => ({}));
    return { success: res.ok && data.success !== false };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

// 37. Send Driver Daily Heartbeat
export async function sendDriverHeartbeat(
  payload: {
    driverId: string;
    locationPermission: string;
    deviceId: string;
    deviceInfo: any;
    driverName?: string;
    driverPhone?: string;
    companyId?: string;
  },
  token?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/fleet-tracking/driver/heartbeat', {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { success: res.ok && data.success !== false, error: data.error };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

// 38. Check Driver Reinstall on Login
export async function checkDriverReinstall(
  payload: {
    driverId: string;
    deviceId: string;
    deviceInfo: any;
    driverData?: any;
  },
  token?: string
): Promise<{ success: boolean; isFirstLogin?: boolean; isReinstall?: boolean; reinstallCount?: number; error?: string }> {
  try {
    const res = await fetch('/api/fleet-tracking/driver/check-reinstall', {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { success: res.ok && data.success !== false, ...data };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

// 39. Trigger Heartbeat Audit Check
export async function triggerHeartbeatAudit(
  token?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/fleet-tracking/cron/check-driver-heartbeats', {
      method: 'GET',
      headers: getHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    return { success: res.ok && data.success !== false, error: data.error };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}






