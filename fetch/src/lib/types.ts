export type Role = 'customer' | 'driver';
export type LatLng = { lat: number; lng: number };

export type VehicleType = 'motorcycle' | 'tricycle' | 'car' | 'van';

export interface Profile {
  id: string;
  role: Role;
  email: string;
  fullName: string;
  phone: string;
  idType: string;
  idPhoto: string; // data URL (demo) or storage path (Supabase)
  selfie: string;
  verified: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

export interface Rates {
  base: number; // pesos, flag-down
  perKm: number;
  perMin: number;
  minimum: number;
}

export interface Driver {
  id: string; // same as profile id
  fullName: string;
  phone: string;
  vehicleType: VehicleType;
  make: string;
  model: string;
  color: string;
  plate: string;
  vehiclePhoto: string;
  rates: Rates;
  gcash: string; // GCash number for direct payment
  bank: string; // bank + account for transfers
  online: boolean;
  location: LatLng | null;
  rating: number;
  ratingCount: number;
  updatedAt: number;
}

export type ServiceType = 'ride' | 'pabili' | 'delivery';
export type PayMethod = 'cash' | 'gcash' | 'bank';
export type TripStatus =
  | 'requested' // customer sent request to a chosen driver
  | 'negotiating' // driver countered / chatting about price
  | 'agreed' // both agreed, driver on the way
  | 'arrived'
  | 'ongoing' // meter running
  | 'completed'
  | 'cancelled';

export interface Trip {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  driverId: string;
  service: ServiceType;
  pickup: LatLng;
  pickupLabel: string;
  dropoff: LatLng;
  dropoffLabel: string;
  items: string; // pabili list or parcel description
  budget: number; // pabili budget for items
  itemsCost: number; // actual amount the driver paid for pabili items
  notes: string;
  estKm: number;
  estMin: number;
  estFare: number;
  offer: number; // agreed or proposed fare
  offerBy: Role;
  useMeter: boolean;
  meterStart: number; // when the meter started (ms)
  meterKm: number;
  meterMin: number;
  meterFare: number;
  discount: number;
  pointsUsed: number;
  tip: number;
  finalFare: number;
  payMethod: PayMethod;
  payRef: string;
  paid: boolean;
  status: TripStatus;
  customerLoc: LatLng | null;
  driverLoc: LatLng | null;
  ratingByCustomer: number;
  commentByCustomer: string;
  ratingByDriver: number;
  commentByDriver: string;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  tripId: string;
  from: Role;
  text: string;
  at: number;
}

export interface Wallet {
  id: string; // customer id
  points: number;
  completedTrips: number;
}
