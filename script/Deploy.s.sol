// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {StartTradeFactory} from "../src/core/StartTradeFactory.sol";
import {StartTradeRouter} from "../src/periphery/StartTradeRouter.sol";
import {StartTradeTokenFactory} from "../src/factory/StartTradeTokenFactory.sol";

contract DeployScript is Script {
    // Avalanche Mainnet addresses
    address constant WAVAX_MAINNET = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    
    // Avalanche Fuji Testnet addresses  
    address constant WAVAX_FUJI = 0xd00ae08403B9bbb9124bB305C09058E32C39A48c;
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        // Determine network and WAVAX address
        address wavaxAddress;
        if (block.chainid == 43114) {
            // Avalanche Mainnet
            wavaxAddress = WAVAX_MAINNET;
            console.log("Deploying to Avalanche Mainnet");
        } else if (block.chainid == 43113) {
            // Avalanche Fuji Testnet
            wavaxAddress = WAVAX_FUJI;
            console.log("Deploying to Avalanche Fuji Testnet");
        } else {
            revert("Unsupported network");
        }
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy Factory
        console.log("Deploying StartTradeFactory...");
        StartTradeFactory factory = new StartTradeFactory(deployer);
        console.log("StartTradeFactory deployed at:", address(factory));
        
        // 2. Deploy Router
        console.log("Deploying StartTradeRouter...");
        StartTradeRouter router = new StartTradeRouter(
            address(factory),
            wavaxAddress
        );
        console.log("StartTradeRouter deployed at:", address(router));
        
        // 3. Deploy Token Factory
        console.log("Deploying StartTradeTokenFactory...");
        StartTradeTokenFactory tokenFactory = new StartTradeTokenFactory(
            address(factory),
            address(router),
            wavaxAddress,
            deployer, // Fee recipient
            deployer  // Owner
        );
        console.log("StartTradeTokenFactory deployed at:", address(tokenFactory));
        
        vm.stopBroadcast();
        
        // Log deployment summary
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network:", block.chainid);
        console.log("WAVAX:", wavaxAddress);
        console.log("Factory:", address(factory));
        console.log("Router:", address(router));
        console.log("TokenFactory:", address(tokenFactory));
        console.log("Deployer:", deployer);
        
        // Save addresses to file for database update
        string memory addresses = string(abi.encodePacked(
            "FACTORY_ADDRESS=", vm.toString(address(factory)), "\n",
            "ROUTER_ADDRESS=", vm.toString(address(router)), "\n",
            "TOKEN_FACTORY_ADDRESS=", vm.toString(address(tokenFactory)), "\n",
            "WAVAX_ADDRESS=", vm.toString(wavaxAddress), "\n",
            "DEPLOYER_ADDRESS=", vm.toString(deployer), "\n",
            "CHAIN_ID=", vm.toString(block.chainid)
        ));
        
        vm.writeFile("deployment-addresses.env", addresses);
        console.log("\nAddresses saved to deployment-addresses.env");
    }
}
