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
 * @title Fund
 * @dev A fund contract that acts as both lender and debtor intermediary for the FactoringContract
 *
 * Key Features:
 * - Lender Side: Pools funds from multiple investors to create offers
 * - Debtor Side: Manages debtor bill requests and payments
 * - Automated offer creation with configurable terms
 * - Profit sharing among fund participants
 * - Integration with FactoringContract for seamless operations
 */
contract Fund is ReentrancyGuard, Pausable, Authorized, IERC721Receiver {
    using SafeERC20 for IERC20;

    // Reference to the FactoringContract
    FactoringContract public immutable factoringContract;

    // Supported stablecoins
    IERC20 public immutable USDC;
    IERC20 public immutable USDT;

    // Fund configuration
    struct FundConfig {
        uint256 minInvestment; // Minimum investment amount
        uint256 maxInvestment; // Maximum investment amount per investor
        uint256 targetAmount; // Target total fund amount
        uint256 feePercentage; // Management fee percentage (basis points)
        bool acceptingInvestments; // Whether fund is accepting new investments
    }

    // Investor information
    struct Investor {
        uint256 investment; // Total amount invested
        uint256 shares; // Number of shares owned
        uint256 lastClaimTime; // Last time rewards were claimed
        bool active; // Whether investor is active
    }

    // Offer configuration for automatic offer creation
    struct OfferConfig {
        uint256 feePercentage; // Fee percentage for offers
        uint256 upfrontPercentage; // Upfront percentage for offers
        uint256 ownerPercentage; // Owner percentage for offers
        uint256 minBillAmount; // Minimum bill amount to consider
        uint256 maxBillAmount; // Maximum bill amount to consider
        address preferredStablecoin; // Preferred stablecoin for offers (USDC or USDT)
        bool autoOfferEnabled; // Whether auto-offer is enabled
    }

    // State variables
    FundConfig public fundConfig;
    OfferConfig public offerConfig;

    uint256 public totalShares;
    uint256 public totalInvested;
    uint256 public totalEarnings;
    uint256 public managementFeesCollected;

    mapping(address => Investor) public investors;
    mapping(address => uint256) public fundBalances; // Token => balance
    mapping(uint256 => bool) public activeBillRequests; // Bill request ID => active
    mapping(uint256 => uint256) public billRequestToOffer; // Bill request ID => offer ID

    address[] public investorList;

    // Events
    event InvestmentMade(
        address indexed investor,
        uint256 amount,
        address token,
        uint256 shares
    );
    event InvestmentWithdrawn(
        address indexed investor,
        uint256 amount,
        address token,
        uint256 shares
    );
    event OfferCreatedAutomatically(
        uint256 indexed billRequestId,
        uint256 indexed offerId,
        uint256 amount
    );
    event ProfitsDistributed(uint256 totalProfit, uint256 managementFee);
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
        FundConfig memory _fundConfig,
        OfferConfig memory _offerConfig
    ) {
        require(_factoringContract != address(0), "Invalid factoring contract");
        require(_usdc != address(0), "Invalid USDC address");
        require(_usdt != address(0), "Invalid USDT address");

        factoringContract = FactoringContract(_factoringContract);
        USDC = IERC20(_usdc);
        USDT = IERC20(_usdt);

        fundConfig = _fundConfig;
        offerConfig = _offerConfig;
    }

    /**
     * @dev Invest in the fund
     * @param amount Amount to invest
     * @param token Token address (USDC or USDT)
     */
    function invest(
        uint256 amount,
        address token
    ) external nonReentrant whenNotPaused {
        require(
            fundConfig.acceptingInvestments,
            "Fund not accepting investments"
        );
        require(amount >= fundConfig.minInvestment, "Investment below minimum");
        require(
            token == address(USDC) || token == address(USDT),
            "Unsupported token"
        );

        Investor storage investor = investors[msg.sender];
        require(
            investor.investment + amount <= fundConfig.maxInvestment,
            "Exceeds maximum investment"
        );
        require(
            totalInvested + amount <= fundConfig.targetAmount,
            "Exceeds target amount"
        );

        // Transfer tokens to fund
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Calculate shares (1:1 ratio for simplicity, could be more complex)
        uint256 shares = amount;

        // Update investor information
        if (!investor.active) {
            investor.active = true;
            investorList.push(msg.sender);
        }

        investor.investment += amount;
        investor.shares += shares;
        investor.lastClaimTime = block.timestamp;

        // Update fund totals
        totalShares += shares;
        totalInvested += amount;
        fundBalances[token] += amount;

        emit InvestmentMade(msg.sender, amount, token, shares);
    }

    /**
     * @dev Withdraw investment from fund
     * @param shares Number of shares to withdraw
     * @param token Token to withdraw in
     */
    function withdraw(uint256 shares, address token) external nonReentrant {
        require(
            token == address(USDC) || token == address(USDT),
            "Unsupported token"
        );

        Investor storage investor = investors[msg.sender];
        require(investor.active, "Not an active investor");
        require(investor.shares >= shares, "Insufficient shares");

        // Calculate withdrawal amount (including profits)
        uint256 totalFundValue = getTotalFundValue();
        uint256 withdrawAmount = (shares * totalFundValue) / totalShares;

        require(
            fundBalances[token] >= withdrawAmount,
            "Insufficient fund balance"
        );

        // Update investor information
        investor.shares -= shares;
        investor.investment =
            (investor.investment * (investor.shares)) /
            (investor.shares + shares);

        if (investor.shares == 0) {
            investor.active = false;
            _removeInvestorFromList(msg.sender);
        }

        // Update fund totals
        totalShares -= shares;
        fundBalances[token] -= withdrawAmount;

        // Transfer tokens to investor
        IERC20(token).safeTransfer(msg.sender, withdrawAmount);

        emit InvestmentWithdrawn(msg.sender, withdrawAmount, token, shares);
    }

    /**
     * @dev Create bill request on behalf of debtor
     * @param totalAmount Total amount of the bill
     * @param dueDate Due date of the bill
     * @param debtor Address of the actual debtor
     */
    function createBillRequestForDebtor(
        uint256 totalAmount,
        uint256 dueDate,
        address debtor
    ) external onlyAuthorizedAdmin returns (uint256) {
        require(debtor != address(0), "Invalid debtor address");

        // The fund creates the bill request, but tracks the actual debtor
        uint256 billRequestId = factoringContract.createBillRequest(
            totalAmount,
            dueDate
        );

        activeBillRequests[billRequestId] = true;

        emit BillRequestFunded(billRequestId, debtor, totalAmount);

        return billRequestId;
    }

    /**
     * @dev Automatically create offer for bill requests
     * @param billRequestId ID of the bill request
     */
    function createOfferForBillRequest(
        uint256 billRequestId
    ) external nonReentrant whenNotPaused {
        require(offerConfig.autoOfferEnabled, "Auto-offer disabled");
        require(
            offerConfig.preferredStablecoin == address(USDC) ||
                offerConfig.preferredStablecoin == address(USDT),
            "Invalid preferred stablecoin"
        );

        // Get bill request details
        FactoringContract.BillRequest memory billRequest = factoringContract
            .getBillRequest(billRequestId);
        require(billRequest.id != 0, "Bill request does not exist");
        require(uint256(billRequest.status) == 0, "Bill request not open"); // 0 = BillRequestStatus.Open

        // Check if bill amount is within our criteria
        require(
            billRequest.totalAmount >= offerConfig.minBillAmount,
            "Bill amount below minimum"
        );
        require(
            billRequest.totalAmount <= offerConfig.maxBillAmount,
            "Bill amount above maximum"
        );

        // Calculate required upfront amount
        uint256 upfrontAmount = (billRequest.totalAmount *
            offerConfig.upfrontPercentage) / 100;
        require(
            fundBalances[offerConfig.preferredStablecoin] >= upfrontAmount,
            "Insufficient fund balance"
        );

        // Create the offer conditions
        FactoringContract.Conditions memory conditions = FactoringContract
            .Conditions({
                feePercentage: offerConfig.feePercentage,
                upfrontPercentage: offerConfig.upfrontPercentage,
                ownerPercentage: offerConfig.ownerPercentage
            });

        // Approve the factoring contract to spend our tokens
        IERC20(offerConfig.preferredStablecoin).safeIncreaseAllowance(
            address(factoringContract),
            upfrontAmount
        );

        // Create the offer
        uint256 offerId = factoringContract.createOffer(
            billRequestId,
            offerConfig.preferredStablecoin,
            conditions
        );

        // Track the offer
        billRequestToOffer[billRequestId] = offerId;
        fundBalances[offerConfig.preferredStablecoin] -= upfrontAmount;

        emit OfferCreatedAutomatically(billRequestId, offerId, upfrontAmount);
    }

    /**
     * @dev Handle bill completion and distribute profits
     * @param billId ID of the completed bill
     */
    function handleBillCompletion(uint256 billId) external nonReentrant {
        // Get bill details
        FactoringContract.Bill memory bill = factoringContract.getBill(billId);
        require(bill.id != 0, "Bill does not exist");
        require(uint256(bill.status) == 1, "Bill not completed"); // 1 = BillStatus.Completed
        require(bill.lender == address(this), "Fund is not the lender");

        // Calculate total return (should include the upfront amount returned + owner percentage)
        uint256 totalReturn = bill.upfrontPaid +
            (bill.totalAmount * bill.conditions.ownerPercentage) /
            100;

        // Update fund balance
        fundBalances[bill.stablecoin] += totalReturn;

        // Calculate profit
        uint256 profit = totalReturn > bill.upfrontPaid
            ? totalReturn - bill.upfrontPaid
            : 0;

        // Collect management fee
        uint256 managementFee = (profit * fundConfig.feePercentage) / 10000;
        managementFeesCollected += managementFee;

        // Add to total earnings
        totalEarnings += (profit - managementFee);

        emit BillCompleted(billId, totalReturn);
        emit ProfitsDistributed(profit, managementFee);
    }

    /**
     * @dev Pay debtor bill through the fund. The caller (msg.sender) must be the actual debtor.
     * @param billId ID of the bill to pay
     */
    function payBillForDebtor(uint256 billId) external nonReentrant {
        // Get bill details
        FactoringContract.Bill memory bill = factoringContract.getBill(billId);
        require(bill.id != 0, "Bill does not exist");
        require(uint256(bill.status) == 0, "Bill not active"); // 0 = BillStatus.Active
        require(bill.debtor == address(this), "Fund is not the debtor");

        // Debtor must transfer the full amount to the fund first
        IERC20(bill.stablecoin).safeTransferFrom(
            msg.sender,
            address(this),
            bill.totalAmount
        );

        // Approve the factoring contract to spend the tokens
        IERC20(bill.stablecoin).safeIncreaseAllowance(
            address(factoringContract),
            bill.totalAmount
        );

        // Complete the bill payment
        factoringContract.completeBill(billId);

        // Any remaining balance stays in the fund
        fundBalances[bill.stablecoin] += IERC20(bill.stablecoin).balanceOf(
            address(this)
        );
    }

    /**
     * @dev Update fund configuration (only admin)
     */
    function updateFundConfig(
        FundConfig memory _fundConfig
    ) external onlyAuthorizedAdmin {
        fundConfig = _fundConfig;
        emit FundConfigUpdated();
    }

    /**
     * @dev Update offer configuration (only admin)
     */
    function updateOfferConfig(
        OfferConfig memory _offerConfig
    ) external onlyAuthorizedAdmin {
        offerConfig = _offerConfig;
        emit OfferConfigUpdated();
    }

    /**
     * @dev Withdraw management fees (only admin)
     */
    function withdrawManagementFees(
        address token,
        uint256 amount
    ) external onlyAuthorizedAdmin {
        require(
            token == address(USDC) || token == address(USDT),
            "Unsupported token"
        );
        require(
            amount <= managementFeesCollected,
            "Insufficient management fees"
        );
        require(fundBalances[token] >= amount, "Insufficient fund balance");

        managementFeesCollected -= amount;
        fundBalances[token] -= amount;

        IERC20(token).safeTransfer(msg.sender, amount);
    }

    /**
     * @dev Get total fund value including profits
     */
    function getTotalFundValue() public view returns (uint256) {
        return totalInvested + totalEarnings;
    }

    /**
     * @dev Get investor information
     */
    function getInvestorInfo(
        address investor
    ) external view returns (Investor memory) {
        return investors[investor];
    }

    /**
     * @dev Get fund balance for a token
     */
    function getFundBalance(address token) external view returns (uint256) {
        return fundBalances[token];
    }

    /**
     * @dev Get all investors
     */
    function getInvestors() external view returns (address[] memory) {
        return investorList;
    }

    /**
     * @dev Calculate investor's current value
     */
    function getInvestorValue(
        address investor
    ) external view returns (uint256) {
        Investor memory inv = investors[investor];
        if (!inv.active || totalShares == 0) return 0;

        return (inv.shares * getTotalFundValue()) / totalShares;
    }

    /**
     * @dev Internal function to remove investor from list
     */
    function _removeInvestorFromList(address investor) internal {
        for (uint256 i = 0; i < investorList.length; i++) {
            if (investorList[i] == investor) {
                investorList[i] = investorList[investorList.length - 1];
                investorList.pop();
                break;
            }
        }
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
     * @dev Handle the receipt of an NFT
     * Implements IERC721Receiver interface to allow the contract to receive NFTs
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    /**
     * @dev Accept an offer for a bill request that the fund owns
     * @param offerId ID of the offer to accept
     */
    function acceptOfferForOwnedBill(
        uint256 offerId
    ) external onlyAuthorizedAdmin nonReentrant {
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

        // Update tracking
        activeBillRequests[offer.billRequestId] = false;
    }
}
