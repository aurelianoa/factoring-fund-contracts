# Factoring Finance Smart Contracts

A comprehensive smart contract system for factoring finance using USDC/USDT stablecoins. This system enables businesses to factor their accounts receivable (bills) for immediate cash flow while providing investors with opportunities to earn returns.

## 🚀 Features

### Core Functionality
- **Bill Factoring**: Convert accounts receivable into immediate cash
- **Multi-Token Support**: Works with USDC and USDT stablecoins
- **NFT Representation**: Each bill is represented as an ERC721 NFT
- **Liquidity Pools**: Investors can deposit funds to earn returns
- **Automated Distribution**: Smart contract handles all payments and fees
- **Flexible Conditions**: Configurable fee structure per bill via Conditions struct

### Financial Flow
1. **Upfront Payment**: Bill owners receive configurable percentage (default 80%) of bill value immediately
2. **Bill Completion**: When debtor pays the full amount, funds are distributed according to bill conditions:
   - Upfront amount returns to the liquidity pool
   - Configurable percentage goes to the bill owner (default 15%)
   - Configurable percentage retained as platform fees (default 5%)

### Conditions System
Each bill can have custom conditions or use default settings:
- **Default Conditions**: 5% platform fees, 80% upfront payment, 15% to bill owner on completion
- **Custom Conditions**: Can be set per bill for flexible terms
- **Validation**: All percentages must be positive and cannot exceed 100% total

### NFT Transfer Control (via BillNFT)
- **Locked by Default**: All bill NFTs start in a locked state and cannot be transferred
- **Owner-Controlled Unlocking**: Only the contract owner can unlock NFTs for transfer
- **Re-locking Capability**: Contract owner can lock NFTs again at any time
- **No Operator Approvals**: `setApprovalForAll` is completely disabled for security
- **Secure Approval**: Individual NFT approvals only work on unlocked NFTs
- **Modular Implementation**: All NFT logic is contained in the separate BillNFT contract

### Security Features
- **Access Control**: Owner-only functions for critical operations
- **Reentrancy Protection**: Prevents reentrancy attacks
- **Pausable**: Emergency pause functionality
- **SafeERC20**: Secure token transfer operations

## 🏗 Contract Architecture

The system is built with a modular architecture for better code organization and reusability:

### BillNFT.sol
A standalone NFT contract that handles all ERC721 functionality and transfer controls:
- **ERC721 Implementation**: Standard NFT functionality for bill representation
- **Transfer Control System**: NFTs are locked by default, only contract owner can unlock
- **Security Features**: No operator approvals allowed, individual approvals only on unlocked NFTs
- **Modular Design**: Can be inherited by other contracts or used independently
- **Events**: Emits `NFTUnlocked` and `NFTLocked` events for transparency

### FactoringContract.sol  
The main business logic contract that inherits from BillNFT:
- **Factoring Logic**: Bill creation, funding, and completion workflows
- **Pool Management**: Investor deposits and withdrawals
- **Payment Distribution**: Automated fund allocation according to bill conditions
- **Business Rules**: Default and custom conditions for flexible terms
- **Integration**: Uses BillNFT for all NFT-related operations

### Fund.sol
A comprehensive fund contract that acts as both lender and debtor intermediary:
- **Multi-Investor Support**: Pools funds from multiple investors
- **Automated Offers**: Creates competitive offers for bill requests automatically
- **Profit Sharing**: Distributes profits proportionally among fund participants
- **Bill Management**: Manages debtor bill requests and payments
- **Access Control**: Authorized admin functions for fund management

### SimpleFund.sol
A simplified solo investor version of the Fund contract:
- **Solo Investor Model**: No multiple investors to manage
- **Authorized Access**: Only authorized wallets can deposit/withdraw funds
- **Automated Operations**: Automatic bill request and offer creation
- **Management Fees**: Collects and manages fees for the contract owner
- **Streamlined Design**: Simpler architecture without investor complexity

### Benefits of Modular Design
- **Separation of Concerns**: NFT logic separated from business logic
- **Reusability**: BillNFT can be used in other projects
- **Maintainability**: Easier to update and audit individual components
- **Testability**: Each contract can be tested independently
- **Gas Efficiency**: Optimized inheritance structure
- **Flexibility**: Choose between Fund (multi-investor) or SimpleFund (solo investor)

## 📁 Project Structure

```
contracts/
├── FactoringContract.sol    # Main factoring contract (inherits from BillNFT)
├── BillNFT.sol             # Modular NFT contract with transfer controls
├── Fund.sol                # Multi-investor pooled fund contract
├── SimpleFund.sol          # Solo investor fund contract
├── MockUSDC.sol            # Mock USDC for testing
├── MockUSDT.sol            # Mock USDT for testing
└── Lock.sol                # Default Hardhat contract

test/
├── FactoringContract.test.ts # Core contract tests
├── Fund.test.ts              # Multi-investor fund tests
├── SimpleFund.test.ts        # Solo investor fund tests
└── Lock.ts                   # Default Hardhat test

ignition/
└── modules/
    ├── MockUSDCModule.ts     # Mock USDC token deployment
    ├── MockUSDTModule.ts     # Mock USDT token deployment
    ├── FactoringModule.ts    # Core factoring marketplace deployment
    ├── SimpleFundModule.ts   # Solo investor fund deployment
    └── FundModule.ts         # Multi-investor fund deployment
```

## 🛠 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd factoring
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Compile contracts**
   ```bash
   npx hardhat compile
   ```

## 🚀 Demo Scripts

### Basic Factoring Demo
```bash
npx hardhat run scripts/demo.ts
```

### NFT Lock/Unlock Demo
```bash
npx hardhat run scripts/nft-lock-demo.ts
```

This demo showcases:
- NFT lock/unlock functionality
- Transfer restrictions and security measures
- Payment routing to current NFT owner
- Contract owner controls

## 🧪 Testing

Run the comprehensive test suite:
```bash
npx hardhat test
```

The test suite includes:
- Contract deployment and initialization
- Pool management (deposits/withdrawals)
- Bill creation and NFT minting
- Bill funding and completion
- Edge cases and security tests
- Multi-token support verification

## 🚀 Deployment

The project includes three independent Hardhat Ignition modules for different deployment scenarios:

### Available Deployment Modules

1. **FactoringModule** - Core factoring contract with mock tokens
2. **SimpleFundModule** - Solo investor fund with auto-offer functionality  
3. **FundModule** - Multi-investor pooled fund

### Quick Deploy Commands

```bash
# Deploy core factoring contract only
npm run deploy:factoring:local

# Deploy simple fund (solo investor)
npm run deploy:simple-fund:local

# Deploy multi-investor fund
npm run deploy:fund:local
```

### Using the Deployment Helper Script

```bash
# Interactive deployment helper
npm run deploy-ignition

# Deploy specific modules
npm run deploy-ignition factoring localhost
npm run deploy-ignition simple-fund localhost
npm run deploy-ignition fund localhost
```

### Manual Hardhat Ignition Deployment

```bash
# Start local network
npx hardhat node

# Deploy FactoringContract + MockTokens
npx hardhat ignition deploy ./ignition/modules/FactoringModule.ts --network localhost

# Deploy SimpleFund + Dependencies
npx hardhat ignition deploy ./ignition/modules/SimpleFundModule.ts --network localhost

# Deploy Fund + Dependencies
npx hardhat ignition deploy ./ignition/modules/FundModule.ts --network localhost
```

### Testnet Deployment

```bash
# Deploy to Sepolia testnet
npx hardhat ignition deploy ./ignition/modules/FactoringModule.ts --network sepolia
npx hardhat ignition deploy ./ignition/modules/SimpleFundModule.ts --network sepolia
npx hardhat ignition deploy ./ignition/modules/FundModule.ts --network sepolia
```

### Module Configurations

#### FactoringModule
- **MockUSDC**: 6 decimals, deployer as owner
- **MockUSDT**: 6 decimals, deployer as owner  
- **FactoringContract**: Core marketplace contract

#### SimpleFundModule
- **All of FactoringModule** +
- **SimpleFund**: Solo investor fund with auto-offering
  - Management fee: 5%
  - Bill terms: 3% fee, 80% upfront, 17% on completion
  - Amount limits: $1K - $50K

#### FundModule  
- **All of FactoringModule** +
- **Fund**: Multi-investor pooled fund
  - Investment range: $5K - $100K per investor
  - Target fund size: $1M
  - Management fee: 2%
  - Bill terms: 4% fee, 80% upfront, 16% on completion
  - Amount limits: $2K - $100K

## 📊 Contract Interactions

### For Investors
1. **Deposit to Pool**
   ```solidity
   factoringContract.depositToPool(amount, tokenAddress);
   ```

2. **Withdraw from Pool** (Owner only)
   ```solidity
   factoringContract.withdrawFromPool(amount, tokenAddress);
   ```

### For Bill Owners
1. **Create Bill with Default Conditions**
   ```solidity
   factoringContract.createBill(totalAmount, dueDate, tokenAddress, description);
   ```

2. **Create Bill with Custom Conditions**
   ```solidity
   Conditions memory customConditions = Conditions({
     feePercentage: 3,      // 3% platform fee
     upfrontPercentage: 90, // 90% upfront payment
     ownerPercentage: 7     // 7% to owner on completion
   });
   
   factoringContract.createBillWithConditions(
     totalAmount, dueDate, tokenAddress, description, customConditions
   );
   ```

3. **Receive NFT**: Automatically minted upon bill creation

### For Contract Owner
1. **Set Default Conditions**
   ```solidity
   factoringContract.setDefaultConditions(feePercentage, upfrontPercentage, ownerPercentage);
   ```

2. **Fund Bill** (Pay upfront percentage)
   ```solidity
   factoringContract.fundBill(billId);
   ```

3. **NFT Lock/Unlock Controls** (inherited from BillNFT)
   ```solidity
   factoringContract.unlockNFT(billId);  // Allow NFT transfers
   factoringContract.lockNFT(billId);    // Prevent NFT transfers
   factoringContract.isNFTUnlocked(billId); // Check lock status
   ```

4. **Emergency Controls**
   ```solidity
   factoringContract.pause();
   factoringContract.unpause();
   ```

### For NFT Holders
1. **Check NFT Lock Status**
   ```solidity
   bool isUnlocked = factoringContract.isNFTUnlocked(billId);
   ```

2. **Transfer Unlocked NFT**
   ```solidity
   // Only works if NFT is unlocked by contract owner
   factoringContract.transferFrom(from, to, billId);
   ```

3. **Approve Unlocked NFT**
   ```solidity
   // Only works if NFT is unlocked
   factoringContract.approve(spender, billId);
   ```

4. **Get NFT Owner**
   ```solidity
   address owner = factoringContract.ownerOf(billId);
   // Or use the convenience function
   address owner = factoringContract.getBillNFTOwner(billId);
   ```

### For Debtors
1. **Complete Bill Payment**
   ```solidity
   factoringContract.completeBill(billId);
   ```

## 🔧 Configuration

### Environment Variables
Create a `.env` file:
```
PRIVATE_KEY=your_private_key_here
INFURA_API_KEY=your_infura_key_here
ETHERSCAN_API_KEY=your_etherscan_key_here
```

### Network Configuration
Update `hardhat.config.ts` for your target networks.

## 📈 Gas Optimization

The contracts are optimized for gas efficiency:
- **FactoringContract**: ~5.0M gas for deployment
- **depositToPool**: ~107K gas average
- **createBill**: ~378K gas average
- **createBillWithConditions**: ~380K gas average
- **fundBill**: ~106K gas average
- **completeBill**: ~90K gas average
- **setDefaultConditions**: ~42K gas average

## 🔐 Security Considerations

### Implemented Security Measures
- **ReentrancyGuard**: Prevents reentrancy attacks
- **Pausable**: Emergency stop functionality
- **Ownable**: Proper access control
- **SafeERC20**: Secure token operations
- **NFT Lock/Unlock Controls**: Contract owner can control NFT transferability
- **No Operator Approvals**: `setApprovalForAll` completely disabled
- **Locked by Default**: All bill NFTs start locked and require owner permission to transfer

### Audit Recommendations
- Conduct professional security audit before mainnet deployment
- Implement multi-signature wallet for owner functions
- Consider timelock for critical parameter changes
- Regular security monitoring and updates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Write comprehensive tests
4. Ensure all tests pass
5. Submit a pull request

## 📜 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Review the test files for usage examples
- Check the contract documentation

---

**⚠️ Disclaimer**: This is experimental software. Use at your own risk. Conduct thorough testing and auditing before deploying to mainnet.
