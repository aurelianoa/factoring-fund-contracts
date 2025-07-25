import { ethers } from "hardhat";
import { FactoringContract, MockUSDC, MockUSDT } from "../typechain-types";

/**
 * Factoring Finance Demo - Marketplace Workflow
 * 
 * This demo showcases the new marketplace-based factoring system with interest-based returns:
 * 
 * 1. **Bill Request**: Debtor creates a bill request and receives an NFT
 * 2. **Offers**: Multiple lenders can create competing offers with different terms
 * 3. **Accept**: Debtor chooses the best offer, NFT transfers to lender, upfront payment made (minus debtor fee)
 * 4. **Complete**: Debtor pays the full amount, lender gets return + time-based interest, platform gets fees
 * 
 * Key Features:
 * - Competitive marketplace with multiple lenders
 * - NFT-based ownership that can be transferred
 * - Time-based interest calculations (monthly rate)
 * - Automatic fee deductions (debtor fee on acceptance, lender fee on completion)
 * - All percentages in basis points (80% = 8000 basis points)
 * - 100,000 USDC bill example
 */

async function main() {
  console.log("🚀 Factoring Finance Demo - Marketplace Workflow");
  console.log("================================================");

  // Get signers
  const [owner, lender1, lender2, debtor] = await ethers.getSigners();

  console.log("👥 Accounts:");
  console.log(`   Owner: ${owner.address}`);
  console.log(`   Lender 1: ${lender1.address}`);
  console.log(`   Lender 2: ${lender2.address}`);
  console.log(`   Debtor: ${debtor.address}\n`);

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

  console.log(`   MockUSDC deployed at: ${await mockUSDC.getAddress()}`);
  console.log(`   MockUSDT deployed at: ${await mockUSDT.getAddress()}`);
  console.log(`   FactoringContract deployed at: ${await factoringContract.getAddress()}\n`);

  // Mint tokens to users
  console.log("💰 Minting tokens...");
  await mockUSDC.mint(lender1.address, ethers.parseUnits("200000", 6));
  await mockUSDC.mint(lender2.address, ethers.parseUnits("200000", 6));
  await mockUSDC.mint(debtor.address, ethers.parseUnits("150000", 6));

  console.log(`   Minted 200,000 USDC to lender1`);
  console.log(`   Minted 200,000 USDC to lender2`);
  console.log(`   Minted 150,000 USDC to debtor\n`);

  // Approve contract to spend tokens
  await mockUSDC.connect(lender1).approve(await factoringContract.getAddress(), ethers.parseUnits("200000", 6));
  await mockUSDC.connect(lender2).approve(await factoringContract.getAddress(), ethers.parseUnits("200000", 6));
  await mockUSDC.connect(debtor).approve(await factoringContract.getAddress(), ethers.parseUnits("150000", 6));

  // Step 1: Debtor creates a bill request
  console.log("📋 Step 1: Debtor creates a bill request");
  const billAmount = ethers.parseUnits("100000", 6); // 100,000 USDC bill example
  const dueDate = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days from now

  const createTx = await factoringContract.connect(debtor).createBillRequest(
    billAmount,
    dueDate
  );
  await createTx.wait();

  const billRequest = await factoringContract.getBillRequest(1);
  console.log(`   Bill request created with ID: 1`);
  console.log(`   Total amount: ${ethers.formatUnits(billRequest.totalAmount, 6)} USDC`);
  console.log(`   Debtor: ${billRequest.debtor}`);
  console.log(`   NFT minted to debtor: ${await factoringContract.ownerOf(1)}\n`);

  // Step 2: Lenders create offers
  console.log("💼 Step 2: Lenders create competing offers");

  // Lender 1 creates offer with higher upfront but higher interest rate
  const conditions1 = {
    upfrontPercentage: 8500, // 85% upfront (8500 basis points)
    rateInterest: 300        // 3% monthly interest (300 basis points)
  };

  await factoringContract.connect(lender1).createOffer(1, await mockUSDC.getAddress(), conditions1);
  const upfrontAmount1 = (billAmount * 8500n) / 10000n; // 85% in basis points

  console.log(`   Lender1 offer: ${conditions1.upfrontPercentage / 100}% upfront (${conditions1.upfrontPercentage} basis points), ${conditions1.rateInterest / 100}% monthly interest`);
  console.log(`   Lender1 deposited: ${ethers.formatUnits(upfrontAmount1, 6)} USDC`);

  // Lender 2 creates offer with lower upfront but lower interest rate
  const conditions2 = {
    upfrontPercentage: 8000, // 80% upfront (8000 basis points)
    rateInterest: 250        // 2.5% monthly interest (250 basis points)
  };

  await factoringContract.connect(lender2).createOffer(1, await mockUSDC.getAddress(), conditions2);
  const upfrontAmount2 = (billAmount * 8000n) / 10000n; // 80% in basis points

  console.log(`   Lender2 offer: ${conditions2.upfrontPercentage / 100}% upfront (${conditions2.upfrontPercentage} basis points), ${conditions2.rateInterest / 100}% monthly interest`);
  console.log(`   Lender2 deposited: ${ethers.formatUnits(upfrontAmount2, 6)} USDC\n`);

  // Check lender balances after offers
  console.log("💰 Lender balances after creating offers:");
  console.log(`   Lender1 balance: ${ethers.formatUnits(await mockUSDC.balanceOf(lender1.address), 6)} USDC`);
  console.log(`   Lender2 balance: ${ethers.formatUnits(await mockUSDC.balanceOf(lender2.address), 6)} USDC\n`);

  // Step 3: Debtor accepts an offer (chooses lender1's offer for higher upfront)
  console.log("✅ Step 3: Debtor accepts lender1's offer");
  const debtorBalanceBefore = await mockUSDC.balanceOf(debtor.address);

  await factoringContract.connect(debtor).acceptOffer(1); // Accept offer ID 1 from lender1

  const debtorBalanceAfter = await mockUSDC.balanceOf(debtor.address);
  const receivedUpfront = debtorBalanceAfter - debtorBalanceBefore;

  // Calculate expected net amount (upfront - debtor fee)
  const debtorFee = (upfrontAmount1 * 40n) / 10000n; // 40 basis points debtor fee
  const expectedNetAmount = upfrontAmount1 - debtorFee;

  console.log(`   Debtor received (net): ${ethers.formatUnits(receivedUpfront, 6)} USDC`);
  console.log(`   Expected net (after 0.4% debtor fee): ${ethers.formatUnits(expectedNetAmount, 6)} USDC`);
  console.log(`   Debtor fee collected: ${ethers.formatUnits(debtorFee, 6)} USDC`);
  console.log(`   NFT transferred to lender1: ${await factoringContract.ownerOf(1)}`);

  // Check that lender2 was refunded
  const lender2BalanceAfter = await mockUSDC.balanceOf(lender2.address);
  console.log(`   Lender2 refunded: ${ethers.formatUnits(lender2BalanceAfter, 6)} USDC\n`);

  // Check bill creation
  const bill = await factoringContract.getBill(1);
  console.log("📄 Bill created:");
  console.log(`   Debtor: ${bill.debtor}`);
  console.log(`   Lender: ${bill.lender}`);
  console.log(`   Upfront paid: ${ethers.formatUnits(bill.upfrontPaid, 6)} USDC`);
  console.log(`   Total amount: ${ethers.formatUnits(bill.totalAmount, 6)} USDC`);
  console.log(`   Monthly interest rate: ${Number(bill.conditions.rateInterest) / 100}% (${bill.conditions.rateInterest} basis points)\n`);

  // Step 4: Debtor pays the bill in full
  console.log("💸 Step 4: Debtor pays bill in full");

  const lender1BalanceBefore = await mockUSDC.balanceOf(lender1.address);
  /// mint block to pass 45 days
  // Simulate time passing (45 days)
  await ethers.provider.send("evm_increaseTime", [45 * 24 * 60 * 60]); // 45 days in seconds
  await ethers.provider.send("evm_mine", []); // Mine a block to apply the time change

  await factoringContract.connect(debtor).completeBill(1);

  const lender1BalanceAfter = await mockUSDC.balanceOf(lender1.address);
  const lenderReceived = lender1BalanceAfter - lender1BalanceBefore;

  console.log(`   Lender1 received on completion: ${ethers.formatUnits(lenderReceived, 6)} USDC`);
  console.log(`   Note: Amount includes upfront + interest - lender fee (calculated automatically based on time elapsed)`);

  // Verify bill history is preserved
  console.log("\n🏛️ Step 5: Verify bill history preservation");
  const lender1Bills = await factoringContract.getBillsByOwner(lender1.address);
  console.log(`   Lender1 bill history: [${lender1Bills.join(', ')}]`);

  try {
    await factoringContract.ownerOf(1);
    console.log("   ❌ NFT still exists (should be burned)");
  } catch (error) {
    console.log("   ✅ NFT successfully burned");
  }

  const finalBill = await factoringContract.getBill(1);
  console.log(`   Bill status: ${finalBill.status === 1n ? "✅ Completed" : "❌ Not completed"}`);
  console.log("   📝 Note: Bill data and ownership history preserved even after NFT burn\n");

  // Check final balances and distributions
  const finalDebtorBalance = await mockUSDC.balanceOf(debtor.address);
  const finalLender1Balance = await mockUSDC.balanceOf(lender1.address);
  const finalPoolBalance = await factoringContract.getPoolBalance(await mockUSDC.getAddress());

  console.log("\n📊 Final Balances:");
  console.log(`   Debtor balance: ${ethers.formatUnits(finalDebtorBalance, 6)} USDC`);
  console.log(`   Lender1 balance: ${ethers.formatUnits(finalLender1Balance, 6)} USDC`);
  console.log(`   Platform fees collected: ${ethers.formatUnits(finalPoolBalance, 6)} USDC`);

  // Calculate what lender1 received total
  const lender1InitialBalance = ethers.parseUnits("200000", 6);
  const lender1NetChange = finalLender1Balance - lender1InitialBalance;
  const lender1TotalProfit = lender1NetChange; // Net change is the profit since they spent upfront and got paid back

  console.log("\n🎯 Distribution Analysis:");
  console.log(`   Lender1 net profit: ${ethers.formatUnits(lender1TotalProfit, 6)} USDC`);
  console.log(`   Note: Profit includes time-based interest minus lender fee (0.1% of upfront)`);

  // Calculate debtor's net cost
  const debtorInitialBalance = ethers.parseUnits("150000", 6);
  const debtorNetCost = debtorInitialBalance - finalDebtorBalance - receivedUpfront;
  console.log(`   Debtor net cost: ${ethers.formatUnits(debtorNetCost, 6)} USDC (includes debtor fee + any interest)`);

  // Verify bill completion
  const completedBill = await factoringContract.getBill(1);
  console.log(`\n📋 Bill Status: ${completedBill.status === 1n ? "✅ Completed" : "❌ Not Completed"}`);

  console.log("\n🎉 Interest-based marketplace demo completed successfully!");
  console.log("💡 Key features demonstrated:");
  console.log("   - 100,000 USDC bill example");
  console.log("   - Time-based interest calculations");
  console.log("   - Automatic fee deductions (debtor 0.4%, lender 0.1%)");
  console.log("   - Basis points calculations (8500 = 85%)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
