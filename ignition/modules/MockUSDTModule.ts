import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MockUSDTModule = buildModule("MockUSDTModule", (m) => {
  // Deploy mock USDT token for testing
  const mockUSDT = m.contract("MockUSDT", [
    "Mock Tether USD",
    "USDT",
    6, // 6 decimals like real USDT
    m.getAccount(0) // deployer as owner
  ]);

  return {
    mockUSDT
  };
});

export default MockUSDTModule;
