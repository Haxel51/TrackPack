export interface User {
  id?: string;
  phone_number?: string;
  email?: string;
  name?: string;
  company_name?: string;
  company_id?: string;
  park_location?: string;
  approved?: boolean;
  active?: boolean;
}

export interface AuthState {
  token: string | null;
  user: User | null;
  role: 'customer' | 'company' | 'staff' | 'admin' | null;
}

export interface Bus {
  id: string;
  bus_number: string;
  origin_park: string;
  destination_park: string;
  company_id: string;
  driver_name: string | null;
  driver_phone: string;
  status: 'loading' | 'departed' | 'arrived';
  departed_at: string | null;
  arrived_at: string | null;
  created_by_staff_id: string;
  created_at: string;
  waybills?: Waybill[];
}

export interface Waybill {
  id: string;
  tracking_code: string;
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  item_description: string;
  bus_id: string;
  bus_number: string;
  origin_park: string;
  destination_park: string;
  company_id: string;
  status: 'booked' | 'in_transit' | 'arrived' | 'collected';
  tracking_active: boolean;
  booked_at: string;
  departed_at: string | null;
  arrived_at: string | null;
  collected_at: string | null;
  collected_by: string | null;
  created_at: string;
}
