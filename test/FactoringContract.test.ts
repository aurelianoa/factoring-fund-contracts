import { expect } from "chai";
import { ethers } from "hardhat";
import { FactoringContract, MockUSDC, MockUSDT } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("FactoringContract", function () {
  let factoringContract: FactoringContract;
  let usdc: MockUSDC;
  let usdt: MockUSDT;
  let owner: SignerWithAddress;
  let debtor: SignerWithAddress;
  let lender1: SignerWithAddress;
  let lender2: SignerWithAddress;
  let otherAccount: SignerWithAddress;

  const BILL_AMOUNT = ethers.parseUnits("1000", 6); // 1000 USDC

  beforeEach(async function () {
    [owner, debtor, lender1, lender2, otherAccount] = await ethers.getSigners();

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

    // Mint tokens to lenders
    await usdc.mint(lender1.address, ethers.parseUnits("10000", 6));
    await usdc.mint(lender2.address, ethers.parseUnits("10000", 6));
    await usdc.mint(debtor.address, ethers.parseUnits("10000", 6));

    // Approve contract to spend tokens
    await usdc.connect(lender1).approve(factoringContract.getAddress(), ethers.parseUnits("10000", 6));
    await usdc.connect(lender2).approve(factoringContract.getAddress(), ethers.parseUnits("10000", 6));
    await usdc.connect(debtor).approve(factoringContract.getAddress(), ethers.parseUnits("10000", 6));
  });

  describe("New Workflow", function () {
    it("Should allow debtor to create bill request and receive NFT", async function () {
      const dueDate = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now

      const tx = await factoringContract.connect(debtor).createBillRequest(
        BILL_AMOUNT,
        dueDate
      );

      await expect(tx)
        .to.emit(factoringContract, "BillRequestCreated")
        .withArgs(1, debtor.address, BILL_AMOUNT, ethers.ZeroAddress); // No stablecoin in request

      // Check that NFT was minted to debtor
      expect(await factoringContract.ownerOf(1)).to.equal(debtor.address);

      // Check bill request details
      const billRequest = await factoringContract.getBillRequest(1);
      expect(billRequest.debtor).to.equal(debtor.address);
      expect(billRequest.totalAmount).to.equal(BILL_AMOUNT);
      expect(billRequest.status).to.equal(0); // BillRequestStatus.Open
    });

    it("Should allow lenders to create offers with deposit", async function () {
      // Create bill request first
      const dueDate = Math.floor(Date.now() / 1000) + 86400;
      await factoringContract.connect(debtor).createBillRequest(
        BILL_AMOUNT,
        dueDate
      );

      // Create offer with custom conditions
      const conditions = {
        feePercentage: 3, // 3% fee
        upfrontPercentage: 85, // 85% upfront
        ownerPercentage: 12 // 12% to owner on completion
      };

      const upfrontAmount = (BILL_AMOUNT * 85n) / 100n;

      const tx = await factoringContract.connect(lender1).createOffer(
        1,
        await usdc.getAddress(),
        conditions
      );

      await expect(tx)
        .to.emit(factoringContract, "OfferCreated")
        .withArgs(1, 1, lender1.address, upfrontAmount);

      // Check offer details
      const offer = await factoringContract.getOffer(1);
      expect(offer.lender).to.equal(lender1.address);
      expect(offer.depositedAmount).to.equal(upfrontAmount);
      expect(offer.status).to.equal(0); // OfferStatus.Active

      // Check that funds were transferred from lender to contract
      expect(await usdc.balanceOf(lender1.address)).to.equal(
        ethers.parseUnits("10000", 6) - upfrontAmount
      );
    });

    it("Should allow multiple offers for the same bill request", async function () {
      // Create bill request
      const dueDate = Math.floor(Date.now() / 1000) + 86400;
      await factoringContract.connect(debtor).createBillRequest(
        BILL_AMOUNT,
        dueDate
      );

      // Create two different offers
      const conditions1 = { feePercentage: 3, upfrontPercentage: 85, ownerPercentage: 12 };
      const conditions2 = { feePercentage: 2, upfrontPercentage: 80, ownerPercentage: 18 };

      await factoringContract.connect(lender1).createOffer(1, await usdc.getAddress(), conditions1);
      await factoringContract.connect(lender2).createOffer(1, await usdc.getAddress(), conditions2);

      // Check that both offers exist
      const offers = await factoringContract.getOffersForBillRequest(1);
      expect(offers.length).to.equal(2);
      expect(offers[0]).to.equal(1);
      expect(offers[1]).to.equal(2);
    });

    it("Should allow debtor to accept an offer", async function () {
      // Create bill request
      const dueDate = Math.floor(Date.now() / 1000) + 86400;

      await factoringContract.connect(debtor).createBillRequest(
        BILL_AMOUNT,
        dueDate
      );

      // Create offer
      const conditions = { feePercentage: 3, upfrontPercentage: 85, ownerPercentage: 12 };
      await factoringContract.connect(lender1).createOffer(1, await usdc.getAddress(), conditions);

      const upfrontAmount = (BILL_AMOUNT * 85n) / 100n;
      const debtorBalanceBefore = await usdc.balanceOf(debtor.address);

      // Accept offer
      const tx = await factoringContract.connect(debtor).acceptOffer(1);

      await expect(tx)
        .to.emit(factoringContract, "OfferAccepted")
        .withArgs(1, 1, debtor.address, lender1.address);

      await expect(tx)
        .to.emit(factoringContract, "BillCreated")
        .withArgs(1, debtor.address, lender1.address, BILL_AMOUNT, await usdc.getAddress());

      // Check that NFT was transferred to lender
      expect(await factoringContract.ownerOf(1)).to.equal(lender1.address);

      // Check that debtor received upfront payment
      expect(await usdc.balanceOf(debtor.address)).to.equal(
        debtorBalanceBefore + upfrontAmount
      );

      // Check that bill was created
      const bill = await factoringContract.getBill(1);
      expect(bill.debtor).to.equal(debtor.address);
      expect(bill.lender).to.equal(lender1.address);
      expect(bill.status).to.equal(0); // BillStatus.Active
    });

    it("Should allow debtor to complete bill payment", async function () {
      // Full workflow: bill request -> offer -> accept -> complete
      const dueDate = Math.floor(Date.now() / 1000) + 86400;

      await factoringContract.connect(debtor).createBillRequest(
        BILL_AMOUNT,
        dueDate
      );

      const conditions = { feePercentage: 3, upfrontPercentage: 85, ownerPercentage: 12 };
      await factoringContract.connect(lender1).createOffer(1, await usdc.getAddress(), conditions);
      await factoringContract.connect(debtor).acceptOffer(1);

      const lenderBalanceBefore = await usdc.balanceOf(lender1.address);
      const upfrontAmount = (BILL_AMOUNT * 85n) / 100n;
      const ownerPayment = (BILL_AMOUNT * 12n) / 100n;
      const expectedLenderPayment = upfrontAmount + ownerPayment;

      // Complete bill payment
      const tx = await factoringContract.connect(debtor).completeBill(1);

      await expect(tx)
        .to.emit(factoringContract, "BillCompleted")
        .withArgs(1, BILL_AMOUNT);

      // Check that lender received payment
      expect(await usdc.balanceOf(lender1.address)).to.equal(
        lenderBalanceBefore + expectedLenderPayment
      );

      // Check that bill status is completed
      const bill = await factoringContract.getBill(1);
      expect(bill.status).to.equal(1); // BillStatus.Completed
    });

    it("Should refund other offers when one is accepted", async function () {
      // Create bill request
      const dueDate = Math.floor(Date.now() / 1000) + 86400;

      await factoringContract.connect(debtor).createBillRequest(
        BILL_AMOUNT,
        dueDate
      );

      // Create two offers
      const conditions1 = { feePercentage: 3, upfrontPercentage: 85, ownerPercentage: 12 };
      const conditions2 = { feePercentage: 2, upfrontPercentage: 80, ownerPercentage: 18 };

      // Get balance before creating offer
      const lender2BalanceBeforeOffer = await usdc.balanceOf(lender2.address);

      await factoringContract.connect(lender1).createOffer(1, await usdc.getAddress(), conditions1);
      await factoringContract.connect(lender2).createOffer(1, await usdc.getAddress(), conditions2);

      // Get balance after creating offer (should be reduced)
      const lender2BalanceAfterOffer = await usdc.balanceOf(lender2.address);

      // Accept first offer (this should refund the second offer)
      await factoringContract.connect(debtor).acceptOffer(1);

      // Check that second lender got refunded to original balance
      expect(await usdc.balanceOf(lender2.address)).to.equal(lender2BalanceBeforeOffer);

      // Check that second offer is expired
      const offer2 = await factoringContract.getOffer(2);
      expect(offer2.status).to.equal(3); // OfferStatus.Expired
    });

    it("Should burn NFT when bill is completed but preserve bill history", async function () {
      // Full workflow: bill request -> offer -> accept -> complete
      const dueDate = Math.floor(Date.now() / 1000) + 86400;

      await factoringContract.connect(debtor).createBillRequest(
        BILL_AMOUNT,
        dueDate
      );

      const conditions = { feePercentage: 3, upfrontPercentage: 85, ownerPercentage: 12 };
      await factoringContract.connect(lender1).createOffer(1, await usdc.getAddress(), conditions);
      await factoringContract.connect(debtor).acceptOffer(1);

      // Verify NFT exists and lender owns it before completion
      expect(await factoringContract.ownerOf(1)).to.equal(lender1.address);
      expect(await factoringContract.getBillsByOwner(lender1.address)).to.deep.equal([1n]);

      // Complete bill payment
      const tx = await factoringContract.connect(debtor).completeBill(1);

      // Check that BillNFTBurned event was emitted
      await expect(tx)
        .to.emit(factoringContract, "BillNFTBurned")
        .withArgs(1, lender1.address);

      // Check that NFT no longer exists
      await expect(factoringContract.ownerOf(1)).to.be.revertedWithCustomError(
        factoringContract,
        "ERC721NonexistentToken"
      );

      // Check that lender's bills array still contains the bill (history preserved)
      expect(await factoringContract.getBillsByOwner(lender1.address)).to.deep.equal([1n]);

      // Check that bill status is still completed (burning doesn't affect bill data)
      const bill = await factoringContract.getBill(1);
      expect(bill.status).to.equal(1); // BillStatus.Completed
    });

    it("Should burn multiple NFTs correctly while preserving bill history", async function () {
      // Create two bill requests with the same debtor
      const dueDate = Math.floor(Date.now() / 1000) + 86400;

      // First bill request

      await factoringContract.connect(debtor).createBillRequest(
        BILL_AMOUNT,
        dueDate
      );

      // Second bill request  
      await factoringContract.connect(debtor).createBillRequest(
        BILL_AMOUNT * 2n,
        dueDate
      );

      const conditions = { feePercentage: 3, upfrontPercentage: 85, ownerPercentage: 12 };

      // Create offers and accept them (both go to lender1)
      await factoringContract.connect(lender1).createOffer(1, await usdc.getAddress(), conditions);
      await factoringContract.connect(lender1).createOffer(2, await usdc.getAddress(), conditions);
      await factoringContract.connect(debtor).acceptOffer(1);
      await factoringContract.connect(debtor).acceptOffer(2);

      // Verify lender1 owns both NFTs
      expect(await factoringContract.getBillsByOwner(lender1.address)).to.deep.equal([1n, 2n]);

      // Complete first bill
      await factoringContract.connect(debtor).completeBill(1);

      // Check that only the first NFT was burned, second still exists
      await expect(factoringContract.ownerOf(1)).to.be.revertedWithCustomError(
        factoringContract,
        "ERC721NonexistentToken"
      );
      expect(await factoringContract.ownerOf(2)).to.equal(lender1.address);

      // Check that lender1's bills array still contains both bills (history preserved)
      expect(await factoringContract.getBillsByOwner(lender1.address)).to.deep.equal([1n, 2n]);

      // Complete second bill
      await factoringContract.connect(debtor).completeBill(2);

      // Check that both NFTs are now burned
      await expect(factoringContract.ownerOf(2)).to.be.revertedWithCustomError(
        factoringContract,
        "ERC721NonexistentToken"
      );

      // Check that lender1's bills array still contains both bills (history preserved)
      expect(await factoringContract.getBillsByOwner(lender1.address)).to.deep.equal([1n, 2n]);
    });

    it("Should burn NFT correctly when bill ownership was transferred and preserve final owner history", async function () {
      // Full workflow: bill request -> offer -> accept -> transfer -> complete
      const dueDate = Math.floor(Date.now() / 1000) + 86400;

      await factoringContract.connect(debtor).createBillRequest(
        BILL_AMOUNT,
        dueDate
      );

      const conditions = { feePercentage: 3, upfrontPercentage: 85, ownerPercentage: 12 };
      await factoringContract.connect(lender1).createOffer(1, await usdc.getAddress(), conditions);
      await factoringContract.connect(debtor).acceptOffer(1);

      // Transfer NFT from lender1 to lender2
      await factoringContract.connect(lender1).transferFrom(lender1.address, lender2.address, 1);

      // Verify ownership transfer
      expect(await factoringContract.ownerOf(1)).to.equal(lender2.address);
      expect(await factoringContract.getBillsByOwner(lender1.address)).to.deep.equal([]);
      expect(await factoringContract.getBillsByOwner(lender2.address)).to.deep.equal([1n]);

      // Complete bill payment (lender2 should receive payment as current owner)
      const lender2BalanceBefore = await usdc.balanceOf(lender2.address);
      const tx = await factoringContract.connect(debtor).completeBill(1);

      // Check that BillNFTBurned event was emitted with lender2 as last owner
      await expect(tx)
        .to.emit(factoringContract, "BillNFTBurned")
        .withArgs(1, lender2.address);

      // Check that NFT was burned
      await expect(factoringContract.ownerOf(1)).to.be.revertedWithCustomError(
        factoringContract,
        "ERC721NonexistentToken"
      );

      // Check that bill history is preserved in both lenders' arrays
      // lender1 originally had the bill, lender2 received it via transfer
      expect(await factoringContract.getBillsByOwner(lender1.address)).to.deep.equal([]);
      expect(await factoringContract.getBillsByOwner(lender2.address)).to.deep.equal([1n]);

      // Check that lender2 received the payment (not lender1)
      const upfrontAmount = (BILL_AMOUNT * 85n) / 100n;
      const ownerPayment = (BILL_AMOUNT * 12n) / 100n;
      const expectedPayment = upfrontAmount + ownerPayment;
      expect(await usdc.balanceOf(lender2.address)).to.equal(lender2BalanceBefore + expectedPayment);
    });
  });
});
