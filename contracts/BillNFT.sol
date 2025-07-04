// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract BillNFT is ERC721 {
    // Events for NFT operations
    event NFTMinted(uint256 indexed tokenId, address indexed to);

    constructor(
        string memory _name,
        string memory _symbol
    ) ERC721(_name, _symbol) {}

    function _mintBillNFT(address to, uint256 tokenId) internal {
        _safeMint(to, tokenId);
        emit NFTMinted(tokenId, to);
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override returns (address) {
        return super._update(to, tokenId, auth);
    }

    function getNFTOwner(uint256 tokenId) external view returns (address) {
        require(_ownerOf(tokenId) != address(0), "NFT does not exist");
        return ownerOf(tokenId);
    }
}
