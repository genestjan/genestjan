// Customer and bike catalogue writes. Plain catalogue edits: direct table write plus an outbox row.
import { db } from './db';
import { nowISO, uid } from '@/domain/util';
import type { Customer, CustomerBike } from '@/domain/types';

const out = (action: string, payload: unknown) =>
  db.outbox.add({ action, payload, createdAt: nowISO(), syncedAt: null, error: null });

export type CustomerInput = Omit<Customer, 'id' | 'createdAt'> & { id?: string };

export async function saveCustomer(input: CustomerInput): Promise<Customer> {
  const name = input.name.trim();
  if (!name) throw new Error('Enter the customer name');
  return db.transaction('rw', [db.customers, db.outbox], async () => {
    const existing = input.id ? await db.customers.get(input.id) : undefined;
    const row: Customer = {
      id: existing?.id ?? uid(),
      createdAt: existing?.createdAt ?? nowISO(),
      name,
      phone: input.phone.trim(),
      messenger: input.messenger.trim(),
      channel: input.channel,
      notes: input.notes.trim(),
    };
    await db.customers.put(row);
    await out('upsert_customer', row);
    return row;
  });
}

export type BikeInput = Omit<CustomerBike, 'id'> & { id?: string };

export async function saveBike(input: BikeInput): Promise<CustomerBike> {
  if (!input.brand.trim() && !input.model.trim()) throw new Error('Enter the bike brand or model');
  return db.transaction('rw', [db.bikes, db.outbox], async () => {
    const row: CustomerBike = {
      id: input.id ?? uid(),
      customerId: input.customerId,
      brand: input.brand.trim(),
      model: input.model.trim(),
      serial: input.serial.trim(),
      color: input.color.trim(),
      notes: input.notes.trim(),
    };
    await db.bikes.put(row);
    await out('upsert_bike', row);
    return row;
  });
}
