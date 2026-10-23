// Core data model. Kept free of React and provider details so the same
// types can back a future native app or a server API.

export type LatLng = { lat: number; lng: number };

/** Where a fact came from. Shown to the rider next to the fact itself. */
export type DataSource =
  | 'osm-overpass'
  | 'osm-nominatim'
  | 'osrm-fossgis'
  | 'openrouteservice'
  | 'user'
  | 'map-pin';

export type StopCategory =
  | 'convenience'
  | 'sari-sari'
  | 'supermarket'
  | 'bakery'
  | 'restaurant'
  | 'cafe'
  | 'water'
  | 'toilets'
  | 'fuel'
  | 'bicycle'
  | 'pharmacy'
  | 'hospital'
  | 'clinic'
  | 'shelter'
  | 'police'
  | 'other';

/** How far we trust that a place exists and is usable as a stop. */
export type Verification =
  | 'osm-listed' // present in OpenStreetMap, not independently confirmed
  | 'user-unverified' // added by a rider, not yet checked
  | 'user-verified' // a rider has confirmed it in person
  | 'reported-closed'; // tags or a rider say it is closed

export type Endpoint = {
  label: string;
  address?: string;
  point: LatLng | null; // null until the rider confirms a specific place
  source?: DataSource;
  osmRef?: string;
};

export type Place = {
  id: string;
  name: string;
  /** True when OSM has no name and we display a generic label instead. */
  unnamed?: boolean;
  category: StopCategory;
  point: LatLng;
  address?: string;
  openingHours?: string;
  brand?: string;
  source: DataSource;
  osmRef?: string; // e.g. "node/123"
  verification: Verification;
  retrievedAt: string; // ISO timestamp the data was fetched or entered
  lastVerified?: string; // ISO date a rider confirmed it
  supplies?: string[];
  notes?: string;
  photo?: string; // small data URL, user-submitted only
  hasToilets?: boolean;
  hasDrinkingWater?: boolean;
};

export type Candidate = Place & {
  routeKm: number; // distance from start along the route to the nearest point
  offRouteM: number; // straight-line distance from the route
  detourKm: number; // estimated extra riding to visit and come back
  insideCorridor: boolean;
  score: number;
};

export type RouteStep = {
  instruction: string;
  distanceM: number;
  name?: string;
};

export type RouteResult = {
  id: string;
  provider: 'osrm-fossgis' | 'openrouteservice';
  providerLabel: string;
  profile: string;
  distanceM: number;
  /** Provider's own duration estimate. RideWise uses the group's pace instead. */
  providerDurationS?: number;
  coords: [number, number][]; // [lat, lng]
  ascentM?: number;
  descentM?: number;
  surfaceSummary?: Record<string, number>; // label -> share 0..1
  wayTypeSummary?: Record<string, number>;
  steps?: RouteStep[];
  retrievedAt: string;
};

export type StopKind = 'short' | 'rest' | 'meal' | 'regroup' | 'custom';
export type StopStatus = 'planned' | 'arrived' | 'completed' | 'skipped';

export type PlannedStop = {
  id: string;
  place: Candidate;
  kind: StopKind;
  durationMin: number;
  mandatory?: boolean;
  backup?: boolean;
  notes?: string;
  status: StopStatus;
  actualArrival?: string;
  actualDeparture?: string;
  suppliesReplenished?: boolean;
  checklistDone?: boolean;
  autoSuggested?: boolean;
};

export type RideStyle = 'relaxed' | 'moderate' | 'experienced';

export type PlanSettings = {
  speedKmh: number; // agreed group moving speed (slowest comfortable rider)
  maxRideMinBetweenStops: number;
  preferredStopIntervalKm: number;
  shortStopMin: number;
  restStopMin: number;
  mealStopMin: number;
  regroupMin: number;
  delayBufferPct: number; // extra time for traffic lights, hills, flats
  corridorM: number; // discovery radius each side of the route
  preferOnRoute: boolean;
  stopTypes: StopCategory[];
  lunchTime: string; // "12:00" local
  includeFuelStations: boolean;
};

export type GroupSettings = {
  name?: string;
  organizer?: string;
  riders: number;
  slowestComfortableKmh?: number;
  regroupEveryStop: boolean;
  supportVehicle: boolean;
  meetingPoint?: string;
  regroupProcedureAgreed: boolean;
  participants: { id: string; name: string }[];
};

export type BikeType = 'road' | 'gravel' | 'mountain' | 'hybrid' | 'touring' | 'other';

export type BikeProfile = {
  type: BikeType;
  tire?: string;
  tirePressureNote?: string; // from the tire/rim manufacturer, rider-entered
  spareTubes?: number;
  brakeType?: string;
  lights?: boolean;
  repairKit?: string;
  chainLubed?: boolean;
};

/** Private to this device. Never included in share links or sync payloads. */
export type RiderProfile = {
  displayName?: string;
  ageRange?: string;
  fitness?: 'building' | 'steady' | 'strong';
  comfortableKmh?: number;
  style: RideStyle;
  usualBreakMin?: number;
  dietary?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  medicalNotes?: string;
};

export type RidePlan = {
  id: string;
  name: string;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
  start: Endpoint;
  end: Endpoint;
  waypoints: Endpoint[];
  /** Local wall-clock departure, "YYYY-MM-DDTHH:mm", in plan.timeZone. */
  departureLocal: string;
  timeZone: string;
  settings: PlanSettings;
  route?: RouteResult;
  alternatives?: RouteResult[];
  candidates: Candidate[];
  candidatesRetrievedAt?: string;
  candidatesSource?: string;
  stops: PlannedStop[];
  group: GroupSettings;
  bike: BikeProfile;
  status: 'draft' | 'planned' | 'riding' | 'completed';
  notes?: string;
};

export type FatigueAnswer = 'good' | 'little-tired' | 'very-tired' | 'unwell' | 'pain' | 'unsafe';
export type FatigueStatus = 'ready' | 'consider-break' | 'rest-recommended' | 'stop-and-assess';

export type SupplyLevel = 'full' | 'half' | 'low' | 'empty' | 'unknown';

export type RideSession = {
  id: string;
  planId: string;
  state: 'riding' | 'paused' | 'at-stop' | 'safety-pause' | 'ended';
  startedAt: string;
  endedAt?: string;
  pauses: { start: string; end?: string; reason: 'stop' | 'manual' | 'safety' }[];
  checkins: { at: string; answer: FatigueAnswer }[];
  baseline?: FatigueAnswer;
  supplies: { water: SupplyLevel; food: SupplyLevel; electrolytes: SupplyLevel; updatedAt?: string };
  reminders: Record<string, { lastAck?: string; snoozedUntil?: string; disabled?: boolean }>;
  lastRideResumeAt?: string; // when riding last (re)started, for continuous-riding checks
  progressKm?: number;
  progressSource?: 'gps' | 'manual';
  gpsEnabled: boolean;
  notes?: string;
};

export type ChecklistKind = 'pre-ride' | 'pit-stop' | 'post-ride';
export type ChecklistItemState = 'todo' | 'ok' | 'problem';

export type ChecklistItem = {
  id: string;
  label: string;
  critical?: boolean; // brakes, steering, wheels, frame: do not ride if a problem
  custom?: boolean;
};

export type ChecklistRecord = {
  id: string;
  kind: ChecklistKind;
  planId?: string;
  stopId?: string;
  states: Record<string, ChecklistItemState>;
  updatedAt: string;
};
