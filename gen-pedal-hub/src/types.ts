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
};

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
};
