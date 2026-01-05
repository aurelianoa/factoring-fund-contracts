// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Authorized} from "@privylabs/authorized/contracts/Authorized.sol";
import {UintArrayManager} from "@aurelianoa/array-manager/contracts/UintArrayManager.sol";
import {BillNFT} from "./BillNFT.sol";

/**
 * @title FactoringContract
 * @dev Smart contract for factoring finance with USDC/USDT
 *
 * Key Features:
 * - Receives funds and allocates into bills
 * - Each bill is represented as an NFT (ERC721 token) via BillNFT inheritance
 * - Funds are paid to the current NFT owner (transferable ownership)
 * - Configurable fee structure per bill via Conditions struct
 * - Default conditions: 5% fees, 80% upfront, 15% to NFT owner on completion
 * - Custom conditions can be set per bill for flexible terms
 * - When bill is paid, distributes funds according to bill's conditions to current NFT owner
 */
contract FactoringContract is
    BillNFT,
    ReentrancyGuard,
    Pausable,
    Authorized,
    UintArrayManager
{
    using SafeERC20 for IERC20;

    // Supported stablecoins
    IERC20 public immutable USDC;
    IERC20 public immutable USDT;

    // Constants
    uint256 public constant BASIS_POINTS = 10_000; /// 100 * 100 basis points = 100%
    uint256 public constant MAX_FEE_PERCENTAGE = 1000; // 10% maximum fee
    uint256 public constant MAX_INTEREST_RATE = 5000; // 50% maximum interest rate
    uint256 public constant MAX_DUE_DATE_DURATION = 1825 days; // 5 years maximum
    uint256 public constant MAX_BILLS_PER_OWNER = 1000; // Maximum bills per owner

    uint256 public debtorFeePercentage = 40; // 0.4% debtor fee
    uint256 public lenderFeePercentage = 10; // 0.1% lender fee
    uint256 public numberofDaysPerMonth = 30;

    // Default conditions
    // @notice this is calculated on 100 basis points
    Conditions public defaultConditions =
        Conditions({
            upfrontPercentage: 8_000, // 80% paid upfront
            rateInterest: 200 // 2% Interest rate for the bill (monthly 30/360 days)
        });

    // Conditions structure for customizable fees per bill
    struct Conditions {
        uint256 upfrontPercentage; // Percentage paid upfront to bill owner
        uint256 rateInterest; // Interest rate for the bill (monthly 30/360 days)
    }

    // State variables
    uint256 private _nextBillId;
    uint256 public totalPoolBalance;
    mapping(address => uint256) public poolBalances; // USDC/USDT balances

    // BillRequest structure (created by debtor)
    struct BillRequest {
        uint256 id;
        address debtor;
        uint256 totalAmount;
        uint256 dueDate;
        BillRequestStatus status;
    }

    enum BillRequestStatus {
        Open, // Available for offers
        Accepted, // Offer accepted, bill created
        Cancelled // Cancelled by debtor
    }

    // Offer structure (created by lenders)
    struct Offer {
        uint256 id;
        uint256 billRequestId;
        address lender;
        address stablecoin; // USDC or USDT chosen by lender
        Conditions conditions;
        uint256 debtorFeePercentage;
        uint256 lenderFeePercentage;
        uint256 depositedAmount; // Amount deposited by lender
        OfferStatus status;
    }

    enum OfferStatus {
        Active,
        Accepted,
        Withdrawn,
        Expired
    }

    // Bill structure (created when offer is accepted)
    struct Bill {
        uint256 id; // Same as billRequestId and NFT tokenId
        address debtor;
        address lender;
        address stablecoin;
        uint256 totalAmount;
        uint256 upfrontPaid;
        uint256 startDate;
        uint256 dueDate;
        BillStatus status;
        Conditions conditions;
        uint256 debtorFeePercentage;
        uint256 lenderFeePercentage;
        uint256 acceptedOfferId;
    }

    enum BillStatus {
        Active, // Bill is active, debtor received upfront payment
        Completed, // Bill completed, all payments made
        Defaulted // Bill defaulted
    }

    // Counters
    uint256 private _nextOfferId;

    // Mappings
    mapping(uint256 => BillRequest) public billRequests;
    mapping(uint256 => Offer) public offers;
    mapping(uint256 => Bill) public bills;
    mapping(address => uint256[]) public ownerBills;
    mapping(uint256 => uint256[]) public billRequestOffers; // billRequestId => offerIds[]

    // Events
    event BillRequestCreated(
        uint256 indexed billRequestId,
        address indexed debtor,
        uint256 amount,
        address stablecoin
    );
    event OfferCreated(
        uint256 indexed offerId,
        uint256 indexed billRequestId,
        address indexed lender,
        uint256 upfrontAmount
    );
    event OfferAccepted(
        uint256 indexed offerId,
        uint256 indexed billRequestId,
        address indexed debtor,
        address lender
    );
    event BillCreated(
        uint256 indexed billId,
        address indexed debtor,
        address indexed lender,
        uint256 amount,
        address stablecoin
    );
    event BillCompleted(uint256 indexed billId, uint256 finalAmount);
    event BillNFTBurned(uint256 indexed billId, address indexed lastOwner);
    event PoolDeposit(
        address indexed depositor,
        uint256 amount,
        address stablecoin
    );
    event PoolWithdraw(
        address indexed withdrawer,
        uint256 amount,
        address stablecoin
    );
    event FeesCollected(uint256 amount, address stablecoin);
    event DefaultConditionsUpdated(
        uint256 upfrontPercentage,
        uint256 rateInterest
    );
    event BillRequestCancelled(uint256 indexed billRequestId);
    event OfferWithdrawn(uint256 indexed offerId, address indexed lender);
    event DebtorFeeUpdated(uint256 oldFee, uint256 newFee);
    event LenderFeeUpdated(uint256 oldFee, uint256 newFee);
    event DaysPerMonthUpdated(uint256 oldDays, uint256 newDays);

    constructor(
        address _usdc,
        address _usdt
    ) BillNFT("FactoringBill", "FBILL") {
        require(_usdc != address(0), "Invalid USDC address");
        require(_usdt != address(0), "Invalid USDT address");

        USDC = IERC20(_usdc);
        USDT = IERC20(_usdt);
        _nextBillId = 1;
        _nextOfferId = 1;
    }

    /**
     * @dev Set default conditions for new bills (only owner)
     * @param _upfrontPercentage Percentage paid upfront to bill owner
     * @param _rateInterest Interest rate for the bill
     */
    function setDefaultConditions(
        uint256 _upfrontPercentage,
        uint256 _rateInterest
    ) external onlyOwner {
        require(
            _upfrontPercentage > 0 && _upfrontPercentage <= BASIS_POINTS,
            "Upfront percentage must be between 0 and 100%"
        );
        require(
            _rateInterest <= MAX_INTEREST_RATE,
            "Interest rate exceeds maximum"
        );

        defaultConditions = Conditions({
            upfrontPercentage: _upfrontPercentage,
            rateInterest: _rateInterest
        });

        emit DefaultConditionsUpdated(_upfrontPercentage, _rateInterest);
    }

    /**
     * @dev Set debtor fee percentage (only authorized admin)
     * @param _fee Fee percentage to set
     */
    function setDebtorFee(uint256 _fee) external onlyOwner {
        require(_fee > 0, "Fee must be greater than 0");
        require(_fee <= MAX_FEE_PERCENTAGE, "Fee exceeds maximum");

        uint256 oldFee = debtorFeePercentage;
        debtorFeePercentage = _fee;

        emit DebtorFeeUpdated(oldFee, _fee);
    }

    /**
     * @dev Set lender fee percentage (only authorized admin)
     * @param _fee Fee percentage to set
     */
    function setLenderFee(uint256 _fee) external onlyOwner {
        require(_fee > 0, "Fee must be greater than 0");
        require(_fee <= MAX_FEE_PERCENTAGE, "Fee exceeds maximum");

        uint256 oldFee = lenderFeePercentage;
        lenderFeePercentage = _fee;

        emit LenderFeeUpdated(oldFee, _fee);
    }

    function setNumberOfDaysPerMonth(uint256 _days) external onlyOwner {
        require(_days > 0, "Days must be greater than 0");
        require(_days <= 31, "Days cannot exceed 31");

        uint256 oldDays = numberofDaysPerMonth;
        numberofDaysPerMonth = _days;

        emit DaysPerMonthUpdated(oldDays, _days);
    }

    /**
     * @dev Create a new bill request (debtor creates this)
     * @param totalAmount Total amount of the bill
     * @param dueDate Due date of the bill (timestamp)
     */
    function createBillRequest(
        uint256 totalAmount,
        uint256 dueDate
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(totalAmount > 0, "Amount must be greater than 0");
        require(dueDate > block.timestamp, "Due date must be in the future");
        require(
            dueDate <= block.timestamp + MAX_DUE_DATE_DURATION,
            "Due date exceeds maximum duration"
        );
        require(
            ownerBills[msg.sender].length < MAX_BILLS_PER_OWNER,
            "Maximum bills per owner reached"
        );

        uint256 billRequestId = _nextBillId++;

        // Create bill request
        billRequests[billRequestId] = BillRequest({
            id: billRequestId,
            debtor: msg.sender,
            totalAmount: totalAmount,
            dueDate: dueDate,
            status: BillRequestStatus.Open
        });

        // Mint NFT to debtor (bill request creator)
        _mintBillNFT(msg.sender, billRequestId);

        // Add to owner bills
        UintArrayManager.addToArray(ownerBills[msg.sender], billRequestId);

        emit BillRequestCreated(
            billRequestId,
            msg.sender,
            totalAmount,
            address(0) // No stablecoin specified at request time
        );

        return billRequestId;
    }

    /**
     * @dev Create an offer for a bill request (lender creates this)
     * @param billRequestId ID of the bill request
     * @param stablecoin Address of stablecoin (USDC or USDT) chosen by lender
     * @param conditions Conditions offered by the lender
     */
    function createOffer(
        uint256 billRequestId,
        address stablecoin,
        Conditions memory conditions
    ) external nonReentrant whenNotPaused returns (uint256) {
        BillRequest storage billRequest = billRequests[billRequestId];
        require(billRequest.id != 0, "Bill request does not exist");
        require(
            billRequest.status == BillRequestStatus.Open,
            "Bill request not open"
        );
        require(
            stablecoin == address(USDC) || stablecoin == address(USDT),
            "Unsupported stablecoin"
        );
        require(stablecoin != address(0), "Invalid stablecoin address");
        require(
            conditions.upfrontPercentage <= BASIS_POINTS,
            "Invalid conditions: upfront cannot exceed 100%"
        );
        require(
            conditions.upfrontPercentage > 0,
            "Upfront percentage must be greater than 0"
        );
        require(
            conditions.rateInterest <= MAX_INTEREST_RATE,
            "Interest rate exceeds maximum"
        );

        uint256 offerId = _nextOfferId++;
        uint256 upfrontAmount = (billRequest.totalAmount *
            conditions.upfrontPercentage) / BASIS_POINTS;

        // Transfer upfront amount from lender to contract
        IERC20(stablecoin).safeTransferFrom(
            msg.sender,
            address(this),
            upfrontAmount
        );

        // Create offer
        offers[offerId] = Offer({
            id: offerId,
            billRequestId: billRequestId,
            lender: msg.sender,
            stablecoin: stablecoin,
            conditions: conditions,
            debtorFeePercentage: debtorFeePercentage,
            lenderFeePercentage: lenderFeePercentage,
            depositedAmount: upfrontAmount,
            status: OfferStatus.Active
        });

        // Add offer to bill request's offers
        UintArrayManager.addToArray(billRequestOffers[billRequestId], offerId);

        emit OfferCreated(offerId, billRequestId, msg.sender, upfrontAmount);

        return offerId;
    }

    /**
     * @dev Accept an offer (NFT owner/debtor accepts this)
     * @param offerId ID of the offer to accept
     */
    function acceptOffer(uint256 offerId) external nonReentrant whenNotPaused {
        Offer storage offer = offers[offerId];
        require(offer.id != 0, "Offer does not exist");
        require(offer.status == OfferStatus.Active, "Offer not active");

        BillRequest storage billRequest = billRequests[offer.billRequestId];
        require(
            billRequest.status == BillRequestStatus.Open,
            "Bill request not open"
        );

        // Only NFT owner (debtor) can accept offers
        require(
            ownerOf(offer.billRequestId) == msg.sender,
            "Only NFT owner can accept offers"
        );
        /// calculate the debtor fee
        uint256 fees = (offer.debtorFeePercentage * offer.depositedAmount) /
            BASIS_POINTS;
        /// register the debtorFee on the pool balance
        // Keep fees in contract
        poolBalances[offer.stablecoin] += fees;
        totalPoolBalance += fees;
        /// the amount to be transfered must be depositedAmount - fee
        uint256 amountToTransfer = offer.depositedAmount - fees;

        // Update owner bills mapping
        UintArrayManager.removeFromArray(
            ownerBills[msg.sender],
            offer.billRequestId
        );
        UintArrayManager.addToArray(
            ownerBills[offer.lender],
            offer.billRequestId
        );

        // Create the actual bill
        bills[offer.billRequestId] = Bill({
            id: offer.billRequestId,
            debtor: msg.sender,
            lender: offer.lender,
            stablecoin: offer.stablecoin, // Use stablecoin from accepted offer
            totalAmount: billRequest.totalAmount,
            upfrontPaid: offer.depositedAmount,
            startDate: block.timestamp,
            dueDate: billRequest.dueDate,
            status: BillStatus.Active,
            conditions: offer.conditions,
            debtorFeePercentage: offer.debtorFeePercentage,
            lenderFeePercentage: offer.lenderFeePercentage,
            acceptedOfferId: offerId
        });

        // Update statuses
        offer.status = OfferStatus.Accepted;
        billRequest.status = BillRequestStatus.Accepted;

        // Transfer upfront amount to debtor using stablecoin from offer
        IERC20(offer.stablecoin).safeTransfer(msg.sender, amountToTransfer);
        // Transfer NFT from debtor to lender
        _transfer(msg.sender, offer.lender, offer.billRequestId);

        // Refund other active offers for this bill request
        _refundOtherOffers(offer.billRequestId, offerId);

        emit OfferAccepted(
            offerId,
            offer.billRequestId,
            msg.sender,
            offer.lender
        );
        emit BillCreated(
            offer.billRequestId,
            msg.sender,
            offer.lender,
            billRequest.totalAmount,
            offer.stablecoin // Use stablecoin from accepted offer
        );
    }

    /**
     * @dev Internal function to refund other active offers when one is accepted
     * @param billRequestId ID of the bill request
     * @param acceptedOfferId ID of the accepted offer (to skip)
     */
    function _refundOtherOffers(
        uint256 billRequestId,
        uint256 acceptedOfferId
    ) internal {
        uint256[] memory offerIds = billRequestOffers[billRequestId];
        for (uint256 i = 0; i < offerIds.length; i++) {
            uint256 offerId = offerIds[i];
            if (offerId != acceptedOfferId) {
                Offer storage offer = offers[offerId];
                if (offer.status == OfferStatus.Active) {
                    // Refund the lender using the stablecoin from the offer
                    IERC20(offer.stablecoin).safeTransfer(
                        offer.lender,
                        offer.depositedAmount
                    );
                    offer.status = OfferStatus.Expired;
                }
            }
        }
    }

    /**
     * @dev Complete bill payment (when bill is paid by debtor)
     * @param billId ID of the bill to complete
     */
    function completeBill(
        uint256 billId
    ) external payable nonReentrant whenNotPaused {
        Bill storage bill = bills[billId];
        require(bill.id != 0, "Bill does not exist");
        require(bill.status == BillStatus.Active, "Bill not active");

        uint256 totalPayment = bill.totalAmount;

        // Transfer total payment from debtor
        IERC20(bill.stablecoin).safeTransferFrom(
            msg.sender,
            address(this),
            totalPayment
        );

        // Get current NFT owner (should be the lender)
        address currentOwner = ownerOf(billId);

        // Calculate lender fees
        uint256 lenderFees = (bill.upfrontPaid * bill.lenderFeePercentage) /
            BASIS_POINTS;

        // Calculate interest with overflow protection
        // Use safe math by dividing early to prevent overflow
        uint256 daysPassed = (block.timestamp - bill.startDate) / 1 days;
        uint256 interest = 0;
        if (daysPassed > 0 && bill.conditions.rateInterest > 0) {
            // Calculate: (upfrontPaid * rateInterest / BASIS_POINTS) * daysPassed / daysPerMonth
            // This order prevents overflow for reasonable values
            uint256 dailyRate = (bill.upfrontPaid *
                bill.conditions.rateInterest) /
                BASIS_POINTS /
                numberofDaysPerMonth;
            interest = dailyRate * daysPassed;
        }

        // Calculate owner payment: upfront + interest - fees
        uint256 ownerPayment = bill.upfrontPaid + interest;

        // Ensure we have enough to cover fees
        require(
            totalPayment >= lenderFees,
            "Payment insufficient to cover fees"
        );

        // Ensure owner payment doesn't exceed what's available after fees
        uint256 availableForOwner = totalPayment - lenderFees;
        if (ownerPayment > availableForOwner) {
            ownerPayment = availableForOwner;
        }

        // Calculate debtor refund (if any)
        uint256 debtorPayment = totalPayment - ownerPayment - lenderFees;

        // Keep fees in contract
        poolBalances[bill.stablecoin] += lenderFees;
        totalPoolBalance += lenderFees;

        // Pay current NFT owner
        IERC20(bill.stablecoin).safeTransfer(currentOwner, ownerPayment);
        // Pay debtor the remaining amount (if any)
        if (debtorPayment > 0) {
            IERC20(bill.stablecoin).safeTransfer(bill.debtor, debtorPayment);
        }

        // Burn NFT but keep bill history in ownerBills
        _burn(billId);

        // Update bill status
        bill.status = BillStatus.Completed;

        emit BillCompleted(billId, totalPayment);
        emit BillNFTBurned(billId, currentOwner);
        emit FeesCollected(lenderFees, bill.stablecoin);
    }

    /**
     * @dev Mark bill as defaulted (only authorized admin can call this)
     * @param billId ID of the bill to mark as defaulted
     */
    function markBillDefaulted(uint256 billId) external onlyAuthorizedAdmin {
        Bill storage bill = bills[billId];
        require(bill.id != 0, "Bill does not exist");
        require(bill.status == BillStatus.Active, "Bill not active");
        require(block.timestamp > bill.dueDate, "Bill not yet due");

        bill.status = BillStatus.Defaulted;
    }

    /**
     * @dev Cancel a bill request (only debtor can call this)
     * @param billRequestId ID of the bill request to cancel
     */
    function cancelBillRequest(uint256 billRequestId) external nonReentrant {
        BillRequest storage billRequest = billRequests[billRequestId];
        require(billRequest.id != 0, "Bill request does not exist");
        require(
            billRequest.status == BillRequestStatus.Open,
            "Bill request not open"
        );
        require(
            ownerOf(billRequestId) == msg.sender,
            "Only NFT owner can cancel"
        );

        billRequest.status = BillRequestStatus.Cancelled;

        // Refund all active offers
        _refundAllOffers(billRequestId);

        emit BillRequestCancelled(billRequestId);
    }

    /**
     * @dev Withdraw an offer (only lender can call this)
     * @param offerId ID of the offer to withdraw
     */
    function withdrawOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        require(offer.id != 0, "Offer does not exist");
        require(offer.status == OfferStatus.Active, "Offer not active");
        require(offer.lender == msg.sender, "Only lender can withdraw offer");

        // Refund the lender using the stablecoin from the offer
        IERC20(offer.stablecoin).safeTransfer(
            msg.sender,
            offer.depositedAmount
        );

        offer.status = OfferStatus.Withdrawn;

        emit OfferWithdrawn(offerId, msg.sender);
    }

    /**
     * @dev Internal function to refund all active offers for a bill request
     * @param billRequestId ID of the bill request
     */
    function _refundAllOffers(uint256 billRequestId) internal {
        uint256[] memory offerIds = billRequestOffers[billRequestId];
        for (uint256 i = 0; i < offerIds.length; i++) {
            uint256 offerId = offerIds[i];
            Offer storage offer = offers[offerId];
            if (offer.status == OfferStatus.Active) {
                // Refund the lender using the stablecoin from the offer
                IERC20(offer.stablecoin).safeTransfer(
                    offer.lender,
                    offer.depositedAmount
                );
                offer.status = OfferStatus.Expired;
            }
        }
    }

    /**
     * @dev Withdraw funds from pool (only admin)
     * @param amount Amount to withdraw
     * @param stablecoin Address of stablecoin
     */
    function withdrawFromPool(
        uint256 amount,
        address stablecoin
    ) external onlyAuthorizedAdmin nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(
            stablecoin == address(USDC) || stablecoin == address(USDT),
            "Unsupported stablecoin"
        );
        require(
            poolBalances[stablecoin] >= amount,
            "Insufficient pool balance"
        );

        poolBalances[stablecoin] -= amount;
        totalPoolBalance -= amount;

        IERC20(stablecoin).safeTransfer(msg.sender, amount);

        emit PoolWithdraw(msg.sender, amount, stablecoin);
    }

    /**
     * @dev Get bills owned by an address
     * @param _owner Address of the bill owner
     * @return Array of bill IDs
     */
    function getBillsByOwner(
        address _owner
    ) external view returns (uint256[] memory) {
        return ownerBills[_owner];
    }

    /**
     * @dev Get bill request details
     * @param billRequestId ID of the bill request
     * @return BillRequest struct
     */
    function getBillRequest(
        uint256 billRequestId
    ) external view returns (BillRequest memory) {
        require(
            billRequests[billRequestId].id != 0,
            "Bill request does not exist"
        );
        return billRequests[billRequestId];
    }

    /**
     * @dev Get offer details
     * @param offerId ID of the offer
     * @return Offer struct
     */
    function getOffer(uint256 offerId) external view returns (Offer memory) {
        require(offers[offerId].id != 0, "Offer does not exist");
        return offers[offerId];
    }

    /**
     * @dev Get offers for a bill request
     * @param billRequestId ID of the bill request
     * @return Array of offer IDs
     */
    function getOffersForBillRequest(
        uint256 billRequestId
    ) external view returns (uint256[] memory) {
        return billRequestOffers[billRequestId];
    }

    /**
     * @dev Get bill details by NFT ID
     * @param nftId ID of the NFT (same as bill ID)
     * @return Bill struct
     */
    function getBillByNFT(uint256 nftId) external view returns (Bill memory) {
        require(_ownerOf(nftId) != address(0), "NFT does not exist");
        require(bills[nftId].id != 0, "Bill does not exist");
        return bills[nftId];
    }

    /**
     * @dev Get bill details
     * @param billId ID of the bill
     * @return Bill struct
     */
    function getBill(uint256 billId) external view returns (Bill memory) {
        require(bills[billId].id != 0, "Bill does not exist");
        return bills[billId];
    }

    /**
     * @dev Get pool balance for a specific stablecoin
     * @param stablecoin Address of stablecoin
     * @return Balance amount
     */
    function getPoolBalance(
        address stablecoin
    ) external view returns (uint256) {
        return poolBalances[stablecoin];
    }

    /**
     * @dev Get current default conditions
     * @return Default conditions struct
     */
    function getDefaultConditions() external view returns (Conditions memory) {
        return defaultConditions;
    }

    /**
     * @dev Get current NFT owner of a bill/bill request
     * @param tokenId ID of the token (bill request ID or bill ID)
     * @return Address of the current NFT owner
     */
    function getBillNFTOwner(uint256 tokenId) external view returns (address) {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        return ownerOf(tokenId);
    }

    /**
     * @dev Get complete bill information including current NFT owner
     * @param billId ID of the bill
     * @return bill The bill struct
     * @return currentOwner Current owner of the NFT
     */
    function getBillWithOwner(
        uint256 billId
    ) external view returns (Bill memory bill, address currentOwner) {
        require(bills[billId].id != 0, "Bill does not exist");
        bill = bills[billId];
        currentOwner = ownerOf(billId);
        return (bill, currentOwner);
    }

    /**
     * @dev Emergency pause function
     */
    function pause() external onlyAuthorizedAdmin {
        _pause();
    }

    /**
     * @dev Unpause function
     */
    function unpause() external onlyAuthorizedAdmin {
        _unpause();
    }

    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view override returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev Override _update to handle bill ownership tracking
     * @param to New owner address (zero address for burns)
     * @param tokenId ID of the token being transferred
     * @param auth Address authorized to perform the update
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = super._update(to, tokenId, auth);

        // Update ownerBills mapping for transfers (not mints/burns)
        if (from != address(0) && to != address(0)) {
            // This is a transfer, update the mappings
            UintArrayManager.removeFromArray(ownerBills[from], tokenId);
            UintArrayManager.addToArray(ownerBills[to], tokenId);
        }
        // Note: Mints are handled in createBillRequest, burns are handled in completeBill

        return from;
    }
}
