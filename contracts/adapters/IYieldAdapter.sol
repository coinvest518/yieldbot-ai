// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IYieldAdapter
 * @notice Enhanced adapter interface with harvest support for multi-protocol yield
 * @dev Implementations should assume the vault is the only caller
 */
interface IYieldAdapter {
    /**
     * @notice The underlying ERC20 asset handled by the adapter (e.g., USDT, USDC)
     */
    function asset() external view returns (IERC20);

    /**
     * @notice Unique identifier for this adapter
     */
    function adapterId() external view returns (bytes32);

    /**
     * @notice Total underlying assets managed by this adapter
     * @dev MUST be denominated in the same units as `asset()`
     */
    function totalUnderlying() external view returns (uint256);

    /**
     * @notice Pending rewards that can be harvested (in asset terms or reward token)
     */
    function pendingRewards() external view returns (uint256);

    /**
     * @notice Deposit `assets` into the external protocol
     * @return deposited The amount of `asset` actually deposited
     */
    function deposit(uint256 assets) external returns (uint256 deposited);

    /**
     * @notice Withdraw `assets` from the external protocol to `to`
     * @return withdrawn The amount of `asset` actually withdrawn
     */
    function withdraw(uint256 assets, address to) external returns (uint256 withdrawn);

    /**
     * @notice Withdraws all managed funds to `to`
     */
    function withdrawAll(address to) external returns (uint256 withdrawn);

    /**
     * @notice Harvest rewards from the protocol and send to `to`
     * @return harvested Amount of rewards harvested (in asset value)
     */
    function harvest(address to) external returns (uint256 harvested);

    /**
     * @notice Current APY estimate in basis points (e.g., 800 = 8%)
     */
    function estimatedAPY() external view returns (uint256);
}
