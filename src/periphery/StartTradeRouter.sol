// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IStartTradeRouter} from "../interfaces/IStartTradeRouter.sol";
import {IStartTradeFactory} from "../interfaces/IStartTradeFactory.sol";
import {IStartTradePair} from "../interfaces/IStartTradePair.sol";
import {IWAVAX} from "../interfaces/IWAVAX.sol";
import {StartTradeLibrary} from "../libraries/StartTradeLibrary.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StartTradeRouter is IStartTradeRouter, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable factory;
    address public immutable WAVAX;

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "StartTradeRouter: EXPIRED");
        _;
    }

    constructor(address _factory, address _WAVAX) {
        factory = _factory;
        WAVAX = _WAVAX;
    }

    receive() external payable {
        assert(msg.sender == WAVAX); // only accept AVAX via fallback from the WAVAX contract
    }

    // **** ADD LIQUIDITY ****
    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) internal virtual returns (uint256 amountA, uint256 amountB) {
        // create the pair if it doesn't exist yet
        if (IStartTradeFactory(factory).getPair(tokenA, tokenB) == address(0)) {
            IStartTradeFactory(factory).createPair(tokenA, tokenB);
        }
        (uint256 reserveA, uint256 reserveB) = StartTradeLibrary.getReserves(factory, tokenA, tokenB);
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = StartTradeLibrary.quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "StartTradeRouter: INSUFFICIENT_B_AMOUNT");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = StartTradeLibrary.quote(amountBDesired, reserveB, reserveA);
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, "StartTradeRouter: INSUFFICIENT_A_AMOUNT");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external virtual override ensure(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
        address pair = StartTradeLibrary.pairFor(factory, tokenA, tokenB);
        IERC20(tokenA).safeTransferFrom(msg.sender, pair, amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, pair, amountB);
        liquidity = IStartTradePair(pair).mint(to);
    }

    function addLiquidityAVAX(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountAVAXMin,
        address to,
        uint256 deadline
    ) external payable virtual override ensure(deadline) returns (uint256 amountToken, uint256 amountAVAX, uint256 liquidity) {
        (amountToken, amountAVAX) = _addLiquidity(
            token,
            WAVAX,
            amountTokenDesired,
            msg.value,
            amountTokenMin,
            amountAVAXMin
        );
        address pair = StartTradeLibrary.pairFor(factory, token, WAVAX);
        IERC20(token).safeTransferFrom(msg.sender, pair, amountToken);
        IWAVAX(WAVAX).deposit{value: amountAVAX}();
        assert(IWAVAX(WAVAX).transfer(pair, amountAVAX));
        liquidity = IStartTradePair(pair).mint(to);
        // refund dust AVAX, if any
        if (msg.value > amountAVAX) _safeTransferAVAX(msg.sender, msg.value - amountAVAX);
    }

    // **** REMOVE LIQUIDITY ****
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) public virtual override ensure(deadline) returns (uint256 amountA, uint256 amountB) {
        address pair = StartTradeLibrary.pairFor(factory, tokenA, tokenB);
        IERC20(pair).safeTransferFrom(msg.sender, pair, liquidity); // send liquidity to pair
        (uint256 amount0, uint256 amount1) = IStartTradePair(pair).burn(to);
        (address token0,) = StartTradeLibrary.sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin, "StartTradeRouter: INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "StartTradeRouter: INSUFFICIENT_B_AMOUNT");
    }

    function removeLiquidityAVAX(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountAVAXMin,
        address to,
        uint256 deadline
    ) public virtual override ensure(deadline) returns (uint256 amountToken, uint256 amountAVAX) {
        (amountToken, amountAVAX) = removeLiquidity(
            token,
            WAVAX,
            liquidity,
            amountTokenMin,
            amountAVAXMin,
            address(this),
            deadline
        );
        IERC20(token).safeTransfer(to, amountToken);
        IWAVAX(WAVAX).withdraw(amountAVAX);
        _safeTransferAVAX(to, amountAVAX);
    }

    // **** SWAP ****
    // requires the initial amount to have already been sent to the first pair
    function _swap(uint256[] memory amounts, address[] memory path, address _to) internal virtual {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = StartTradeLibrary.sortTokens(input, output);
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) = input == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
            address to = i < path.length - 2 ? StartTradeLibrary.pairFor(factory, output, path[i + 2]) : _to;
            IStartTradePair(StartTradeLibrary.pairFor(factory, input, output)).swap(
                amount0Out, amount1Out, to, new bytes(0)
            );
        }
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external virtual override ensure(deadline) returns (uint256[] memory amounts) {
        amounts = StartTradeLibrary.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "StartTradeRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        IERC20(path[0]).safeTransferFrom(
            msg.sender, StartTradeLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, to);
    }

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external virtual override ensure(deadline) returns (uint256[] memory amounts) {
        amounts = StartTradeLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, "StartTradeRouter: EXCESSIVE_INPUT_AMOUNT");
        IERC20(path[0]).safeTransferFrom(
            msg.sender, StartTradeLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, to);
    }

    function swapExactAVAXForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)
        external
        payable
        virtual
        override
        ensure(deadline)
        returns (uint256[] memory amounts)
    {
        require(path[0] == WAVAX, "StartTradeRouter: INVALID_PATH");
        amounts = StartTradeLibrary.getAmountsOut(factory, msg.value, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "StartTradeRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        IWAVAX(WAVAX).deposit{value: amounts[0]}();
        assert(IWAVAX(WAVAX).transfer(StartTradeLibrary.pairFor(factory, path[0], path[1]), amounts[0]));
        _swap(amounts, path, to);
    }

    function swapTokensForExactAVAX(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external virtual override ensure(deadline) returns (uint256[] memory amounts) {
        require(path[path.length - 1] == WAVAX, "StartTradeRouter: INVALID_PATH");
        amounts = StartTradeLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, "StartTradeRouter: EXCESSIVE_INPUT_AMOUNT");
        IERC20(path[0]).safeTransferFrom(
            msg.sender, StartTradeLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, address(this));
        IWAVAX(WAVAX).withdraw(amounts[amounts.length - 1]);
        _safeTransferAVAX(to, amounts[amounts.length - 1]);
    }

    function swapExactTokensForAVAX(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external virtual override ensure(deadline) returns (uint256[] memory amounts) {
        require(path[path.length - 1] == WAVAX, "StartTradeRouter: INVALID_PATH");
        amounts = StartTradeLibrary.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "StartTradeRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        IERC20(path[0]).safeTransferFrom(
            msg.sender, StartTradeLibrary.pairFor(factory, path[0], path[1]), amounts[0]
        );
        _swap(amounts, path, address(this));
        IWAVAX(WAVAX).withdraw(amounts[amounts.length - 1]);
        _safeTransferAVAX(to, amounts[amounts.length - 1]);
    }

    function swapAVAXForExactTokens(uint256 amountOut, address[] calldata path, address to, uint256 deadline)
        external
        payable
        virtual
        override
        ensure(deadline)
        returns (uint256[] memory amounts)
    {
        require(path[0] == WAVAX, "StartTradeRouter: INVALID_PATH");
        amounts = StartTradeLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= msg.value, "StartTradeRouter: EXCESSIVE_INPUT_AMOUNT");
        IWAVAX(WAVAX).deposit{value: amounts[0]}();
        assert(IWAVAX(WAVAX).transfer(StartTradeLibrary.pairFor(factory, path[0], path[1]), amounts[0]));
        _swap(amounts, path, to);
        // refund dust AVAX, if any
        if (msg.value > amounts[0]) _safeTransferAVAX(msg.sender, msg.value - amounts[0]);
    }

    // **** LIBRARY FUNCTIONS ****
    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB)
        public
        pure
        virtual
        override
        returns (uint256 amountB)
    {
        return StartTradeLibrary.quote(amountA, reserveA, reserveB);
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        public
        pure
        virtual
        override
        returns (uint256 amountOut)
    {
        return StartTradeLibrary.getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut)
        public
        pure
        virtual
        override
        returns (uint256 amountIn)
    {
        return StartTradeLibrary.getAmountIn(amountOut, reserveIn, reserveOut);
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        public
        view
        virtual
        override
        returns (uint256[] memory amounts)
    {
        return StartTradeLibrary.getAmountsOut(factory, amountIn, path);
    }

    function getAmountsIn(uint256 amountOut, address[] calldata path)
        public
        view
        virtual
        override
        returns (uint256[] memory amounts)
    {
        return StartTradeLibrary.getAmountsIn(factory, amountOut, path);
    }

    function _safeTransferAVAX(address to, uint256 value) internal {
        (bool success,) = to.call{value: value}(new bytes(0));
        require(success, "StartTradeRouter: AVAX_TRANSFER_FAILED");
    }
}
