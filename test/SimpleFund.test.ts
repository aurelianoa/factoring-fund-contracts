import { expect } from "chai";
import { ethers } from "hardhat";
import {
  SimpleFund,
  FactoringContract,
  MockUSDC,
  MockUSDT
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("SimpleFund Contract", function () {
  let simpleFund: SimpleFund;
  let factoringContract: FactoringContract;
  let usdc: MockUSDC;
  let usdt: MockUSDT;

  let owner: SignerWithAddress;
  let admin: SignerWithAddress;
  let debtor: SignerWithAddress;
  let unauthorizedUser: SignerWithAddress;

  const DEPOSIT_AMOUNT = ethers.parseUnits("50000", 6);
  const BILL_AMOUNT = ethers.parseUnits("10000", 6);

  beforeEach(async function () {
    [owner, admin, debtor, unauthorizedUser] = await ethers.getSigners();

    // Deploy mock tokens
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDCFactory.deploy("Mock USDC", "USDC", 6, owner.address);

    const MockUSDTFactory = await ethers.getContractFactory("MockUSDT");
    usdt = await MockUSDTFactory.deploy("Mock USDT", "USDT", 6, owner.address);

    // Deploy FactoringContract
    const FactoringContractFactory = await ethers.getContractFactory("FactoringContract");
    factoringContract = await FactoringContractFactory.deploy(
      await usdc.getAddress(),
      await usdt.getAddress()
    );

    // Deploy SimpleFund contract
    const fundConfig = {
      managementFeePercentage: 500, // 5% in basis points
      acceptingDeposits: true
    };

    const SimpleFundFactory = await ethers.getContractFactory("SimpleFund");
    simpleFund = await SimpleFundFactory.deploy(
      await factoringContract.getAddress(),
      await usdc.getAddress(),
      await usdt.getAddress(),
      fundConfig
    );

    // Mint tokens to admin and debtor
    await usdc.mint(admin.address, ethers.parseUnits("100000", 6));
    await usdc.mint(owner.address, ethers.parseUnits("100000", 6)); // Add tokens to owner
    await usdc.mint(debtor.address, ethers.parseUnits("50000", 6));

    // Approve simpleFund to spend tokens
    await usdc.connect(admin).approve(simpleFund.getAddress(), ethers.parseUnits("100000", 6));
    await usdc.connect(owner).approve(simpleFund.getAddress(), ethers.parseUnits("100000", 6)); // Add approval for owner
    await usdc.connect(debtor).approve(simpleFund.getAddress(), ethers.parseUnits("50000", 6)); // Debtor approves SimpleFund
  });

  describe("Fund Management", function () {
    it("Should allow authorized admin to deposit funds", async function () {
      const tx = await simpleFund.connect(owner).deposit(DEPOSIT_AMOUNT, await usdc.getAddress());

      await expect(tx)
        .to.emit(simpleFund, "FundsDeposited")
        .withArgs(owner.address, DEPOSIT_AMOUNT, await usdc.getAddress());

      // Check fund balances
      expect(await simpleFund.getTotalFundValue()).to.equal(DEPOSIT_AMOUNT);
      expect(await simpleFund.getFundBalance(await usdc.getAddress())).to.equal(DEPOSIT_AMOUNT);
    });

    it("Should prevent unauthorized users from depositing", async function () {
      await expect(
        simpleFund.connect(unauthorizedUser).deposit(DEPOSIT_AMOUNT, await usdc.getAddress())
      ).to.be.reverted;
    });

    it("Should allow authorized admin to withdraw funds", async function () {
      // First deposit
      await simpleFund.connect(owner).deposit(DEPOSIT_AMOUNT, await usdc.getAddress());

      const withdrawAmount = DEPOSIT_AMOUNT / 2n;
      const balanceBefore = await usdc.balanceOf(owner.address);

      const tx = await simpleFund.connect(owner).withdraw(withdrawAmount, await usdc.getAddress());

      await expect(tx)
        .to.emit(simpleFund, "FundsWithdrawn")
        .withArgs(owner.address, withdrawAmount, await usdc.getAddress());

      // Check balances
      const balanceAfter = await usdc.balanceOf(owner.address);
      expect(balanceAfter - balanceBefore).to.equal(withdrawAmount);
      expect(await simpleFund.getTotalFundValue()).to.equal(DEPOSIT_AMOUNT - withdrawAmount);
    });

    it("Should prevent unauthorized users from withdrawing", async function () {
      await simpleFund.connect(owner).deposit(DEPOSIT_AMOUNT, await usdc.getAddress());

      await expect(
        simpleFund.connect(unauthorizedUser).withdraw(DEPOSIT_AMOUNT / 2n, await usdc.getAddress())
      ).to.be.reverted;
    });

    it("Should prevent withdrawal when insufficient balance", async function () {
      await simpleFund.connect(owner).deposit(DEPOSIT_AMOUNT, await usdc.getAddress());

      await expect(
        simpleFund.connect(owner).withdraw(DEPOSIT_AMOUNT * 2n, await usdc.getAddress())
      ).to.be.revertedWith("Insufficient fund balance");
    });
  });

  describe("Bill Request Management", function () {
    beforeEach(async function () {
      // Add liquidity to the fund
      await simpleFund.connect(owner).deposit(DEPOSIT_AMOUNT, await usdc.getAddress());
    });

    it("Should allow admin to create bill request for debtor", async function () {
      const dueDate = Math.floor(Date.now() / 1000) + 86400; // 24 hours

      const tx = await simpleFund.connect(owner).createBillRequestForDebtor(
        BILL_AMOUNT,
        dueDate,
        debtor.address
      );

      await expect(tx)
        .to.emit(simpleFund, "BillRequestFunded")
        .withArgs(1, debtor.address, BILL_AMOUNT);

      // Check that bill request was created in factoring contract
      const billRequest = await factoringContract.getBillRequest(1);
      expect(billRequest.totalAmount).to.equal(BILL_AMOUNT);
      expect(billRequest.debtor).to.equal(await simpleFund.getAddress()); // SimpleFund is the debtor in factoring contract
    });

    it("Should prevent unauthorized users from creating bill requests", async function () {
      const dueDate = Math.floor(Date.now() / 1000) + 86400;

      await expect(
        simpleFund.connect(unauthorizedUser).createBillRequestForDebtor(
          BILL_AMOUNT,
          dueDate,
          debtor.address
        )
      ).to.be.reverted;
    });

    it("Should automatically create offers for bill requests", async function () {
      // Create bill request first
      const dueDate = Math.floor(Date.now() / 1000) + 86400;
      await simpleFund.connect(owner).createBillRequestForDebtor(
        BILL_AMOUNT,
        dueDate,
        debtor.address
      );

      // Create offer automatically
      const conditions: FactoringContract.ConditionsStruct = {
        feePercentage: 3,
        upfrontPercentage: 80,
        ownerPercentage: 17
      };
      const tx = await simpleFund.createOfferForBillRequest(1, await usdc.getAddress(), conditions);

      await expect(tx)
        .to.emit(simpleFund, "OfferCreatedAutomatically")
        .withArgs(1, 1, BILL_AMOUNT * 80n / 100n); // 80% upfront

      // Check that offer was created
      const offer = await factoringContract.getOffer(1);
      expect(offer.lender).to.equal(await simpleFund.getAddress());
      expect(offer.billRequestId).to.equal(1);
    });

    it("Should reject non-existent bill requests", async function () {
      const conditions: FactoringContract.ConditionsStruct = {
        feePercentage: 3,
        upfrontPercentage: 80,
        ownerPercentage: 17
      };
      await expect(
        simpleFund.createOfferForBillRequest(999, await usdc.getAddress(), conditions)
      ).to.be.revertedWith("Bill request does not exist");
    });
  });

  describe("Bill Completion and Management Fees", function () {
    beforeEach(async function () {
      // Setup: deposit, create bill request, create offer, accept offer
      await simpleFund.connect(owner).deposit(DEPOSIT_AMOUNT, await usdc.getAddress());

      const dueDate = Math.floor(Date.now() / 1000) + 86400;
      await simpleFund.connect(owner).createBillRequestForDebtor(
        BILL_AMOUNT,
        dueDate,
        debtor.address
      );

      const conditions: FactoringContract.ConditionsStruct = {
        feePercentage: 3,
        upfrontPercentage: 80,
        ownerPercentage: 17
      };
      await simpleFund.createOfferForBillRequest(1, await usdc.getAddress(), conditions);

      // Accept the offer using fund's own method since fund owns the NFT
      await simpleFund.connect(owner).acceptOfferForOwnedBill(1);
    });

    it("Should handle bill completion and collect management fees", async function () {
      // Get bill details
      const bill = await factoringContract.getBill(1);

      const initialTotalEarnings = await simpleFund.totalEarnings();
      const initialManagementFees = await simpleFund.managementFeesCollected();

      // Pay the bill through the fund (this will automatically handle completion)
      const tx = await simpleFund.connect(debtor).payBillForDebtor(1, debtor.address);

      await expect(tx)
        .to.emit(simpleFund, "BillCompleted");

      await expect(tx)
        .to.emit(simpleFund, "ManagementFeesCollected");

      // Check that earnings and management fees increased
      expect(await simpleFund.totalEarnings()).to.be.gt(initialTotalEarnings);
      expect(await simpleFund.managementFeesCollected()).to.be.gt(initialManagementFees);
    });

    it("Should allow owner to withdraw management fees", async function () {
      // Complete bill first to generate fees (automatically handles completion)
      await simpleFund.connect(debtor).payBillForDebtor(1, debtor.address);

      const managementFees = await simpleFund.managementFeesCollected();
      const balanceBefore = await usdc.balanceOf(owner.address);

      await simpleFund.connect(owner).withdrawManagementFees(await usdc.getAddress());

      const balanceAfter = await usdc.balanceOf(owner.address);
      expect(balanceAfter - balanceBefore).to.equal(managementFees);
      expect(await simpleFund.managementFeesCollected()).to.equal(0);
    });

    it("Should prevent non-owner from withdrawing management fees", async function () {
      // Complete bill first to generate fees (automatically handles completion)
      await simpleFund.connect(debtor).payBillForDebtor(1, debtor.address);

      await expect(
        simpleFund.connect(admin).withdrawManagementFees(await usdc.getAddress())
      ).to.be.reverted;
    });
  });

  describe("Configuration Management", function () {
    it("Should allow admin to update fund config", async function () {
      const newConfig = {
        managementFeePercentage: 300, // 3%
        acceptingDeposits: false
      };

      const tx = await simpleFund.connect(owner).updateFundConfig(newConfig);
      await expect(tx).to.emit(simpleFund, "FundConfigUpdated");

      const updatedConfig = await simpleFund.fundConfig();
      expect(updatedConfig.managementFeePercentage).to.equal(newConfig.managementFeePercentage);
      expect(updatedConfig.acceptingDeposits).to.equal(newConfig.acceptingDeposits);
    });

    // Removed test for updateOfferConfig and offerConfig state variable, as offer config is now passed as parameters

    it("Should prevent unauthorized users from updating configs", async function () {
      const newConfig = {
        managementFeePercentage: 300,
        acceptingDeposits: false
      };

      await expect(
        simpleFund.connect(unauthorizedUser).updateFundConfig(newConfig)
      ).to.be.reverted;
    });
  });

  describe("Access Control", function () {
    it("Should allow admin to pause and unpause", async function () {
      await simpleFund.connect(owner).pause();
      expect(await simpleFund.paused()).to.be.true;

      await simpleFund.connect(owner).unpause();
      expect(await simpleFund.paused()).to.be.false;
    });

    it("Should prevent operations when paused", async function () {
      await simpleFund.connect(owner).pause();

      await expect(
        simpleFund.connect(owner).deposit(DEPOSIT_AMOUNT, await usdc.getAddress())
      ).to.be.reverted;
    });

    it("Should prevent unauthorized users from pausing", async function () {
      await expect(
        simpleFund.connect(unauthorizedUser).pause()
      ).to.be.reverted;
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await simpleFund.connect(owner).deposit(DEPOSIT_AMOUNT, await usdc.getAddress());
    });

    it("Should return correct fund balance for token", async function () {
      const balance = await simpleFund.getFundBalance(await usdc.getAddress());
      expect(balance).to.equal(DEPOSIT_AMOUNT);
    });

    it("Should return correct total fund value", async function () {
      const totalValue = await simpleFund.getTotalFundValue();
      expect(totalValue).to.equal(DEPOSIT_AMOUNT);
    });
  });

  describe("Complete Bill Creation", function () {
    beforeEach(async function () {
      // Setup: deposit funds
      await simpleFund.connect(owner).deposit(DEPOSIT_AMOUNT, await usdc.getAddress());
    });

    it("should create a complete bill flow in one transaction", async function () {
      const dueDate = Math.floor(Date.now() / 1000) + 86400;
      const conditions = {
        feePercentage: 3,
        upfrontPercentage: 80,
        ownerPercentage: 15
      };

      const initialBalance = await simpleFund.getFundBalance(await usdc.getAddress());
      const upfrontAmount = (BILL_AMOUNT * BigInt(conditions.upfrontPercentage)) / BigInt(100);

      // Create complete bill in one transaction
      const tx = await simpleFund.connect(owner).createCompleteBill(
        BILL_AMOUNT,
        dueDate,
        await usdc.getAddress(),
        conditions
      );

      const receipt = await tx.wait();
      const billId = receipt?.logs[receipt.logs.length - 1]; // Get bill ID from event

      // Verify fund balance decreased by upfront amount
      const newBalance = await simpleFund.getFundBalance(await usdc.getAddress());
      expect(newBalance).to.equal(initialBalance - upfrontAmount);

      // Verify bill was created correctly
      const bill = await factoringContract.getBill(1); // Bill ID should be 1
      expect(bill.totalAmount).to.equal(BILL_AMOUNT);
      expect(bill.debtor).to.equal(await simpleFund.getAddress());
      expect(bill.lender).to.equal(await simpleFund.getAddress());
      expect(bill.upfrontPaid).to.equal(upfrontAmount);
      expect(bill.conditions.feePercentage).to.equal(conditions.feePercentage);
      expect(bill.conditions.upfrontPercentage).to.equal(conditions.upfrontPercentage);
      expect(bill.conditions.ownerPercentage).to.equal(conditions.ownerPercentage);
    });

    it("should revert if insufficient fund balance", async function () {
      const dueDate = Math.floor(Date.now() / 1000) + 86400;
      // Use a bill amount larger than the deposited amount so upfront exceeds available funds
      const largeBillAmount = ethers.parseUnits("100000", 6); // Much larger than DEPOSIT_AMOUNT
      const conditions = {
        feePercentage: 3,
        upfrontPercentage: 80,
        ownerPercentage: 15
      };

      await expect(
        simpleFund.connect(owner).createCompleteBill(
          largeBillAmount,
          dueDate,
          await usdc.getAddress(),
          conditions
        )
      ).to.be.revertedWith("Insufficient fund balance for upfront payment");
    });

    it("should revert with invalid conditions", async function () {
      const dueDate = Math.floor(Date.now() / 1000) + 86400;
      const invalidConditions = {
        feePercentage: 150, // Invalid: > 100%
        upfrontPercentage: 80,
        ownerPercentage: 15
      };

      await expect(
        simpleFund.connect(owner).createCompleteBill(
          BILL_AMOUNT,
          dueDate,
          await usdc.getAddress(),
          invalidConditions
        )
      ).to.be.revertedWith("Fee percentage too high");
    });

    it("should revert with past due date", async function () {
      const pastDueDate = Math.floor(Date.now() / 1000) - 86400; // yesterday
      const conditions = {
        feePercentage: 3,
        upfrontPercentage: 80,
        ownerPercentage: 15
      };

      await expect(
        simpleFund.connect(owner).createCompleteBill(
          BILL_AMOUNT,
          pastDueDate,
          await usdc.getAddress(),
          conditions
        )
      ).to.be.revertedWith("Due date must be in the future");
    });

    it("should only allow authorized operators", async function () {
      const dueDate = Math.floor(Date.now() / 1000) + 86400;
      const conditions = {
        feePercentage: 3,
        upfrontPercentage: 80,
        ownerPercentage: 15
      };

      await expect(
        simpleFund.connect(unauthorizedUser).createCompleteBill(
          BILL_AMOUNT,
          dueDate,
          await usdc.getAddress(),
          conditions
        )
      ).to.be.reverted;
    });
  });
});
