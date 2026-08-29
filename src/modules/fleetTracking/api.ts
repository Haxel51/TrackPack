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
    return await res.json();
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
    return await res.json();
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




