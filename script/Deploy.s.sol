// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {StartTradeFactory} from "../src/core/StartTradeFactory.sol";
import {StartTradeRouter} from "../src/periphery/StartTradeRouter.sol";
import {StartTradeTokenFactory} from "../src/factory/StartTradeTokenFactory.sol";

contract DeployScript is Script {
    // Avalanche mainnet addresses
    address constant WAVAX_MAINNET = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    
    // Fuji testnet addresses
    address constant WAVAX_FUJI = 0xd00ae08403B9bbb9124bB305C09058E32C39A48c;

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Determine which network we're on
        address wavaxAddress;
        if (block.chainid == 43114) {
            // Avalanche mainnet
            wavaxAddress = WAVAX_MAINNET;
            console.log("Deploying to Avalanche mainnet");
        } else if (block.chainid == 43113) {
            // Fuji testnet
            wavaxAddress = WAVAX_FUJI;
            console.log("Deploying to Fuji testnet");
        } else {
            revert("Unsupported network");
        }

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Factory
        StartTradeFactory factory = new StartTradeFactory(deployer);
        console.log("StartTradeFactory deployed at:", address(factory));

        // Deploy Router
        StartTradeRouter router = new StartTradeRouter(
            address(factory),
            wavaxAddress
        );
        console.log("StartTradeRouter deployed at:", address(router));

        // Deploy Token Factory
        StartTradeTokenFactory tokenFactory = new StartTradeTokenFactory(
            address(router),
            address(factory),
            wavaxAddress,
            deployer // Fee recipient
        );
        console.log("StartTradeTokenFactory deployed at:", address(tokenFactory));

        vm.stopBroadcast();

        // Log deployment info
        console.log("\n=== Deployment Summary ===");
        console.log("Network:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("WAVAX:", wavaxAddress);
        console.log("Factory:", address(factory));
        console.log("Router:", address(router));
        console.log("Token Factory:", address(tokenFactory));
        console.log("========================\n");
    }
}
