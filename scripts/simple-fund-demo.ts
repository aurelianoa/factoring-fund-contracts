import { ethers } from "hardhat";

async function main() {
  console.log("🚀 SimpleFund Demo - Solo Investor Factoring with Interest-based Returns");
  console.log("=======================================================================");

  const [owner, admin, debtor] = await ethers.getSigners();

  console.log("👥 Accounts:");
  console.log(`   Owner: ${owner.address}`);
  console.log(`   Admin: ${admin.address}`);
  console.log(`   Debtor: ${debtor.address}`);

  // Deploy contracts
  console.log("\n📄 Deploying contracts...");

  const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDCFactory.deploy("Mock USDC", "USDC", 6, owner.address);
  console.log(`   MockUSDC deployed at: ${await usdc.getAddress()}`);

  const FactoringContractFactory = await ethers.getContractFactory("FactoringContract");
  const factoringContract = await FactoringContractFactory.deploy(
    await usdc.getAddress(),
    await usdc.getAddress() // Using USDC for both for simplicity
  );
  console.log(`   FactoringContract deployed at: ${await factoringContract.getAddress()}`);

  const fundConfig = {
    managementFeePercentage: 500, // 5%
    acceptingDeposits: true
  };

  // Updated conditions for new interest-based model - 100,000 USDC bill example
  const conditions = {
    upfrontPercentage: 8000, // 80% upfront (8000 basis points)
    rateInterest: 300        // 3% monthly interest (300 basis points)
  };

  const SimpleFundFactory = await ethers.getContractFactory("SimpleFund");
  const simpleFund = await SimpleFundFactory.deploy(
    await factoringContract.getAddress(),
    await usdc.getAddress(),
    await usdc.getAddress(),
    fundConfig
  );
  console.log(`   SimpleFund deployed at: ${await simpleFund.getAddress()}`);

  // Setup tokens - larger amounts for 100k bill example
  console.log("\n💰 Setting up tokens...");
  const depositAmount = ethers.parseUnits("150000", 6); // 150k for fund
  const billAmount = ethers.parseUnits("100000", 6);    // 100k bill example

  await usdc.mint(owner.address, depositAmount);
  await usdc.mint(debtor.address, billAmount);

  await usdc.connect(owner).approve(simpleFund.getAddress(), depositAmount);
  await usdc.connect(debtor).approve(simpleFund.getAddress(), billAmount);
  await usdc.connect(debtor).approve(factoringContract.getAddress(), billAmount);

  console.log(`   Minted ${ethers.formatUnits(depositAmount, 6)} USDC to owner (fund investment)`);
  console.log(`   Minted ${ethers.formatUnits(billAmount, 6)} USDC to debtor (for bill payment)`);

  // Step 1: Owner deposits funds
  console.log("\n🏦 Step 1: Owner deposits funds into SimpleFund");
  await simpleFund.connect(owner).deposit(depositAmount, await usdc.getAddress());
  const fundBalance = await simpleFund.getTotalFundValue();
  console.log(`   Deposited: $${ethers.formatUnits(depositAmount, 6)}`);
  console.log(`   Total fund value: $${ethers.formatUnits(fundBalance, 6)}`);

  // Step 2: Create bill request for debtor
  console.log("\n📋 Step 2: Create bill request for debtor (100k example)");
  const dueDate = Math.floor(Date.now() / 1000) + 86400; // 24 hours
  const billRequestTx = await simpleFund.connect(owner).createBillRequestForDebtor(
    billAmount,
    dueDate
  );

  console.log(`   Bill request created for $${ethers.formatUnits(billAmount, 6)}`);
  console.log(`   Due date: ${new Date(dueDate * 1000).toLocaleDateString()}`);

  // Step 3: Create offer automatically
  console.log("\n🤖 Step 3: Automatically create offer for bill request");
  await simpleFund.createOfferForBillRequest(1, await usdc.getAddress(), conditions);

  const offer = await factoringContract.getOffer(1);
  const upfrontAmount = (billAmount * 8000n) / 10000n; // 80% upfront in basis points
  console.log(`   Offer created with ID: 1`);
  console.log(`   Upfront amount: $${ethers.formatUnits(upfrontAmount, 6)} (80% = 8000 basis points)`);
  console.log(`   Monthly interest rate: ${Number(conditions.rateInterest) / 100}% (${conditions.rateInterest} basis points)`);

  // Step 4: Accept offer
  console.log("\n✅ Step 4: SimpleFund accepts its own offer");
  await simpleFund.connect(owner).acceptOfferForOwnedBill(1);

  const bill = await factoringContract.getBill(1);
  console.log(`   Bill created with ID: 1`);
  console.log(`   Lender: ${bill.lender}`);
  console.log(`   Status: ${bill.status} (should be 0 for Active)`);
  console.log(`   Note: Debtor received upfront payment minus 0.4% debtor fee`);

  // Step 5: Debtor pays bill through SimpleFund (manual completion for demo)
  console.log("\n💸 Step 5: Debtor pays bill using FactoringContract directly (demo scenario)");
  const balanceBeforePayment = await simpleFund.totalEarnings();
  const feesBeforePayment = await simpleFund.managementFeesCollected();

  console.log(`   Total earnings before: $${ethers.formatUnits(balanceBeforePayment, 6)}`);
  console.log(`   Management fees before: $${ethers.formatUnits(feesBeforePayment, 6)}`);

  // In this demo, debtor pays directly through FactoringContract
  // This triggers the SimpleFund's handleBillCompletion
  await factoringContract.connect(debtor).completeBill(1);

  // Now call handleBillCompletion to update SimpleFund's internal state
  await simpleFund.handleBillCompletion(1);

  const balanceAfterPayment = await simpleFund.totalEarnings();
  const feesAfterPayment = await simpleFund.managementFeesCollected();

  console.log(`   Total earnings after: $${ethers.formatUnits(balanceAfterPayment, 6)}`);
  console.log(`   Management fees after: $${ethers.formatUnits(feesAfterPayment, 6)}`);
  console.log(`   Note: Returns include time-based interest minus lender fee (0.1%)`);

  // Step 6: Show final results
  console.log("\n🎯 Step 6: Final Results");
  const finalFundValue = await simpleFund.getTotalFundValue();
  const totalEarnings = await simpleFund.totalEarnings();
  const managementFees = await simpleFund.managementFeesCollected();

  console.log(`   Initial fund value: $${ethers.formatUnits(depositAmount, 6)}`);
  console.log(`   Final fund value: $${ethers.formatUnits(finalFundValue, 6)}`);
  console.log(`   Total earnings: $${ethers.formatUnits(totalEarnings, 6)}`);
  console.log(`   Management fees collected: $${ethers.formatUnits(managementFees, 6)}`);
  console.log(`   Net return: $${ethers.formatUnits(finalFundValue - depositAmount, 6)}`);

  // Owner can withdraw management fees
  if (managementFees > 0) {
    console.log("\n💰 Step 7: Owner withdraws management fees");
    const ownerBalanceBefore = await usdc.balanceOf(owner.address);
    await simpleFund.connect(owner).withdrawManagementFees(await usdc.getAddress());
    const ownerBalanceAfter = await usdc.balanceOf(owner.address);
    console.log(`   Owner received: $${ethers.formatUnits(ownerBalanceAfter - ownerBalanceBefore, 6)}`);
  }

  console.log("\n🎉 SimpleFund demo completed successfully!");
  console.log("📊 Summary: SimpleFund operated as a solo investor with interest-based returns:");
  console.log("   ✅ 100,000 USDC bill example");
  console.log("   ✅ Time-based interest calculations");
  console.log("   ✅ Automatic fee deductions (debtor 0.4%, lender 0.1%)");
  console.log("   ✅ Management fee collection (5%)");
  console.log("   ✅ Basis points calculations (8000 = 80%)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
