import { ethers } from "hardhat";
import { FactoringContract, MockUSDC, MockUSDT } from "../typechain-types";

/**
 * Factoring Finance Demo - Marketplace Workflow
 * 
 * This demo showcases the new marketplace-based factoring system:
 * 
 * 1. **Bill Request**: Debtor creates a bill request and receives an NFT
 * 2. **Offers**: Multiple lenders can create competing offers with different terms
 * 3. **Accept**: Debtor chooses the best offer, NFT transfers to lender, upfront payment made
 * 4. **Complete**: Debtor pays the full amount, lender gets return + profit, platform gets fees
 * 
 * Key Features:
 * - Competitive marketplace with multiple lenders
 * - NFT-based ownership that can be transferred
 * - Flexible terms per offer (fee%, upfront%, completion%)
 * - Automatic refunding of rejected offers
 * - Direct peer-to-peer lending without pools
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
  await mockUSDC.mint(lender1.address, ethers.parseUnits("50000", 6));
  await mockUSDC.mint(lender2.address, ethers.parseUnits("50000", 6));
  await mockUSDC.mint(debtor.address, ethers.parseUnits("20000", 6));

  console.log(`   Minted 50,000 USDC to lender1`);
  console.log(`   Minted 50,000 USDC to lender2`);
  console.log(`   Minted 20,000 USDC to debtor\n`);

  // Approve contract to spend tokens
  await mockUSDC.connect(lender1).approve(await factoringContract.getAddress(), ethers.parseUnits("50000", 6));
  await mockUSDC.connect(lender2).approve(await factoringContract.getAddress(), ethers.parseUnits("50000", 6));
  await mockUSDC.connect(debtor).approve(await factoringContract.getAddress(), ethers.parseUnits("20000", 6));

  // Step 1: Debtor creates a bill request
  console.log("📋 Step 1: Debtor creates a bill request");
  const billAmount = ethers.parseUnits("10000", 6);
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

  // Lender 1 creates offer with better upfront but higher fees
  const conditions1 = {
    feePercentage: 5,     // 5% fee
    upfrontPercentage: 85, // 85% upfront
    ownerPercentage: 10   // 10% to debtor on completion
  };

  await factoringContract.connect(lender1).createOffer(1, await mockUSDC.getAddress(), conditions1);
  const upfrontAmount1 = (billAmount * 85n) / 100n;

  console.log(`   Lender1 offer: ${conditions1.upfrontPercentage}% upfront, ${conditions1.feePercentage}% fee, ${conditions1.ownerPercentage}% completion`);
  console.log(`   Lender1 deposited: ${ethers.formatUnits(upfrontAmount1, 6)} USDC`);

  // Lender 2 creates offer with lower upfront but lower fees
  const conditions2 = {
    feePercentage: 3,     // 3% fee
    upfrontPercentage: 80, // 80% upfront
    ownerPercentage: 17   // 17% to debtor on completion
  };

  await factoringContract.connect(lender2).createOffer(1, await mockUSDC.getAddress(), conditions2);
  const upfrontAmount2 = (billAmount * 80n) / 100n;

  console.log(`   Lender2 offer: ${conditions2.upfrontPercentage}% upfront, ${conditions2.feePercentage}% fee, ${conditions2.ownerPercentage}% completion`);
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

  console.log(`   Debtor received upfront: ${ethers.formatUnits(receivedUpfront, 6)} USDC`);
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
  console.log(`   Remaining: ${ethers.formatUnits(bill.remainingAmount, 6)} USDC\n`);

  // Step 4: Debtor pays the bill in full
  console.log("💸 Step 4: Debtor pays bill in full");
  await factoringContract.connect(debtor).completeBill(1);

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

  // Calculate what lender1 received
  const lender1InitialBalance = ethers.parseUnits("50000", 6);
  const lender1TotalReceived = finalLender1Balance - lender1InitialBalance + upfrontAmount1;
  const lender1Profit = lender1TotalReceived - billAmount;

  console.log("\n🎯 Distribution Analysis:");
  console.log(`   Lender1 total received: ${ethers.formatUnits(lender1TotalReceived, 6)} USDC`);
  console.log(`   Lender1 profit: ${ethers.formatUnits(lender1Profit, 6)} USDC`);

  // Calculate debtor's net position
  const debtorNetPayment = ethers.parseUnits("20000", 6) - finalDebtorBalance - receivedUpfront;
  console.log(`   Debtor net payment: ${ethers.formatUnits(debtorNetPayment, 6)} USDC`);

  // Verify bill completion
  const completedBill = await factoringContract.getBill(1);
  console.log(`\n📋 Bill Status: ${completedBill.status === 1n ? "✅ Completed" : "❌ Not Completed"}`);

  console.log("\n🎉 Marketplace demo completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
