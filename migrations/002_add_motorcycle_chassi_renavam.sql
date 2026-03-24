-- Add chassi, renavam and mileage columns to motorcycles table
ALTER TABLE motorcycles
  ADD COLUMN IF NOT EXISTS chassi TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS renavam TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mileage INTEGER NOT NULL DEFAULT 0;

-- Create unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_motorcycles_chassi ON motorcycles(chassi) WHERE chassi != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_motorcycles_renavam ON motorcycles(renavam) WHERE renavam != '';
