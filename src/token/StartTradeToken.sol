// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StartTradeToken
 * @dev ERC20 token with permit functionality for StartTrade platform
 * @param name The name of the token
 * @param symbol The symbol of the token
 * @param initialSupply The initial supply of tokens to mint
 * @param owner The owner of the token contract
 */
contract StartTradeToken is ERC20, ERC20Permit, Ownable {
    string public description;
    string public imageUrl;
    address public creator;
    uint256 public createdAt;
    
    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint256 initialSupply
    );

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address owner,
        string memory _description,
        string memory _imageUrl
    ) ERC20(name, symbol) ERC20Permit(name) Ownable(owner) {
        creator = owner;
        description = _description;
        imageUrl = _imageUrl;
        createdAt = block.timestamp;
        
        if (initialSupply > 0) {
            _mint(owner, initialSupply);
        }
        
        emit TokenCreated(address(this), owner, name, symbol, initialSupply);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) external {
        _spendAllowance(account, msg.sender, amount);
        _burn(account, amount);
    }

    function updateMetadata(string memory _description, string memory _imageUrl) external onlyOwner {
        description = _description;
        imageUrl = _imageUrl;
    }
}
