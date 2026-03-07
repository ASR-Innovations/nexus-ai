import { expect } from "chai";
import { ethers } from "hardhat";
import { XCMRouter } from "../typechain-types";

describe("XCMRouter", function () {
  let xcmRouter: XCMRouter;

  beforeEach(async function () {
    const XCMRouterFactory = await ethers.getContractFactory("XCMRouter");
    xcmRouter = await XCMRouterFactory.deploy();
    await xcmRouter.waitForDeployment();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Deployment
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("deploys with correct XCM_PRECOMPILE address", async function () {
      const precompile = await xcmRouter.XCM_PRECOMPILE();
      expect(precompile).to.equal("0x0000000000000000000000000000000000000A00");
    });

    it("initializes with 3 supported parachains", async function () {
      const chains = await xcmRouter.getSupportedParachains();
      expect(chains.length).to.equal(3);
    });

    it("initializes Hydration (2034) as first parachain", async function () {
      const chains = await xcmRouter.getSupportedParachains();
      expect(chains[0]).to.equal(2034);
    });

    it("initializes Bifrost (2030) as second parachain", async function () {
      const chains = await xcmRouter.getSupportedParachains();
      expect(chains[1]).to.equal(2030);
    });

    it("initializes Moonbeam (2004) as third parachain", async function () {
      const chains = await xcmRouter.getSupportedParachains();
      expect(chains[2]).to.equal(2004);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // isSupportedParachain
  // ─────────────────────────────────────────────────────────────────────────────
  describe("isSupportedParachain", function () {
    it("returns true for Hydration (2034)", async function () {
      expect(await xcmRouter.isSupportedParachain(2034)).to.be.true;
    });

    it("returns true for Bifrost (2030)", async function () {
      expect(await xcmRouter.isSupportedParachain(2030)).to.be.true;
    });

    it("returns true for Moonbeam (2004)", async function () {
      expect(await xcmRouter.isSupportedParachain(2004)).to.be.true;
    });

    it("returns false for unknown parachain 1000", async function () {
      expect(await xcmRouter.isSupportedParachain(1000)).to.be.false;
    });

    it("returns false for parachain 0", async function () {
      expect(await xcmRouter.isSupportedParachain(0)).to.be.false;
    });

    it("returns false for parachain 9999", async function () {
      expect(await xcmRouter.isSupportedParachain(9999)).to.be.false;
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // getSupportedParachains
  // ─────────────────────────────────────────────────────────────────────────────
  describe("getSupportedParachains", function () {
    it("returns array of length 3", async function () {
      const chains = await xcmRouter.getSupportedParachains();
      expect(chains.length).to.equal(3);
    });

    it("contains exactly [2034, 2030, 2004]", async function () {
      const chains = await xcmRouter.getSupportedParachains();
      expect(chains.map(Number)).to.deep.equal([2034, 2030, 2004]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // buildTransferXCM
  // ─────────────────────────────────────────────────────────────────────────────
  describe("buildTransferXCM", function () {
    it("returns non-empty bytes for Hydration (2034)", async function () {
      const signers = await ethers.getSigners();
      const beneficiary = ethers.zeroPadValue(signers[1].address, 32);
      const msg = await xcmRouter.buildTransferXCM(
        2034,
        beneficiary,
        ethers.parseEther("1")
      );
      expect(msg.length).to.be.greaterThan(2);
    });

    it("returns non-empty bytes for Bifrost (2030)", async function () {
      const signers = await ethers.getSigners();
      const beneficiary = ethers.zeroPadValue(signers[1].address, 32);
      const msg = await xcmRouter.buildTransferXCM(
        2030,
        beneficiary,
        ethers.parseEther("1")
      );
      expect(msg.length).to.be.greaterThan(2);
    });

    it("returns non-empty bytes for Moonbeam (2004)", async function () {
      const signers = await ethers.getSigners();
      const beneficiary = ethers.zeroPadValue(signers[1].address, 32);
      const msg = await xcmRouter.buildTransferXCM(
        2004,
        beneficiary,
        ethers.parseEther("1")
      );
      expect(msg.length).to.be.greaterThan(2);
    });

    it("reverts for unsupported parachain 1000", async function () {
      const signers = await ethers.getSigners();
      const beneficiary = ethers.zeroPadValue(signers[1].address, 32);
      await expect(
        xcmRouter.buildTransferXCM(1000, beneficiary, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(xcmRouter, "UnsupportedParachain");
    });

    it("produces different messages for different parachains", async function () {
      const signers = await ethers.getSigners();
      const amount = ethers.parseEther("1");
      const beneficiary = ethers.zeroPadValue(signers[1].address, 32);
      const msg2034 = await xcmRouter.buildTransferXCM(2034, beneficiary, amount);
      const msg2004 = await xcmRouter.buildTransferXCM(2004, beneficiary, amount);
      expect(msg2034).to.not.equal(msg2004);
    });

    it("produces different messages for different amounts", async function () {
      const signers = await ethers.getSigners();
      const beneficiary = ethers.zeroPadValue(signers[1].address, 32);
      const msg1 = await xcmRouter.buildTransferXCM(2034, beneficiary, ethers.parseEther("1"));
      const msg2 = await xcmRouter.buildTransferXCM(2034, beneficiary, ethers.parseEther("2"));
      expect(msg1).to.not.equal(msg2);
    });

    it("starts with XCM version byte 0x03", async function () {
      const signers = await ethers.getSigners();
      const beneficiary = ethers.zeroPadValue(signers[1].address, 32);
      const msg = await xcmRouter.buildTransferXCM(2034, beneficiary, ethers.parseEther("1"));
      // First byte should be 0x03 (XCM v3)
      expect(msg.slice(0, 4)).to.equal("0x03");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // estimateWeight
  // ─────────────────────────────────────────────────────────────────────────────
  describe("estimateWeight", function () {
    it("returns fallback weight 1_000_000_000 when precompile is not available (local Hardhat)", async function () {
      const signers = await ethers.getSigners();
      const beneficiary = ethers.zeroPadValue(signers[1].address, 32);
      const msg = await xcmRouter.buildTransferXCM(2034, beneficiary, ethers.parseEther("1"));
      const weight = await xcmRouter.estimateWeight(msg);
      // On local Hardhat, XCM precompile is absent → fallback weight
      expect(weight).to.equal(1_000_000_000n);
    });

    it("accepts empty bytes and returns fallback weight", async function () {
      const weight = await xcmRouter.estimateWeight("0x");
      expect(weight).to.equal(1_000_000_000n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // routeTransfer
  // ─────────────────────────────────────────────────────────────────────────────
  describe("routeTransfer", function () {
    it("reverts for unsupported parachain", async function () {
      const signers = await ethers.getSigners();
      const beneficiary = ethers.zeroPadValue(signers[1].address, 32);
      await expect(
        xcmRouter
          .connect(signers[0])
          .routeTransfer(1000, beneficiary, ethers.parseEther("1"), {
            value: ethers.parseEther("1"),
          })
      ).to.be.revertedWithCustomError(xcmRouter, "UnsupportedParachain");
    });

    it("reverts for zero amount", async function () {
      const signers = await ethers.getSigners();
      const beneficiary = ethers.zeroPadValue(signers[1].address, 32);
      await expect(
        xcmRouter
          .connect(signers[0])
          .routeTransfer(2034, beneficiary, 0n, { value: 0n })
      ).to.be.revertedWithCustomError(xcmRouter, "ZeroAmount");
    });

    it("reverts for zero beneficiary address (bytes32(0))", async function () {
      const signers = await ethers.getSigners();
      await expect(
        xcmRouter
          .connect(signers[0])
          .routeTransfer(2034, ethers.ZeroHash, ethers.parseEther("1"), {
            value: ethers.parseEther("1"),
          })
      ).to.be.revertedWithCustomError(xcmRouter, "ZeroBeneficiary");
    });

    it("succeeds and emits XCMDispatched on local Hardhat (precompile address has no code, call returns true)", async function () {
      const signers = await ethers.getSigners();
      const beneficiary = ethers.zeroPadValue(signers[1].address, 32);
      // On local Hardhat, 0x...0A00 has no code — EVM call to empty address returns (true, "0x").
      // So _executeXCM succeeds, and routeTransfer emits XCMDispatched.
      await expect(
        xcmRouter
          .connect(signers[0])
          .routeTransfer(2034, beneficiary, ethers.parseEther("1"), {
            value: ethers.parseEther("1"),
          })
      ).to.emit(xcmRouter, "XCMDispatched")
        .withArgs(2034, beneficiary, ethers.parseEther("1"));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // receive()
  // ─────────────────────────────────────────────────────────────────────────────
  describe("receive()", function () {
    it("accepts ETH sent directly to contract", async function () {
      const signers = await ethers.getSigners();
      const amount = ethers.parseEther("1");
      await signers[0].sendTransaction({
        to: await xcmRouter.getAddress(),
        value: amount,
      });
      const balance = await ethers.provider.getBalance(await xcmRouter.getAddress());
      expect(balance).to.equal(amount);
    });
  });
});
