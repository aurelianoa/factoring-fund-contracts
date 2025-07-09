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

        // Update fund totals
        totalFundValue += amount;
        fundBalances[token] += amount;

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
        require(fundBalances[token] >= amount, "Insufficient fund balance");

        // Update fund totals
        totalFundValue -= amount;
        fundBalances[token] -= amount;

        // Transfer tokens to caller
        IERC20(token).safeTransfer(msg.sender, amount);

        emit FundsWithdrawn(msg.sender, amount, token);
    }

    /**
     * @dev Create bill request for a debtor
     * @param totalAmount Total bill amount
     * @param dueDate Due date for the bill
     * @param realDebtor Address of the real debtor
     */
    function createBillRequestForDebtor(
        uint256 totalAmount,
        uint256 dueDate,
        address realDebtor
    )
        external
        onlyAuthorizedOperator
        nonReentrant
        whenNotPaused
        returns (uint256)
    {
        require(realDebtor != address(0), "Invalid debtor address");
        require(totalAmount > 0, "Amount must be greater than 0");

        // Create bill request with fund as debtor (no stablecoin specified)
        uint256 billRequestId = factoringContract.createBillRequest(
            totalAmount,
            dueDate
        );

        // Mark as active
        activeBillRequests[billRequestId] = true;

        emit BillRequestFunded(billRequestId, realDebtor, totalAmount);

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
            conditions.upfrontPercentage) / 100;
        require(
            fundBalances[stablecoin] >= upfrontAmount,
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
     * @dev Pay a bill on behalf of a debtor
     * @param billId ID of the bill to pay
     * @param realDebtor Address of the real debtor
     */
    function payBillForDebtor(
        uint256 billId,
        address realDebtor
    ) external nonReentrant {
        require(realDebtor != address(0), "Invalid debtor address");

        // Get bill details
        FactoringContract.Bill memory bill = factoringContract.getBill(billId);
        require(bill.id != 0, "Bill does not exist");
        require(bill.debtor == address(this), "Fund is not the debtor");

        // Check that the caller is the real debtor
        require(msg.sender == realDebtor, "Only real debtor can pay the bill");

        // The real debtor needs to pay the fund, then fund pays the bill
        IERC20(bill.stablecoin).safeTransferFrom(
            realDebtor,
            address(this),
            bill.totalAmount
        );

        // Update fund balance
        fundBalances[bill.stablecoin] += bill.totalAmount;

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

        // Calculate total return (owner's share from the bill completion)
        uint256 totalReturn = (bill.totalAmount *
            bill.conditions.ownerPercentage) / 100;

        // Calculate management fee
        uint256 managementFee = (totalReturn *
            fundConfig.managementFeePercentage) / 10000; // basis points
        uint256 netReturn = totalReturn - managementFee;

        // Update fund balances
        fundBalances[bill.stablecoin] += netReturn;
        totalFundValue += netReturn;
        totalEarnings += netReturn;
        managementFeesCollected += managementFee;

        emit BillCompleted(billId, totalReturn);
        emit ManagementFeesCollected(managementFee);
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
    function getFundBalance(address token) external view returns (uint256) {
        return fundBalances[token];
    }

    /**
     * @dev Get total fund value across all tokens
     * @return Total fund value
     */
    function getTotalFundValue() public view returns (uint256) {
        return totalFundValue;
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

    /**
     * @dev Create a complete bill flow: create bill request, create offer, and accept offer
     * @notice This is a convenience function that combines three operations in one transaction:
     *         1. Creates a bill request (SimpleFund acts as debtor)
     *         2. Creates an offer for that bill request (SimpleFund acts as lender)
     *         3. Accepts the offer (SimpleFund accepts its own offer)
     *         This is useful for internal bill creation where the fund serves both roles.
     * @param totalAmount Total bill amount
     * @param dueDate Due date for the bill
     * @param stablecoin Stablecoin address (USDC or USDT)
     * @param conditions Offer conditions (fee, upfront, owner percentages)
     * @return billId The ID of the created bill (same as bill request ID)
     */
    function createCompleteBill(
        uint256 totalAmount,
        uint256 dueDate,
        address stablecoin,
        FactoringContract.Conditions memory conditions
    )
        external
        onlyAuthorizedOperator
        nonReentrant
        whenNotPaused
        returns (uint256)
    {
        require(totalAmount > 0, "Amount must be greater than 0");
        require(
            stablecoin == address(USDC) || stablecoin == address(USDT),
            "Unsupported stablecoin"
        );
        require(dueDate > block.timestamp, "Due date must be in the future");

        // Validate conditions
        require(conditions.feePercentage <= 100, "Fee percentage too high");
        require(
            conditions.upfrontPercentage <= 100,
            "Upfront percentage too high"
        );
        require(conditions.ownerPercentage <= 100, "Owner percentage too high");

        // Calculate required upfront amount
        uint256 upfrontAmount = (totalAmount * conditions.upfrontPercentage) /
            100;
        require(
            fundBalances[stablecoin] >= upfrontAmount,
            "Insufficient fund balance for upfront payment"
        );

        // Step 1: Create bill request (SimpleFund acts as debtor)
        uint256 billRequestId = factoringContract.createBillRequest(
            totalAmount,
            dueDate
        );

        // Mark as active
        activeBillRequests[billRequestId] = true;

        // Step 2: Approve FactoringContract to spend our tokens for the offer
        IERC20(stablecoin).approve(address(factoringContract), upfrontAmount);

        // Step 3: Create offer (SimpleFund acts as lender)
        uint256 offerId = factoringContract.createOffer(
            billRequestId,
            stablecoin,
            conditions
        );

        // Track the mapping
        billRequestToOffer[billRequestId] = offerId;

        // Step 4: Accept the offer (SimpleFund accepts its own offer)
        factoringContract.acceptOffer(offerId);

        // Update fund balances after upfront payment
        fundBalances[stablecoin] -= upfrontAmount;
        totalFundValue -= upfrontAmount;

        emit BillRequestFunded(billRequestId, address(this), totalAmount);
        emit OfferCreatedAutomatically(billRequestId, offerId, upfrontAmount);

        // The bill ID is the same as the bill request ID
        return billRequestId;
    }
}
