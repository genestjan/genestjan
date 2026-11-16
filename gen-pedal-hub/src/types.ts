export type Point = { t: number; lat: number; lon: number; alt: number | null };

export type Ride = {
  id: string;
  title: string;
  startedAt: number;
  endedAt: number;
  distanceM: number;
  movingMs: number;
  elapsedMs: number;
  elevGainM: number;
  maxSpeedMs: number;
  bikeId: string | null;
};

export type CheckKey = 'chain' | 'tyres' | 'service';

export type Bike = {
  id: string;
  name: string;
  kind: string;
  /** Distance in km already on the bike when it was added. */
  startKm: number;
  /** Bike odometer (km) when each check was last done. */
  doneAtKm: Record<CheckKey, number>;
  /** Repairs and services the rider wrote down. */
  log: ServiceEntry[];
};

export type ServiceEntry = { id: string; at: number; note: string; cost: number };

export type Units = 'km' | 'mi';

export type Profile = {
  onboarded: boolean;
  name: string;
  level: string;
  bikeKind: string;
  weeklyGoalKm: number;
  units: Units;
  emergencyName: string;
  emergencyPhone: string;
  /** Body weight, used only to estimate calories. */
  weightKg: number;
  monthlyGoalKm: number;
  /** Minutes between drink reminders during a ride. 0 switches them off. */
  drinkEveryMin: number;
  restDayReminders: boolean;
  city: string;
};

/** The training plan the rider is following, if any. */
export type TrainingState = {
  planId: string | null;
  /** Start of the day the plan began (local time, ms). */
  startedAt: number;
  /** Day numbers (0 = first day of the plan) ticked off by hand. */
  done: Record<number, boolean>;
};

/** A route kept on this phone to ride again. Its points are stored separately. */
export type SavedRoute = {
  id: string;
  name: string;
  distanceM: number;
  elevGainM: number;
  createdAt: number;
  startLat: number;
  startLon: number;
};
