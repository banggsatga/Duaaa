-- Update contract addresses after deployment
-- Run this after deploying the smart contracts

-- Create contract_addresses table if it doesn't exist
CREATE TABLE IF NOT EXISTS contract_addresses (
    id SERIAL PRIMARY KEY,
    contract_name VARCHAR(50) NOT NULL UNIQUE,
    address VARCHAR(42) NOT NULL,
    chain_id INTEGER NOT NULL,
    deployed_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Insert or update contract addresses
-- Replace these addresses with actual deployed addresses

INSERT INTO contract_addresses (contract_name, address, chain_id) 
VALUES 
    ('StartTradeFactory', '0x0000000000000000000000000000000000000000', 43113),
    ('StartTradeRouter', '0x0000000000000000000000000000000000000000', 43113),
    ('StartTradeTokenFactory', '0x0000000000000000000000000000000000000000', 43113),
    ('WAVAX', '0xd00ae08403B9bbb9124bB305C09058E32C39A48c', 43113)
ON CONFLICT (contract_name) 
DO UPDATE SET 
    address = EXCLUDED.address,
    chain_id = EXCLUDED.chain_id,
    deployed_at = NOW(),
    is_active = TRUE;

-- Enable RLS
ALTER TABLE contract_addresses ENABLE ROW LEVEL SECURITY;

-- Create policy for reading contract addresses (public)
CREATE POLICY "Contract addresses are viewable by everyone" ON contract_addresses
    FOR SELECT USING (true);

-- Create policy for updating contract addresses (authenticated users only)
CREATE POLICY "Only authenticated users can update contract addresses" ON contract_addresses
    FOR ALL USING (auth.role() = 'authenticated');

-- Grant permissions
GRANT SELECT ON contract_addresses TO anon;
GRANT ALL ON contract_addresses TO authenticated;
GRANT USAGE ON SEQUENCE contract_addresses_id_seq TO authenticated;
