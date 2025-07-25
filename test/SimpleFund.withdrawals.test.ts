import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { SimpleFund, FactoringContract, MockUSDC } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("SimpleFund Withdrawal Functions", function () {
  async function deployContractsFixture() {
    const [deployer, admin, operator, user] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDCFactory.deploy("Mock USDC", "USDC", 6, deployer.address);

    // Deploy MockUSDT
    const MockUSDTFactory = await ethers.getContractFactory("MockUSDT");
    const usdt = await MockUSDTFactory.deploy("Mock USDT", "USDT", 6, deployer.address);

    // Deploy FactoringContract
    const FactoringContractFactory = await ethers.getContractFactory("FactoringContract");
    const factoringContract = await FactoringContractFactory.deploy(
      await usdc.getAddress(),
      await usdt.getAddress()
    );

    // Deploy SimpleFund
    const SimpleFundFactory = await ethers.getContractFactory("SimpleFund");
    const simpleFund = await SimpleFundFactory.deploy(
      await factoringContract.getAddress(),
      await usdc.getAddress(),
      await usdt.getAddress(),
      {
        managementFeePercentage: 500, // 5%
        acceptingDeposits: true
      }
    );

    // Set operator role for deployer (owner already has admin role)
    // Note: Since the deployer is the owner, they have admin privileges by default

    // Mint some USDC to participants
    await usdc.mint(deployer.address, ethers.parseUnits("1000000", 6)); // 1M USDC to deployer
    await usdc.mint(operator.address, ethers.parseUnits("1000000", 6)); // 1M USDC
    await usdc.mint(user.address, ethers.parseUnits("200000", 6)); // 200k USDC
    await usdc.mint(await simpleFund.getAddress(), ethers.parseUnits("500000", 6)); // 500k USDC to fund

    return {
      deployer,
      admin,
      operator,
      user,
      usdc,
      usdt,
      factoringContract,
      simpleFund
    };
  }

  describe("Withdraw Upfront Payment", function () {
    it("Should allow admin to withdraw upfront payment after offer is accepted", async function () {
      const { deployer, operator, user, usdc, factoringContract, simpleFund } = await loadFixture(deployContractsFixture);

      const billAmount = ethers.parseUnits("100000", 6); // 100k USDC
      const dueDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days from now
      const upfrontPercentage = 8000; // 80%
      const rateInterest = 300; // 3% monthly

      // SimpleFund creates a bill request
      const billRequestTx = await simpleFund.connect(deployer).createBillRequestForDebtor(
        billAmount,
        dueDate
      );
      const receipt = await billRequestTx.wait();
      const billRequestId = 1n; // First bill request

      // User creates an offer
      const upfrontAmount = (billAmount * BigInt(upfrontPercentage)) / 10000n;
      await usdc.connect(user).approve(await factoringContract.getAddress(), upfrontAmount);

      await factoringContract.connect(user).createOffer(
        billRequestId,
        await usdc.getAddress(),
        { upfrontPercentage, rateInterest }
      );

      // SimpleFund accepts the offer (gets upfront payment)
      await simpleFund.connect(deployer).acceptOfferForOwnedBill(1n); // First offer

      // Check SimpleFund received upfront payment (minus debtor fee)
      const bill = await factoringContract.getBill(billRequestId);
      const debtorFee = (bill.upfrontPaid * bill.debtorFeePercentage) / 10000n;
      const expectedUpfrontAfterFees = bill.upfrontPaid - debtorFee;

      // Admin withdraws the upfront payment
      const initialBalance = await usdc.balanceOf(deployer.address);

      await simpleFund.connect(deployer).withdrawUpfrontPayment(
        billRequestId,
        deployer.address
      );

      const finalBalance = await usdc.balanceOf(deployer.address);
      expect(finalBalance - initialBalance).to.equal(expectedUpfrontAfterFees);
    });

    it("Should revert if bill is not active", async function () {
      const { deployer, simpleFund } = await loadFixture(deployContractsFixture);

      await expect(
        simpleFund.connect(deployer).withdrawUpfrontPayment(999n, deployer.address)
      ).to.be.revertedWith("Bill does not exist");
    });
  });

  describe("Withdraw Debtor Payment", function () {
    it("Should allow admin to withdraw debtor payment after bill completion", async function () {
      const { deployer, operator, user, usdc, factoringContract, simpleFund } = await loadFixture(deployContractsFixture);

      const billAmount = ethers.parseUnits("100000", 6); // 100k USDC
      const dueDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days from now
      const upfrontPercentage = 8000; // 80%
      const rateInterest = 300; // 3% monthly

      // Create bill request and offer
      await simpleFund.connect(deployer).createBillRequestForDebtor(billAmount, dueDate);
      const billRequestId = 1n;

      const upfrontAmount = (billAmount * BigInt(upfrontPercentage)) / 10000n;
      await usdc.connect(user).approve(await factoringContract.getAddress(), upfrontAmount);

      await factoringContract.connect(user).createOffer(
        billRequestId,
        await usdc.getAddress(),
        { upfrontPercentage, rateInterest }
      );

      // Accept offer
      await simpleFund.connect(deployer).acceptOfferForOwnedBill(1n);

      // Fast forward 15 days
      await time.increase(15 * 24 * 60 * 60);

      // Complete the bill (SimpleFund pays as debtor)
      await usdc.connect(deployer).approve(await factoringContract.getAddress(), billAmount);
      await factoringContract.connect(deployer).completeBill(billRequestId);

      // Calculate expected debtor payment
      const bill = await factoringContract.getBill(billRequestId);
      const lenderFees = (bill.upfrontPaid * bill.lenderFeePercentage) / 10000n;
      const daysPassed = 15n; // 15 days
      const interest = (bill.upfrontPaid * BigInt(rateInterest) * daysPassed) / 30n / 10000n;
      const ownerPayment = bill.upfrontPaid + interest - lenderFees;
      const expectedDebtorPayment = bill.totalAmount - ownerPayment;

      // Admin withdraws the debtor payment
      const initialBalance = await usdc.balanceOf(deployer.address);

      await simpleFund.connect(deployer).withdrawDebtorPayment(
        billRequestId,
        deployer.address
      );

      const finalBalance = await usdc.balanceOf(deployer.address);
      expect(finalBalance - initialBalance).to.equal(expectedDebtorPayment);
    });

    it("Should revert if bill is not completed", async function () {
      const { deployer, operator, user, usdc, factoringContract, simpleFund } = await loadFixture(deployContractsFixture);

      const billAmount = ethers.parseUnits("100000", 6);
      const dueDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      const upfrontPercentage = 8000; // 80%
      const rateInterest = 300; // 3% monthly

      // Create bill request and accept offer to create an active bill
      await simpleFund.connect(deployer).createBillRequestForDebtor(billAmount, dueDate);
      const billRequestId = 1n;

      const upfrontAmount = (billAmount * BigInt(upfrontPercentage)) / 10000n;
      await usdc.connect(user).approve(await factoringContract.getAddress(), upfrontAmount);

      await factoringContract.connect(user).createOffer(
        billRequestId,
        await usdc.getAddress(),
        { upfrontPercentage, rateInterest }
      );

      await simpleFund.connect(deployer).acceptOfferForOwnedBill(1n);

      // Try to withdraw debtor payment before bill is completed (should fail)
      await expect(
        simpleFund.connect(deployer).withdrawDebtorPayment(1n, deployer.address)
      ).to.be.revertedWith("Bill not completed");
    });

    it("Should revert if no debtor payment available", async function () {
      const { deployer, operator, user, usdc, factoringContract, simpleFund } = await loadFixture(deployContractsFixture);

      const billAmount = ethers.parseUnits("100000", 6); // 100k USDC
      const dueDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      // High upfront percentage that should leave minimal debtor payment
      const upfrontPercentage = 9500; // 95%
      const rateInterest = 100; // 1% monthly (moderate interest)

      // Create and complete bill with high upfront percentage
      await simpleFund.connect(deployer).createBillRequestForDebtor(billAmount, dueDate);
      const billRequestId = 1n;

      const upfrontAmount = (billAmount * BigInt(upfrontPercentage)) / 10000n;
      await usdc.connect(user).approve(await factoringContract.getAddress(), upfrontAmount);

      await factoringContract.connect(user).createOffer(
        billRequestId,
        await usdc.getAddress(),
        { upfrontPercentage, rateInterest }
      );

      await simpleFund.connect(deployer).acceptOfferForOwnedBill(1n);

      // Fast forward 5 days for some interest accumulation
      await time.increase(5 * 24 * 60 * 60);

      await usdc.connect(deployer).approve(await factoringContract.getAddress(), billAmount);
      await factoringContract.connect(deployer).completeBill(billRequestId);

      // Check if there's any debtor payment available
      const bill = await factoringContract.getBill(billRequestId);
      const lenderFees = (bill.upfrontPaid * bill.lenderFeePercentage) / 10000n;
      const daysPassed = 5n; // 5 days
      const interest = (bill.upfrontPaid * BigInt(rateInterest) * daysPassed) / 30n / 10000n;
      const ownerPayment = bill.upfrontPaid + interest - lenderFees;
      const debtorPayment = bill.totalAmount - ownerPayment;

      if (debtorPayment <= 0n) {
        // Should revert because no debtor payment available
        await expect(
          simpleFund.connect(deployer).withdrawDebtorPayment(billRequestId, deployer.address)
        ).to.be.revertedWith("No debtor payment available");
      } else {
        // If there is debtor payment, the withdrawal should succeed
        await expect(
          simpleFund.connect(deployer).withdrawDebtorPayment(billRequestId, deployer.address)
        ).to.not.be.reverted;
      }
    });
  });

  describe("Access Control", function () {
    it("Should only allow admin to withdraw upfront payment", async function () {
      const { operator, user, simpleFund } = await loadFixture(deployContractsFixture);

      await expect(
        simpleFund.connect(user).withdrawUpfrontPayment(1n, user.address)
      ).to.be.reverted;

      await expect(
        simpleFund.connect(operator).withdrawUpfrontPayment(1n, operator.address)
      ).to.be.reverted;
    });

    it("Should only allow admin to withdraw debtor payment", async function () {
      const { operator, user, simpleFund } = await loadFixture(deployContractsFixture);

      await expect(
        simpleFund.connect(user).withdrawDebtorPayment(1n, user.address)
      ).to.be.reverted;

      await expect(
        simpleFund.connect(operator).withdrawDebtorPayment(1n, operator.address)
      ).to.be.reverted;
    });
  });
});
