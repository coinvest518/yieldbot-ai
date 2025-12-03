import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("YBOTYieldVault", function () {
  let vault;
  let depositToken;
  let ybotToken;
  let mockAdapter;
  let owner;
  let user1;
  let user2;
  let treasury;

  const YBOT_DECIMALS = 18;
  const DEPOSIT_DECIMALS = 18;
  const MIN_YBOT_BALANCE = ethers.parseUnits("100", YBOT_DECIMALS); // 100 YBOT required
  const DEPOSIT_AMOUNT = ethers.parseUnits("1000", DEPOSIT_DECIMALS);
  const YBOT_REWARD_RATE = 10n; // 10 YBOT per 1 deposit token of yield

  beforeEach(async function () {
    [owner, user1, user2, treasury] = await ethers.getSigners();

    // Deploy mock deposit token (e.g., USDT)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    depositToken = await MockERC20.deploy("Mock USDT", "mUSDT", 18);
    await depositToken.waitForDeployment();

    // Deploy mock YBOT token
    ybotToken = await MockERC20.deploy("YBOT Token", "YBOT", 18);
    await ybotToken.waitForDeployment();

    // Deploy vault with all required constructor parameters
    const YBOTYieldVault = await ethers.getContractFactory("YBOTYieldVault");
    vault = await YBOTYieldVault.deploy(
      await depositToken.getAddress(),  // depositToken_
      await ybotToken.getAddress(),     // ybotToken_
      owner.address,                    // owner_
      treasury.address,                 // feeCollector_
      MIN_YBOT_BALANCE,                 // minYBOTBalance_
      YBOT_REWARD_RATE,                 // ybotRewardRate_
      50n,                              // depositFeeBps_ (0.5%)
      50n,                              // withdrawalFeeBps_ (0.5%)
      2000n                             // performanceFeeBps_ (20%)
    );
    await vault.waitForDeployment();

    // Deploy mock adapter (for testing only)
    const MockAdapter = await ethers.getContractFactory("MockAdapter");
    mockAdapter = await MockAdapter.deploy(
      await depositToken.getAddress(),
      await vault.getAddress()
    );
    await mockAdapter.waitForDeployment();

    // Mint tokens to users
    await depositToken.mint(user1.address, ethers.parseUnits("10000", DEPOSIT_DECIMALS));
    await depositToken.mint(user2.address, ethers.parseUnits("10000", DEPOSIT_DECIMALS));
    await ybotToken.mint(user1.address, ethers.parseUnits("200", YBOT_DECIMALS));
    await ybotToken.mint(user2.address, ethers.parseUnits("50", YBOT_DECIMALS)); // Not enough YBOT

    // Approve vault for deposits
    await depositToken.connect(user1).approve(await vault.getAddress(), ethers.MaxUint256);
    await depositToken.connect(user2).approve(await vault.getAddress(), ethers.MaxUint256);
  });

  describe("YBOT Token Gate", function () {
    it("should allow deposit when user has enough YBOT", async function () {
      // Add adapter first
      await vault.addAdapter(await mockAdapter.getAddress(), 10000); // 100% allocation
      
      const userYBOT = await ybotToken.balanceOf(user1.address);
      expect(userYBOT).to.be.gte(MIN_YBOT_BALANCE);

      await vault.connect(user1).deposit(DEPOSIT_AMOUNT);

      const userInfo = await vault.userInfo(user1.address);
      expect(userInfo.deposited).to.be.gt(0);
    });

    it("should reject deposit when user has insufficient YBOT", async function () {
      await vault.addAdapter(await mockAdapter.getAddress(), 10000);
      
      const userYBOT = await ybotToken.balanceOf(user2.address);
      expect(userYBOT).to.be.lt(MIN_YBOT_BALANCE);

      await expect(
        vault.connect(user2).deposit(DEPOSIT_AMOUNT)
      ).to.be.revertedWithCustomError(vault, "InsufficientYBOTBalance");
    });

    it("should allow owner to update minYBOTBalance", async function () {
      const newMin = ethers.parseUnits("50", YBOT_DECIMALS);
      await vault.setMinYBOTBalance(newMin);
      
      expect(await vault.minYBOTBalance()).to.equal(newMin);
    });

    it("should use hasYBOTAccess correctly", async function () {
      expect(await vault.hasYBOTAccess(user1.address)).to.be.true;
      expect(await vault.hasYBOTAccess(user2.address)).to.be.false;
    });
  });

  describe("Multi-Adapter Support", function () {
    let mockAdapter2;

    beforeEach(async function () {
      const MockAdapter = await ethers.getContractFactory("MockAdapter");
      mockAdapter2 = await MockAdapter.deploy(
        await depositToken.getAddress(),
        await vault.getAddress()
      );
      await mockAdapter2.waitForDeployment();
    });

    it("should add multiple adapters with allocations", async function () {
      await vault.addAdapter(await mockAdapter.getAddress(), 6000);  // 60%
      await vault.addAdapter(await mockAdapter2.getAddress(), 4000); // 40%

      expect(await vault.adapterCount()).to.equal(2);
      
      const allocations = await vault.getAllocations();
      expect(allocations[0]).to.equal(6000n);
      expect(allocations[1]).to.equal(4000n);
    });

    it("should distribute deposits across adapters", async function () {
      await vault.addAdapter(await mockAdapter.getAddress(), 6000);  // 60%
      await vault.addAdapter(await mockAdapter2.getAddress(), 4000); // 40%

      await vault.connect(user1).deposit(DEPOSIT_AMOUNT);

      // Deposit after 0.5% fee = 995 tokens
      const netDeposit = DEPOSIT_AMOUNT * 9950n / 10000n;
      
      const adapter1Balance = await mockAdapter.totalDeposited();
      const adapter2Balance = await mockAdapter2.totalDeposited();

      // 60% of 995 = ~597
      expect(adapter1Balance).to.be.closeTo(
        netDeposit * 6000n / 10000n, 
        ethers.parseUnits("1", DEPOSIT_DECIMALS)
      );
      // 40% of 995 = ~398
      expect(adapter2Balance).to.be.closeTo(
        netDeposit * 4000n / 10000n,
        ethers.parseUnits("1", DEPOSIT_DECIMALS)
      );
    });

    it("should remove adapter correctly", async function () {
      await vault.addAdapter(await mockAdapter.getAddress(), 6000);
      await vault.addAdapter(await mockAdapter2.getAddress(), 4000);

      const adapterId = await mockAdapter.adapterId();
      await vault.removeAdapter(adapterId); // Remove first adapter

      expect(await vault.adapterCount()).to.equal(1);
    });
  });

  describe("Deposits and Withdrawals", function () {
    beforeEach(async function () {
      await vault.addAdapter(await mockAdapter.getAddress(), 10000);
    });

    it("should track deposited amount", async function () {
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT);

      const userInfo = await vault.userInfo(user1.address);
      // Net deposit = 1000 - 0.5% fee = 995
      const expectedNet = DEPOSIT_AMOUNT * 9950n / 10000n;
      expect(userInfo.deposited).to.equal(expectedNet);
    });

    it("should charge deposit fee", async function () {
      // Default 0.5% deposit fee
      const expectedFee = DEPOSIT_AMOUNT * 50n / 10000n;
      const expectedDeposit = DEPOSIT_AMOUNT - expectedFee;

      await vault.connect(user1).deposit(DEPOSIT_AMOUNT);

      const adapterBalance = await mockAdapter.totalDeposited();
      expect(adapterBalance).to.equal(expectedDeposit);
      
      // Fee should go to treasury
      const treasuryBalance = await depositToken.balanceOf(treasury.address);
      expect(treasuryBalance).to.equal(expectedFee);
    });

    it("should withdraw correctly", async function () {
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT);
      
      const userInfoBefore = await vault.userInfo(user1.address);
      const withdrawAmount = userInfoBefore.deposited / 2n;
      
      const balanceBefore = await depositToken.balanceOf(user1.address);
      await vault.connect(user1).withdraw(withdrawAmount);
      const balanceAfter = await depositToken.balanceOf(user1.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("should charge withdrawal fee", async function () {
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT);
      
      const initialBalance = await depositToken.balanceOf(user1.address);
      const userInfo = await vault.userInfo(user1.address);
      const deposited = userInfo.deposited;
      
      await vault.connect(user1).withdraw(deposited);
      
      const finalBalance = await depositToken.balanceOf(user1.address);
      const received = finalBalance - initialBalance;

      // Withdrawal fee is 0.5% of amount
      const withdrawAfterFee = deposited * 9950n / 10000n;
      
      expect(received).to.be.closeTo(withdrawAfterFee, ethers.parseUnits("1", DEPOSIT_DECIMALS));
    });

    it("should reject withdrawal exceeding balance", async function () {
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT);
      
      const userInfo = await vault.userInfo(user1.address);
      const tooMuch = userInfo.deposited + ethers.parseUnits("100", DEPOSIT_DECIMALS);
      
      await expect(
        vault.connect(user1).withdraw(tooMuch)
      ).to.be.revertedWithCustomError(vault, "InsufficientBalance");
    });
  });

  describe("YBOT Reward Distribution", function () {
    beforeEach(async function () {
      await vault.addAdapter(await mockAdapter.getAddress(), 10000);
    });

    it("should accumulate YBOT rewards after harvest", async function () {
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT);

      // Simulate yield in adapter
      await depositToken.mint(owner.address, ethers.parseUnits("100", DEPOSIT_DECIMALS));
      await depositToken.approve(await mockAdapter.getAddress(), ethers.MaxUint256);
      await mockAdapter.addYield(ethers.parseUnits("100", DEPOSIT_DECIMALS));

      // Harvest
      await vault.harvest();

      // Check pending YBOT rewards
      const pendingRewards = await vault.pendingYBOT(user1.address);
      expect(pendingRewards).to.be.gt(0);
    });

    it("should allow claiming YBOT rewards", async function () {
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT);

      // Mint YBOT to vault for reward distribution
      await ybotToken.mint(await vault.getAddress(), ethers.parseUnits("10000", YBOT_DECIMALS));

      // Simulate yield
      await depositToken.mint(owner.address, ethers.parseUnits("100", DEPOSIT_DECIMALS));
      await depositToken.approve(await mockAdapter.getAddress(), ethers.MaxUint256);
      await mockAdapter.addYield(ethers.parseUnits("100", DEPOSIT_DECIMALS));

      await vault.harvest();

      const ybotBefore = await ybotToken.balanceOf(user1.address);
      await vault.connect(user1).claimRewards();
      const ybotAfter = await ybotToken.balanceOf(user1.address);

      expect(ybotAfter).to.be.gt(ybotBefore);
    });

    it("should distribute rewards proportionally to depositors", async function () {
      // User1 deposits 75%, User2 gets YBOT and deposits 25%
      await ybotToken.mint(user2.address, ethers.parseUnits("100", YBOT_DECIMALS));
      
      await vault.connect(user1).deposit(ethers.parseUnits("750", DEPOSIT_DECIMALS));
      await vault.connect(user2).deposit(ethers.parseUnits("250", DEPOSIT_DECIMALS));

      // Mint YBOT to vault for reward distribution
      await ybotToken.mint(await vault.getAddress(), ethers.parseUnits("10000", YBOT_DECIMALS));

      // Simulate yield
      await depositToken.mint(owner.address, ethers.parseUnits("100", DEPOSIT_DECIMALS));
      await depositToken.approve(await mockAdapter.getAddress(), ethers.MaxUint256);
      await mockAdapter.addYield(ethers.parseUnits("100", DEPOSIT_DECIMALS));

      await vault.harvest();

      const pending1 = await vault.pendingYBOT(user1.address);
      const pending2 = await vault.pendingYBOT(user2.address);

      // User1 should get ~3x User2's rewards (75% vs 25%)
      // Allow for some variance due to fees affecting deposit amounts
      expect(pending1).to.be.gt(pending2 * 2n);
    });
  });

  describe("Fee Configuration", function () {
    beforeEach(async function () {
      await vault.addAdapter(await mockAdapter.getAddress(), 10000);
    });

    it("should allow owner to update fees", async function () {
      await vault.setFees(100, 100, 1500); // 1%, 1%, 15%

      expect(await vault.depositFeeBps()).to.equal(100);
      expect(await vault.withdrawalFeeBps()).to.equal(100);
      expect(await vault.performanceFeeBps()).to.equal(1500);
    });

    it("should reject fee exceeding maximum", async function () {
      await expect(
        vault.setFees(600, 50, 2000) // 6% deposit > 5% max
      ).to.be.reverted;
    });

    it("should collect performance fee on harvest", async function () {
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT);

      // Record treasury balance after deposit fee
      const treasuryAfterDeposit = await depositToken.balanceOf(treasury.address);

      // Simulate large yield
      await depositToken.mint(owner.address, ethers.parseUnits("1000", DEPOSIT_DECIMALS));
      await depositToken.approve(await mockAdapter.getAddress(), ethers.MaxUint256);
      await mockAdapter.addYield(ethers.parseUnits("1000", DEPOSIT_DECIMALS));

      await vault.harvest();
      const treasuryAfterHarvest = await depositToken.balanceOf(treasury.address);

      // 20% performance fee on 1000 = 200
      const performanceFeeReceived = treasuryAfterHarvest - treasuryAfterDeposit;
      expect(performanceFeeReceived).to.be.closeTo(
        ethers.parseUnits("200", DEPOSIT_DECIMALS),
        ethers.parseUnits("1", DEPOSIT_DECIMALS)
      );
    });
  });

  describe("Pause Functionality", function () {
    beforeEach(async function () {
      await vault.addAdapter(await mockAdapter.getAddress(), 10000);
    });

    it("should prevent deposits when paused", async function () {
      await vault.pause();

      await expect(
        vault.connect(user1).deposit(DEPOSIT_AMOUNT)
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("should allow withdrawals when paused", async function () {
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT);
      await vault.pause();

      const userInfo = await vault.userInfo(user1.address);
      await vault.connect(user1).withdraw(userInfo.deposited);

      const userInfoAfter = await vault.userInfo(user1.address);
      expect(userInfoAfter.deposited).to.equal(0);
    });

    it("should allow unpause", async function () {
      await vault.pause();
      await vault.unpause();

      await vault.connect(user1).deposit(DEPOSIT_AMOUNT);
      const userInfo = await vault.userInfo(user1.address);
      expect(userInfo.deposited).to.be.gt(0);
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await vault.addAdapter(await mockAdapter.getAddress(), 10000);
      await vault.connect(user1).deposit(DEPOSIT_AMOUNT);
    });

    it("should return total deposited", async function () {
      const totalDeposited = await vault.totalDeposited();
      expect(totalDeposited).to.be.gt(0);
    });

    it("should check YBOT access", async function () {
      expect(await vault.hasYBOTAccess(user1.address)).to.be.true;
      expect(await vault.hasYBOTAccess(user2.address)).to.be.false;
    });

    it("should return estimated APY", async function () {
      const apy = await vault.estimatedAPY();
      // MockAdapterV2 returns 1000 (10% APY)
      expect(apy).to.equal(1000n);
    });

    it("should return adapter count", async function () {
      expect(await vault.adapterCount()).to.equal(1);
    });
  });

  describe("Minimum Deposit", function () {
    beforeEach(async function () {
      await vault.addAdapter(await mockAdapter.getAddress(), 10000);
    });

    it("should reject deposits below $10 minimum", async function () {
      const smallAmount = ethers.parseUnits("5", DEPOSIT_DECIMALS); // $5
      
      await expect(
        vault.connect(user1).deposit(smallAmount)
      ).to.be.revertedWithCustomError(vault, "BelowMinimumDeposit");
    });

    it("should accept deposits at $10 minimum", async function () {
      const minAmount = ethers.parseUnits("10", DEPOSIT_DECIMALS); // $10
      
      await vault.connect(user1).deposit(minAmount);
      const userInfo = await vault.userInfo(user1.address);
      expect(userInfo.deposited).to.be.gt(0);
    });
  });
});
