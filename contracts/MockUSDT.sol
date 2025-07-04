// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDT
 * @dev Mock USDT token for testing purposes
 */
contract MockUSDT is ERC20, Ownable {
    uint8 private _decimals;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 decimals_,
        address _owner
    ) ERC20(_name, _symbol) Ownable(_owner) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Mint tokens to an address (for testing)
     * @param to Address to mint tokens to
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Faucet function for testing - allows anyone to mint tokens
     * @param amount Amount to mint to caller
     */
    function faucet(uint256 amount) external {
        require(amount <= 10000 * 10 ** _decimals, "Faucet limit exceeded");
        _mint(msg.sender, amount);
    }
}
