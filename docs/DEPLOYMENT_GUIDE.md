# Deployment Guide

Comprehensive guide for deploying the Factoring Finance smart contracts to various networks.

## Table of Contents
- [Deployment Overview](#deployment-overview)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Network Configurations](#network-configurations)
- [Deployment Strategies](#deployment-strategies)
- [Post-Deployment Verification](#post-deployment-verification)
- [Troubleshooting](#troubleshooting)

## Deployment Overview

### Deployment Flow

```mermaid
graph TD
    START[Start Deployment] --> ENV{Environment?}
    
    ENV -->|Local| LOCAL[Local Network]
    ENV -->|Testnet| TESTNET[Sepolia/Goerli]
    ENV -->|Mainnet| MAINNET[Ethereum Mainnet]
    
    LOCAL --> MOCK[Deploy Mock Tokens]
    TESTNET --> MOCK
    MAINNET --> REAL[Use Real USDC/USDT]
    
    MOCK --> DEPLOY_FC[Deploy FactoringContract]
    REAL --> DEPLOY_FC
    
    DEPLOY_FC --> CHOICE{Deploy Funds?}
    
    CHOICE -->|No| VERIFY_FC[Verify FactoringContract]
    CHOICE -->|SimpleFund| DEPLOY_SF[Deploy SimpleFund]
    CHOICE -->|Fund| DEPLOY_F[Deploy Fund]
    CHOICE -->|Both| DEPLOY_BOTH[Deploy Both Funds]
    
    DEPLOY_SF --> VERIFY_SF[Verify SimpleFund]
    DEPLOY_F --> VERIFY_F[Verify Fund]
    DEPLOY_BOTH --> VERIFY_ALL[Verify All Contracts]
    
    VERIFY_FC --> CONFIG[Configure Parameters]
    VERIFY_SF --> CONFIG
    VERIFY_F --> CONFIG
    VERIFY_ALL --> CONFIG
    
    CONFIG --> TEST[Run Integration Tests]
    TEST --> MONITOR[Setup Monitoring]
    MONITOR --> DONE[✅ Deployment Complete]
    
    style DONE fill:#4CAF50
    style DEPLOY_FC fill:#2196F3
    style DEPLOY_SF fill:#FF9800
    style DEPLOY_F fill:#FF5722
```

### Contract Dependencies

```mermaid
graph LR
    subgraph "Prerequisites"
        USDC[USDC Token<br/>Mock or Real]
        USDT[USDT Token<br/>Mock or Real]
    end
    
    subgraph "Core Contracts"
        FC[FactoringContract]
        BN[BillNFT<br/>Inherited]
    end
    
    subgraph "Optional Fund Contracts"
        SF[SimpleFund]
        MF[Fund]
    end
    
    USDC --> FC
    USDT --> FC
    BN -.->|Inherited| FC
    
    FC --> SF
    USDC --> SF
    USDT --> SF
    
    FC --> MF
    USDC --> MF
    USDT --> MF
    
    style FC fill:#4CAF50
    style SF fill:#FF9800
    style MF fill:#FF5722
```

## Pre-Deployment Checklist

### Security Checklist

```mermaid
graph TB
    START[Pre-Deployment] --> C1{Audit Complete?}
    C1 -->|No| AUDIT[❌ Get Security Audit]
    C1 -->|Yes| C2{Tests Passing?}
    
    C2 -->|No| TESTS[❌ Fix Tests]
    C2 -->|Yes| C3{Multi-sig Setup?}
    
    C3 -->|No| MSIG[❌ Setup Multi-sig]
    C3 -->|Yes| C4{Timelock?}
    
    C4 -->|No| TLOCK[⚠️ Consider Timelock]
    C4 -->|Yes| C5{Monitoring?}
    
    C5 -->|No| MON[❌ Setup Monitoring]
    C5 -->|Yes| C6{Parameters Set?}
    
    C6 -->|No| PARAMS[❌ Review Parameters]
    C6 -->|Yes| READY[✅ Ready to Deploy]
    
    AUDIT --> C1
    TESTS --> C2
    MSIG --> C3
    TLOCK --> C5
    MON --> C5
    PARAMS --> C6
    
    style READY fill:#4CAF50
    style AUDIT fill:#FF6B6B
    style TESTS fill:#FF6B6B
    style MSIG fill:#FF6B6B
    style MON fill:#FF6B6B
    style PARAMS fill:#FF6B6B
    style TLOCK fill:#FFA500
```

### Environment Setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env

# 3. Configure environment variables
# Required variables:
# - PRIVATE_KEY: Deployer private key
# - INFURA_API_KEY: For network access (testnet/mainnet)
# - ETHERSCAN_API_KEY: For contract verification

# 4. Compile contracts
npm run compile

# 5. Run tests
npm test

# 6. Run security checks
npm run slither  # If slither is configured
```

### Parameter Configuration

```mermaid
graph TD
    subgraph "FactoringContract Parameters"
        P1["USDC Address<br/>(0xA0b8...52A3 mainnet)"]
        P2["USDT Address<br/>(0xdAC1...1ec7 mainnet)"]
        P3["Default Conditions<br/>(upfront: 80%, interest: 2%)"]
        P4["Fee Percentages<br/>(debtor: 0.4%, lender: 0.1%)"]
    end
    
    subgraph "SimpleFund Parameters"
        S1["Management Fee<br/>(e.g., 5%)"]
        S2["Accepting Deposits<br/>(true/false)"]
    end
    
    subgraph "Fund Parameters"
        F1["Min/Max Investment<br/>(e.g., $5K-$100K)"]
        F2["Target Amount<br/>(e.g., $1M)"]
        F3["Management Fee<br/>(e.g., 2%)"]
        F4["Offer Config<br/>(upfront, interest, limits)"]
    end
    
    style P1 fill:#E3F2FD
    style P2 fill:#E3F2FD
    style S1 fill:#FFF3E0
    style F1 fill:#FFEBEE
```

## Network Configurations

### Testnet Deployment (Sepolia)

```mermaid
sequenceDiagram
    autonumber
    participant D as Deployer
    participant N as Sepolia Network
    participant E as Etherscan
    
    Note over D,E: Deploy Mock Tokens
    D->>N: Deploy MockUSDC
    N-->>D: USDC Address
    D->>N: Deploy MockUSDT
    N-->>D: USDT Address
    
    Note over D,E: Deploy Core Contract
    D->>N: Deploy FactoringContract(USDC, USDT)
    N-->>D: FactoringContract Address
    
    Note over D,E: Deploy Fund Contracts (Optional)
    D->>N: Deploy SimpleFund(FactoringContract, USDC, USDT, config)
    N-->>D: SimpleFund Address
    
    Note over D,E: Verify Contracts
    D->>E: Verify MockUSDC
    D->>E: Verify MockUSDT
    D->>E: Verify FactoringContract
    D->>E: Verify SimpleFund
    E-->>D: Verification Complete
    
    Note over D,E: Initialize
    D->>N: Configure default conditions
    D->>N: Mint test tokens
    D->>N: Run integration tests
```

**Commands:**
```bash
# Deploy all contracts to Sepolia
./scripts/deploy.sh sepolia all

# Or deploy individually
npx hardhat ignition deploy ignition/modules/testnet/FactoringModule.ts \
  --network sepolia \
  --parameters ignition/parameters/testnet.json

# Verify on Etherscan
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

### Mainnet Deployment

```mermaid
sequenceDiagram
    autonumber
    participant Team as Deployment Team
    participant MS as Multi-sig Wallet
    participant N as Mainnet
    participant E as Etherscan
    participant M as Monitoring
    
    Note over Team,M: Pre-Deployment
    Team->>Team: Final audit review
    Team->>Team: Parameter review
    Team->>MS: Setup multi-sig (e.g., Gnosis Safe)
    
    Note over Team,M: Deployment
    Team->>N: Deploy FactoringContract<br/>(Real USDC/USDT addresses)
    N-->>Team: FactoringContract Address
    
    Team->>N: Transfer ownership to multi-sig
    Team->>MS: Confirm ownership transfer
    
    Note over Team,M: Verification
    Team->>E: Verify FactoringContract
    E-->>Team: Verified
    
    Note over Team,M: Initialization
    MS->>N: Set initial parameters<br/>(via multi-sig)
    MS->>N: Approve initial operators
    
    Note over Team,M: Monitoring
    Team->>M: Setup event monitoring
    Team->>M: Setup alerting
    M-->>Team: Monitoring active
    
    Note over Team,M: Go Live
    Team->>Team: Announce deployment
    Team->>Team: Update documentation
```

**Real Token Addresses:**

| Network | USDC | USDT |
|---------|------|------|
| Ethereum Mainnet | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | `0xdAC17F958D2ee523a2206206994597C13D831ec7` |
| Sepolia Testnet | Deploy Mock | Deploy Mock |
| Local | Deploy Mock | Deploy Mock |

**Commands:**
```bash
# IMPORTANT: Review all parameters before mainnet deployment!

# Deploy to mainnet (requires confirmation)
./scripts/deploy.sh mainnet factoring

# Or use Hardhat Ignition
npx hardhat ignition deploy ignition/modules/mainnet/FactoringModule.ts \
  --network mainnet \
  --parameters ignition/parameters/mainnet.json \
  --verify
```

## Deployment Strategies

### Strategy 1: Minimal Deployment

For testing or single-contract deployments:

```mermaid
graph LR
    A[Deploy FactoringContract Only] --> B[Configure Parameters]
    B --> C[Test Core Functionality]
    C --> D[Monitor Usage]
    
    style A fill:#4CAF50
```

**Use Case:** Development, testing, or when only direct debtor-lender interactions are needed.

### Strategy 2: SimpleFund Deployment

For solo investor or managed fund operations:

```mermaid
graph LR
    A[Deploy FactoringContract] --> B[Deploy SimpleFund]
    B --> C[Configure Both Contracts]
    C --> D[Authorize Operators]
    D --> E[Test Fund Operations]
    
    style A fill:#4CAF50
    style B fill:#FF9800
```

**Use Case:** Single investor or fund manager wants automated offer creation and management.

### Strategy 3: Full Deployment

For complete ecosystem with multiple investment options:

```mermaid
graph LR
    A[Deploy FactoringContract] --> B[Deploy SimpleFund]
    B --> C[Deploy Fund]
    C --> D[Configure All Contracts]
    D --> E[Setup Multi-sig]
    E --> F[Comprehensive Testing]
    
    style A fill:#4CAF50
    style B fill:#FF9800
    style C fill:#FF5722
```

**Use Case:** Production environment with multiple investor types and pooled funds.

### Strategy 4: Phased Rollout

For gradual production deployment:

```mermaid
graph TD
    PHASE1[Phase 1: Core Contract] --> TEST1{Test & Monitor}
    TEST1 -->|Success| PHASE2[Phase 2: SimpleFund]
    TEST1 -->|Issues| FIX1[Fix Issues]
    FIX1 --> PHASE1
    
    PHASE2 --> TEST2{Test & Monitor}
    TEST2 -->|Success| PHASE3[Phase 3: Multi-investor Fund]
    TEST2 -->|Issues| FIX2[Fix Issues]
    FIX2 --> PHASE2
    
    PHASE3 --> TEST3{Test & Monitor}
    TEST3 -->|Success| PROD[Full Production]
    TEST3 -->|Issues| FIX3[Fix Issues]
    FIX3 --> PHASE3
    
    style PHASE1 fill:#E3F2FD
    style PHASE2 fill:#FFF3E0
    style PHASE3 fill:#FFEBEE
    style PROD fill:#4CAF50
```

## Post-Deployment Verification

### Verification Checklist

```mermaid
graph TB
    START[Deployment Complete] --> V1{Contracts Verified<br/>on Etherscan?}
    V1 -->|No| VER[Verify Contracts]
    V1 -->|Yes| V2{Ownership Correct?}
    
    V2 -->|No| OWN[Transfer Ownership]
    V2 -->|Yes| V3{Parameters Set?}
    
    V3 -->|No| PARAM[Set Parameters]
    V3 -->|Yes| V4{Authorizations Set?}
    
    V4 -->|No| AUTH[Configure Auth]
    V4 -->|Yes| V5{Integration Tests Pass?}
    
    V5 -->|No| TEST[Run Tests]
    V5 -->|Yes| V6{Monitoring Active?}
    
    V6 -->|No| MON[Setup Monitoring]
    V6 -->|Yes| V7{Documentation Updated?}
    
    V7 -->|No| DOC[Update Docs]
    V7 -->|Yes| DONE[✅ Verified]
    
    VER --> V1
    OWN --> V2
    PARAM --> V3
    AUTH --> V4
    TEST --> V5
    MON --> V6
    DOC --> V7
    
    style DONE fill:#4CAF50
```

### Integration Tests

Run comprehensive integration tests after deployment:

```bash
# Set deployed contract addresses in test configuration
export FACTORING_CONTRACT_ADDRESS="0x..."
export SIMPLE_FUND_ADDRESS="0x..."

# Run integration tests
npx hardhat test --network <network> --grep "Integration"

# Test specific workflows
npx hardhat test test/integration/full-workflow.test.ts --network <network>
```

### Smoke Tests

```mermaid
graph LR
    subgraph "FactoringContract Smoke Tests"
        T1[Create Bill Request]
        T2[Create Offer]
        T3[Accept Offer]
        T4[Complete Bill]
    end
    
    subgraph "SimpleFund Smoke Tests"
        T5[Deposit Funds]
        T6[Create Offer]
        T7[Withdraw Funds]
    end
    
    subgraph "Fund Smoke Tests"
        T8[Investor Deposit]
        T9[Auto-Create Offer]
        T10[Handle Completion]
    end
    
    T1 --> T2 --> T3 --> T4
    T5 --> T6 --> T7
    T8 --> T9 --> T10
    
    style T4 fill:#4CAF50
    style T7 fill:#4CAF50
    style T10 fill:#4CAF50
```

## Troubleshooting

### Common Issues

```mermaid
graph TD
    ISSUE{Deployment Issue?}
    
    ISSUE -->|Gas Error| GAS[Increase gas limit or price]
    ISSUE -->|Nonce Error| NONCE[Reset nonce or wait]
    ISSUE -->|Verification Failed| VERIFY[Check constructor args]
    ISSUE -->|Transaction Reverted| REVERT[Check require statements]
    
    GAS --> RETRY[Retry Deployment]
    NONCE --> RETRY
    VERIFY --> RETRY
    REVERT --> DEBUG[Debug with Hardhat]
    
    DEBUG --> FIX[Fix Issue]
    FIX --> RETRY
    
    RETRY --> SUCCESS{Success?}
    SUCCESS -->|Yes| DONE[✅ Complete]
    SUCCESS -->|No| CHECK[Check Logs]
    CHECK --> ISSUE
    
    style DONE fill:#4CAF50
```

### Gas Estimation Issues

If deployment fails due to gas:

```bash
# Check estimated gas
npx hardhat run scripts/estimate-gas.js --network <network>

# Deploy with manual gas settings
npx hardhat ignition deploy <module> \
  --network <network> \
  --gas-price 50000000000 \
  --gas-limit 10000000
```

### Verification Issues

If Etherscan verification fails:

```bash
# Manual verification with constructor args
npx hardhat verify --network <network> \
  --constructor-args scripts/constructor-args.js \
  <CONTRACT_ADDRESS>

# Flatten contract for manual verification
npx hardhat flatten contracts/FactoringContract.sol > FactoringContract_flat.sol
```

### Network Connection Issues

```mermaid
graph TD
    CONNECT{Connection Issue?}
    
    CONNECT -->|RPC Error| RPC[Check RPC endpoint]
    CONNECT -->|API Key| KEY[Verify API keys]
    CONNECT -->|Network| NET[Check network config]
    
    RPC --> TRY[Try Alternative RPC]
    KEY --> UPDATE[Update .env]
    NET --> FIX[Fix hardhat.config.ts]
    
    TRY --> RETRY[Retry]
    UPDATE --> RETRY
    FIX --> RETRY
    
    RETRY --> SUCCESS{Success?}
    SUCCESS -->|Yes| DONE[✅ Connected]
    SUCCESS -->|No| SUPPORT[Contact Support]
    
    style DONE fill:#4CAF50
```

## Monitoring & Maintenance

### Post-Deployment Monitoring

```mermaid
graph TB
    subgraph "Event Monitoring"
        E1[BillRequestCreated]
        E2[OfferCreated]
        E3[OfferAccepted]
        E4[BillCompleted]
        E5[FeesCollected]
    end
    
    subgraph "State Monitoring"
        S1[Pool Balances]
        S2[Active Bills Count]
        S3[Total Volume]
        S4[Fee Revenue]
    end
    
    subgraph "Security Monitoring"
        SEC1[Large Transactions]
        SEC2[Unauthorized Attempts]
        SEC3[Unusual Patterns]
    end
    
    E1 & E2 & E3 & E4 & E5 --> ALERT[Alert System]
    S1 & S2 & S3 & S4 --> DASH[Dashboard]
    SEC1 & SEC2 & SEC3 --> SECURITY[Security Alerts]
    
    ALERT --> TEAM[Dev Team]
    DASH --> TEAM
    SECURITY --> TEAM
    
    style SECURITY fill:#FF6B6B
```

### Recommended Tools

- **Tenderly**: Transaction monitoring and debugging
- **Defender**: Automated operations and monitoring (OpenZeppelin)
- **The Graph**: Indexed event data and analytics
- **Dune Analytics**: Custom dashboards and queries

### Upgrade Considerations

Since contracts are not upgradeable, consider:

```mermaid
graph LR
    V1[Version 1<br/>Deployed] --> USE1[Users Active]
    USE1 --> ISSUE{Need Update?}
    
    ISSUE -->|Yes| V2[Deploy Version 2]
    V2 --> MIGRATE[Migration Plan]
    MIGRATE --> NOTIFY[Notify Users]
    NOTIFY --> PARALLEL[Run Parallel]
    PARALLEL --> SUNSET[Sunset V1]
    
    ISSUE -->|No| MAINTAIN[Maintain V1]
    
    style V1 fill:#2196F3
    style V2 fill:#4CAF50
    style SUNSET fill:#FFA500
```

## Conclusion

Successful deployment requires:
1. ✅ Thorough testing on testnet
2. ✅ Security audit completion
3. ✅ Multi-sig setup for mainnet
4. ✅ Comprehensive monitoring
5. ✅ Clear upgrade/migration path
6. ✅ Documentation for users and developers

Always prioritize security and user safety over speed of deployment.
