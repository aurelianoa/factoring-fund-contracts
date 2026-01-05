# Architecture Documentation

This document provides an in-depth look at the Factoring Finance Smart Contract system architecture, design decisions, and implementation details.

## Table of Contents
- [System Overview](#system-overview)
- [Design Principles](#design-principles)
- [Contract Hierarchy](#contract-hierarchy)
- [Data Flow](#data-flow)
- [State Management](#state-management)
- [Security Model](#security-model)
- [Gas Optimization](#gas-optimization)

## System Overview

### Core Components

```mermaid
graph TB
    subgraph "Core Layer"
        BN[BillNFT<br/>ERC721 + Transfer Controls]
        FC[FactoringContract<br/>Core Business Logic]
    end
    
    subgraph "Fund Layer"
        SF[SimpleFund<br/>Solo Investor]
        MF[Fund<br/>Multi-Investor Pool]
    end
    
    subgraph "Token Layer"
        USDC[USDC Stablecoin]
        USDT[USDT Stablecoin]
    end
    
    subgraph "External Dependencies"
        OZ[OpenZeppelin<br/>Security & Standards]
        PV[Privylabs<br/>Authorization]
        UA[Array Manager<br/>Utility]
    end
    
    BN --> FC
    OZ --> BN
    OZ --> FC
    OZ --> SF
    OZ --> MF
    PV --> FC
    PV --> SF
    PV --> MF
    UA --> FC
    
    FC -.-> USDC
    FC -.-> USDT
    SF --> FC
    MF --> FC
    
    style FC fill:#4CAF50
    style BN fill:#2196F3
    style SF fill:#FF9800
    style MF fill:#FF5722
```

### Three-Tier Architecture

The system follows a three-tier architecture pattern:

1. **Presentation Layer** (User Interaction)
   - Debtors create bill requests
   - Lenders create and manage offers
   - Fund managers operate pooled funds

2. **Business Logic Layer** (Smart Contracts)
   - FactoringContract: Core marketplace logic
   - SimpleFund/Fund: Investment management
   - BillNFT: NFT representation and controls

3. **Data Layer** (Blockchain State)
   - Bill requests and offers
   - Bill lifecycle and history
   - NFT ownership records
   - Fee pools and balances

## Design Principles

### 1. Separation of Concerns

```mermaid
graph LR
    subgraph "NFT Logic"
        N1[ERC721 Standard]
        N2[Minting/Burning]
        N3[Transfer Controls]
        N4[Ownership Tracking]
    end
    
    subgraph "Business Logic"
        B1[Bill Requests]
        B2[Offers]
        B3[Acceptances]
        B4[Completions]
        B5[Fee Distribution]
    end
    
    subgraph "Fund Logic"
        F1[Investment Management]
        F2[Auto-Offering]
        F3[Profit Distribution]
        F4[Balance Tracking]
    end
    
    N1 & N2 & N3 & N4 --> BillNFT
    B1 & B2 & B3 & B4 & B5 --> FactoringContract
    F1 & F2 & F3 & F4 --> Funds
    
    BillNFT --> FactoringContract
    Funds --> FactoringContract
    
    style BillNFT fill:#2196F3
    style FactoringContract fill:#4CAF50
    style Funds fill:#FF9800
```

**Benefits:**
- Each contract has a single, well-defined responsibility
- Easier to test, maintain, and upgrade
- Reduces contract size and deployment costs
- Enables independent auditing of components

### 2. Fail-Safe Defaults

All critical operations are protected with multiple validation layers:

```mermaid
graph TD
    A[User Action] --> B{Zero Address?}
    B -->|Yes| FAIL[❌ Revert]
    B -->|No| C{Valid Amount?}
    C -->|No| FAIL
    C -->|Yes| D{Within Limits?}
    D -->|No| FAIL
    D -->|Yes| E{Authorized?}
    E -->|No| FAIL
    E -->|Yes| F{Paused?}
    F -->|Yes| FAIL
    F -->|No| G{Reentrancy?}
    G -->|Locked| FAIL
    G -->|Unlocked| H[✅ Execute]
    
    style FAIL fill:#FF6B6B
    style H fill:#4CAF50
```

### 3. Progressive Disclosure

The system reveals complexity gradually:

- **Simple Use Case**: Direct debtor-lender interaction
- **Intermediate**: Using SimpleFund for solo investing
- **Advanced**: Multi-investor Fund with automatic strategies

### 4. Defense in Depth

Multiple layers of security:

```mermaid
graph TB
    L1[Input Validation] --> L2[Access Control]
    L2 --> L3[Reentrancy Protection]
    L3 --> L4[Pausable Circuit Breaker]
    L4 --> L5[Safe Math Operations]
    L5 --> L6[Balance Verification]
    L6 --> L7[SafeERC20 Transfers]
    L7 --> SUCCESS[✅ Secure Execution]
    
    style L1 fill:#E3F2FD
    style L2 fill:#FFF3E0
    style L3 fill:#FFEBEE
    style L4 fill:#FCE4EC
    style L5 fill:#F3E5F5
    style L6 fill:#E8F5E9
    style L7 fill:#E0F2F1
    style SUCCESS fill:#4CAF50
```

## Contract Hierarchy

### Inheritance Tree

```mermaid
graph TD
    ERC721[ERC721<br/>OpenZeppelin] --> BillNFT[BillNFT]
    BillNFT --> FactoringContract[FactoringContract]
    
    ReentrancyGuard[ReentrancyGuard<br/>OpenZeppelin] --> FactoringContract
    Pausable[Pausable<br/>OpenZeppelin] --> FactoringContract
    Authorized[Authorized<br/>Privylabs] --> FactoringContract
    UintArrayManager[UintArrayManager<br/>Aurelianoa] --> FactoringContract
    
    ReentrancyGuard2[ReentrancyGuard] --> SimpleFund[SimpleFund]
    Pausable2[Pausable] --> SimpleFund
    Authorized2[Authorized] --> SimpleFund
    IERC721Receiver[IERC721Receiver] --> SimpleFund
    
    ReentrancyGuard3[ReentrancyGuard] --> Fund[Fund]
    Pausable3[Pausable] --> Fund
    Authorized3[Authorized] --> Fund
    IERC721Receiver2[IERC721Receiver] --> Fund
    
    SafeERC20[SafeERC20<br/>OpenZeppelin] -.->|Uses| FactoringContract
    SafeERC20 -.->|Uses| SimpleFund
    SafeERC20 -.->|Uses| Fund
    
    style BillNFT fill:#2196F3
    style FactoringContract fill:#4CAF50
    style SimpleFund fill:#FF9800
    style Fund fill:#FF5722
```

### Interface Compliance

```mermaid
graph LR
    subgraph "BillNFT"
        I1[IERC721]
        I2[IERC721Metadata]
    end
    
    subgraph "FactoringContract"
        I3[IERC721]
        I4[IERC721Metadata]
        I5[Custom IFactoring]
    end
    
    subgraph "SimpleFund"
        I6[IERC721Receiver]
        I7[Custom ISimpleFund]
    end
    
    subgraph "Fund"
        I8[IERC721Receiver]
        I9[Custom IFund]
    end
```

## Data Flow

### Bill Request to Completion

```mermaid
sequenceDiagram
    autonumber
    participant D as Debtor
    participant FC as FactoringContract
    participant L as Lender
    participant NFT as BillNFT
    participant Token as USDC/USDT
    
    rect rgb(255, 228, 181)
        Note over D,Token: Phase 1: Bill Request
        D->>FC: createBillRequest(amount, dueDate)
        FC->>FC: Validate inputs
        FC->>FC: Check MAX_BILLS_PER_OWNER
        FC->>FC: Create BillRequest struct
        FC->>NFT: _mintBillNFT(debtor, billId)
        NFT->>D: NFT ownership
        FC->>FC: Add to ownerBills[debtor]
        FC-->>D: Return billRequestId
    end
    
    rect rgb(144, 238, 144)
        Note over D,Token: Phase 2: Offer Creation
        L->>Token: approve(FactoringContract, upfrontAmount)
        L->>FC: createOffer(billRequestId, stablecoin, conditions)
        FC->>FC: Validate conditions & limits
        FC->>Token: transferFrom(lender, contract, upfrontAmount)
        FC->>FC: Create Offer struct
        FC->>FC: Add to billRequestOffers[billRequestId]
        FC-->>L: Return offerId
    end
    
    rect rgb(173, 216, 230)
        Note over D,Token: Phase 3: Acceptance
        D->>FC: acceptOffer(offerId)
        FC->>FC: Verify NFT ownership
        FC->>FC: Calculate debtor fee
        FC->>Token: transfer(debtor, upfrontAmount - fee)
        FC->>FC: poolBalances[stablecoin] += fee
        FC->>NFT: transfer(debtor → lender)
        FC->>FC: Create Bill struct
        FC->>FC: Refund other offers
        FC->>FC: Update ownerBills mappings
    end
    
    rect rgb(255, 182, 193)
        Note over D,Token: Phase 4: Completion
        D->>Token: approve(FactoringContract, totalAmount)
        D->>FC: completeBill(billId)
        FC->>Token: transferFrom(debtor, contract, totalAmount)
        FC->>FC: Calculate lender fees
        FC->>FC: Calculate interest (days × rate)
        FC->>FC: Calculate owner payment
        FC->>FC: Calculate debtor refund
        FC->>Token: transfer(currentOwner, ownerPayment)
        alt Debtor refund > 0
            FC->>Token: transfer(debtor, debtorPayment)
        end
        FC->>FC: poolBalances[stablecoin] += fees
        FC->>NFT: burn(billId)
        FC->>FC: Update bill.status = Completed
    end
```

### Fund Operations Flow

```mermaid
sequenceDiagram
    autonumber
    participant FM as Fund Manager
    participant SF as SimpleFund
    participant FC as FactoringContract
    participant Token as USDC/USDT
    
    rect rgb(255, 248, 220)
        Note over FM,Token: Deposit & Setup
        FM->>Token: approve(SimpleFund, amount)
        FM->>SF: deposit(amount, token)
        Token->>SF: Transfer tokens
        SF->>SF: Track balance
    end
    
    rect rgb(240, 248, 255)
        Note over FM,Token: Create Offer for Bill Request
        FM->>SF: createOfferForBillRequest(billRequestId, conditions)
        SF->>SF: Check getAvailableBalance()
        SF->>SF: committedFunds[token] += upfrontAmount
        SF->>Token: approve(FactoringContract, upfrontAmount)
        SF->>FC: createOffer(...)
        FC->>Token: transferFrom(SimpleFund, contract, upfrontAmount)
        SF->>SF: billRequestToOffer[billRequestId] = offerId
    end
    
    rect rgb(255, 240, 245)
        Note over FM,Token: Accept Offer (If Fund owns NFT)
        FM->>SF: acceptOfferForOwnedBill(offerId)
        SF->>FC: ownerOf(billRequestId)
        FC-->>SF: Return owner address
        SF->>SF: Verify ownership
        SF->>SF: Release committed funds if needed
        SF->>FC: acceptOffer(offerId)
    end
    
    rect rgb(245, 255, 250)
        Note over FM,Token: Withdraw or Cancel
        alt Withdraw Offer
            FM->>SF: withdrawOffer(offerId)
            SF->>SF: committedFunds[token] -= depositedAmount
            SF->>FC: withdrawOffer(offerId)
            FC->>Token: transfer(SimpleFund, depositedAmount)
        else Cancel Before Commitment
            FM->>SF: withdraw(amount, token)
            SF->>Token: transfer(FM, amount)
        end
    end
```

## State Management

### Bill Request States

```mermaid
stateDiagram-v2
    [*] --> Open: createBillRequest()
    
    state Open {
        [*] --> AwaitingOffers
        AwaitingOffers --> HasOffers: createOffer()
        HasOffers --> HasOffers: createOffer()
    }
    
    Open --> Accepted: acceptOffer()
    Open --> Cancelled: cancelBillRequest()
    
    state "Bill Active" as Active {
        [*] --> Funded
        Funded --> AwaitingPayment
    }
    
    Accepted --> Active: Bill Created
    Active --> Completed: completeBill()
    Active --> Defaulted: markBillDefaulted()
    
    Cancelled --> [*]
    Completed --> [*]
    Defaulted --> [*]
```

### Offer States

```mermaid
stateDiagram-v2
    [*] --> Active: createOffer()
    
    state Active {
        [*] --> FundsLocked
        FundsLocked --> CanWithdraw
    }
    
    Active --> Accepted: acceptOffer()
    Active --> Withdrawn: withdrawOffer()
    Active --> Expired: Another offer accepted
    
    state Accepted {
        [*] --> BillCreated
        BillCreated --> NFTTransferred
    }
    
    Accepted --> [*]
    Withdrawn --> [*]: Funds returned
    Expired --> [*]: Funds returned
```

### Fund Balance States

```mermaid
stateDiagram-v2
    [*] --> Available: deposit()
    
    Available --> Committed: createOffer()
    
    state Committed {
        [*] --> LockedInOffer
        LockedInOffer --> InActiveBill: acceptOffer()
    }
    
    Committed --> Available: withdrawOffer()
    Committed --> Available: Offer expired
    Committed --> Earned: Bill completed
    
    Earned --> Available: Profit realized
    Available --> [*]: withdraw()
```

## Security Model

### Multi-Layer Validation

```mermaid
graph TD
    subgraph "Layer 1: Input Sanitization"
        L1A[Non-zero amounts]
        L1B[Valid addresses]
        L1C[Reasonable dates]
        L1D[Within limits]
    end
    
    subgraph "Layer 2: Business Rules"
        L2A[Status checks]
        L2B[Ownership verification]
        L2C[Balance sufficiency]
        L2D[Condition validation]
    end
    
    subgraph "Layer 3: Access Control"
        L3A[Owner only]
        L3B[Admin only]
        L3C[Operator only]
        L3D[NFT owner only]
    end
    
    subgraph "Layer 4: State Guards"
        L4A[Not paused]
        L4B[Not reentering]
        L4C[Not defaulted]
        L4D[Not expired]
    end
    
    subgraph "Layer 5: Safe Execution"
        L5A[SafeERC20]
        L5B[Overflow protection]
        L5C[Underflow protection]
        L5D[Balance checks]
    end
    
    L1A & L1B & L1C & L1D --> L2A & L2B & L2C & L2D
    L2A & L2B & L2C & L2D --> L3A & L3B & L3C & L3D
    L3A & L3B & L3C & L3D --> L4A & L4B & L4C & L4D
    L4A & L4B & L4C & L4D --> L5A & L5B & L5C & L5D
    L5A & L5B & L5C & L5D --> EXECUTE[Execute Action]
    
    style EXECUTE fill:#4CAF50
```

### Reentrancy Protection Pattern

```mermaid
sequenceDiagram
    participant User
    participant Contract
    participant ReentrancyGuard
    participant ExternalContract
    
    User->>Contract: Call function
    Contract->>ReentrancyGuard: Enter (set locked = true)
    ReentrancyGuard-->>Contract: Lock acquired
    
    Contract->>Contract: Update state BEFORE external calls
    Contract->>ExternalContract: External call
    
    alt Reentrancy Attempt
        ExternalContract->>Contract: Try to call back
        Contract->>ReentrancyGuard: Check locked
        ReentrancyGuard-->>Contract: Already locked
        Contract-->>ExternalContract: REVERT
    end
    
    ExternalContract-->>Contract: Return
    Contract->>ReentrancyGuard: Exit (set locked = false)
    Contract-->>User: Success
```

### Pausable Circuit Breaker

```mermaid
stateDiagram-v2
    [*] --> Active: Deploy
    
    Active --> Paused: pause()
    Paused --> Active: unpause()
    
    state Active {
        [*] --> AllowOperations
        AllowOperations --> Processing
        Processing --> AllowOperations
    }
    
    state Paused {
        [*] --> BlockOperations
        BlockOperations --> AdminOnly
    }
    
    note right of Paused
        Only admin functions
        available during pause
    end note
```

## Gas Optimization

### Storage Optimization

```mermaid
graph LR
    subgraph "Optimized Storage"
        O1["Use uint256 consistently<br/>(Avoid packing overhead)"]
        O2["Immutable for constants<br/>(Saves SLOAD)"]
        O3["mapping over array<br/>(O(1) access)"]
        O4["Events over storage<br/>(Cheaper history)"]
    end
    
    subgraph "Computation Optimization"
        C1["Cache storage reads<br/>(Avoid multiple SLOAD)"]
        C2["Early returns<br/>(Save gas on failures)"]
        C3["Batch operations<br/>(Single transaction)"]
        C4["Efficient loops<br/>(Minimize iterations)"]
    end
    
    subgraph "External Call Optimization"
        E1["SafeERC20 when needed<br/>(Not always required)"]
        E2["Minimize external calls<br/>(Expensive operations)"]
        E3["Use view functions<br/>(Free off-chain)"]
    end
    
    style O1 fill:#E3F2FD
    style O2 fill:#E3F2FD
    style C1 fill:#FFF3E0
    style C2 fill:#FFF3E0
    style E1 fill:#E8F5E9
```

### Interest Calculation Optimization

The interest calculation was specifically optimized to prevent overflow while maintaining precision:

```mermaid
graph TD
    A["Original (Overflow Risk):<br/>(upfrontPaid × rateInterest × daysPassed)<br/>÷ daysPerMonth ÷ BASIS_POINTS"] -->|"❌ Overflow for large values"| FAIL[Overflow Risk]
    
    B["Optimized (Safe):<br/>(upfrontPaid × rateInterest)<br/>÷ BASIS_POINTS ÷ daysPerMonth<br/>= dailyRate<br/><br/>interest = dailyRate × daysPassed"] -->|"✅ Divides early"| SUCCESS[Safe Calculation]
    
    style FAIL fill:#FF6B6B
    style SUCCESS fill:#4CAF50
```

**Why this works:**
1. Divides by BASIS_POINTS (10,000) early, reducing magnitude
2. Divides by daysPerMonth (30) early, further reducing magnitude
3. Final multiplication by daysPassed has much smaller values
4. Prevents overflow for reasonable bill amounts (<10^15) and durations (<5 years)

### Array Management Optimization

```mermaid
graph LR
    subgraph "Array Operations"
        A1[Add: O(1)]
        A2[Remove: O(n)]
        A3[Search: O(n)]
    end
    
    subgraph "Mitigation"
        M1["MAX_BILLS_PER_OWNER = 1000<br/>(Limit array size)"]
        M2["Use for history only<br/>(Not for validation)"]
        M3["Consider EnumerableSet<br/>(For future upgrade)"]
    end
    
    A1 & A2 & A3 --> M1 & M2 & M3
    
    style M1 fill:#FFF3E0
```

## Upgrade Considerations

### Current Architecture (Non-Upgradeable)

The contracts are currently deployed without upgradeability proxies. This design choice prioritizes:
- **Simplicity**: No proxy complexity
- **Gas Efficiency**: No delegatecall overhead
- **Transparency**: Code is what you see
- **Immutability**: Trust through unchangeability

### Future Upgrade Path

If upgradeability is needed, consider:

```mermaid
graph TB
    subgraph "Option 1: New Version Deployment"
        O1A[Deploy new contracts]
        O1B[Migrate liquidity]
        O1C[Redirect users]
        O1D[Maintain old version]
    end
    
    subgraph "Option 2: UUPS Proxy Pattern"
        O2A[Deploy proxy]
        O2B[Deploy implementation]
        O2C[Upgrade logic only]
        O2D[Keep storage layout]
    end
    
    subgraph "Option 3: Diamond Pattern"
        O3A[Modular facets]
        O3B[Selective upgrades]
        O3C[Complex but flexible]
    end
    
    CURRENT[Current Architecture] --> DECISION{Need Upgrade?}
    DECISION -->|Yes, Simple| O1A
    DECISION -->|Yes, Complex| O2A
    DECISION -->|Yes, Modular| O3A
    DECISION -->|No| MAINTAIN[Maintain as-is]
    
    style CURRENT fill:#2196F3
    style MAINTAIN fill:#4CAF50
```

## Conclusion

The Factoring Finance smart contract system is designed with:
- **Security First**: Multiple validation layers and fail-safe defaults
- **Modularity**: Clear separation of concerns
- **Extensibility**: Easy to add new fund types or features
- **Gas Efficiency**: Optimized storage and computation patterns
- **Developer Experience**: Clear interfaces and comprehensive documentation

This architecture balances complexity with usability, providing a robust foundation for factoring finance operations on the blockchain.
