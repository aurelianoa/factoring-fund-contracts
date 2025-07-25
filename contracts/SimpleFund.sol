// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Authorized} from "@privylabs/authorized/contracts/Authorized.sol";
import {FactoringContract} from "./FactoringContract.sol";

/**
 * @title SimpleFund
 * @dev A simplified fund contract that acts as a solo investor for the FactoringContract
 *
 * Key Features:
 * - Solo investor model - no multiple investors to manage
 * - Only authorized wallets can deposit/withdraw funds
 * - Automated bill request and offer creation
 * - Management fees for the contract
 * - Withdrawal functions for upfront payments and debtor payments
 * - Integration with FactoringContract for seamless operations
 */
contract SimpleFund is ReentrancyGuard, Pausable, Authorized, IERC721Receiver {
    using SafeERC20 for IERC20;

    // Reference to the FactoringContract
    FactoringContract public immutable factoringContract;

    // Supported stablecoins
    IERC20 public immutable USDC;
    IERC20 public immutable USDT;

    // Fund configuration
    struct FundConfig {
        uint256 managementFeePercentage; // Management fee percentage (basis points)
        bool acceptingDeposits; // Whether fund is accepting new deposits
    }

    // State variables
    FundConfig public fundConfig;

    uint256 public totalFundValue;
    uint256 public totalEarnings;
    uint256 public managementFeesCollected;

    mapping(address => uint256) public fundBalances; // Token => balance
    mapping(uint256 => bool) public activeBillRequests; // Bill request ID => active
    mapping(uint256 => uint256) public billRequestToOffer; // Bill request ID => offer ID

    // Events
    event FundsDeposited(
        address indexed depositor,
        uint256 amount,
        address token
    );
    event FundsWithdrawn(
        address indexed withdrawer,
        uint256 amount,
        address token
    );
    event OfferCreatedAutomatically(
        uint256 indexed billRequestId,
        uint256 indexed offerId,
        uint256 amount
    );
    event ManagementFeesCollected(uint256 amount);
    event BillRequestFunded(
        uint256 indexed billRequestId,
        address indexed debtor,
        uint256 amount
    );
    event BillCompleted(uint256 indexed billId, uint256 totalReturn);
    event FundConfigUpdated();
    event OfferConfigUpdated();
    event OfferWithdrawn(
        uint256 indexed offerId,
        uint256 indexed billRequestId,
        uint256 amount
    );

    constructor(
        address _factoringContract,
        address _usdc,
        address _usdt,
        FundConfig memory _fundConfig
    ) {
        require(_factoringContract != address(0), "Invalid factoring contract");
        require(_usdc != address(0), "Invalid USDC address");
        require(_usdt != address(0), "Invalid USDT address");

        factoringContract = FactoringContract(_factoringContract);
        USDC = IERC20(_usdc);
        USDT = IERC20(_usdt);

        fundConfig = _fundConfig;
    }

    /**
     * @dev Deposit funds into the contract (only authorized)
     * @param amount Amount to deposit
     * @param token Token address (USDC or USDT)
     */
    function deposit(
        uint256 amount,
        address token
    ) external onlyAuthorizedOperator nonReentrant whenNotPaused {
        require(fundConfig.acceptingDeposits, "Fund not accepting deposits");
        require(amount > 0, "Amount must be greater than 0");
        require(
            token == address(USDC) || token == address(USDT),
            "Unsupported token"
        );

        // Transfer tokens to fund
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit FundsDeposited(msg.sender, amount, token);
    }

    /**
     * @dev Withdraw funds from the contract (only authorized)
     * @param amount Amount to withdraw
     * @param token Token to withdraw
     */
    function withdraw(
        uint256 amount,
        address token
    ) external onlyAuthorizedAdmin nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(
            token == address(USDC) || token == address(USDT),
            "Unsupported token"
        );
        require(
            IERC20(token).balanceOf(address(this)) >= amount,
            "Insufficient balance"
        );

        // Transfer tokens to caller
        IERC20(token).safeTransfer(msg.sender, amount);

        emit FundsWithdrawn(msg.sender, amount, token);
    }

    /**
     * @dev Create bill request (SimpleFund acts as debtor)
     * @param totalAmount Total bill amount
     * @param dueDate Due date for the bill
     */
    function createBillRequestForDebtor(
        uint256 totalAmount,
        uint256 dueDate
    )
        external
        onlyAuthorizedOperator
        nonReentrant
        whenNotPaused
        returns (uint256)
    {
        require(totalAmount > 0, "Amount must be greater than 0");

        // Create bill request with fund as debtor (no stablecoin specified)
        uint256 billRequestId = factoringContract.createBillRequest(
            totalAmount,
            dueDate
        );

        emit BillRequestFunded(billRequestId, address(this), totalAmount);

        return billRequestId;
    }

    /**
     * @dev Automatically create offer for bill requests
     * @param billRequestId ID of the bill request
     * @param stablecoin Address of stablecoin to use for the offer
     * @param conditions Offer conditions
     */
    function createOfferForBillRequest(
        uint256 billRequestId,
        address stablecoin,
        FactoringContract.Conditions memory conditions
    ) external onlyAuthorizedOperator nonReentrant whenNotPaused {
        require(
            stablecoin == address(USDC) || stablecoin == address(USDT),
            "Unsupported stablecoin"
        );

        // Get bill request details
        FactoringContract.BillRequest memory billRequest = factoringContract
            .getBillRequest(billRequestId);
        require(billRequest.id != 0, "Bill request does not exist");
        require(uint256(billRequest.status) == 0, "Bill request not open"); // 0 = BillRequestStatus.Open

        // Calculate required upfront amount
        uint256 upfrontAmount = (billRequest.totalAmount *
            conditions.upfrontPercentage) / factoringContract.BASIS_POINTS();
        require(
            IERC20(stablecoin).balanceOf(address(this)) >= upfrontAmount,
            "Insufficient fund balance"
        );

        // Approve FactoringContract to spend our tokens for the offer
        IERC20(stablecoin).approve(address(factoringContract), upfrontAmount);

        // Create the offer and funds are transferred
        uint256 offerId = factoringContract.createOffer(
            billRequestId,
            stablecoin,
            conditions
        );

        // Track the mapping
        billRequestToOffer[billRequestId] = offerId;

        emit OfferCreatedAutomatically(billRequestId, offerId, upfrontAmount);
    }

    /**
     * @dev Accept an offer for a bill request that the fund owns
     * @param offerId ID of the offer to accept
     */
    function acceptOfferForOwnedBill(
        uint256 offerId
    ) external onlyAuthorizedOperator nonReentrant {
        // Get the offer details
        FactoringContract.Offer memory offer = factoringContract.getOffer(
            offerId
        );
        require(offer.id != 0, "Offer does not exist");
        require(uint256(offer.status) == 0, "Offer not active"); // 0 = OfferStatus.Active

        // Check that the fund owns the NFT for this bill request
        address nftOwner = factoringContract.ownerOf(offer.billRequestId);
        require(nftOwner == address(this), "Fund does not own the NFT");
        // Accept the offer
        factoringContract.acceptOffer(offerId);
    }

    /**
     * @dev Withdraw an active offer that the fund created
     * @param offerId ID of the offer to withdraw
     */
    function withdrawOffer(
        uint256 offerId
    ) external onlyAuthorizedOperator nonReentrant {
        // Get the offer details to verify it belongs to this fund
        FactoringContract.Offer memory offer = factoringContract.getOffer(
            offerId
        );
        require(offer.id != 0, "Offer does not exist");
        require(
            offer.lender == address(this),
            "Fund is not the lender for this offer"
        );
        require(uint256(offer.status) == 0, "Offer not active"); // 0 = OfferStatus.Active

        // Withdraw the offer from FactoringContract (this will refund the tokens)
        factoringContract.withdrawOffer(offerId);

        emit OfferWithdrawn(
            offerId,
            offer.billRequestId,
            offer.depositedAmount
        );
    }

    /**
     * @dev Pay a bill on behalf of a debtor
     * @param billId ID of the bill to pay
     */
    function payBillForDebtor(uint256 billId) external nonReentrant {
        // Get bill details
        FactoringContract.Bill memory bill = factoringContract.getBill(billId);
        require(bill.id != 0, "Bill does not exist");
        require(bill.debtor == address(this), "Fund is not the debtor");
        require(
            uint256(bill.status) == 0,
            "Bill not open for payment" // 0 = BillStatus.Open
        );
        // Check if this contract does have the balance in the bill stablecoin
        require(
            fundBalances[bill.stablecoin] >= bill.totalAmount,
            "Insufficient fund balance"
        );

        // Update fund balances before payment
        fundBalances[bill.stablecoin] -= bill.totalAmount;
        totalFundValue -= bill.totalAmount;

        // Approve FactoringContract to spend our tokens for bill completion
        IERC20(bill.stablecoin).approve(
            address(factoringContract),
            bill.totalAmount
        );

        // Complete the bill payment
        factoringContract.completeBill(billId);

        // Automatically handle completion and management fees
        _handleBillCompletion(billId);
    }

    /**
     * @dev Handle bill completion and collect management fees (internal)
     * @param billId ID of the completed bill
     */
    function _handleBillCompletion(uint256 billId) internal {
        // Get updated bill details after completion
        FactoringContract.Bill memory bill = factoringContract.getBill(billId);
        require(bill.id != 0, "Bill does not exist");
        require(uint256(bill.status) == 1, "Bill not completed"); // 1 = BillStatus.Completed

        // With the new interest model, the FactoringContract automatically calculates:
        // - Interest based on days passed and rateInterest
        // - Lender fees at completion
        // - Proper distribution to lender (NFT owner)

        // The fund receives: upfrontPaid + interest - lenderFees
        // We need to track what we actually received vs what we paid out
        uint256 currentBalance = IERC20(bill.stablecoin).balanceOf(
            address(this)
        );
        uint256 previousBalance = fundBalances[bill.stablecoin];

        // Calculate net earnings from this bill completion
        // This represents the interest earned minus any fees paid
        if (currentBalance > previousBalance) {
            uint256 grossEarnings = currentBalance - previousBalance;

            // Calculate management fee on the gross earnings
            uint256 managementFee = (grossEarnings *
                fundConfig.managementFeePercentage) /
                factoringContract.BASIS_POINTS();
            uint256 netEarnings = grossEarnings - managementFee;

            // Update tracking
            fundBalances[bill.stablecoin] = currentBalance - managementFee;
            totalFundValue = totalFundValue + netEarnings; // Add net earnings to total value
            totalEarnings += netEarnings;
            managementFeesCollected += managementFee;

            emit ManagementFeesCollected(managementFee);
        } else {
            // Update balance tracking even if no profit
            fundBalances[bill.stablecoin] = currentBalance;
        }

        emit BillCompleted(billId, bill.totalAmount);
    }

    /**
     * @dev Handle bill completion and collect management fees (public)
     * @param billId ID of the completed bill
     */
    function handleBillCompletion(
        uint256 billId
    ) external onlyAuthorizedAdmin nonReentrant {
        _handleBillCompletion(billId);
    }

    /**
     * @dev Withdraw management fees (only owner)
     * @param token Token to withdraw fees in
     */
    function withdrawManagementFees(
        address token
    ) external onlyOwner nonReentrant {
        require(
            token == address(USDC) || token == address(USDT),
            "Unsupported token"
        );
        require(managementFeesCollected > 0, "No fees to withdraw");

        uint256 feesToWithdraw = managementFeesCollected;
        managementFeesCollected = 0;

        IERC20(token).safeTransfer(msg.sender, feesToWithdraw);
    }

    /**
     * @dev Withdraw all funds of a specific stablecoin (only owner)
     * @param stablecoin Stablecoin address (USDC or USDT)
     * @param receiver Address to receive the withdrawn funds
     */
    function withdrawAll(
        address stablecoin,
        address receiver
    ) external onlyOwner nonReentrant {
        require(
            stablecoin == address(USDC) || stablecoin == address(USDT),
            "Unsupported stablecoin"
        );
        require(receiver != address(0), "Invalid receiver address");

        // Get actual balance from the stablecoin contract
        uint256 actualBalance = IERC20(stablecoin).balanceOf(address(this));
        require(actualBalance > 0, "No balance to withdraw");

        // Transfer all funds to receiver
        IERC20(stablecoin).safeTransfer(receiver, actualBalance);

        emit FundsWithdrawn(receiver, actualBalance, stablecoin);
    }

    /**
     * @dev Withdraw upfront payment received when an offer is accepted (only owner/admin)
     * @param billId ID of the bill to withdraw upfront payment for
     * @param receiver Address to receive the withdrawn funds
     */
    function withdrawUpfrontPayment(
        uint256 billId,
        address receiver
    ) external onlyAuthorizedAdmin nonReentrant {
        require(receiver != address(0), "Invalid receiver address");

        // Get bill details
        FactoringContract.Bill memory bill = factoringContract.getBill(billId);
        require(bill.id != 0, "Bill does not exist");
        require(bill.debtor == address(this), "Fund is not the debtor");
        require(
            uint256(bill.status) == 0,
            "Bill not active" // 0 = BillStatus.Active
        );

        // Calculate upfront payment amount after debtor fees
        uint256 debtorFee = (bill.upfrontPaid * bill.debtorFeePercentage) /
            factoringContract.BASIS_POINTS();
        uint256 upfrontPaymentAfterFees = bill.upfrontPaid - debtorFee;

        // Verify we have sufficient balance
        require(
            IERC20(bill.stablecoin).balanceOf(address(this)) >=
                upfrontPaymentAfterFees,
            "Insufficient balance for upfront payment withdrawal"
        );

        // Transfer the upfront payment after fees to receiver
        IERC20(bill.stablecoin).safeTransfer(receiver, upfrontPaymentAfterFees);

        emit FundsWithdrawn(receiver, upfrontPaymentAfterFees, bill.stablecoin);
    }

    /**
     * @dev Withdraw debtor payment received when a bill is completed (only owner/admin)
     * @param billId ID of the completed bill to withdraw debtor payment for
     * @param receiver Address to receive the withdrawn funds
     */
    function withdrawDebtorPayment(
        uint256 billId,
        address receiver
    ) external onlyAuthorizedAdmin nonReentrant {
        require(receiver != address(0), "Invalid receiver address");

        // Get bill details
        FactoringContract.Bill memory bill = factoringContract.getBill(billId);
        require(bill.id != 0, "Bill does not exist");
        require(bill.debtor == address(this), "Fund is not the debtor");
        require(
            uint256(bill.status) == 1,
            "Bill not completed" // 1 = BillStatus.Completed
        );

        // Calculate debtor payment using the same logic as FactoringContract.completeBill
        uint256 lenderFees = (bill.upfrontPaid * bill.lenderFeePercentage) /
            factoringContract.BASIS_POINTS();

        // Calculate interest based on days passed
        uint256 daysPassed = (block.timestamp - bill.startDate) / 1 days;
        uint256 interest = (bill.upfrontPaid *
            bill.conditions.rateInterest *
            daysPassed) /
            factoringContract.numberofDaysPerMonth() /
            factoringContract.BASIS_POINTS();

        // Calculate owner payment (lender receives this)
        uint256 ownerPayment = bill.upfrontPaid + interest - lenderFees;

        // Ensure ownerPayment does not exceed totalPayment (same logic as FactoringContract)
        if (ownerPayment > bill.totalAmount) {
            ownerPayment = bill.totalAmount - lenderFees;
        }

        // Calculate debtor payment (what debtor gets back)
        uint256 debtorPayment = bill.totalAmount - ownerPayment;

        // Only proceed if there's a debtor payment to withdraw
        require(debtorPayment > 0, "No debtor payment available");

        // Verify we have sufficient balance
        require(
            IERC20(bill.stablecoin).balanceOf(address(this)) >= debtorPayment,
            "Insufficient balance for debtor payment withdrawal"
        );

        // Transfer the debtor payment to receiver
        IERC20(bill.stablecoin).safeTransfer(receiver, debtorPayment);

        emit FundsWithdrawn(receiver, debtorPayment, bill.stablecoin);
    }

    /**
     * @dev Update fund configuration (only authorized admin)
     * @param newConfig New fund configuration
     */
    function updateFundConfig(
        FundConfig memory newConfig
    ) external onlyAuthorizedAdmin {
        fundConfig = newConfig;
        emit FundConfigUpdated();
    }

    // Removed updateOfferConfig and offerConfig state variable, as offer config is now passed as parameters

    /**
     * @dev Get total fund balance for a specific token
     * @param token Token address
     * @return Token balance
     */
    function getFundBalance(address token) public view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @dev Get total fund value across all tokens
     * @return Total fund value
     */
    function getTotalFundValue() public view returns (uint256) {
        return getFundBalance(address(USDC)) + getFundBalance(address(USDT));
    }

    /**
     * @dev Pause the contract (only authorized admin)
     */
    function pause() external onlyAuthorizedAdmin {
        _pause();
    }

    /**
     * @dev Unpause the contract (only authorized admin)
     */
    function unpause() external onlyAuthorizedAdmin {
        _unpause();
    }

    /**
     * @dev Handle NFT transfers (ERC721Receiver implementation)
     */
    function onERC721Received(
        address /* operator */,
        address /* from */,
        uint256 /* tokenId */,
        bytes calldata /* data */
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
