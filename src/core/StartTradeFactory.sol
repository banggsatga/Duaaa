// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IStartTradeFactory} from "../interfaces/IStartTradeFactory.sol";
import {IStartTradePair} from "../interfaces/IStartTradePair.sol";
import {StartTradePair} from "./StartTradePair.sol";

contract StartTradeFactory is IStartTradeFactory {
    address public feeTo;
    address public feeToSetter;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    constructor(address _feeToSetter) {
        feeToSetter = _feeToSetter;
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "StartTrade: IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "StartTrade: ZERO_ADDRESS");
        require(getPair[token0][token1] == address(0), "StartTrade: PAIR_EXISTS"); // single check is sufficient
        bytes memory bytecode = type(StartTradePair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        IStartTradePair(pair).initialize(token0, token1);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function setFeeTo(address _feeTo) external {
        require(msg.sender == feeToSetter, "StartTrade: FORBIDDEN");
        feeTo = _feeTo;
    }

    function setFeeToSetter(address _feeToSetter) external {
        require(msg.sender == feeToSetter, "StartTrade: FORBIDDEN");
        feeToSetter = _feeToSetter;
    }
}
