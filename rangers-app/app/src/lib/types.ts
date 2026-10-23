export type FormatId = '4v4' | '5v5' | 'futsal' | '7v7' | '8v8' | '9v9' | '11v11';

export interface Player {
  id: string;
  firstName: string;
  number?: number;
  gkWilling: boolean;
}

export interface FormatSpec {
  id: FormatId;
  label: string;
  slots: number;
  hasKeeper: boolean;
  length: number; // metres
  width: number;
}

export const FORMATS: Record<FormatId, FormatSpec> = {
  '4v4': { id: '4v4', label: '4v4 (no keepers)', slots: 4, hasKeeper: false, length: 30, width: 20 },
  '5v5': { id: '5v5', label: '5v5 with keepers', slots: 5, hasKeeper: true, length: 30, width: 20 },
  futsal: { id: 'futsal', label: 'Futsal 5-a-side', slots: 5, hasKeeper: true, length: 40, width: 20 },
  '7v7': { id: '7v7', label: '7v7', slots: 7, hasKeeper: true, length: 55, width: 37 },
  '8v8': { id: '8v8', label: '8v8 (PFF standard to U13)', slots: 8, hasKeeper: true, length: 64, width: 45 },
  '9v9': { id: '9v9', label: '9v9', slots: 9, hasKeeper: true, length: 73, width: 46 },
  '11v11': { id: '11v11', label: '11v11', slots: 11, hasKeeper: true, length: 100, width: 64 },
};

export type Role = 'GK' | 'FIELD' | 'BENCH';
