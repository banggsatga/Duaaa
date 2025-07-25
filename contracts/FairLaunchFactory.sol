// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./FairLaunchToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract FairLaunchFactory is Ownable, ReentrancyGuard {
    // State variables
    uint256 public launchFee = 0.1 ether; // 0.1 AVAX to create a launch
    address public feeRecipient;
    
    // Mappings
    mapping(address => address[]) public creatorTokens;
    mapping(address => bool) public isValidToken;
    address[] public allTokens;
    
    // Events
    event TokenLaunched(
        address indexed creator,
        address indexed tokenAddress,
        string name,
        string symbol,
        uint256 timestamp
    );
    event LaunchFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    
    // External contracts
    address public immutable WAVAX;
    address public immutable uniswapRouter;
    
    constructor(address _wavax, address _uniswapRouter) {
        WAVAX = _wavax;
        uniswapRouter = _uniswapRouter;
        feeRecipient = msg.sender;
    }
    
    // Create a new fair launch token
    function createToken(
        string memory _name,
        string memory _symbol,
        string memory _description,
        string memory _imageUrl,
        string memory _metadataUrl
    ) external payable nonReentrant returns (address) {
        require(msg.value >= launchFee, "Insufficient launch fee");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_symbol).length > 0, "Symbol cannot be empty");
        require(bytes(_symbol).length <= 6, "Symbol too long");
        
        // Deploy new token contract
        FairLaunchToken newToken = new FairLaunchToken(
            _name,
            _symbol,
            msg.sender,
            WAVAX,
            uniswapRouter
        );
        
        address tokenAddress = address(newToken);
        
        // Update mappings
        creatorTokens[msg.sender].push(tokenAddress);
        isValidToken[tokenAddress] = true;
        allTokens.push(tokenAddress);
        
        // Send launch fee to fee recipient
        if (msg.value > 0) {
            payable(feeRecipient).transfer(msg.value);
        }
        
        emit TokenLaunched(msg.sender, tokenAddress, _name, _symbol, block.timestamp);
        
        return tokenAddress;
    }
    
    // Get tokens created by a specific creator
    function getCreatorTokens(address _creator) external view returns (address[] memory) {
        return creatorTokens[_creator];
    }
    
    // Get all tokens
    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }
    
    // Get total number of tokens
    function getTotalTokens() external view returns (uint256) {
        return allTokens.length;
    }
    
    // Get token info by index
    function getTokenByIndex(uint256 _index) external view returns (address) {
        require(_index < allTokens.length, "Index out of bounds");
        return allTokens[_index];
    }
    
    // Get recent tokens
    function getRecentTokens(uint256 _count) external view returns (address[] memory) {
        uint256 totalTokens = allTokens.length;
        if (totalTokens == 0) {
            return new address[](0);
        }
        
        uint256 count = _count > totalTokens ? totalTokens : _count;
        address[] memory recentTokens = new address[](count);
        
        for (uint256 i = 0; i < count; i++) {
            recentTokens[i] = allTokens[totalTokens - 1 - i];
        }
        
        return recentTokens;
    }
    
    // Admin functions
    function setLaunchFee(uint256 _newFee) external onlyOwner {
        uint256 oldFee = launchFee;
        launchFee = _newFee;
        emit LaunchFeeUpdated(oldFee, _newFee);
    }
    
    function setFeeRecipient(address _newRecipient) external onlyOwner {
        require(_newRecipient != address(0), "Invalid recipient");
        address oldRecipient = feeRecipient;
        feeRecipient = _newRecipient;
        emit FeeRecipientUpdated(oldRecipient, _newRecipient);
    }
    
    // Emergency withdraw
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    // Check if token is valid
    function validateToken(address _token) external view returns (bool) {
        return isValidToken[_token];
    }
}
