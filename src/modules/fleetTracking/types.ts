export interface GarageLocation {
  id?: string;
  company_id: string;
  address_text: string;
  lat: number | null;
  lng: number | null;
  location_confirmed: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
  updated_at?: string;
}

export interface SupplierLocation {
  id: string;
  company_id: string;
  name: string;
  address_text: string;
  lat: number | null;
  lng: number | null;
  location_confirmed: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ConfirmLocationPayload {
  lat: number;
  lng: number;
  confirmed_by?: string;
}
