import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "hardhat";
import MockUSDCModule from "./MockUSDCModule";
import MockUSDTModule from "./MockUSDTModule";

const FundModule = buildModule("FundModule", (m) => {
  // Use mock tokens from separate modules
  const { mockUSDC } = m.useModule(MockUSDCModule);
  const { mockUSDT } = m.useModule(MockUSDTModule);

  // Deploy the main factoring contract first (required for Fund)
  const factoringContract = m.contract("FactoringContract", [
    mockUSDC,
    mockUSDT
  ]);

  // Fund configuration for multi-investor fund
  const fundConfig = {
    minInvestment: ethers.parseUnits("5000", 6),    // $5,000 minimum investment
    maxInvestment: ethers.parseUnits("100000", 6),  // $100,000 maximum per investor
    targetAmount: ethers.parseUnits("1000000", 6),  // $1M target fund size
    feePercentage: 200,                             // 2% management fee (basis points)
    acceptingInvestments: true
  };

  const offerConfig = {
    feePercentage: 4,           // 4% fee
    upfrontPercentage: 80,      // 80% upfront
    ownerPercentage: 16,        // 16% to owner on completion
    minBillAmount: ethers.parseUnits("2000", 6),   // $2,000 minimum
    maxBillAmount: ethers.parseUnits("100000", 6), // $100,000 maximum
    autoOfferEnabled: true
  };

  // Deploy Fund contract
  const fund = m.contract("Fund", [
    factoringContract,
    mockUSDC,
    mockUSDT,
    fundConfig,
    offerConfig
  ]);

  return {
    mockUSDC,
    mockUSDT,
    factoringContract,
    fund
  };
});

export default FundModule;
