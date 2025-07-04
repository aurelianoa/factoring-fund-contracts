import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MockUSDCModule = buildModule("MockUSDCModule", (m) => {
  // Deploy mock USDC token for testing
  const mockUSDC = m.contract("MockUSDC", [
    "Mock USD Coin",
    "USDC",
    6, // 6 decimals like real USDC
    m.getAccount(0) // deployer as owner
  ]);

  return {
    mockUSDC
  };
});

export default MockUSDCModule;
