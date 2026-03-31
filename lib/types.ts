export type ShipmentStatus =
  | 'pending'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'delayed'
  | 'exception';

export type CarrierStatus = 'unassigned' | 'pending' | 'accepted' | 'rejected';

export interface Shipment {
  id: string;
  tracking_number: string;
  status: ShipmentStatus;
  carrier_status: CarrierStatus;
  carrier_rate: number | null;
  carrier_notes: string | null;
  origin_address: string;
  origin_city: string;
  origin_state: string;
  origin_country: string;
  origin_zip: string | null;
  origin_contact_name: string | null;
  origin_contact_phone: string | null;
  destination_address: string;
  destination_city: string;
  destination_state: string;
  destination_country: string;
  destination_zip: string | null;
  destination_contact_name: string | null;
  destination_contact_phone: string | null;
  distance_miles: number | null;
  total_price: number | null;
  transport_type: string;
  is_expedited: boolean;
  is_cross_border: boolean;
  scheduled_pickup: string | null;
  estimated_delivery: string | null;
  notes: string | null;
  vehicles?: Vehicle[];
}

export interface Vehicle {
  id: string;
  shipment_id: string;
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  color: string | null;
  condition: string;
  is_operable: boolean;
  status: string;
  photos?: any;
}

export interface CarrierUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  company_name: string | null;
  mc_number: string | null;
  dot_number: string | null;
  fmcsa_status: string;
  is_verified: boolean;
  profile_photo_url: string | null;
  // Route profile fields
  home_base_city: string | null;
  home_base_state: string | null;
  home_base_lat: number | null;
  home_base_lng: number | null;
  preferred_corridors: Array<{ origin_state: string; destination_state: string }> | null;
  max_deadhead_miles: number | null;
  next_available_location_city: string | null;
  next_available_location_state: string | null;
  next_available_location_lat: number | null;
  next_available_location_lng: number | null;
  next_available_at: string | null;
  // GPS
  current_lat: number | null;
  current_lng: number | null;
}

export interface RouteMatch extends Shipment {
  pickup_detour_miles: number;
  delivery_detour_miles: number;
  total_detour: number;
  deadhead_score: 'green' | 'yellow' | 'red';
}

export interface CarrierLoadToken {
  id: string;
  token: string;
  shipment_id: string;
  carrier_user_id: string;
  is_active: boolean;
  expires_at: string;
}

export interface ShipmentEvent {
  id: string;
  shipment_id: string;
  event_type: string;
  description: string;
  location: string | null;
  event_time: string;
}
