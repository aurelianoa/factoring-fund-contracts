# Hardhat Ignition Deployment Modules

## Overview

This project includes three independent Hardhat Ignition modules for deploying different configurations of the Factoring Finance smart contract system.

## Available Modules

### 1. FactoringModule (`ignition/modules/FactoringModule.ts`)

**Purpose**: Deploys the core factoring marketplace contract with mock tokens.

**Deployed Contracts**:
- `MockUSDC`: Mock USDC token (6 decimals)
- `MockUSDT`: Mock USDT token (6 decimals)  
- `FactoringContract`: Core factoring marketplace

**Use Case**: Basic factoring operations, bill NFT management, marketplace functionality.

**Deployment**:
```bash
npx hardhat ignition deploy ./ignition/modules/FactoringModule.ts --network <network>
npm run deploy:factoring:local
```

### 2. SimpleFundModule (`ignition/modules/SimpleFundModule.ts`)

**Purpose**: Deploys a solo investor fund that can automatically offer on bills.

**Deployed Contracts**:
- All contracts from FactoringModule +
- `SimpleFund`: Solo investor fund contract

**Configuration**:
- Management fee: 5%
- Auto-offer terms: 3% fee, 80% upfront, 17% on completion
- Bill amount range: $1,000 - $50,000
- Auto-offering enabled

**Use Case**: Single investor wanting automated bill factoring with predefined terms.

**Deployment**:
```bash
npx hardhat ignition deploy ./ignition/modules/SimpleFundModule.ts --network <network>
npm run deploy:simple-fund:local
```

### 3. FundModule (`ignition/modules/FundModule.ts`)

**Purpose**: Deploys a multi-investor pooled fund for collaborative bill factoring.

**Deployed Contracts**:
- All contracts from FactoringModule +
- `Fund`: Multi-investor pooled fund contract

**Configuration**:
- Investment range: $5,000 - $100,000 per investor
- Target fund size: $1,000,000
- Management fee: 2%
- Auto-offer terms: 4% fee, 80% upfront, 16% on completion  
- Bill amount range: $2,000 - $100,000
- Auto-offering enabled

**Use Case**: Multiple investors pooling capital for larger-scale bill factoring operations.

**Deployment**:
```bash
npx hardhat ignition deploy ./ignition/modules/FundModule.ts --network <network>
npm run deploy:fund:local
```

## Deployment Workflows

### Independent Modules

Each module is completely independent and can be deployed separately:

1. **FactoringModule**: For marketplace-only deployments
2. **SimpleFundModule**: For solo investor operations  
3. **FundModule**: For multi-investor fund operations

### Deployment Helper Script

Use the interactive deployment script:

```bash
npm run deploy-ignition [module] [network]

# Examples:
npm run deploy-ignition factoring localhost
npm run deploy-ignition simple-fund sepolia
npm run deploy-ignition fund hardhat
```

### Network Support

All modules support deployment to:
- `hardhat` (temporary, in-memory)
- `localhost` (local Hardhat node)
- `sepolia` (Ethereum testnet)
- Any configured network in `hardhat.config.ts`

## Module Architecture

```
FactoringModule
├── MockUSDC
├── MockUSDT
└── FactoringContract

SimpleFundModule  
├── MockUSDC
├── MockUSDT
├── FactoringContract
└── SimpleFund (depends on FactoringContract)

FundModule
├── MockUSDC
├── MockUSDT  
├── FactoringContract
└── Fund (depends on FactoringContract)
```

## Constructor Parameters

### FactoringContract
```solidity
constructor(address _usdc, address _usdt)
```

### SimpleFund
```solidity
constructor(
    address _factoringContract,
    address _usdc, 
    address _usdt,
    FundConfig memory _fundConfig,
    OfferConfig memory _offerConfig
)
```

### Fund
```solidity
constructor(
    address _factoringContract,
    address _usdc,
    address _usdt, 
    FundConfig memory _fundConfig,
    OfferConfig memory _offerConfig
)
```

## Testing Deployment

All modules have been tested and deploy successfully:

```bash
# Test all modules
npx hardhat ignition deploy ./ignition/modules/FactoringModule.ts --network hardhat
npx hardhat ignition deploy ./ignition/modules/SimpleFundModule.ts --network hardhat  
npx hardhat ignition deploy ./ignition/modules/FundModule.ts --network hardhat
```

Each deployment creates the complete contract system needed for the respective use case.
