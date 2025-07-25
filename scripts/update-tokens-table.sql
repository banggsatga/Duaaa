-- Update tokens table to match new fair launch structure
ALTER TABLE tokens DROP COLUMN IF EXISTS supply;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS initial_price NUMERIC DEFAULT 0.000001;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS current_price NUMERIC DEFAULT 0.000001;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS total_supply NUMERIC DEFAULT 0;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS contract_address TEXT;

-- Update existing records
UPDATE tokens SET 
  initial_price = 0.000001,
  current_price = 0.000001,
  total_supply = 0
WHERE initial_price IS NULL;

-- Add comment to indicate bonding curve mechanism
COMMENT ON TABLE tokens IS 'Fair launch tokens using bonding curve mechanism - no max supply, dynamic minting/burning';
COMMENT ON COLUMN tokens.total_supply IS 'Current circulating supply (dynamic based on bonding curve)';
COMMENT ON COLUMN tokens.current_price IS 'Current token price in AVAX (calculated from bonding curve)';
COMMENT ON COLUMN tokens.contract_address IS 'Deployed smart contract address on Avalanche';
