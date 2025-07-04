import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "hardhat";
import MockUSDCModule from "./MockUSDCModule";
import MockUSDTModule from "./MockUSDTModule";

const SimpleFundModule = buildModule("SimpleFundModule", (m) => {
  // Use mock tokens from separate modules
  const { mockUSDC } = m.useModule(MockUSDCModule);
  const { mockUSDT } = m.useModule(MockUSDTModule);

  // Deploy the main factoring contract first (required for SimpleFund)
  const factoringContract = m.contract("FactoringContract", [
    mockUSDC,
    mockUSDT
  ]);

  // SimpleFund configuration
  const fundConfig = {
    managementFeePercentage: 500, // 5% in basis points
    acceptingDeposits: true
  };

  const offerConfig = {
    feePercentage: 3,           // 3% fee
    upfrontPercentage: 80,      // 80% upfront
    ownerPercentage: 17,        // 17% to owner on completion
    minBillAmount: ethers.parseUnits("1000", 6),   // $1,000 minimum
    maxBillAmount: ethers.parseUnits("50000", 6),  // $50,000 maximum
    autoOfferEnabled: true
  };

  // Deploy SimpleFund contract
  const simpleFund = m.contract("SimpleFund", [
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
    simpleFund
  };
});

export default SimpleFundModule;
