import {
  LayoutDashboard, ScanBarcode, ShoppingCart, Boxes, ArrowLeftRight, Truck, CalendarClock, Wrench, Users, BarChart3, Settings, ClipboardList, Factory,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/domain/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  group: 'Sell' | 'Stock' | 'Workshop' | 'Shop';
  key?: string; // desktop keyboard shortcut (Alt + key)
}

const ALL: Role[] = ['owner', 'cashier', 'advisor', 'mechanic', 'warehouse'];
const FRONT: Role[] = ['owner', 'cashier', 'advisor'];

export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'cashier', 'advisor', 'warehouse'], group: 'Sell', key: '1' },
  { to: '/pos', label: 'POS Checkout', icon: ShoppingCart, roles: FRONT, group: 'Sell', key: '2' },
  { to: '/repairs', label: 'Estimates & Jobs', icon: Wrench, roles: FRONT, group: 'Workshop', key: '3' },
  { to: '/calendar', label: 'Repair Calendar', icon: CalendarClock, roles: ['owner', 'cashier', 'advisor', 'mechanic'], group: 'Workshop', key: '4' },
  { to: '/my-jobs', label: 'My Jobs', icon: ClipboardList, roles: ['mechanic', 'owner'], group: 'Workshop' },
  { to: '/inventory', label: 'Inventory', icon: Boxes, roles: ALL, group: 'Stock', key: '5' },
  { to: '/transfers', label: 'Transfers & Alerts', icon: ArrowLeftRight, roles: ['owner', 'warehouse', 'cashier'], group: 'Stock', key: '6' },
  { to: '/purchasing', label: 'Smart POs', icon: Truck, roles: ['owner', 'warehouse'], group: 'Stock', key: '7' },
  { to: '/suppliers', label: 'Suppliers', icon: Factory, roles: ['owner', 'warehouse'], group: 'Stock' },
  { to: '/customers', label: 'Customers & Bikes', icon: Users, roles: FRONT, group: 'Shop', key: '8' },
  { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['owner'], group: 'Shop', key: '9' },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['owner'], group: 'Shop' },
];

/** Phone bottom bar: three tabs, the big centre Scan button, and More. */
export const MOBILE_TABS: Record<Role, string[]> = {
  owner: ['/', '/repairs', '/inventory'],
  cashier: ['/pos', '/repairs', '/inventory'],
  advisor: ['/repairs', '/calendar', '/customers'],
  mechanic: ['/my-jobs', '/calendar', '/inventory'],
  warehouse: ['/inventory', '/transfers', '/purchasing'],
};

export const SCAN_ICON = ScanBarcode;
export const navFor = (role: Role) => NAV.filter((n) => n.roles.includes(role));
