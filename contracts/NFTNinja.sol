// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTNinja is ERC721URIStorage, Ownable {
    uint256 public nextTokenId;
    uint256 public maxSupply;
    uint256 public mintPrice; // in tokens (1e18 = 1 token)
    address public tokenAddress; // YBOT token

    event Minted(address indexed minter, uint256 indexed tokenId, string tokenURI);

    constructor(string memory name_, string memory symbol_, uint256 _maxSupply, uint256 _mintPrice, address _tokenAddress) ERC721(name_, symbol_) Ownable(msg.sender) {
        nextTokenId = 1;
        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
        tokenAddress = _tokenAddress;
    }

    function mintWithTokenURI(address to, string memory tokenURI) external returns (uint256) {
        require(nextTokenId <= maxSupply, "Max supply reached");
        IERC20 token = IERC20(tokenAddress);
        require(token.balanceOf(msg.sender) >= mintPrice, "Insufficient token balance");
        require(token.allowance(msg.sender, address(this)) >= mintPrice, "Insufficient allowance");

        // Transfer tokens from user to contract
        bool success = token.transferFrom(msg.sender, address(this), mintPrice);
        require(success, "Token transfer failed");

        uint256 tokenId = nextTokenId;
        nextTokenId++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);

        emit Minted(to, tokenId, tokenURI);
        return tokenId;
    }

    // Owner can withdraw tokens
    function withdrawTokens(address to) external onlyOwner {
        IERC20 token = IERC20(tokenAddress);
        uint256 bal = token.balanceOf(address(this));
        require(bal > 0, "No token balance");
        token.transfer(to, bal);
    }

    function setMintPrice(uint256 _price) external onlyOwner {
        mintPrice = _price;
    }

    function setMaxSupply(uint256 _supply) external onlyOwner {
        maxSupply = _supply;
    }

    function setTokenAddress(address _tokenAddress) external onlyOwner {
        tokenAddress = _tokenAddress;
    }
}
