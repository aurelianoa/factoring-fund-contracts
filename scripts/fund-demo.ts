import { ethers } from "hardhat";
import { Fund, FactoringContract, MockUSDC, MockUSDT } from "../typechain-types";

/**
 * Fund Contract Demo
 * 
 * This demo showcases the Fund contract which acts as an intermediary
 * between investors/lenders and debtors in the factoring marketplace:
 * 
 * 1. **Investment**: Multiple investors pool funds into the Fund
 * 2. **Auto-Lending**: Fund automatically creates offers for bill requests
 * 3. **Profit Sharing**: Profits from successful bills are shared among investors
 * 4. **Debtor Services**: Fund helps debtors create bill requests and pay bills
 */

async function main() {
  console.log("🚀 Fund Contract Demo - Pooled Factoring");
  console.log("========================================");

  // Get signers
  const [owner, investor1, investor2, investor3, debtor1, debtor2] = await ethers.getSigners();

  console.log("👥 Accounts:");
  console.log(`   Owner: ${owner.address}`);
  console.log(`   Investor 1: ${investor1.address}`);
  console.log(`   Investor 2: ${investor2.address}`);
  console.log(`   Investor 3: ${investor3.address}`);
  console.log(`   Debtor 1: ${debtor1.address}`);
  console.log(`   Debtor 2: ${debtor2.address}\n`);

  // Deploy contracts
  console.log("📄 Deploying contracts...");

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy("Mock USD Coin", "USDC", 6, owner.address) as MockUSDC;
  await mockUSDC.waitForDeployment();

  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const mockUSDT = await MockUSDT.deploy("Mock Tether USD", "USDT", 6, owner.address) as MockUSDT;
  await mockUSDT.waitForDeployment();

  const FactoringContract = await ethers.getContractFactory("FactoringContract");
  const factoringContract = await FactoringContract.deploy(
    await mockUSDC.getAddress(),
    await mockUSDT.getAddress()
  ) as FactoringContract;
  await factoringContract.waitForDeployment();

  // Fund configuration
  const fundConfig = {
    minInvestment: ethers.parseUnits("5000", 6),     // $5,000 minimum
    maxInvestment: ethers.parseUnits("100000", 6),   // $100,000 maximum
    targetAmount: ethers.parseUnits("500000", 6),    // $500,000 target
    feePercentage: 200,                              // 2% management fee
    acceptingInvestments: true
  };

  const offerConfig = {
    feePercentage: 4,        // 4% platform fee
    upfrontPercentage: 82,   // 82% upfront payment
    ownerPercentage: 14,     // 14% completion payment
    minBillAmount: ethers.parseUnits("2000", 6),     // $2,000 minimum
    maxBillAmount: ethers.parseUnits("50000", 6),    // $50,000 maximum
    autoOfferEnabled: true
  };

  const Fund = await ethers.getContractFactory("Fund");
  const fund = await Fund.deploy(
    await factoringContract.getAddress(),
    await mockUSDC.getAddress(),
    await mockUSDT.getAddress(),
    fundConfig,
    offerConfig
  ) as Fund;
  await fund.waitForDeployment();

  console.log(`   MockUSDC deployed at: ${await mockUSDC.getAddress()}`);
  console.log(`   FactoringContract deployed at: ${await factoringContract.getAddress()}`);
  console.log(`   Fund deployed at: ${await fund.getAddress()}\n`);

  // Mint tokens and setup approvals
  console.log("💰 Setting up tokens and approvals...");

  // Mint tokens to investors
  await mockUSDC.mint(investor1.address, ethers.parseUnits("150000", 6));
  await mockUSDC.mint(investor2.address, ethers.parseUnits("100000", 6));
  await mockUSDC.mint(investor3.address, ethers.parseUnits("75000", 6));

  // Mint tokens to debtors for bill payments
  await mockUSDC.mint(debtor1.address, ethers.parseUnits("30000", 6));
  await mockUSDC.mint(debtor2.address, ethers.parseUnits("40000", 6));

  // Approve fund to spend tokens
  await mockUSDC.connect(investor1).approve(fund.getAddress(), ethers.parseUnits("150000", 6));
  await mockUSDC.connect(investor2).approve(fund.getAddress(), ethers.parseUnits("100000", 6));
  await mockUSDC.connect(investor3).approve(fund.getAddress(), ethers.parseUnits("75000", 6));
  await mockUSDC.connect(debtor1).approve(fund.getAddress(), ethers.parseUnits("30000", 6));
  await mockUSDC.connect(debtor2).approve(fund.getAddress(), ethers.parseUnits("40000", 6));

  console.log("   Tokens minted and approvals set\n");

  // Step 1: Investors invest in the fund
  console.log("🏦 Step 1: Investors pool their money into the fund");

  await fund.connect(investor1).invest(ethers.parseUnits("80000", 6), await mockUSDC.getAddress());
  await fund.connect(investor2).invest(ethers.parseUnits("60000", 6), await mockUSDC.getAddress());
  await fund.connect(investor3).invest(ethers.parseUnits("40000", 6), await mockUSDC.getAddress());

  const totalFundValue = await fund.getTotalFundValue();
  console.log(`   Investor1 invested: $80,000`);
  console.log(`   Investor2 invested: $60,000`);
  console.log(`   Investor3 invested: $40,000`);
  console.log(`   Total fund value: $${ethers.formatUnits(totalFundValue, 6)}\n`);

  // Show investor shares
  console.log("📊 Investor ownership breakdown:");
  const investor1Value = await fund.getInvestorValue(investor1.address);
  const investor2Value = await fund.getInvestorValue(investor2.address);
  const investor3Value = await fund.getInvestorValue(investor3.address);

  console.log(`   Investor1: $${ethers.formatUnits(investor1Value, 6)} (${(Number(investor1Value) * 100 / Number(totalFundValue)).toFixed(1)}%)`);
  console.log(`   Investor2: $${ethers.formatUnits(investor2Value, 6)} (${(Number(investor2Value) * 100 / Number(totalFundValue)).toFixed(1)}%)`);
  console.log(`   Investor3: $${ethers.formatUnits(investor3Value, 6)} (${(Number(investor3Value) * 100 / Number(totalFundValue)).toFixed(1)}%)\n`);

  // Step 2: Create bill requests for debtors
  console.log("📋 Step 2: Fund creates bill requests for debtors");

  const dueDate1 = Math.floor(Date.now() / 1000) + (45 * 24 * 60 * 60); // 45 days
  const dueDate2 = Math.floor(Date.now() / 1000) + (60 * 24 * 60 * 60); // 60 days

  const billAmount1 = ethers.parseUnits("25000", 6);
  const billAmount2 = ethers.parseUnits("35000", 6);

  await fund.createBillRequestForDebtor(
    billAmount1,
    dueDate1,
    await mockUSDC.getAddress(),
    debtor1.address
  );

  await fund.createBillRequestForDebtor(
    billAmount2,
    dueDate2,
    await mockUSDC.getAddress(),
    debtor2.address
  );

  console.log(`   Bill request 1: $${ethers.formatUnits(billAmount1, 6)} for debtor1`);
  console.log(`   Bill request 2: $${ethers.formatUnits(billAmount2, 6)} for debtor2\n`);

  // Step 3: Fund automatically creates offers
  console.log("🤖 Step 3: Fund automatically creates competitive offers");

  await fund.createOfferForBillRequest(1);
  await fund.createOfferForBillRequest(2);

  const upfront1 = (billAmount1 * 82n) / 100n;
  const upfront2 = (billAmount2 * 82n) / 100n;

  console.log(`   Offer 1: $${ethers.formatUnits(upfront1, 6)} upfront (82%) for bill 1`);
  console.log(`   Offer 2: $${ethers.formatUnits(upfront2, 6)} upfront (82%) for bill 2`);

  const fundBalanceAfterOffers = await fund.getFundBalance(await mockUSDC.getAddress());
  console.log(`   Remaining fund balance: $${ethers.formatUnits(fundBalanceAfterOffers, 6)}\n`);

  // Step 4: Fund accepts its own offers (since it owns the NFTs)
  console.log("✅ Step 4: Fund accepts offers and disburses upfront payments");

  // Fund accepts its own offers
  await fund.acceptOfferForOwnedBill(1);
  await fund.acceptOfferForOwnedBill(2);

  console.log(`   Debtor1 received upfront: $${ethers.formatUnits(upfront1, 6)}`);
  console.log(`   Debtor2 received upfront: $${ethers.formatUnits(upfront2, 6)}`);
  console.log(`   Bills created with Fund as lender\n`);

  // Step 5: Debtors pay their bills
  console.log("💸 Step 5: Debtors pay their bills in full");

  // Debtor1 pays through fund
  await fund.connect(debtor1).payBillForDebtor(1, debtor1.address);
  await fund.handleBillCompletion(1);

  // Debtor2 pays through fund  
  await fund.connect(debtor2).payBillForDebtor(2, debtor2.address);
  await fund.handleBillCompletion(2);

  console.log(`   Debtor1 paid: $${ethers.formatUnits(billAmount1, 6)}`);
  console.log(`   Debtor2 paid: $${ethers.formatUnits(billAmount2, 6)}\n`);

  // Step 6: Calculate and display final results
  console.log("🎯 Step 6: Final Results and Profit Distribution");

  const finalFundValue = await fund.getTotalFundValue();
  const totalProfit = finalFundValue - totalFundValue;
  const totalEarnings = await fund.totalEarnings();
  const managementFees = await fund.managementFeesCollected();

  console.log(`   Initial fund value: $${ethers.formatUnits(totalFundValue, 6)}`);
  console.log(`   Final fund value: $${ethers.formatUnits(finalFundValue, 6)}`);
  console.log(`   Total profit: $${ethers.formatUnits(totalProfit, 6)}`);
  console.log(`   Investor earnings: $${ethers.formatUnits(totalEarnings, 6)}`);
  console.log(`   Management fees: $${ethers.formatUnits(managementFees, 6)}\n`);

  // Show final investor values
  console.log("💎 Final investor portfolio values:");
  const finalInvestor1Value = await fund.getInvestorValue(investor1.address);
  const finalInvestor2Value = await fund.getInvestorValue(investor2.address);
  const finalInvestor3Value = await fund.getInvestorValue(investor3.address);

  const investor1Profit = finalInvestor1Value - investor1Value;
  const investor2Profit = finalInvestor2Value - investor2Value;
  const investor3Profit = finalInvestor3Value - investor3Value;

  console.log(`   Investor1: $${ethers.formatUnits(finalInvestor1Value, 6)} (+$${ethers.formatUnits(investor1Profit, 6)})`);
  console.log(`   Investor2: $${ethers.formatUnits(finalInvestor2Value, 6)} (+$${ethers.formatUnits(investor2Profit, 6)})`);
  console.log(`   Investor3: $${ethers.formatUnits(finalInvestor3Value, 6)} (+$${ethers.formatUnits(investor3Profit, 6)})\n`);

  // Calculate ROI
  const roi1 = (Number(investor1Profit) * 100) / Number(investor1Value);
  const roi2 = (Number(investor2Profit) * 100) / Number(investor2Value);
  const roi3 = (Number(investor3Profit) * 100) / Number(investor3Value);

  console.log("📈 Return on Investment (ROI):");
  console.log(`   Investor1 ROI: ${roi1.toFixed(2)}%`);
  console.log(`   Investor2 ROI: ${roi2.toFixed(2)}%`);
  console.log(`   Investor3 ROI: ${roi3.toFixed(2)}%`);

  const totalInvested = investor1Value + investor2Value + investor3Value;
  const totalProfitEarned = investor1Profit + investor2Profit + investor3Profit;
  const avgROI = (Number(totalProfitEarned) * 100) / Number(totalInvested);
  console.log(`   Average ROI: ${avgROI.toFixed(2)}%\n`);

  console.log("🎉 Fund demo completed successfully!");
  console.log("📊 Summary: The fund successfully pooled investor capital,");
  console.log("    automatically created competitive offers, and distributed");
  console.log("    profits proportionally among investors!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
