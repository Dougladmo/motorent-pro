# @motorent/shared

Shared types, utilities, and constants for MotoRent Pro mono-repo.

## Overview

This package provides common functionality used by both frontend and backend packages:

- **Types**: Domain models, enums, and database types
- **Utils**: Validators, formatters, and date utilities
- **Constants**: Shared constants like week days

## Package Structure

```
src/
├── types/           # Domain types
│   ├── motorcycle.ts
│   ├── subscriber.ts
│   ├── rental.ts
│   ├── payment.ts
│   └── database.ts
├── utils/           # Utility functions
│   ├── validators.ts
│   ├── formatters.ts
│   └── date.ts
└── constants/       # Shared constants
    └── weekDays.ts
```

## Build Output

This package builds to **dual formats**:

- **ESM** (`dist/esm/`) - For frontend (Vite/React)
- **CommonJS** (`dist/cjs/`) - For backend (Node.js/Express)

The package.json exports both formats with conditional exports.

## Usage

### In Frontend (ESM)

```typescript
import {
  Motorcycle,
  MotorcycleStatus,
  formatCurrency,
  validateCPF,
  WEEK_DAYS
} from '@motorent/shared';
```

### In Backend (CommonJS)

```typescript
const {
  Database,
  PaymentStatus,
  addDays,
  formatDate
} = require('@motorent/shared');
```

## Scripts

- `npm run build` - Build both ESM and CJS
- `npm run build:esm` - Build ESM only
- `npm run build:cjs` - Build CJS only
- `npm run clean` - Remove dist folder
- `npm run typecheck` - Type check without emitting
- `npm run update-types` - Regenerate database types from Supabase

## Development

When making changes:

1. Edit source files in `src/`
2. Run `npm run build` to rebuild
3. Changes will be reflected in dependent packages

## Type Generation

Database types are generated from Supabase schema:

```bash
npm run update-types
```

This runs the Supabase CLI in the backend package and copies the generated types to `src/types/database.ts`.
