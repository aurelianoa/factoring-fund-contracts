import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const FactoringModule = buildModule("FactoringModule", (m) => {
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

export default FactoringModule;
