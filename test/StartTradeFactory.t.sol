// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {StartTradeFactory} from "../src/core/StartTradeFactory.sol";
import {StartTradePair} from "../src/core/StartTradePair.sol";
import {StartTradeRouter} from "../src/periphery/StartTradeRouter.sol";
import {StartTradeTokenFactory} from "../src/factory/StartTradeTokenFactory.sol";
import {StartTradeToken} from "../src/token/StartTradeToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockWAVAX is IERC20 {
    string public name = "Wrapped AVAX";
    string public symbol = "WAVAX";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    event Deposit(address indexed dst, uint256 wad);
    event Withdrawal(address indexed src, uint256 wad);
    
    receive() external payable {
        deposit();
    }
    
    function deposit() public payable {
        balanceOf[msg.sender] += msg.value;
        totalSupply += msg.value;
        emit Deposit(msg.sender, msg.value);
    }
    
    function withdraw(uint256 wad) public {
        require(balanceOf[msg.sender] >= wad);
        balanceOf[msg.sender] -= wad;
        totalSupply -= wad;
        payable(msg.sender).transfer(wad);
        emit Withdrawal(msg.sender, wad);
    }
    
    function transfer(address to, uint256 value) public returns (bool) {
        return transferFrom(msg.sender, to, value);
    }
    
    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        require(balanceOf[from] >= value);
        
        if (from != msg.sender && allowance[from][msg.sender] != type(uint256).max) {
            require(allowance[from][msg.sender] >= value);
            allowance[from][msg.sender] -= value;
        }
        
        balanceOf[from] -= value;
        balanceOf[to] += value;
        
        emit Transfer(from, to, value);
        return true;
    }
    
    function approve(address spender, uint256 value) public returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }
}

contract StartTradeFactoryTest is Test {
    StartTradeFactory public factory;
    StartTradeRouter public router;
    StartTradeTokenFactory public tokenFactory;
    MockWAVAX public wavax;
    
    address public owner = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);
    address public feeRecipient = address(0x4);
    
    function setUp() public {
        vm.deal(owner, 100 ether);
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        
        vm.startPrank(owner);
        
        // Deploy WAVAX
        wavax = new MockWAVAX();
        
        // Deploy factory
        factory = new StartTradeFactory(owner);
        
        // Deploy router
        router = new StartTradeRouter(address(factory), address(wavax));
        
        // Deploy token factory
        tokenFactory = new StartTradeTokenFactory(
            address(factory),
            address(router),
            address(wavax),
            feeRecipient,
            owner
        );
        
        vm.stopPrank();
    }
    
    function testCreatePair() public {
        vm.startPrank(owner);
        
        // Create two test tokens
        StartTradeToken tokenA = new StartTradeToken(
            "Token A", "TKNA", 18, 1000000 * 10**18, owner,
            "Test token A", "", "", "", ""
        );
        StartTradeToken tokenB = new StartTradeToken(
            "Token B", "TKNB", 18, 1000000 * 10**18, owner,
            "Test token B", "", "", "", ""
        );
        
        // Create pair
        address pair = factory.createPair(address(tokenA), address(tokenB));
        
        // Verify pair was created
        assertEq(factory.getPair(address(tokenA), address(tokenB)), pair);
        assertEq(factory.getPair(address(tokenB), address(tokenA)), pair);
        assertEq(factory.allPairsLength(), 1);
        
        vm.stopPrank();
    }
    
    function testTokenCreation() public {
        vm.startPrank(user1);
        
        uint256 creationFee = tokenFactory.tokenCreationFee();
        
        // Create token
        address tokenAddress = tokenFactory.createToken{value: creationFee}(
            "Test Token",
            "TEST",
            "A test token for bonding curve",
            "https://example.com/image.png",
            "https://example.com",
            "https://t.me/test",
            "https://twitter.com/test",
            100 ether // 100 AVAX market cap target
        );
        
        // Verify token was created
        (address storedAddress, address creator,,,,,,,) = tokenFactory.tokens(tokenAddress);
        assertEq(storedAddress, tokenAddress);
        assertEq(creator, user1);
        
        vm.stopPrank();
    }
    
    function testBuyTokens() public {
        vm.startPrank(user1);
        
        uint256 creationFee = tokenFactory.tokenCreationFee();
        
        // Create token
        address tokenAddress = tokenFactory.createToken{value: creationFee}(
            "Test Token",
            "TEST",
            "A test token for bonding curve",
            "https://example.com/image.png",
            "https://example.com",
            "https://t.me/test",
            "https://twitter.com/test",
            100 ether
        );
        
        // Buy tokens
        uint256 avaxAmount = 1 ether;
        uint256 tokensBefore = IERC20(tokenAddress).balanceOf(user1);
        
        tokenFactory.buyTokens{value: avaxAmount}(tokenAddress);
        
        uint256 tokensAfter = IERC20(tokenAddress).balanceOf(user1);
        assertGt(tokensAfter, tokensBefore);
        
        vm.stopPrank();
    }
    
    function testAddLiquidity() public {
        vm.startPrank(owner);
        
        // Create test tokens
        StartTradeToken tokenA = new StartTradeToken(
            "Token A", "TKNA", 18, 1000000 * 10**18, owner,
            "Test token A", "", "", "", ""
        );
        
        // Approve router
        tokenA.approve(address(router), 1000 * 10**18);
        
        // Add liquidity
        router.addLiquidityAVAX{value: 10 ether}(
            address(tokenA),
            1000 * 10**18,
            900 * 10**18,
            9 ether,
            owner,
            block.timestamp + 300
        );
        
        // Verify pair exists
        address pair = factory.getPair(address(tokenA), address(wavax));
        assertNotEq(pair, address(0));
        
        vm.stopPrank();
    }
    
    function testSwap() public {
        vm.startPrank(owner);
        
        // Create test tokens and add liquidity first
        StartTradeToken tokenA = new StartTradeToken(
            "Token A", "TKNA", 18, 1000000 * 10**18, owner,
            "Test token A", "", "", "", ""
        );
        
        tokenA.approve(address(router), 1000 * 10**18);
        
        router.addLiquidityAVAX{value: 10 ether}(
            address(tokenA),
            1000 * 10**18,
            900 * 10**18,
            9 ether,
            owner,
            block.timestamp + 300
        );
        
        // Perform swap
        address[] memory path = new address[](2);
        path[0] = address(wavax);
        path[1] = address(tokenA);
        
        uint256 tokenBalanceBefore = tokenA.balanceOf(owner);
        
        router.swapExactAVAXForTokens{value: 1 ether}(
            0,
            path,
            owner,
            block.timestamp + 300
        );
        
        uint256 tokenBalanceAfter = tokenA.balanceOf(owner);
        assertGt(tokenBalanceAfter, tokenBalanceBefore);
        
        vm.stopPrank();
    }
}
