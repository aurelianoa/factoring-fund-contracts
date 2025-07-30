import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Example deployment script for mainnet modules
const DeployAllModule = buildModule("DeployAllModule", (m) => {
  // This is a combined module that can deploy everything at once

  // Get USDC and USDT addresses from parameters
  const usdcAddress = m.getParameter("USDC");
  const usdtAddress = m.getParameter("USDT");

  // Deploy FactoringContract
  const factoringContract = m.contract("FactoringContract", [
    usdcAddress,
    usdtAddress
  ]);

  // SimpleFund configuration
  const simpleFundConfig = {
    managementFeePercentage: 500, // 5% in basis points
    acceptingDeposits: true
  };

  // Deploy SimpleFund
  const simpleFund = m.contract("SimpleFund", [
    factoringContract,
    usdcAddress,
    usdtAddress,
    simpleFundConfig
  ]);

  // Fund configuration for multi-investor fund
  const fundConfig = {
    minInvestment: "5000000000", // $5,000 with 6 decimals
    maxInvestment: "100000000000", // $100,000 with 6 decimals  
    targetAmount: "1000000000000", // $1M with 6 decimals
    feePercentage: 200, // 2% management fee (basis points)
    acceptingInvestments: true
  };

  // Deploy Fund
  const fund = m.contract("Fund", [
    factoringContract,
    usdcAddress,
    usdtAddress,
    fundConfig
  ]);

  return {
    factoringContract,
    simpleFund,
    fund
  };
});

export default DeployAllModule;
