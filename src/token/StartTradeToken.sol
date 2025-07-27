// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StartTradeToken
 * @dev ERC20 token with permit functionality for gasless approvals
 */
contract StartTradeToken is ERC20, ERC20Permit, Ownable {
    uint8 private _decimals;
    string private _description;
    string private _imageUrl;
    string private _website;
    string private _telegram;
    string private _twitter;

    event MetadataUpdated(
        string description,
        string imageUrl,
        string website,
        string telegram,
        string twitter
    );

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 totalSupply_,
        address owner,
        string memory description_,
        string memory imageUrl_,
        string memory website_,
        string memory telegram_,
        string memory twitter_
    ) ERC20(name, symbol) ERC20Permit(name) Ownable(owner) {
        _decimals = decimals_;
        _description = description_;
        _imageUrl = imageUrl_;
        _website = website_;
        _telegram = telegram_;
        _twitter = twitter_;
        
        _mint(owner, totalSupply_);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function description() public view returns (string memory) {
        return _description;
    }

    function imageUrl() public view returns (string memory) {
        return _imageUrl;
    }

    function website() public view returns (string memory) {
        return _website;
    }

    function telegram() public view returns (string memory) {
        return _telegram;
    }

    function twitter() public view returns (string memory) {
        return _twitter;
    }

    /**
     * @dev Updates token metadata
     * @param description_ New description
     * @param imageUrl_ New image URL
     * @param website_ New website URL
     * @param telegram_ New Telegram URL
     * @param twitter_ New Twitter URL
     */
    function updateMetadata(
        string memory description_,
        string memory imageUrl_,
        string memory website_,
        string memory telegram_,
        string memory twitter_
    ) external onlyOwner {
        _description = description_;
        _imageUrl = imageUrl_;
        _website = website_;
        _telegram = telegram_;
        _twitter = twitter_;
        
        emit MetadataUpdated(description_, imageUrl_, website_, telegram_, twitter_);
    }

    /**
     * @dev Returns token information
     * @return name Token name
     * @return symbol Token symbol
     * @return decimals_ Token decimals
     * @return totalSupply_ Total supply
     * @return description_ Token description
     * @return imageUrl_ Token image URL
     * @return website_ Website URL
     * @return telegram_ Telegram URL
     * @return twitter_ Twitter URL
     */
    function getTokenInfo() external view returns (
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 totalSupply_,
        string memory description_,
        string memory imageUrl_,
        string memory website_,
        string memory telegram_,
        string memory twitter_
    ) {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            _description,
            _imageUrl,
            _website,
            _telegram,
            _twitter
        );
    }
}
