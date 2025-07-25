#!/bin/bash

# Deploy script for factoring contracts
# Usage: ./deploy.sh [network] [module_type]
# Example: ./deploy.sh mainnet all
# Example: ./deploy.sh sepolia factoring

set -e

NETWORK=${1:-"hardhat"}
MODULE_TYPE=${2:-"all"}

echo "🚀 Deploying to network: $NETWORK"
echo "📦 Module type: $MODULE_TYPE"

if [[ "$NETWORK" == "mainnet" || "$NETWORK" == "ethereum" ]]; then
    echo "⚠️  WARNING: Deploying to MAINNET! This will cost real ETH."
    read -p "Are you sure you want to continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled"
        exit 1
    fi
    
    MODULE_PATH="ignition/modules/mainnet"
    PARAMS_PATH="ignition/parameters/mainnet.json"
    if [[ "$MODULE_TYPE" == "all" ]]; then
        PARAMS_PATH="ignition/parameters/mainnet-deploy-all.json"
    fi
else
    MODULE_PATH="ignition/modules/testnet"
    PARAMS_PATH="ignition/parameters/testnet.json"
fi

case $MODULE_TYPE in
    "factoring"|"FactoringModule")
        echo "🏭 Deploying FactoringContract..."
        npx hardhat ignition deploy $MODULE_PATH/FactoringModule.ts --network $NETWORK --parameters $PARAMS_PATH
        ;;
    "simplefund"|"SimpleFundModule")
        echo "💰 Deploying SimpleFund..."
        npx hardhat ignition deploy $MODULE_PATH/SimpleFundModule.ts --network $NETWORK --parameters $PARAMS_PATH
        ;;
    "fund"|"FundModule")
        echo "🏦 Deploying Fund..."
        npx hardhat ignition deploy $MODULE_PATH/FundModule.ts --network $NETWORK --parameters $PARAMS_PATH
        ;;
    "all"|"DeployAllModule")
        if [[ "$NETWORK" == "mainnet" || "$NETWORK" == "ethereum" ]]; then
            echo "🌐 Deploying all contracts to mainnet..."
            npx hardhat ignition deploy $MODULE_PATH/DeployAllModule.ts --network $NETWORK --parameters ignition/parameters/mainnet-deploy-all.json
        else
            echo "🧪 Deploying all contracts to testnet..."
            echo "📄 Deploying FactoringContract..."
            npx hardhat ignition deploy $MODULE_PATH/FactoringModule.ts --network $NETWORK --parameters $PARAMS_PATH
            echo "💰 Deploying SimpleFund..."
            npx hardhat ignition deploy $MODULE_PATH/SimpleFundModule.ts --network $NETWORK --parameters $PARAMS_PATH
            echo "🏦 Deploying Fund..."
            npx hardhat ignition deploy $MODULE_PATH/FundModule.ts --network $NETWORK --parameters $PARAMS_PATH
        fi
        ;;
    *)
        echo "❌ Unknown module type: $MODULE_TYPE"
        echo "Valid options: factoring, simplefund, fund, all"
        exit 1
        ;;
esac

echo "✅ Deployment completed successfully!"
