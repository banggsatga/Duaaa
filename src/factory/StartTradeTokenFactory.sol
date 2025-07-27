// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {StartTradeToken} from "../token/StartTradeToken.sol";
import {IStartTradeFactory} from "../interfaces/IStartTradeFactory.sol";
import {IStartTradeRouter} from "../interfaces/IStartTradeRouter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// Custom errors for gas efficiency
error InvalidParameters();
error InsufficientPayment();
error TokenNotFound();
error AlreadyListed();
error ThresholdNotReached();
error TransferFailed();

contract StartTradeTokenFactory is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    struct TokenInfo {
        address tokenAddress;
        address creator;
        uint256 totalSupply;
        uint256 currentSupply;
        uint256 targetMarketCap;
        uint256 currentPrice;
        bool isListed;
        uint256 createdAt;
        uint256 avaxRaised;
    }

    struct BondingCurveParams {
        uint256 initialPrice;      // Starting price in wei per token
        uint256 finalPrice;        // Final price in wei per token
        uint256 targetSupply;      // Supply at which to list on DEX
        uint256 k;                 // Bonding curve steepness parameter
    }

    // Constants
    uint256 public constant LISTING_THRESHOLD = 24 ether; // 24 AVAX to list on DEX
    uint256 public constant PLATFORM_FEE_BPS = 100; // 1% platform fee
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1B tokens max
    
    // State variables
    address public immutable dexFactory;
    address public immutable dexRouter;
    address public immutable WAVAX;
    address public feeRecipient;
    uint256 public tokenCreationFee = 0.01 ether;
    
    // Mappings
    mapping(address => TokenInfo) public tokens;
    mapping(address => BondingCurveParams) public bondingCurves;
    address[] public allTokens;
    
    // Events
    event TokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol,
        uint256 totalSupply,
        uint256 targetMarketCap
    );
    
    event TokenPurchased(
        address indexed tokenAddress,
        address indexed buyer,
        uint256 avaxAmount,
        uint256 tokenAmount,
        uint256 newPrice
    );
    
    event TokenSold(
        address indexed tokenAddress,
        address indexed seller,
        uint256 tokenAmount,
        uint256 avaxAmount,
        uint256 newPrice
    );
    
    event TokenListed(
        address indexed tokenAddress,
        address indexed pairAddress,
        uint256 liquidityAdded
    );

    constructor(
        address _dexFactory,
        address _dexRouter,
        address _WAVAX,
        address _feeRecipient,
        address _owner
    ) Ownable(_owner) {
        dexFactory = _dexFactory;
        dexRouter = _dexRouter;
        WAVAX = _WAVAX;
        feeRecipient = _feeRecipient;
    }

    /**
     * @dev Creates a new token with bonding curve mechanics
     */
    function createToken(
        string memory name,
        string memory symbol,
        string memory description,
        string memory imageUrl,
        string memory website,
        string memory telegram,
        string memory twitter,
        uint256 targetMarketCap
    ) external payable nonReentrant returns (address tokenAddress) {
        if (msg.value < tokenCreationFee) revert InsufficientPayment();
        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert InvalidParameters();
        if (targetMarketCap == 0) revert InvalidParameters();

        // Deploy new token
        StartTradeToken token = new StartTradeToken(
            name,
            symbol,
            18, // Standard 18 decimals
            MAX_SUPPLY,
            address(this), // Factory owns initially
            description,
            imageUrl,
            website,
            telegram,
            twitter
        );
        
        tokenAddress = address(token);
        
        // Calculate bonding curve parameters
        BondingCurveParams memory params = BondingCurveParams({
            initialPrice: 1e12, // 0.000001 AVAX per token
            finalPrice: (targetMarketCap * 1e18) / MAX_SUPPLY,
            targetSupply: (MAX_SUPPLY * 80) / 100, // 80% of supply for bonding curve
            k: 1e18 // Linear curve initially
        });
        
        bondingCurves[tokenAddress] = params;
        
        // Store token info
        tokens[tokenAddress] = TokenInfo({
            tokenAddress: tokenAddress,
            creator: msg.sender,
            totalSupply: MAX_SUPPLY,
            currentSupply: 0,
            targetMarketCap: targetMarketCap,
            currentPrice: params.initialPrice,
            isListed: false,
            createdAt: block.timestamp,
            avaxRaised: 0
        });
        
        allTokens.push(tokenAddress);
        
        // Transfer creation fee to fee recipient
        if (msg.value > 0) {
            (bool success,) = feeRecipient.call{value: msg.value}("");
            if (!success) revert TransferFailed();
        }
        
        emit TokenCreated(tokenAddress, msg.sender, name, symbol, MAX_SUPPLY, targetMarketCap);
    }

    /**
     * @dev Buy tokens using bonding curve pricing
     */
    function buyTokens(address tokenAddress) external payable nonReentrant {
        TokenInfo storage tokenInfo = tokens[tokenAddress];
        if (tokenInfo.tokenAddress == address(0)) revert TokenNotFound();
        if (tokenInfo.isListed) revert AlreadyListed();
        if (msg.value == 0) revert InsufficientPayment();

        BondingCurveParams memory params = bondingCurves[tokenAddress];
        
        // Calculate tokens to mint based on bonding curve
        uint256 tokensToMint = calculateTokensForAVAX(tokenAddress, msg.value);
        
        // Check if this purchase would exceed target supply
        if (tokenInfo.currentSupply + tokensToMint > params.targetSupply) {
            tokensToMint = params.targetSupply - tokenInfo.currentSupply;
        }
        
        // Calculate actual AVAX needed
        uint256 avaxNeeded = calculateAVAXForTokens(tokenAddress, tokensToMint);
        
        // Update token info
        tokenInfo.currentSupply += tokensToMint;
        tokenInfo.avaxRaised += avaxNeeded;
        tokenInfo.currentPrice = getCurrentPrice(tokenAddress);
        
        // Mint tokens to buyer
        StartTradeToken(tokenAddress).transfer(msg.sender, tokensToMint);
        
        // Refund excess AVAX
        if (msg.value > avaxNeeded) {
            (bool success,) = msg.sender.call{value: msg.value - avaxNeeded}("");
            if (!success) revert TransferFailed();
        }
        
        emit TokenPurchased(tokenAddress, msg.sender, avaxNeeded, tokensToMint, tokenInfo.currentPrice);
        
        // Check if ready to list on DEX
        if (tokenInfo.avaxRaised >= LISTING_THRESHOLD && !tokenInfo.isListed) {
            _listOnDEX(tokenAddress);
        }
    }

    /**
     * @dev Sell tokens back to bonding curve
     */
    function sellTokens(address tokenAddress, uint256 tokenAmount) external nonReentrant {
        TokenInfo storage tokenInfo = tokens[tokenAddress];
        if (tokenInfo.tokenAddress == address(0)) revert TokenNotFound();
        if (tokenInfo.isListed) revert AlreadyListed();
        if (tokenAmount == 0) revert InvalidParameters();

        // Calculate AVAX to return
        uint256 avaxToReturn = calculateAVAXForTokens(tokenAddress, tokenAmount);
        
        // Apply platform fee
        uint256 platformFee = (avaxToReturn * PLATFORM_FEE_BPS) / 10000;
        uint256 userReceives = avaxToReturn - platformFee;
        
        // Update token info
        tokenInfo.currentSupply -= tokenAmount;
        tokenInfo.avaxRaised -= avaxToReturn;
        tokenInfo.currentPrice = getCurrentPrice(tokenAddress);
        
        // Transfer tokens from user to factory (burn)
        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), tokenAmount);
        
        // Transfer AVAX to user
        (bool success,) = msg.sender.call{value: userReceives}("");
        if (!success) revert TransferFailed();
        
        // Transfer platform fee
        if (platformFee > 0) {
            (bool feeSuccess,) = feeRecipient.call{value: platformFee}("");
            if (!feeSuccess) revert TransferFailed();
        }
        
        emit TokenSold(tokenAddress, msg.sender, tokenAmount, userReceives, tokenInfo.currentPrice);
    }

    /**
     * @dev Lists token on DEX when threshold is reached
     */
    function _listOnDEX(address tokenAddress) internal {
        TokenInfo storage tokenInfo = tokens[tokenAddress];
        BondingCurveParams memory params = bondingCurves[tokenAddress];
        
        // Create pair on DEX
        address pair = IStartTradeFactory(dexFactory).createPair(tokenAddress, WAVAX);
        
        // Calculate liquidity amounts
        uint256 tokenLiquidity = MAX_SUPPLY - tokenInfo.currentSupply; // Remaining tokens
        uint256 avaxLiquidity = tokenInfo.avaxRaised;
        
        // Approve router to spend tokens
        IERC20(tokenAddress).forceApprove(dexRouter, tokenLiquidity);
        
        // Add liquidity to DEX
        IStartTradeRouter(dexRouter).addLiquidityAVAX{value: avaxLiquidity}(
            tokenAddress,
            tokenLiquidity,
            tokenLiquidity,
            avaxLiquidity,
            address(this), // LP tokens go to factory
            block.timestamp + 300
        );
        
        tokenInfo.isListed = true;
        
        emit TokenListed(tokenAddress, pair, tokenLiquidity);
    }

    /**
     * @dev Calculate tokens received for given AVAX amount
     */
    function calculateTokensForAVAX(address tokenAddress, uint256 avaxAmount) public view returns (uint256) {
        TokenInfo memory tokenInfo = tokens[tokenAddress];
        BondingCurveParams memory params = bondingCurves[tokenAddress];
        
        if (tokenInfo.tokenAddress == address(0)) return 0;
        
        // Simple linear bonding curve: price increases linearly with supply
        uint256 currentPrice = params.initialPrice + 
            ((params.finalPrice - params.initialPrice) * tokenInfo.currentSupply) / params.targetSupply;
        
        return avaxAmount / currentPrice;
    }

    /**
     * @dev Calculate AVAX needed for given token amount
     */
    function calculateAVAXForTokens(address tokenAddress, uint256 tokenAmount) public view returns (uint256) {
        TokenInfo memory tokenInfo = tokens[tokenAddress];
        BondingCurveParams memory params = bondingCurves[tokenAddress];
        
        if (tokenInfo.tokenAddress == address(0)) return 0;
        
        // Simple linear bonding curve calculation
        uint256 avgPrice = params.initialPrice + 
            ((params.finalPrice - params.initialPrice) * (tokenInfo.currentSupply + tokenAmount/2)) / params.targetSupply;
        
        return tokenAmount * avgPrice;
    }

    /**
     * @dev Get current token price
     */
    function getCurrentPrice(address tokenAddress) public view returns (uint256) {
        TokenInfo memory tokenInfo = tokens[tokenAddress];
        BondingCurveParams memory params = bondingCurves[tokenAddress];
        
        if (tokenInfo.tokenAddress == address(0)) return 0;
        
        return params.initialPrice + 
            ((params.finalPrice - params.initialPrice) * tokenInfo.currentSupply) / params.targetSupply;
    }

    /**
     * @dev Get all tokens created
     */
    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }

    /**
     * @dev Get token count
     */
    function getTokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    /**
     * @dev Update token creation fee (only owner)
     */
    function setTokenCreationFee(uint256 _fee) external onlyOwner {
        tokenCreationFee = _fee;
    }

    /**
     * @dev Update fee recipient (only owner)
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }

    /**
     * @dev Emergency withdraw (only owner)
     */
    function emergencyWithdraw() external onlyOwner {
        (bool success,) = owner().call{value: address(this).balance}("");
        if (!success) revert TransferFailed();
    }

    /**
     * @dev Receive AVAX
     */
    receive() external payable {}
}
