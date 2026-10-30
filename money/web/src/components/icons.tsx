import {
  ArrowLeftRight, Banknote, Briefcase, Car, Fuel, GraduationCap, Gift, Hammer, HeartPulse, Landmark, MoreHorizontal,
  Percent, Plane, Repeat, RotateCcw, ShoppingBag, ShoppingCart, Store, TrendingUp, Users, UtensilsCrossed, Zap,
  type LucideIcon,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  utensils: UtensilsCrossed, zap: Zap, fuel: Fuel, 'shopping-bag': ShoppingBag, 'heart-pulse': HeartPulse, users: Users,
  'shopping-cart': ShoppingCart, car: Car, hammer: Hammer, 'graduation-cap': GraduationCap, landmark: Landmark,
  briefcase: Briefcase, repeat: Repeat, plane: Plane, gift: Gift, percent: Percent, 'more-horizontal': MoreHorizontal,
  banknote: Banknote, store: Store, 'rotate-ccw': RotateCcw, 'trending-up': TrendingUp, transfer: ArrowLeftRight,
};

export const iconFor = (name: string | undefined): LucideIcon => (name && MAP[name]) || MoreHorizontal;

export const ICON_NAMES = Object.keys(MAP).filter((k) => k !== 'transfer');
