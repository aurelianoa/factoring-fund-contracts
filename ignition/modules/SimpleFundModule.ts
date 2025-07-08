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

  // Deploy SimpleFund contract (no offerConfig)
  const simpleFund = m.contract("SimpleFund", [
    factoringContract,
    mockUSDC,
    mockUSDT,
    fundConfig
  ]);

  return {
    mockUSDC,
    mockUSDT,
    factoringContract,
    simpleFund
  };
});

export default SimpleFundModule;
