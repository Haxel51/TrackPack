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
export async function getGoogleMapsConfig(): Promise<{ success: boolean; apiKey: string }> {
  try {
    const res = await fetch(`${API_BASE}/google-maps-config`);
    return await res.json();
  } catch (err: any) {
    return { success: false, apiKey: '' };
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


