import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SimpleFund, MockUSDC, FactoringContract } from "../typechain-types";
import { Signer } from "ethers";

describe("SimpleFund Withdrawal Tracking", function () {
  async function deployFactoringAndSimpleFundFixture() {
    const [owner, operator, user1, user2] = await ethers.getSigners();

    // Deploy mock USDC and USDT
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUSDC = await MockUSDC.deploy("Mock USDC", "USDC", 6, owner.address);
    await mockUSDC.waitForDeployment();

    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy("Mock USDT", "USDT", 6, owner.address);
    await mockUSDT.waitForDeployment();

    // Deploy FactoringContract
    const FactoringContract = await ethers.getContractFactory(
      "FactoringContract"
    );
    const factoringContract = await FactoringContract.deploy(
      await mockUSDC.getAddress(),
      await mockUSDT.getAddress()
    );
    await factoringContract.waitForDeployment();

    // Deploy SimpleFund
    const SimpleFund = await ethers.getContractFactory("SimpleFund");
    const simpleFund = await SimpleFund.deploy(
      await factoringContract.getAddress(),
      await mockUSDC.getAddress(),
      await mockUSDT.getAddress(),
      {
        managementFeePercentage: 500n, // 5%
        acceptingDeposits: true,
      }
    );
    await simpleFund.waitForDeployment();

    // Note: Owner already has admin privileges by default in SimpleFund
    // Owner can perform both operator and admin functions

    // Mint tokens to SimpleFund for testing
    await mockUSDC.mint(await simpleFund.getAddress(), ethers.parseUnits("1000000", 6));
    await mockUSDT.mint(await simpleFund.getAddress(), ethers.parseUnits("1000000", 6));

    return {
      simpleFund,
      factoringContract,
      mockUSDC,
      mockUSDT,
      owner,
      operator,
      user1,
      user2,
    };
  }

  async function createBillAndAcceptOffer() {
    const { simpleFund, factoringContract, mockUSDC, owner } = await loadFixture(
      deployFactoringAndSimpleFundFixture
    );

    const totalAmount = ethers.parseUnits("10000", 6); // 10,000 USDC
    const dueDate = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days from now

    // Create bill request
    const tx1 = await simpleFund
      .connect(owner)
      .createBillRequestForDebtor(totalAmount, dueDate);
    const receipt1 = await tx1.wait();
    const billRequestId = 1n; // First bill request ID

    // Create offer for the bill request
    const conditions = {
      upfrontPercentage: 8000n, // 80%
      rateInterest: 500n, // 5% monthly
    };

    await simpleFund
      .connect(owner)
      .createOfferForBillRequest(
        billRequestId,
        await mockUSDC.getAddress(),
        conditions
      );

    const offerId = 1n; // First offer ID

    // Accept the offer (SimpleFund accepts its own offer)
    await simpleFund.connect(owner).acceptOfferForOwnedBill(offerId);

    const billId = 1n; // First bill ID

    return {
      simpleFund,
      factoringContract,
      mockUSDC,
      owner,
      billId,
      totalAmount,
    };
  }

  describe("Upfront Payment Withdrawal Tracking", function () {
    it("Should allow single upfront payment withdrawal", async function () {
      const { simpleFund, owner, billId } = await loadFixture(createBillAndAcceptOffer);

      // Check initial state
      expect(await simpleFund.upfrontPaymentWithdrawn(billId)).to.be.false;

      // Withdraw upfront payment
      await expect(
        simpleFund
          .connect(owner)
          .withdrawUpfrontPayment(billId, owner.address)
      ).to.not.be.reverted;

      // Check state after withdrawal
      expect(await simpleFund.upfrontPaymentWithdrawn(billId)).to.be.true;
    });

    it("Should prevent double upfront payment withdrawal", async function () {
      const { simpleFund, owner, billId } = await loadFixture(createBillAndAcceptOffer);

      // First withdrawal should succeed
      await simpleFund
        .connect(owner)
        .withdrawUpfrontPayment(billId, owner.address);

      // Second withdrawal should fail
      await expect(
        simpleFund
          .connect(owner)
          .withdrawUpfrontPayment(billId, owner.address)
      ).to.be.revertedWith("Upfront payment already withdrawn");
    });

    it("Should emit UpfrontPaymentWithdrawn event", async function () {
      const { simpleFund, owner, billId } = await loadFixture(createBillAndAcceptOffer);

      // Calculate expected amount (80% of 10,000 USDC minus 0.4% debtor fee)
      const upfrontPaid = ethers.parseUnits("8000", 6); // 80% of 10,000
      const debtorFee = (upfrontPaid * 40n) / 10000n; // 0.4%
      const expectedAmount = upfrontPaid - debtorFee;

      await expect(
        simpleFund
          .connect(owner)
          .withdrawUpfrontPayment(billId, owner.address)
      )
        .to.emit(simpleFund, "UpfrontPaymentWithdrawn")
        .withArgs(billId, owner.address, expectedAmount);
    });
  });

  describe("Debtor Payment Withdrawal Tracking", function () {
    async function completeBillFixture() {
      const result = await createBillAndAcceptOffer();
      const { simpleFund, factoringContract, mockUSDC, billId } = result;

      // Mint additional tokens to SimpleFund for bill completion
      const totalAmount = ethers.parseUnits("10000", 6);
      await mockUSDC.mint(await simpleFund.getAddress(), totalAmount);

      // Approve FactoringContract to spend SimpleFund's tokens for bill completion
      // Note: SimpleFund should handle this internally in payBillForDebtor, but for test we'll call it directly
      await simpleFund.payBillForDebtor(billId);

      return result;
    }

    it("Should allow single debtor payment withdrawal", async function () {
      const { simpleFund, owner, billId } = await loadFixture(completeBillFixture);

      // Check initial state
      expect(await simpleFund.debtorPaymentWithdrawn(billId)).to.be.false;

      // Withdraw debtor payment
      await expect(
        simpleFund
          .connect(owner)
          .withdrawDebtorPayment(billId, owner.address)
      ).to.not.be.reverted;

      // Check state after withdrawal
      expect(await simpleFund.debtorPaymentWithdrawn(billId)).to.be.true;
    });

    it("Should prevent double debtor payment withdrawal", async function () {
      const { simpleFund, owner, billId } = await loadFixture(completeBillFixture);

      // First withdrawal should succeed
      await simpleFund
        .connect(owner)
        .withdrawDebtorPayment(billId, owner.address);

      // Second withdrawal should fail
      await expect(
        simpleFund
          .connect(owner)
          .withdrawDebtorPayment(billId, owner.address)
      ).to.be.revertedWith("Debtor payment already withdrawn");
    });

    it("Should emit DebtorPaymentWithdrawn event", async function () {
      const { simpleFund, owner, billId, totalAmount } = await loadFixture(completeBillFixture);

      // Get bill details to calculate expected debtor payment
      const factoringContract = await ethers.getContractAt(
        "FactoringContract",
        await simpleFund.factoringContract()
      );
      const bill = await factoringContract.getBill(billId);

      // Calculate expected debtor payment (same logic as in contract)
      const lenderFees = (bill.upfrontPaid * bill.lenderFeePercentage) / 10000n;
      const daysPassed = 0n; // Immediate completion
      const interest = (bill.upfrontPaid * bill.conditions.rateInterest * daysPassed) / 30n / 10000n;
      const ownerPayment = bill.upfrontPaid + interest - lenderFees;
      const expectedDebtorPayment = totalAmount - ownerPayment;

      await expect(
        simpleFund
          .connect(owner)
          .withdrawDebtorPayment(billId, owner.address)
      )
        .to.emit(simpleFund, "DebtorPaymentWithdrawn")
        .withArgs(billId, owner.address, expectedDebtorPayment);
    });
  });

  describe("Independent Withdrawal Tracking", function () {
    it("Should track upfront and debtor payments independently", async function () {
      const { simpleFund, mockUSDC, owner, billId } = await loadFixture(createBillAndAcceptOffer);

      // Withdraw upfront payment
      await simpleFund
        .connect(owner)
        .withdrawUpfrontPayment(billId, owner.address);

      // Complete the bill (mint additional tokens and pay)
      const totalAmount = ethers.parseUnits("10000", 6);
      await mockUSDC.mint(await simpleFund.getAddress(), totalAmount);
      await simpleFund.payBillForDebtor(billId);

      // Check tracking states
      expect(await simpleFund.upfrontPaymentWithdrawn(billId)).to.be.true;
      expect(await simpleFund.debtorPaymentWithdrawn(billId)).to.be.false;

      // Should still be able to withdraw debtor payment
      await expect(
        simpleFund
          .connect(owner)
          .withdrawDebtorPayment(billId, owner.address)
      ).to.not.be.reverted;

      // Check final states
      expect(await simpleFund.upfrontPaymentWithdrawn(billId)).to.be.true;
      expect(await simpleFund.debtorPaymentWithdrawn(billId)).to.be.true;
    });

    it("Should track different bills independently", async function () {
      const { simpleFund, owner } = await loadFixture(deployFactoringAndSimpleFundFixture);

      // Create and process first bill
      const totalAmount1 = ethers.parseUnits("5000", 6);
      const dueDate1 = Math.floor(Date.now() / 1000) + 86400 * 30;

      await simpleFund
        .connect(owner)
        .createBillRequestForDebtor(totalAmount1, dueDate1);

      const conditions = {
        upfrontPercentage: 8000n,
        rateInterest: 500n,
      };

      await simpleFund
        .connect(owner)
        .createOfferForBillRequest(
          1n,
          await simpleFund.USDC(),
          conditions
        );

      await simpleFund.connect(owner).acceptOfferForOwnedBill(1n);

      // Create and process second bill
      const totalAmount2 = ethers.parseUnits("7500", 6);
      const dueDate2 = Math.floor(Date.now() / 1000) + 86400 * 30;

      await simpleFund
        .connect(owner)
        .createBillRequestForDebtor(totalAmount2, dueDate2);

      await simpleFund
        .connect(owner)
        .createOfferForBillRequest(
          2n,
          await simpleFund.USDC(),
          conditions
        );

      await simpleFund.connect(owner).acceptOfferForOwnedBill(2n);

      // Withdraw upfront payment for first bill only
      await simpleFund
        .connect(owner)
        .withdrawUpfrontPayment(1n, owner.address);

      // Check tracking states
      expect(await simpleFund.upfrontPaymentWithdrawn(1n)).to.be.true;
      expect(await simpleFund.upfrontPaymentWithdrawn(2n)).to.be.false;

      // Should still be able to withdraw upfront payment for second bill
      await expect(
        simpleFund
          .connect(owner)
          .withdrawUpfrontPayment(2n, owner.address)
      ).to.not.be.reverted;

      // Check final states
      expect(await simpleFund.upfrontPaymentWithdrawn(1n)).to.be.true;
      expect(await simpleFund.upfrontPaymentWithdrawn(2n)).to.be.true;
    });
  });
});
