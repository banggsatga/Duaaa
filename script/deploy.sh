#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NETWORK=${1:-fuji}
PRIVATE_KEY=${PRIVATE_KEY}
SNOWTRACE_API_KEY=${SNOWTRACE_API_KEY}

if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}Error: PRIVATE_KEY environment variable is not set${NC}"
    exit 1
fi

if [ -z "$SNOWTRACE_API_KEY" ]; then
    echo -e "${YELLOW}Warning: SNOWTRACE_API_KEY not set, contracts won't be verified${NC}"
fi

echo -e "${GREEN}Deploying StartTrade contracts to $NETWORK...${NC}"

# Deploy contracts
forge script script/Deploy.s.sol:DeployScript \
    --rpc-url $NETWORK \
    --private-key $PRIVATE_KEY \
    --broadcast \
    --verify \
    --etherscan-api-key $SNOWTRACE_API_KEY \
    -vvvv

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Deployment completed successfully!${NC}"
    echo -e "${YELLOW}Don't forget to update the database with contract addresses${NC}"
else
    echo -e "${RED}Deployment failed!${NC}"
    exit 1
fi
