import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "hardhat";

const FundModule = buildModule("FundModule", (m) => {
  // Get USDC and USDT addresses from parameters
  const usdcAddress = m.getParameter("USDC");
  const usdtAddress = m.getParameter("USDT");

  // Deploy the main factoring contract first (required for Fund)
  const factoringContract = m.contract("FactoringContract", [
    usdcAddress,
    usdtAddress
  ]);

  // Fund configuration for multi-investor fund
  const fundConfig = {
    minInvestment: ethers.parseUnits("5000", 6),    // $5,000 minimum investment
    maxInvestment: ethers.parseUnits("100000", 6),  // $100,000 maximum per investor
    targetAmount: ethers.parseUnits("1000000", 6),  // $1M target fund size
    feePercentage: 200,                             // 2% management fee (basis points)
    acceptingInvestments: true
  };

  // Deploy Fund contract with real token addresses
  const fund = m.contract("Fund", [
    factoringContract,
    usdcAddress,
    usdtAddress,
    fundConfig
  ]);

  return {
    factoringContract,
    fund
  };
});

export default FundModule;
