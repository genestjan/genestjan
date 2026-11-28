// Free customer messages: pre-filled text that opens the shop phone's SMS app,
// Messenger or Viber. Staff press send. No paid SMS gateway needed.
import type { Channel, NotifyTrigger } from './types';
import { money } from './util';

export interface NotifyVars {
  shop: string;
  customer: string;
  bike: string;
  jobNo: string;
  total?: number;
  when?: string;
  phone?: string;
}

export const TRIGGERS: Record<NotifyTrigger, string> = {
  appointment_confirmed: 'Appointment confirmed',
  estimate_ready: 'Estimate ready',
  waiting_parts: 'Waiting for parts',
  ready_for_pickup: 'Ready for pickup',
  follow_up: 'Tune-up reminder',
};

export function messageFor(t: NotifyTrigger, v: NotifyVars): string {
  const first = v.customer.split(' ')[0] || 'there';
  const total = v.total != null ? money(v.total) : '';
  switch (t) {
    case 'appointment_confirmed':
      return `Hi ${first}! Your ${v.bike} is booked at ${v.shop} on ${v.when}. Job no. ${v.jobNo}. See you!`;
    case 'estimate_ready':
      return `Hi ${first}! The estimate for your ${v.bike} is ready: ${total}. Reply YES to approve and we'll get started. (${v.jobNo})`;
    case 'waiting_parts':
      return `Hi ${first}, quick update from ${v.shop}: we're waiting on a part for your ${v.bike}. We'll message you as soon as it arrives. (${v.jobNo})`;
    case 'ready_for_pickup':
      return `Good news, ${first}! Your ${v.bike} is ready for pickup at ${v.shop}. Total: ${total}. (${v.jobNo})`;
    case 'follow_up':
      return `Hi ${first}! It's been a while since your ${v.bike}'s last service at ${v.shop}. Book a tune-up to keep it riding smooth.`;
  }
}

/** Normalise a PH mobile number to +63 format. */
export function phPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('63')) return '+' + d;
  if (d.startsWith('09')) return '+63' + d.slice(1);
  if (d.startsWith('9') && d.length === 10) return '+63' + d;
  return d ? '+' + d : '';
}

export function channelLink(channel: Channel, to: string, body: string): string {
  const text = encodeURIComponent(body);
  switch (channel) {
    case 'sms':
      return `sms:${phPhone(to)}?body=${text}`;
    case 'viber':
      return `viber://forward?text=${text}`;
    case 'messenger': {
      // Messenger cannot pre-fill text from a link, so the app copies it first,
      // then opens the chat. A username or profile link both work.
      const user = to.replace(/^https?:\/\/(www\.)?(facebook\.com|m\.me)\//, '').replace(/\/$/, '');
      return user ? `https://m.me/${user}` : 'https://www.messenger.com/';
    }
  }
}
