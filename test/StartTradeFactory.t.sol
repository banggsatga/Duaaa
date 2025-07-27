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
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;

    function deposit() external payable {
        _balances[msg.sender] += msg.value;
        _totalSupply += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(_balances[msg.sender] >= amount, "Insufficient balance");
        _balances[msg.sender] -= amount;
        _totalSupply -= amount;
        payable(msg.sender).transfer(amount);
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        return true;
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        _allowances[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        _allowances[from][msg.sender] -= amount;
        _balances[from] -= amount;
        _balances[to] += amount;
        return true;
    }

    receive() external payable {
        deposit();
    }
}

contract StartTradeFactoryTest is Test {
    StartTradeFactory factory;
    StartTradeRouter router;
    StartTradeTokenFactory tokenFactory;
    MockWAVAX wavax;
    
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address feeRecipient = makeAddr("feeRecipient");

    function setUp() public {
        // Deploy contracts
        wavax = new MockWAVAX();
        factory = new StartTradeFactory(address(this));
        router = new StartTradeRouter(address(factory), address(wavax));
        tokenFactory = new StartTradeTokenFactory(
            address(router),
            address(factory),
            address(wavax),
            feeRecipient
        );

        // Fund test accounts
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(address(this), 100 ether);
    }

    function testCreatePair() public {
        // Create two test tokens
        StartTradeToken tokenA = new StartTradeToken(
            "Token A",
            "TKNA",
            1000000 * 10**18,
            address(this),
            "Test token A",
            "https://example.com/a.png"
        );
        
        StartTradeToken tokenB = new StartTradeToken(
            "Token B",
            "TKNB",
            1000000 * 10**18,
            address(this),
            "Test token B",
            "https://example.com/b.png"
        );

        // Create pair
        address pair = factory.createPair(address(tokenA), address(tokenB));
        
        // Verify pair was created
        assertEq(factory.getPair(address(tokenA), address(tokenB)), pair);
        assertEq(factory.getPair(address(tokenB), address(tokenA)), pair);
        assertEq(factory.allPairsLength(), 1);
    }

    function testTokenCreation() public {
        vm.startPrank(alice);
        
        // Create token with creation fee
        address token = tokenFactory.createToken{value: 0.01 ether}(
            "Alice Token",
            "ALICE",
            "Alice's awesome token",
            "https://example.com/alice.png"
        );

        // Verify token was created
        assertTrue(token != address(0));
        assertEq(tokenFactory.getAllTokensLength(), 1);
        
        // Check token info
        (address creator,,,,,) = tokenFactory.tokenInfo(token);
        assertEq(creator, alice);
        
        vm.stopPrank();
    }

    function testBuyTokens() public {
        vm.startPrank(alice);
        
        // Create token
        address token = tokenFactory.createToken{value: 0.01 ether}(
            "Alice Token",
            "ALICE",
            "Alice's awesome token",
            "https://example.com/alice.png"
        );

        // Buy tokens
        uint256 avaxAmount = 1 ether;
        uint256 expectedTokens = tokenFactory.getTokensOut(token, avaxAmount * 98 / 100); // Account for fees
        
        tokenFactory.buyTokens{value: avaxAmount}(token, 0);
        
        // Verify tokens were received
        assertGt(IERC20(token).balanceOf(alice), 0);
        
        vm.stopPrank();
    }

    function testSellTokens() public {
        vm.startPrank(alice);
        
        // Create and buy tokens first
        address token = tokenFactory.createToken{value: 0.01 ether}(
            "Alice Token",
            "ALICE",
            "Alice's awesome token",
            "https://example.com/alice.png"
        );

        tokenFactory.buyTokens{value: 1 ether}(token, 0);
        uint256 tokenBalance = IERC20(token).balanceOf(alice);
        
        // Approve token factory to spend tokens
        IERC20(token).approve(address(tokenFactory), tokenBalance / 2);
        
        // Sell half the tokens
        uint256 balanceBefore = alice.balance;
        tokenFactory.sellTokens(token, tokenBalance / 2, 0);
        
        // Verify AVAX was received
        assertGt(alice.balance, balanceBefore);
        
        vm.stopPrank();
    }

    receive() external payable {}
}
