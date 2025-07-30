import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const FactoringStableCoinParamsModule = buildModule("FactoringStableCoinParamsModule", (m) => {
  // Get USDC and USDT addresses from parameters
  const usdcAddress = m.getParameter("USDC");
  const usdtAddress = m.getParameter("USDT");

  // Deploy the main factoring contract with real token addresses
  const factoringContract = m.contract("FactoringContract", [
    usdcAddress,
    usdtAddress
  ]);

  return {
    factoringContract
  };
});

export default FactoringStableCoinParamsModule;
