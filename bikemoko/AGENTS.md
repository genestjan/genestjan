# Bikemoko: rules for every agent working on this app

Bikemoko is a bike shop in General Santos City: retail store, parts warehouse and repair workshop.
This app is their Inventory, POS and Service Repair system. Web at genestjanramirez.com/bikemoko/,
Android APK (Capacitor) and Windows EXE (Electron) from the same code.

## Stack
React 19, TypeScript strict, Vite, Tailwind 3 with CSS-variable tokens, Dexie (IndexedDB) local database,
react-router HashRouter, lucide-react icons. Tests: vitest (+ fake-indexeddb). No other UI libraries
without asking the lead.

## Files you may touch
- Your own module folder: `src/screens/<module>/` (create any files you need inside it).
- New tests next to your files.
- If you need a new data action, put it in `src/data/<module>Actions.ts`. Do NOT edit `src/data/actions.ts`,
  `src/data/db.ts`, `src/domain/*`, `src/ui/kit.tsx`, `src/app/*` or other modules' folders.
  If you think a shared file needs changing, say so in your final report instead.

## Data rules (non-negotiable)
- Never change `stock` rows directly from a screen. Use the actions in `src/data/actions.ts`
  (`recordSale`, `transferStock`, `transferMany`, `adjustCount`, `receivePO`, `approveEstimateToJob`,
  `completeRepairBilling`, `setJobStatus`, `addJobPart`, `toggleTimer`, `updateJob`, `createJob`,
  `rescheduleJob`, `saveEstimate`, `createPO`, `setPOStatus`, `logNotification`, `openShift`, `closeShift`,
  `updateLevelSettings`). Plain catalogue edits (products, customers, bikes, suppliers, services, staff,
  settings) may write to their Dexie table directly, and must also call `db.outbox.add(...)` like actions do.
- Money is integer centavos. Display with `<Money>` or `money()` from `src/domain/util.ts`.
- Read data with live queries (`useLiveQuery`, `useProducts`, `useStockMap`, etc. in `src/data/hooks.ts`)
  so every screen updates instantly.
- Wrap user actions in `run(() => action(...), 'Success message')` from the kit, which shows toasts.

## Design rules (premium and simple)
- Build only from `src/ui/kit.tsx`: Button, Card, PageHeader, Section, Badge, Stat, Money, Empty, Table,
  Field, Input, Select, Textarea, SearchBox, MoneyInput, Stepper, Segmented, Toggle, Modal, Drawer, toast, run.
- Colours only via tokens: `bg, surface, raised, line, ink, muted, faint, brand, ok, warn, bad, info`.
  Never hard-code hex colours (staff lane colours from data are the exception).
- Works at 390px phone width and 1280px+ desktop. Touch targets at least 44px on phone.
  Desktop POS is keyboard friendly.
- Numbers use the `num` class (tabular). Peso sign ₱.
- Every list has a good empty state. Every destructive action asks to confirm.
- Copy: short, friendly, plain English a cashier understands. British spelling is fine. **No em dashes anywhere.**
- Big bold numbers, calm surfaces, one orange accent for the main action on each screen. Do not add
  gradients, emojis or decorative clutter.

## Before you finish
Run `npx tsc -b` and `npx vitest run` from `bikemoko/` and fix everything you caused.
Do not run `npm install` (ask the lead). Do not commit; the lead commits.
Report: files created, what works, anything stubbed, anything you need changed in shared files.
