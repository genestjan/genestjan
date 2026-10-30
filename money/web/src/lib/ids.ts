export const newId = () => crypto.randomUUID();

/** The same input always gives the same id, so two devices that process the same captured
 *  notification create the same record instead of a duplicate. */
export async function stableId(input: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)));
  const hex = Array.from(h.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
