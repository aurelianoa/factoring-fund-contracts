import { expect } from "chai";
import { ethers } from "hardhat";
import {
  Fund,
  FactoringContract,
  MockUSDC,
  MockUSDT
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Fund Contract", function () {
  let fund: Fund;
  let factoringContract: FactoringContract;
  let usdc: MockUSDC;
  let usdt: MockUSDT;

  let owner: SignerWithAddress;
  let investor1: SignerWithAddress;
  let investor2: SignerWithAddress;
  let debtor: SignerWithAddress;
  let admin: SignerWithAddress;

  const INVESTMENT_AMOUNT = ethers.parseUnits("10000", 6);
  const BILL_AMOUNT = ethers.parseUnits("5000", 6);

  beforeEach(async function () {
    [owner, investor1, investor2, debtor, admin] = await ethers.getSigners();

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

    // Deploy Fund contract
    const fundConfig = {
      minInvestment: ethers.parseUnits("1000", 6),
      maxInvestment: ethers.parseUnits("50000", 6),
      targetAmount: ethers.parseUnits("100000", 6),
      feePercentage: 500, // 5% in basis points
      acceptingInvestments: true
    };

    const offerConfig = {
      feePercentage: 3,
      upfrontPercentage: 80,
      ownerPercentage: 17,
      minBillAmount: ethers.parseUnits("1000", 6),
      maxBillAmount: ethers.parseUnits("20000", 6),
      autoOfferEnabled: true,
      preferredStablecoin: await usdc.getAddress()
    };

    const FundFactory = await ethers.getContractFactory("Fund");
    fund = await FundFactory.deploy(
      await factoringContract.getAddress(),
      await usdc.getAddress(),
      await usdt.getAddress(),
      fundConfig,
      offerConfig
    );

    // Authorize the admin (assuming the owner deploys and is authorized by default)
    // await fund.authorize(admin.address); // Remove this line for now

    // Mint tokens to investors and debtor
    await usdc.mint(investor1.address, ethers.parseUnits("50000", 6));
    await usdc.mint(investor2.address, ethers.parseUnits("50000", 6));
    await usdc.mint(debtor.address, ethers.parseUnits("20000", 6));

    // Approve fund to spend tokens
    await usdc.connect(investor1).approve(fund.getAddress(), ethers.parseUnits("50000", 6));
    await usdc.connect(investor2).approve(fund.getAddress(), ethers.parseUnits("50000", 6));
    await usdc.connect(debtor).approve(fund.getAddress(), ethers.parseUnits("20000", 6));
  });

  describe("Investment Management", function () {
    it("Should allow investors to invest in the fund", async function () {
      const tx = await fund.connect(investor1).invest(INVESTMENT_AMOUNT, await usdc.getAddress());

      await expect(tx)
        .to.emit(fund, "InvestmentMade")
        .withArgs(investor1.address, INVESTMENT_AMOUNT, await usdc.getAddress(), INVESTMENT_AMOUNT);

      // Check investor information
      const investorInfo = await fund.getInvestorInfo(investor1.address);
      expect(investorInfo.investment).to.equal(INVESTMENT_AMOUNT);
      expect(investorInfo.shares).to.equal(INVESTMENT_AMOUNT);
      expect(investorInfo.active).to.be.true;

      // Check fund totals
      expect(await fund.totalInvested()).to.equal(INVESTMENT_AMOUNT);
      expect(await fund.totalShares()).to.equal(INVESTMENT_AMOUNT);
      expect(await fund.getFundBalance(await usdc.getAddress())).to.equal(INVESTMENT_AMOUNT);
    });

    it("Should prevent investment below minimum", async function () {
      const smallAmount = ethers.parseUnits("500", 6);

      await expect(
        fund.connect(investor1).invest(smallAmount, await usdc.getAddress())
      ).to.be.revertedWith("Investment below minimum");
    });

    it("Should prevent investment above maximum", async function () {
      const largeAmount = ethers.parseUnits("60000", 6);

      await expect(
        fund.connect(investor1).invest(largeAmount, await usdc.getAddress())
      ).to.be.revertedWith("Exceeds maximum investment");
    });

    it("Should allow withdrawal of investment", async function () {
      // First invest
      await fund.connect(investor1).invest(INVESTMENT_AMOUNT, await usdc.getAddress());

      const balanceBefore = await usdc.balanceOf(investor1.address);
      const sharesToWithdraw = INVESTMENT_AMOUNT / 2n;

      // Withdraw half
      const tx = await fund.connect(investor1).withdraw(sharesToWithdraw, await usdc.getAddress());

      await expect(tx)
        .to.emit(fund, "InvestmentWithdrawn")
        .withArgs(investor1.address, sharesToWithdraw, await usdc.getAddress(), sharesToWithdraw);

      // Check balances
      const balanceAfter = await usdc.balanceOf(investor1.address);
      expect(balanceAfter - balanceBefore).to.equal(sharesToWithdraw);
    });
  });

  describe("Bill Request Management", function () {
    beforeEach(async function () {
      // Add some fund liquidity
      await fund.connect(investor1).invest(INVESTMENT_AMOUNT, await usdc.getAddress());
    });

    it("Should create bill request for debtor", async function () {
      const dueDate = Math.floor(Date.now() / 1000) + 86400; // 24 hours

      // No stablecoin param in bill request creation
      const tx = await fund.connect(owner).createBillRequestForDebtor(
        BILL_AMOUNT,
        dueDate,
        debtor.address
      );

      await expect(tx)
        .to.emit(fund, "BillRequestFunded")
        .withArgs(1, debtor.address, BILL_AMOUNT);

      // Check that bill request was created in factoring contract
      const billRequest = await factoringContract.getBillRequest(1);
      expect(billRequest.totalAmount).to.equal(BILL_AMOUNT);
      expect(billRequest.debtor).to.equal(await fund.getAddress()); // Fund is the debtor in factoring contract
    });

    it("Should automatically create offers for bill requests", async function () {
      // Create bill request first
      const dueDate = Math.floor(Date.now() / 1000) + 86400;
      await fund.connect(owner).createBillRequestForDebtor(
        BILL_AMOUNT,
        dueDate,
        debtor.address
      );

      // Create offer automatically
      const tx = await fund.createOfferForBillRequest(1);

      await expect(tx)
        .to.emit(fund, "OfferCreatedAutomatically")
        .withArgs(1, 1, BILL_AMOUNT * 80n / 100n); // 80% upfront

      // Check that offer was created
      const offer = await factoringContract.getOffer(1);
      expect(offer.lender).to.equal(await fund.getAddress());
      expect(offer.billRequestId).to.equal(1);
      expect(offer.stablecoin).to.equal(await usdc.getAddress());
    });

    it("Should reject bills outside amount criteria", async function () {
      // Create a bill that's too large
      const largeBillAmount = ethers.parseUnits("25000", 6);
      const dueDate = Math.floor(Date.now() / 1000) + 86400;

      await fund.connect(owner).createBillRequestForDebtor(
        largeBillAmount,
        dueDate,
        debtor.address
      );

      await expect(
        fund.createOfferForBillRequest(1)
      ).to.be.revertedWith("Bill amount above maximum");
    });
  });

  describe("Bill Completion and Profit Distribution", function () {
    beforeEach(async function () {
      // Setup: invest, create bill request, create offer, accept offer
      await fund.connect(investor1).invest(INVESTMENT_AMOUNT, await usdc.getAddress());

      const dueDate = Math.floor(Date.now() / 1000) + 86400;
      await fund.connect(owner).createBillRequestForDebtor(
        BILL_AMOUNT,
        dueDate,
        debtor.address
      );

      await fund.createOfferForBillRequest(1);

      // Accept the offer using fund's own method since fund owns the NFT
      await fund.acceptOfferForOwnedBill(1);
    });

    it("Should handle bill completion and distribute profits", async function () {
      // Get bill details
      const bill = await factoringContract.getBill(1);

      // Pay the bill through the fund
      await fund.connect(debtor).payBillForDebtor(1);

      // Handle completion
      const tx = await fund.handleBillCompletion(1);

      await expect(tx)
        .to.emit(fund, "BillCompleted");

      await expect(tx)
        .to.emit(fund, "ProfitsDistributed");

      // Check that total earnings increased
      expect(await fund.totalEarnings()).to.be.gt(0);
    });
  });

  describe("Administration", function () {
    it("Should allow admin to update fund config", async function () {
      const newConfig = {
        minInvestment: ethers.parseUnits("2000", 6),
        maxInvestment: ethers.parseUnits("60000", 6),
        targetAmount: ethers.parseUnits("200000", 6),
        feePercentage: 300, // 3%
        acceptingInvestments: false
      };

      const tx = await fund.connect(owner).updateFundConfig(newConfig);
      await expect(tx).to.emit(fund, "FundConfigUpdated");

      const updatedConfig = await fund.fundConfig();
      expect(updatedConfig.minInvestment).to.equal(newConfig.minInvestment);
      expect(updatedConfig.feePercentage).to.equal(newConfig.feePercentage);
    });

    it("Should allow admin to update offer config", async function () {
      const newOfferConfig = {
        feePercentage: 4,
        upfrontPercentage: 85,
        ownerPercentage: 11,
        minBillAmount: ethers.parseUnits("2000", 6),
        maxBillAmount: ethers.parseUnits("15000", 6),
        autoOfferEnabled: false,
        preferredStablecoin: await usdc.getAddress()
      };

      const tx = await fund.connect(owner).updateOfferConfig(newOfferConfig);
      await expect(tx).to.emit(fund, "OfferConfigUpdated");

      const updatedConfig = await fund.offerConfig();
      expect(updatedConfig.feePercentage).to.equal(newOfferConfig.feePercentage);
      expect(updatedConfig.autoOfferEnabled).to.equal(newOfferConfig.autoOfferEnabled);
    });

    it("Should prevent non-admin from updating configs", async function () {
      const newConfig = {
        minInvestment: ethers.parseUnits("2000", 6),
        maxInvestment: ethers.parseUnits("60000", 6),
        targetAmount: ethers.parseUnits("200000", 6),
        feePercentage: 300,
        acceptingInvestments: false
      };

      await expect(
        fund.connect(investor1).updateFundConfig(newConfig)
      ).to.be.reverted;
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await fund.connect(investor1).invest(INVESTMENT_AMOUNT, await usdc.getAddress());
      await fund.connect(investor2).invest(INVESTMENT_AMOUNT / 2n, await usdc.getAddress());
    });

    it("Should return correct total fund value", async function () {
      const totalValue = await fund.getTotalFundValue();
      expect(totalValue).to.equal(INVESTMENT_AMOUNT + INVESTMENT_AMOUNT / 2n);
    });

    it("Should return correct investor value", async function () {
      const investor1Value = await fund.getInvestorValue(investor1.address);
      const investor2Value = await fund.getInvestorValue(investor2.address);

      expect(investor1Value).to.equal(INVESTMENT_AMOUNT);
      expect(investor2Value).to.equal(INVESTMENT_AMOUNT / 2n);
    });

    it("Should return investors list", async function () {
      const investors = await fund.getInvestors();
      expect(investors).to.have.length(2);
      expect(investors).to.include(investor1.address);
      expect(investors).to.include(investor2.address);
    });
  });
});
