// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract WinnerClaimsV2 is Ownable, ReentrancyGuard {
    IERC20 public ybot;
    
    mapping(bytes32 => bool) public claimed;
    
    event Claimed(bytes32 indexed claimCode, address indexed winner, uint256 amount);
    
    constructor(address _ybot) Ownable(msg.sender) {
        ybot = IERC20(_ybot);
    }
    
    // User: Claim tokens with claimCode and amount (owner verifies off-chain)
    function claim(bytes32 claimCode, address recipient, uint256 amount) external nonReentrant {
        require(!claimed[claimCode], "Already claimed");
        require(amount > 0, "Invalid amount");
        
        claimed[claimCode] = true;
        
        require(ybot.transfer(recipient, amount * 10**18), "Transfer failed");
        emit Claimed(claimCode, recipient, amount);
    }
    
    // Admin: Fund contract with YBOT
    function fundContract(uint256 amount) external onlyOwner {
        require(ybot.transferFrom(msg.sender, address(this), amount), "Transfer failed");
    }
    
    // Admin: Withdraw remaining YBOT
    function withdraw(uint256 amount) external onlyOwner {
        require(ybot.transfer(owner(), amount), "Transfer failed");
    }
}
