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

export interface TruckProfile {
  id: string;
  company_id: string;
  plate_number: string;
  driver_name: string;
  driver_phone: string;
  payment_plan: 'per_trip' | 'monthly';
  subscription_active_until: string | null;
  subscription_history?: Array<{
    action: string;
    renewed_by: string;
    renewed_at: string;
    valid_until: string;
    note?: string;
  }>;
  last_reminder_key?: string;
  last_reminder_sent_at?: string;
  created_at: string;
  created_by: string;
  updated_at?: string;
}

export interface CreateTruckPayload {
  plate_number: string;
  driver_name: string;
  driver_phone: string;
  payment_plan?: 'per_trip' | 'monthly';
}

export interface TripRedirectDestination {
  type: 'saved_customer' | 'manual';
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

export interface TripStatusHistoryEntry {
  status: string;
  triggered_by: string;
  triggered_at: string;
  note?: string;
}

export interface TripRecord {
  id: string;
  company_id: string;
  truck_id: string;
  plate_number: string;
  driver_name: string;
  driver_phone: string;
  primary_destination_type: 'supplier';
  primary_destination_id: string;
  primary_destination_name: string;
  primary_destination_lat: number | null;
  primary_destination_lng: number | null;
  redirect_destination: TripRedirectDestination | null;
  payment_plan: 'per_trip' | 'monthly';
  payment_status: 'pending' | 'confirmed';
  payment_amount: number;
  payment_reference?: string | null;
  payment_date?: string | null;
  paid_by?: string | null;
  tracking_active?: boolean;
  trip_status:
    | 'created'
    | 'payment_confirmed'
    | 'departed'
    | 'in_progress'
    | 'arrived_at_supplier'
    | 'loaded'
    | 'stopped_warning'
    | 'stopped_alert'
    | 'stopped'
    | 'arrived_at_destination'
    | 'returning'
    | 'completed'
    | 'cancelled'
    | string;
  status_history?: TripStatusHistoryEntry[];
  last_known_lat?: number | null;
  last_known_lng?: number | null;
  last_movement_at?: string | null;
  stopped_warning_sent?: boolean;
  stopped_alert_sent?: boolean;
  stopped_acknowledged?: boolean;
  gps_signal_status?: 'normal' | 'weak' | 'lost_30min' | 'lost_60min';
  gps_lost_30min_sent?: boolean;
  gps_lost_60min_sent?: boolean;
  gps_loss_dismissed?: boolean;
  location_history?: Array<{
    lat: number;
    lng: number;
    timestamp: string;
  }>;
  created_by: string;
  created_at: string;
  garage_lat: number | null;
  garage_lng: number | null;
}

export interface SavedCustomer {
  id: string;
  company_id: string;
  name: string;
  address_text: string;
  lat: number | null;
  lng: number | null;
  created_at: string;
  created_by: string;
}

export interface CreateTripPayload {
  truck_id: string;
  supplier_id: string;
}

export interface RedirectTripPayload {
  type: 'saved_customer' | 'manual';
  customer_id?: string;
  name: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
  save_as_new_customer?: boolean;
}

