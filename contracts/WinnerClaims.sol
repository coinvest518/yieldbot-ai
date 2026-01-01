// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract WinnerClaims is Ownable, ReentrancyGuard {
    IERC20 public ybot;
    
    mapping(bytes32 => bool) public claimed;
    mapping(bytes32 => uint256) public claimAmounts;
    
    event Claimed(bytes32 indexed claimCode, address indexed winner, uint256 amount);
    
    constructor(address _ybot) Ownable(msg.sender) {
        ybot = IERC20(_ybot);
    }
    
    // Admin: Set claim amount for a claimCode
    function setClaimAmount(bytes32 claimCode, uint256 amount) external onlyOwner {
        claimAmounts[claimCode] = amount;
    }
    
    // User: Claim tokens with claimCode
    function claim(bytes32 claimCode, address recipient) external nonReentrant {
        require(!claimed[claimCode], "Already claimed");
        require(claimAmounts[claimCode] > 0, "Invalid claim code");
        
        uint256 amount = claimAmounts[claimCode];
        claimed[claimCode] = true;
        
        require(ybot.transfer(recipient, amount), "Transfer failed");
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
