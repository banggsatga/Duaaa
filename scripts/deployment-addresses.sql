-- Store deployed contract addresses
INSERT INTO contract_addresses (
    network,
    contract_name,
    contract_address,
    deployed_at,
    deployer_address
) VALUES 
-- Fuji Testnet addresses (update with actual deployed addresses)
('fuji', 'StartTradeFactory', '0x...', NOW(), '0x...'),
('fuji', 'StartTradeRouter', '0x...', NOW(), '0x...'),
('fuji', 'StartTradeTokenFactory', '0x...', NOW(), '0x...'),
('fuji', 'WAVAX', '0xd00ae08403B9bbb9124bB305C09058E32C39A48c', NOW(), '0x0000000000000000000000000000000000000000'),

-- Avalanche Mainnet addresses (update when deployed)
('avalanche', 'StartTradeFactory', '0x...', NOW(), '0x...'),
('avalanche', 'StartTradeRouter', '0x...', NOW(), '0x...'),
('avalanche', 'StartTradeTokenFactory', '0x...', NOW(), '0x...'),
('avalanche', 'WAVAX', '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', NOW(), '0x0000000000000000000000000000000000000000');

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS contract_addresses (
    id SERIAL PRIMARY KEY,
    network VARCHAR(50) NOT NULL,
    contract_name VARCHAR(100) NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    deployed_at TIMESTAMP DEFAULT NOW(),
    deployer_address VARCHAR(42),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contract_addresses_network ON contract_addresses(network);
CREATE INDEX IF NOT EXISTS idx_contract_addresses_name ON contract_addresses(contract_name);
CREATE INDEX IF NOT EXISTS idx_contract_addresses_address ON contract_addresses(contract_address);
