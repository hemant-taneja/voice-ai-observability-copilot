-- Track which company (agency) each location belongs to.
-- Used to redirect to the correct locationId after a company-level OAuth install.
ALTER TABLE locations ADD COLUMN IF NOT EXISTS company_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_locations_company_id ON locations(company_id);
