// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IWAVAX {
    function deposit() external payable;
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

interface IUniswapV2Router {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);
}

contract FairLaunchToken is ERC20, Ownable, ReentrancyGuard {
    // Constants
    uint256 public constant LAUNCH_CAP = 200 ether; // 200 AVAX
    uint256 public constant INITIAL_PRICE = 0.000001 ether; // 0.000001 AVAX per token
    uint256 public constant FEE_PERCENTAGE = 20; // 20% to contract, 80% to creator
    uint256 public constant PRICE_INCREMENT_FACTOR = 1000000; // Price increment factor
    
    // State variables
    address public creator;
    uint256 public totalRaised;
    uint256 public currentPrice;
    bool public isLaunched;
    bool public isCompleted;
    
    // Mappings
    mapping(address => uint256) public contributions;
    mapping(address => uint256) public tokenBalances;
    
    // Events
    event TokensPurchased(address indexed buyer, uint256 avaxAmount, uint256 tokensReceived, uint256 newPrice);
    event TokensSold(address indexed seller, uint256 tokensAmount, uint256 avaxReceived, uint256 newPrice);
    event LaunchCompleted(address indexed tokenAddress, uint256 totalRaised);
    event FeesDistributed(address indexed creator, uint256 creatorFee, uint256 contractFee);
    
    // External contracts
    IWAVAX public immutable WAVAX;
    IUniswapV2Router public immutable uniswapRouter;
    
    constructor(
        string memory _name,
        string memory _symbol,
        address _creator,
        address _wavax,
        address _uniswapRouter
    ) ERC20(_name, _symbol) {
        creator = _creator;
        currentPrice = INITIAL_PRICE;
        isLaunched = true;
        isCompleted = false;
        WAVAX = IWAVAX(_wavax);
        uniswapRouter = IUniswapV2Router(_uniswapRouter);
        
        // Transfer ownership to creator
        _transferOwnership(_creator);
    }
    
    // Calculate price based on bonding curve
    function calculatePrice(uint256 _totalRaised) public pure returns (uint256) {
        if (_totalRaised == 0) return INITIAL_PRICE;
        
        // Exponential bonding curve: price = initial_price * (1 + total_raised / price_increment_factor)^2
        uint256 factor = (_totalRaised * 1e18) / (PRICE_INCREMENT_FACTOR * 1e18) + 1e18;
        uint256 newPrice = (INITIAL_PRICE * factor * factor) / (1e18 * 1e18);
        
        return newPrice;
    }
    
    // Calculate tokens to mint for given AVAX amount
    function calculateTokensForAVAX(uint256 _avaxAmount) public view returns (uint256) {
        if (_avaxAmount == 0) return 0;
        
        uint256 tokensToMint = 0;
        uint256 remainingAVAX = _avaxAmount;
        uint256 simulatedRaised = totalRaised;
        
        // Simulate the purchase to calculate total tokens
        while (remainingAVAX > 0 && simulatedRaised < LAUNCH_CAP) {
            uint256 priceAtLevel = calculatePrice(simulatedRaised);
            uint256 avaxForOneToken = priceAtLevel;
            
            if (remainingAVAX >= avaxForOneToken) {
                tokensToMint += 1e18; // 1 token
                remainingAVAX -= avaxForOneToken;
                simulatedRaised += avaxForOneToken;
            } else {
                // Partial token
                tokensToMint += (remainingAVAX * 1e18) / avaxForOneToken;
                remainingAVAX = 0;
            }
        }
        
        return tokensToMint;
    }
    
    // Calculate AVAX to receive for given token amount
    function calculateAVAXForTokens(uint256 _tokenAmount) public view returns (uint256) {
        if (_tokenAmount == 0) return 0;
        
        uint256 avaxToReceive = 0;
        uint256 remainingTokens = _tokenAmount;
        uint256 simulatedRaised = totalRaised;
        
        // Simulate the sale to calculate total AVAX
        while (remainingTokens > 0 && simulatedRaised > 0) {
            uint256 priceAtLevel = calculatePrice(simulatedRaised);
            uint256 tokensAtLevel = 1e18; // 1 token
            
            if (remainingTokens >= tokensAtLevel) {
                avaxToReceive += priceAtLevel;
                remainingTokens -= tokensAtLevel;
                simulatedRaised -= priceAtLevel;
            } else {
                // Partial token
                avaxToReceive += (remainingTokens * priceAtLevel) / tokensAtLevel;
                remainingTokens = 0;
            }
        }
        
        return avaxToReceive;
    }
    
    // Buy tokens with AVAX
    function buyTokens() external payable nonReentrant {
        require(isLaunched && !isCompleted, "Launch not active");
        require(msg.value > 0, "Must send AVAX");
        require(totalRaised + msg.value <= LAUNCH_CAP, "Exceeds launch cap");
        
        uint256 tokensToMint = calculateTokensForAVAX(msg.value);
        require(tokensToMint > 0, "No tokens to mint");
        
        // Update state
        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;
        
        // Mint tokens to buyer
        _mint(msg.sender, tokensToMint);
        tokenBalances[msg.sender] += tokensToMint;
        
        // Update current price
        currentPrice = calculatePrice(totalRaised);
        
        // Distribute fees
        _distributeFees(msg.value);
        
        emit TokensPurchased(msg.sender, msg.value, tokensToMint, currentPrice);
        
        // Check if launch is completed
        if (totalRaised >= LAUNCH_CAP) {
            _completeLaunch();
        }
    }
    
    // Sell tokens for AVAX
    function sellTokens(uint256 _tokenAmount) external nonReentrant {
        require(isLaunched && !isCompleted, "Launch not active");
        require(_tokenAmount > 0, "Must specify token amount");
        require(balanceOf(msg.sender) >= _tokenAmount, "Insufficient token balance");
        
        uint256 avaxToReceive = calculateAVAXForTokens(_tokenAmount);
        require(avaxToReceive > 0, "No AVAX to receive");
        require(address(this).balance >= avaxToReceive, "Insufficient contract balance");
        
        // Burn tokens from seller
        _burn(msg.sender, _tokenAmount);
        tokenBalances[msg.sender] -= _tokenAmount;
        
        // Update state
        totalRaised -= avaxToReceive;
        currentPrice = calculatePrice(totalRaised);
        
        // Distribute fees
        uint256 feeAmount = (avaxToReceive * FEE_PERCENTAGE) / 100;
        uint256 sellerAmount = avaxToReceive - feeAmount;
        
        // Send AVAX to seller
        payable(msg.sender).transfer(sellerAmount);
        
        // Keep fee in contract
        
        emit TokensSold(msg.sender, _tokenAmount, sellerAmount, currentPrice);
    }
    
    // Internal function to distribute fees
    function _distributeFees(uint256 _amount) internal {
        uint256 contractFee = (_amount * FEE_PERCENTAGE) / 100;
        uint256 creatorFee = _amount - contractFee;
        
        // Send creator fee
        if (creatorFee > 0) {
            payable(creator).transfer(creatorFee);
        }
        
        // Contract fee stays in contract
        
        emit FeesDistributed(creator, creatorFee, contractFee);
    }
    
    // Complete launch and add liquidity
    function _completeLaunch() internal {
        isCompleted = true;
        
        // Calculate liquidity amounts
        uint256 contractBalance = address(this).balance;
        uint256 liquidityAVAX = contractBalance / 2; // Use half for liquidity
        uint256 liquidityTokens = totalSupply() / 2; // Use half of tokens for liquidity
        
        // Mint additional tokens for liquidity
        _mint(address(this), liquidityTokens);
        
        // Convert AVAX to WAVAX
        WAVAX.deposit{value: liquidityAVAX}();
        
        // Approve router to spend tokens and WAVAX
        _approve(address(this), address(uniswapRouter), liquidityTokens);
        WAVAX.transfer(address(uniswapRouter), liquidityAVAX);
        
        // Add liquidity to Uniswap
        try uniswapRouter.addLiquidity(
            address(this),
            address(WAVAX),
            liquidityTokens,
            liquidityAVAX,
            0, // Accept any amount of tokens
            0, // Accept any amount of WAVAX
            creator, // LP tokens go to creator
            block.timestamp + 300 // 5 minutes deadline
        ) {
            emit LaunchCompleted(address(this), totalRaised);
        } catch {
            // If liquidity addition fails, keep tokens and AVAX in contract
            isCompleted = false;
        }
    }
    
    // Emergency functions
    function emergencyWithdraw() external onlyOwner {
        require(isCompleted || block.timestamp > block.timestamp + 30 days, "Launch still active");
        payable(owner()).transfer(address(this).balance);
    }
    
    function updateCreator(address _newCreator) external onlyOwner {
        creator = _newCreator;
    }
    
    // View functions
    function getTokenInfo() external view returns (
        string memory name,
        string memory symbol,
        address creatorAddress,
        uint256 totalRaisedAmount,
        uint256 currentTokenPrice,
        uint256 totalTokenSupply,
        bool launchCompleted
    ) {
        return (
            name(),
            symbol(),
            creator,
            totalRaised,
            currentPrice,
            totalSupply(),
            isCompleted
        );
    }
    
    function getUserInfo(address _user) external view returns (
        uint256 userContribution,
        uint256 userTokenBalance,
        uint256 userAVAXValue
    ) {
        uint256 tokenBalance = balanceOf(_user);
        uint256 avaxValue = calculateAVAXForTokens(tokenBalance);
        
        return (
            contributions[_user],
            tokenBalance,
            avaxValue
        );
    }
    
    // Receive function to accept AVAX
    receive() external payable {
        if (msg.value > 0) {
            buyTokens();
        }
    }
}
