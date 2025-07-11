import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import FactoringModule from "./FactoringModule";

const SimpleFundModule = buildModule("SimpleFundModule", (m) => {
  // Use FactoringModule for tokens and factoring contract
  const { mockUSDC, mockUSDT, factoringContract } = m.useModule(FactoringModule);

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
