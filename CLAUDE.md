# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MotoRent Pro** is a motorcycle rental management system built with React, TypeScript, and Vite. The application manages motorcycles, subscribers (renters), rentals, and weekly payment tracking with automated recurring payment generation.

**Tech Stack:**
- React 19 with TypeScript
- Vite for build tooling
- Recharts for data visualization
- Lucide React for icons
- No backend - fully client-side with mock data

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm preview
```

## Architecture

### State Management Pattern

**AppContext (context/AppContext.tsx)** is the single source of truth for all application state:
- Manages: `motorcycles`, `subscribers`, `rentals`, `payments`
- Provides CRUD operations via context methods
- Implements automatic weekly payment generation via frontend "cron job" (useEffect)
- All pages access state via `useApp()` hook

**Critical:** State is in-memory only. Refreshing the page resets to mock data from `constants.ts`.

### Payment Generation Logic

The system automatically generates weekly recurring payments:

1. **Trigger:** Runs on mount and when `rentals` or `subscribers` change
2. **Schedule:** Creates payments based on `rental.startDate` with 7-day intervals
3. **Lookahead:** Generates payments up to 7 days in the future
4. **Status Rules:**
   - Past due dates → `PaymentStatus.OVERDUE`
   - Today or future → `PaymentStatus.PENDING`
   - Manually marked → `PaymentStatus.PAID`
5. **Auto-notification:** Simulates WhatsApp notification for payments due today (console logs)

**Implementation:** `AppContext.tsx:32-136` - The `runFrontendCron` function handles this logic.

### Data Model Relationships

```
Rental (links Motorcycle ↔ Subscriber)
  ├─ motorcycleId → Motorcycle
  ├─ subscriberId → Subscriber
  └─ generates → Payment[] (weekly, recurring)

Payment
  ├─ rentalId → Rental
  └─ subscriberName (denormalized for display)
```

**Key Pattern:** When creating a rental via `createRental()`, the motorcycle status automatically updates to `RENTED`, and the cron is forced to re-run to generate the first payment.

### Page Structure

All pages in `pages/` follow the same pattern:
- Import `useApp()` to access state and methods
- Render data in tables/cards
- Provide forms for CRUD operations
- Use local state for UI (modals, filters, etc.)

**Pages:**
- `Dashboard.tsx` - Revenue stats with time filters (WEEK/FORTNIGHT/MONTH) + charts
- `Payments.tsx` - Payment management with status filtering, manual reminders, mark as paid
- `Motorcycles.tsx` - Fleet management with status updates, add/delete
- `Subscribers.tsx` - Customer management with CRUD operations
- `Architecture.tsx` - Technical documentation page explaining the system design

### Component Organization

- `components/Sidebar.tsx` - Navigation sidebar with mobile menu support
- `App.tsx` - Root component with page routing (simple string-based, no react-router)

## Important Patterns

### Adding New Features

When extending the application:

1. **New entity type?** Add to `types.ts`, create mock data in `constants.ts`, extend `AppContext`
2. **New page?** Create in `pages/`, add route case in `App.tsx:15-24`, add nav item in `Sidebar.tsx`
3. **State mutations?** Add method to `AppContext.tsx` and expose in provider value

### Date Handling

**Format:** All dates stored as `YYYY-MM-DD` strings (ISO format split on 'T')

**Critical for payment generation:**
- Dates parsed with `new Date(year, month-1, day)` to avoid timezone issues
- Always use `.toISOString().split('T')[0]` for consistency
- Payment due date comparisons use string comparison (`<`, `>`)

### WhatsApp Integration (Simulated)

The codebase includes simulated WhatsApp microservice calls:
- Auto-notification on payment creation: `AppContext.tsx:101-116`
- Manual reminder: `sendReminder()` method, `AppContext.tsx:182-226`
- Both aggregate total debt across all subscriber rentals before sending

**Implementation:** Currently logs to console. Replace with actual API calls when backend is ready.

### Environment Variables

The app expects `GEMINI_API_KEY` in `.env.local`, though it's not currently used in the codebase (likely for future AI features).

**Configuration:** `vite.config.ts:14-15` exposes as `process.env.GEMINI_API_KEY`

## Code Style

- **Language:** Brazilian Portuguese for UI strings and comments
- **TypeScript:** Strict typing with enums for status values (`MotorcycleStatus`, `PaymentStatus`)
- **React:** Functional components with hooks, no class components
- **Styling:** Inline Tailwind classes (no separate CSS files)

## Testing Notes

No test framework is configured. When adding tests:
- Install Jest + React Testing Library
- Focus on `AppContext` payment generation logic (complex business rules)
- Test status transitions (PENDING → OVERDUE, manual PAID)
- Verify rental creation triggers payment generation
