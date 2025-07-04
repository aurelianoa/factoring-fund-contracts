# Hardhat Ignition Modules Overview

## Available Modules

The Factoring Finance project now includes **5 independent deployment modules**:

### 1. Mock Token Modules

#### MockUSDCModule (`ignition/modules/MockUSDCModule.ts`)
**Purpose**: Deploy only the MockUSDC token contract.

**Deployed Contracts**:
- `MockUSDC`: Mock USDC token (6 decimals, deployer as owner)

**Use Case**: When you need only a USDC token for testing or integration.

**Deployment**:
```bash
npx hardhat ignition deploy ./ignition/modules/MockUSDCModule.ts --network <network>
npm run deploy:mock-usdc:local
```

#### MockUSDTModule (`ignition/modules/MockUSDTModule.ts`) 
**Purpose**: Deploy only the MockUSDT token contract.

**Deployed Contracts**:
- `MockUSDT`: Mock USDT token (6 decimals, deployer as owner)

**Use Case**: When you need only a USDT token for testing or integration.

**Deployment**:
```bash
npx hardhat ignition deploy ./ignition/modules/MockUSDTModule.ts --network <network>
npm run deploy:mock-usdt:local
```

### 2. Core Contract Modules

#### FactoringModule (`ignition/modules/FactoringModule.ts`)
**Purpose**: Deploy the core factoring marketplace with mock tokens.

**Deployed Contracts**:
- Uses `MockUSDCModule` and `MockUSDTModule`
- `FactoringContract`: Core factoring marketplace

**Use Case**: Basic factoring operations, bill NFT management, marketplace functionality.

**Deployment**:
```bash
npx hardhat ignition deploy ./ignition/modules/FactoringModule.ts --network <network>
npm run deploy:factoring:local
```

#### SimpleFundModule (`ignition/modules/SimpleFundModule.ts`)
**Purpose**: Deploy a solo investor fund with auto-offering capabilities.

**Deployed Contracts**:
- Uses `MockUSDCModule` and `MockUSDTModule`
- `FactoringContract`: Core marketplace
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

#### FundModule (`ignition/modules/FundModule.ts`)
**Purpose**: Deploy a multi-investor pooled fund for collaborative factoring.

**Deployed Contracts**:
- Uses `MockUSDCModule` and `MockUSDTModule`
- `FactoringContract`: Core marketplace
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

## Module Dependencies

The modular architecture uses Hardhat Ignition's `m.useModule()` feature for clean dependencies:

```
MockUSDCModule (standalone)
MockUSDTModule (standalone)

FactoringModule
├── uses MockUSDCModule
├── uses MockUSDTModule
└── deploys FactoringContract

SimpleFundModule
├── uses MockUSDCModule
├── uses MockUSDTModule
├── deploys FactoringContract
└── deploys SimpleFund

FundModule
├── uses MockUSDCModule
├── uses MockUSDTModule
├── deploys FactoringContract
└── deploys Fund
```

## Benefits of Modular Architecture

1. **Reusability**: Mock token modules can be reused across different deployments
2. **Independence**: Each module can be deployed separately
3. **Consistency**: All modules use the same mock token instances when deployed together
4. **Flexibility**: Mix and match modules based on deployment needs
5. **Testing**: Deploy individual components for isolated testing

## Deployment Examples

### Deploy just tokens for testing
```bash
npm run deploy:mock-usdc:local
npm run deploy:mock-usdt:local
```

### Deploy core marketplace
```bash
npm run deploy:factoring:local
```

### Deploy complete fund systems
```bash
npm run deploy:simple-fund:local
npm run deploy:fund:local
```

### Using the deployment helper
```bash
# Interactive mode
npm run deploy-ignition

# Direct deployment
npm run deploy-ignition mock-usdc localhost
npm run deploy-ignition factoring sepolia
npm run deploy-ignition simple-fund hardhat
```

All modules have been tested and deploy successfully across different networks.
