<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Factoring Finance Smart Contract Project

## Context
This project implements a smart contract system for factoring finance using USDC/USDT stablecoins. The system allows businesses to factor their bills (accounts receivable) for immediate cash flow.

## Architecture
- **FactoringContract.sol**: Main contract handling factoring logic, bill management, and fund distribution
- **MockUSDC.sol** / **MockUSDT.sol**: Mock stablecoin contracts for testing
- Bills are represented as NFTs using ERC721 standard
- Uses OpenZeppelin contracts for security and standards compliance

## Key Features
1. **Pool Management**: Investors can deposit USDC/USDT into liquidity pools
2. **Bill Creation**: Bill owners create factoring requests as NFTs
3. **Upfront Payment**: 80% of bill value paid immediately to bill owner
4. **Bill Completion**: When debtor pays, funds are distributed:
   - 80% returns to liquidity pool
   - 15% paid to bill owner
   - 5% retained as platform fees

## Development Guidelines
- Always use SafeERC20 for token transfers
- Include comprehensive access controls and security measures
- Write extensive tests for all contract functions
- Use events for important state changes
- Follow OpenZeppelin security patterns
- Consider gas optimization in contract design

## Testing
- Use Hardhat testing framework with TypeScript
- Create fixtures for reusable test setups
- Test all edge cases and security scenarios
- Include integration tests for complete workflows
