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

    // Constants
    uint256 public constant BONDING_CURVE_CAP = 24 ether; // 24 AVAX
    uint256 public constant INITIAL_VIRTUAL_AVAX = 1 ether; // 1 AVAX
    uint256 public constant INITIAL_VIRTUAL_TOKEN = 1_000_000 * 10**18; // 1M tokens
    uint256 public constant PLATFORM_FEE_PERCENT = 100; // 1%
    uint256 public constant CREATOR_FEE_PERCENT = 100; // 1%
    uint256 public constant FEE_DENOMINATOR = 10000; // 100%

    // State variables
    IStartTradeRouter public immutable router;
    IStartTradeFactory public immutable factory;
    address public immutable WAVAX;
    
    address public feeRecipient;
    uint256 public tokenCreationFee = 0.01 ether;

    // Token tracking
    mapping(address => TokenInfo) public tokenInfo;
    mapping(address => bool) public isLaunched;
    address[] public allTokens;

    struct TokenInfo {
        address creator;
        uint256 virtualAvax;
        uint256 virtualTokens;
        uint256 realAvax;
        uint256 realTokens;
        bool isLaunched;
        uint256 createdAt;
    }

    // Events
    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        string description,
        string imageUrl
    );
    
    event TokenPurchased(
        address indexed token,
        address indexed buyer,
        uint256 avaxAmount,
        uint256 tokenAmount,
        uint256 newPrice
    );
    
    event TokenSold(
        address indexed token,
        address indexed seller,
        uint256 tokenAmount,
        uint256 avaxAmount,
        uint256 newPrice
    );
    
    event TokenLaunched(
        address indexed token,
        address indexed pair,
        uint256 avaxAmount,
        uint256 tokenAmount
    );

    // Custom errors
    error InsufficientPayment();
    error TokenNotFound();
    error TokenAlreadyLaunched();
    error InsufficientTokenBalance();
    error InsufficientAvaxReserves();
    error SlippageExceeded();
    error TransferFailed();

    constructor(
        address _router,
        address _factory,
        address _WAVAX,
        address _feeRecipient
    ) Ownable(msg.sender) {
        router = IStartTradeRouter(_router);
        factory = IStartTradeFactory(_factory);
        WAVAX = _WAVAX;
        feeRecipient = _feeRecipient;
    }

    function createToken(
        string memory name,
        string memory symbol,
        string memory description,
        string memory imageUrl
    ) external payable nonReentrant returns (address token) {
        if (msg.value < tokenCreationFee) revert InsufficientPayment();

        // Create new token
        token = address(new StartTradeToken(
            name,
            symbol,
            INITIAL_VIRTUAL_TOKEN,
            address(this),
            description,
            imageUrl
        ));

        // Initialize token info
        tokenInfo[token] = TokenInfo({
            creator: msg.sender,
            virtualAvax: INITIAL_VIRTUAL_AVAX,
            virtualTokens: INITIAL_VIRTUAL_TOKEN,
            realAvax: 0,
            realTokens: 0,
            isLaunched: false,
            createdAt: block.timestamp
        });

        allTokens.push(token);

        // Send creation fee to fee recipient
        if (tokenCreationFee > 0) {
            (bool success,) = feeRecipient.call{value: tokenCreationFee}("");
            if (!success) revert TransferFailed();
        }

        // Refund excess payment
        if (msg.value > tokenCreationFee) {
            (bool success,) = msg.sender.call{value: msg.value - tokenCreationFee}("");
            if (!success) revert TransferFailed();
        }

        emit TokenCreated(token, msg.sender, name, symbol, description, imageUrl);
    }

    function buyTokens(address token, uint256 minTokensOut) external payable nonReentrant {
        TokenInfo storage info = tokenInfo[token];
        if (info.creator == address(0)) revert TokenNotFound();
        if (info.isLaunched) revert TokenAlreadyLaunched();

        uint256 avaxAmount = msg.value;
        uint256 platformFee = (avaxAmount * PLATFORM_FEE_PERCENT) / FEE_DENOMINATOR;
        uint256 creatorFee = (avaxAmount * CREATOR_FEE_PERCENT) / FEE_DENOMINATOR;
        uint256 netAvaxAmount = avaxAmount - platformFee - creatorFee;

        // Calculate tokens to mint using bonding curve
        uint256 tokensOut = getTokensOut(token, netAvaxAmount);
        if (tokensOut < minTokensOut) revert SlippageExceeded();

        // Update reserves
        info.virtualAvax += netAvaxAmount;
        info.virtualTokens -= tokensOut;
        info.realAvax += netAvaxAmount;
        info.realTokens += tokensOut;

        // Mint tokens to buyer
        StartTradeToken(token).mint(msg.sender, tokensOut);

        // Send fees
        if (platformFee > 0) {
            (bool success,) = feeRecipient.call{value: platformFee}("");
            if (!success) revert TransferFailed();
        }
        
        if (creatorFee > 0) {
            (bool success,) = info.creator.call{value: creatorFee}("");
            if (!success) revert TransferFailed();
        }

        emit TokenPurchased(token, msg.sender, avaxAmount, tokensOut, getCurrentPrice(token));

        // Check if ready to launch
        if (info.realAvax >= BONDING_CURVE_CAP) {
            _launchToken(token);
        }
    }

    function sellTokens(address token, uint256 tokenAmount, uint256 minAvaxOut) external nonReentrant {
        TokenInfo storage info = tokenInfo[token];
        if (info.creator == address(0)) revert TokenNotFound();
        if (info.isLaunched) revert TokenAlreadyLaunched();

        if (IERC20(token).balanceOf(msg.sender) < tokenAmount) revert InsufficientTokenBalance();

        // Calculate AVAX to return using bonding curve
        uint256 avaxOut = getAvaxOut(token, tokenAmount);
        if (avaxOut < minAvaxOut) revert SlippageExceeded();
        if (info.realAvax < avaxOut) revert InsufficientAvaxReserves();

        // Update reserves
        info.virtualAvax -= avaxOut;
        info.virtualTokens += tokenAmount;
        info.realAvax -= avaxOut;
        info.realTokens -= tokenAmount;

        // Burn tokens from seller
        IERC20(token).safeTransferFrom(msg.sender, address(this), tokenAmount);
        StartTradeToken(token).burn(tokenAmount);

        // Send AVAX to seller
        (bool success,) = msg.sender.call{value: avaxOut}("");
        if (!success) revert TransferFailed();

        emit TokenSold(token, msg.sender, tokenAmount, avaxOut, getCurrentPrice(token));
    }

    function _launchToken(address token) internal {
        TokenInfo storage info = tokenInfo[token];
        
        // Create pair
        address pair = factory.createPair(token, WAVAX);
        
        // Add liquidity
        uint256 tokenLiquidity = info.realTokens;
        uint256 avaxLiquidity = info.realAvax;
        
        // Approve router to spend tokens
        IERC20(token).forceApprove(address(router), tokenLiquidity);
        
        // Add liquidity to DEX
        router.addLiquidityAVAX{value: avaxLiquidity}(
            token,
            tokenLiquidity,
            tokenLiquidity,
            avaxLiquidity,
            address(0), // Burn LP tokens
            block.timestamp + 300
        );
        
        // Mark as launched
        info.isLaunched = true;
        isLaunched[token] = true;
        
        emit TokenLaunched(token, pair, avaxLiquidity, tokenLiquidity);
    }

    // View functions
    function getTokensOut(address token, uint256 avaxAmount) public view returns (uint256) {
        TokenInfo memory info = tokenInfo[token];
        if (info.creator == address(0)) return 0;
        
        // Bonding curve: k = virtualAvax * virtualTokens
        uint256 k = info.virtualAvax * info.virtualTokens;
        uint256 newVirtualAvax = info.virtualAvax + avaxAmount;
        uint256 newVirtualTokens = k / newVirtualAvax;
        
        return info.virtualTokens - newVirtualTokens;
    }

    function getAvaxOut(address token, uint256 tokenAmount) public view returns (uint256) {
        TokenInfo memory info = tokenInfo[token];
        if (info.creator == address(0)) return 0;
        
        // Bonding curve: k = virtualAvax * virtualTokens
        uint256 k = info.virtualAvax * info.virtualTokens;
        uint256 newVirtualTokens = info.virtualTokens + tokenAmount;
        uint256 newVirtualAvax = k / newVirtualTokens;
        
        return info.virtualAvax - newVirtualAvax;
    }

    function getCurrentPrice(address token) public view returns (uint256) {
        TokenInfo memory info = tokenInfo[token];
        if (info.creator == address(0) || info.virtualTokens == 0) return 0;
        
        return (info.virtualAvax * 1e18) / info.virtualTokens;
    }

    function getAllTokensLength() external view returns (uint256) {
        return allTokens.length;
    }

    // Admin functions
    function setTokenCreationFee(uint256 _fee) external onlyOwner {
        tokenCreationFee = _fee;
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }

    function emergencyWithdraw() external onlyOwner {
        (bool success,) = owner().call{value: address(this).balance}("");
        if (!success) revert TransferFailed();
    }

    receive() external payable {}
}
