import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import MockUSDCModule from "./MockUSDCModule";
import MockUSDTModule from "./MockUSDTModule";

const FactoringModule = buildModule("FactoringModule", (m) => {
  // Use mock tokens from separate modules
  const { mockUSDC } = m.useModule(MockUSDCModule);
  const { mockUSDT } = m.useModule(MockUSDTModule);

  // Deploy the main factoring contract
  const factoringContract = m.contract("FactoringContract", [
    mockUSDC,
    mockUSDT
  ]);

  return {
    mockUSDC,
    mockUSDT,
    factoringContract
  };
});

export default FactoringModule;
