#!/bin/bash

# Load environment variables
source .env

# Deploy to Fuji testnet
echo "Deploying to Fuji testnet..."
forge script script/Deploy.s.sol:DeployScript --rpc-url $FUJI_RPC_URL --private-key $PRIVATE_KEY --broadcast --verify --etherscan-api-key $SNOWTRACE_API_KEY

# Deploy to Avalanche mainnet (uncomment when ready)
# echo "Deploying to Avalanche mainnet..."
# forge script script/Deploy.s.sol:DeployScript --rpc-url $AVALANCHE_RPC_URL --private-key $PRIVATE_KEY --broadcast --verify --etherscan-api-key $SNOWTRACE_API_KEY

echo "Deployment complete!"
