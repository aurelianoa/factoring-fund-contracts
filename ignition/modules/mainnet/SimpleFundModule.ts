import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import FactoringModule from "./FactoringModule";

const SimpleFundModule = buildModule("SimpleFundModule", (m) => {
  // Get USDC and USDT addresses from parameters
  const usdcAddress = m.getParameter("USDC");
  const usdtAddress = m.getParameter("USDT");

  // Use FactoringModule for the factoring contract
  const { factoringContract } = m.useModule(FactoringModule);

  // SimpleFund configuration
  const fundConfig = {
    managementFeePercentage: 500, // 5% in basis points
    acceptingDeposits: true
  };

  // Deploy SimpleFund contract with real token addresses
  const simpleFund = m.contract("SimpleFund", [
    factoringContract,
    usdcAddress,
    usdtAddress,
    fundConfig
  ]);

  return {
    factoringContract,
    simpleFund
  };
});

export default SimpleFundModule;
