export interface GarageLocation {
  id?: string;
  company_id: string;
  address_text: string;
  lat: number | null;
  lng: number | null;
  location_confirmed: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
  geofence_radius?: number; // in meters (default: 150m)
  updated_at?: string;
}

export interface SupplierLocation {
  id: string;
  company_id: string;
  name: string;
  address_text: string;
  category?: 'petroleum' | 'port' | 'factory' | 'warehouse' | 'agriculture' | 'transit' | 'general' | string;
  geofence_radius?: number; // in meters (default: 150m)
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

export type AssetCategory =
  | 'heavy_truck'
  | 'fuel_tanker'
  | 'commercial_bus'
  | 'delivery_van'
  | 'construction_equipment'
  | 'utility_vehicle'
  | 'other';

export type TrackerModelType =
  | 'tk905'
  | 'sinotrack_st905'
  | 'micodus'
  | 'gf07'
  | 'teltonika'
  | 'satellite_globalstar'
  | 'custom';

export interface TruckProfile {
  id: string;
  company_id: string;
  plate_number: string;
  asset_type?: AssetCategory;
  asset_name?: string;
  tracker_id?: string; // IMEI, ESN, or Serial ID
  tracker_model?: TrackerModelType | string;
  tracker_battery_level?: number; // 0 - 100%
  tracker_last_ping?: string;
  tracker_tamper_alarm?: boolean;
  tracker_status?: 'online' | 'standby' | 'offline' | 'tampered';
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
  is_driver_online?: boolean;
  driver_connection_status?: 'online' | 'offline';
  driver_last_seen?: string;
  driver_last_ping_at?: string;
  driver_last_ping_seconds_ago?: number | null;
  created_at: string;
  created_by: string;
  updated_at?: string;
}

export interface CreateTruckPayload {
  plate_number: string;
  asset_type?: AssetCategory;
  asset_name?: string;
  tracker_id?: string;
  tracker_model?: TrackerModelType | string;
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

export interface ProofOfDeliveryRecord {
  pod_reference: string;
  delivered_at: string;
  signed_by_name: string;
  signed_by_phone?: string;
  discharged_quantity?: string;
  seal_intact: boolean;
  seal_notes?: string;
  delivery_remarks?: string;
  verified_by: string;
}

export interface DepartureChecklist {
  waybill_handed: boolean;
  seal_verified: boolean;
  driver_data_online: boolean;
  officer_name?: string;
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
  cargo_type?: string;
  cargo_description?: string;
  waybill_number?: string;
  cargo_quantity?: string;
  seal_number?: string;
  customer_contact_name?: string;
  customer_contact_phone?: string;
  gate_pass_code?: string | null;
  departure_checklist?: DepartureChecklist | null;
  pod_record?: ProofOfDeliveryRecord | null;
  departed_at?: string | null;
  completed_at?: string | null;
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
  gps_signal_status?: 'normal' | 'weak' | 'lost_30min' | 'lost_60min' | 'data_disconnected';
  gps_lost_30min_sent?: boolean;
  gps_lost_60min_sent?: boolean;
  gps_loss_dismissed?: boolean;
  data_disconnected?: boolean;
  connection_status?: 'online' | 'data_disconnected';
  data_disconnected_alert_sent?: boolean;
  location_history?: Array<{
    lat: number;
    lng: number;
    timestamp: string;
  }>;
  created_by: string;
  created_at: string;
  garage_lat: number | null;
  garage_lng: number | null;
  estimated_arrival_time?: string | null;
  estimated_duration_text?: string | null;
  remaining_distance_km?: number | null;
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

