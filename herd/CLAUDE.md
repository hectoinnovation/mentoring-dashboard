# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands must be run from the `herd/` directory.

```bash
npm run dev      # Start dev server (Next.js 14, hot reload)
npm run build    # Production build
npm run lint     # ESLint via next lint
npx tsc --noEmit # Type-check without emitting
```

No test suite is configured.

## Architecture

This is a single-page HR event attendance dashboard (HERD). The app lives entirely in `herd/`.

### Data flow

`app/page.tsx` is a **Server Component** that:
1. Reads `?event=<uuid>` from `searchParams` to know which event is selected
2. Fetches all events + the selected event's responses directly from Supabase
3. Computes `DepartmentStat[]` aggregates in-process (`buildDepartmentStats`)
4. Passes hydrated data down to pure display components

**Client mutations** (insert new events / participants) are done directly from Client Components via the shared `supabase` singleton in `lib/supabase.ts`, followed by `router.refresh()` to re-trigger the Server Component fetch.

### Key constraint: `useSearchParams` + Suspense

`DashboardHeader` is a Client Component that contains `EventSelector` (which calls `useSearchParams`). Any Client Component using `useSearchParams` **must** be wrapped in `<Suspense>` at the server boundary or React will fail to hydrate and event handlers won't attach. This pattern is required in `app/page.tsx`:

```tsx
<Suspense>
  <DashboardHeader ... />
</Suspense>
```

### shadcn/ui version note

The installed shadcn uses `@base-ui/react` (v1.x) as its primitive layer, **not** `@radix-ui/react`. The `Select` component from `components/ui/select.tsx` has a known issue where it displays the raw `value` (UUID) instead of the item label when used in a controlled manner. **Use native `<select>` elements** for dropdowns instead of the shadcn Select component.

The `Dialog` component from `components/ui/dialog.tsx` also uses `@base-ui/react/dialog`. Use the custom `components/Modal.tsx` (plain Tailwind fixed overlay) instead for reliability.

### Supabase schema

Four tables in the `public` schema:

| Table | Key columns |
|-------|-------------|
| `departments` | `id uuid PK`, `name text` |
| `events` | `id uuid PK`, `title`, `event_type`, `event_date date` |
| `participants` | `id uuid PK`, `department_id FK`, `name`, `email unique`, `priority (high/normal/low)` |
| `responses` | `id uuid PK`, `event_id FK`, `participant_id FK`, `response_status (attending/not_attending/pending)`, unique(event_id, participant_id) |

All shared types (`Event`, `ParticipantResponse`, `DepartmentStat`, `ResponseStatus`, `Priority`) are defined in `lib/supabase.ts`.

### Environment variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Supabase project ref: `lcxzavilkfhbseuedsgd`

### globals.css

Uses **Tailwind v3** directives (`@tailwind base/components/utilities`). The shadcn `init` command generates v4-style CSS (`@import "tw-animate-css"`, `@import "shadcn/tailwind.css"`, `@apply border-border`) which is **incompatible** with this setup — do not regenerate globals.css via shadcn CLI.
