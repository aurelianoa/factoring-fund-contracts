# Ignition Deployment Modules

This directory contains Hardhat Ignition modules for deploying the factoring contracts on different networks.

## Structure

```
ignition/
├── modules/
│   ├── mainnet/           # Mainnet deployment modules (uses real USDC/USDT)
│   │   ├── FactoringModule.ts
│   │   ├── SimpleFundModule.ts
│   │   ├── FundModule.ts
│   │   └── DeployAllModule.ts
│   └── testnet/           # Testnet deployment modules (uses mock tokens)
│       ├── FactoringModule.ts
│       ├── SimpleFundModule.ts
│       ├── FundModule.ts
│       ├── MockUSDCModule.ts
│       └── MockUSDTModule.ts
└── parameters/
    ├── mainnet.json       # Mainnet parameters (real token addresses)
    ├── mainnet-deploy-all.json
    └── testnet.json       # Testnet parameters (empty for mock tokens)
```

## Usage

### Mainnet Deployment

Deploy individual contracts:

```bash
# Deploy FactoringContract only
npx hardhat ignition deploy ignition/modules/mainnet/FactoringModule.ts --network mainnet --parameters ignition/parameters/mainnet.json

# Deploy SimpleFund
npx hardhat ignition deploy ignition/modules/mainnet/SimpleFundModule.ts --network mainnet --parameters ignition/parameters/mainnet.json

# Deploy Fund
npx hardhat ignition deploy ignition/modules/mainnet/FundModule.ts --network mainnet --parameters ignition/parameters/mainnet.json
```

Deploy all contracts at once:

```bash
npx hardhat ignition deploy ignition/modules/mainnet/DeployAllModule.ts --network mainnet --parameters ignition/parameters/mainnet-deploy-all.json
```

### Testnet Deployment

```bash
# Deploy with mock tokens on testnet
npx hardhat ignition deploy ignition/modules/testnet/FactoringModule.ts --network sepolia --parameters ignition/parameters/testnet.json

npx hardhat ignition deploy ignition/modules/testnet/SimpleFundModule.ts --network sepolia --parameters ignition/parameters/testnet.json

npx hardhat ignition deploy ignition/modules/testnet/FundModule.ts --network sepolia --parameters ignition/parameters/testnet.json
```

## Token Addresses

### Mainnet
- **USDC**: `0xA0b86a33E6441b8435b662F21e9A1e01e13D52A3`
- **USDT**: `0xdAC17F958D2ee523a2206206994597C13D831ec7`

### Testnet
Mock tokens are deployed automatically as part of the testnet modules.

## Configuration

### SimpleFund Configuration
- Management Fee: 5% (500 basis points)
- Accepting Deposits: true

### Fund Configuration  
- Minimum Investment: $5,000 USDC
- Maximum Investment: $100,000 USDC per investor
- Target Amount: $1,000,000 USDC
- Management Fee: 2% (200 basis points)
- Accepting Investments: true

## Notes

- Mainnet modules use real USDC and USDT token addresses passed via parameters
- Testnet modules deploy and use mock ERC20 tokens for testing
- All contracts implement the new interest-based factoring model
- The SimpleFund contract includes the new withdrawal functions for upfront and debtor payments
