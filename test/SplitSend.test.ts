import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { PayableOverrides } from "@ethersproject/contracts";
import { BigNumber, Contract } from "ethers";

const MAX_UINT256 = ethers.constants.MaxUint256;

describe("SplitSend", function () {
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;
    let splitSend: Contract;
    let testGreeter: Contract;

    const greetInterface = new ethers.utils.Interface([
        "function greet(string memory who) public view",
    ]);

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
        const SplitSend = await ethers.getContractFactory("SplitSend");
        splitSend = await SplitSend.deploy();
        await splitSend.deployed();

        const TestGreeter = await ethers.getContractFactory("TestGreeter");
        testGreeter = await TestGreeter.deploy();
        await testGreeter.deployed();
    });

    describe("Split Ethers", () => {
        it("Insufficient Ether splitting", async function () {
            const payments = [addr1, addr2].map((a) => ({
                beneficiary: a.address,
                amount: ethers.utils.parseEther("100"),
            }));

            const overrides: PayableOverrides = {
                value: ethers.utils.parseEther("100"),
            };

            const initialBalances = await Promise.all([
                addr1.getBalance(),
                addr2.getBalance(),
            ]);
            await expect(
                splitSend.sendEtherToMultipleBeneficiaries(
                    greetInterface.encodeFunctionData("greet", ["WOZAK"]),
                    testGreeter.address,
                    payments,
                    overrides
                )
            ).to.be.reverted;
            const finalBalances = await Promise.all([
                addr1.getBalance(),
                addr2.getBalance(),
            ]);
            const difference = finalBalances.map((v, i) =>
                v.sub(initialBalances[i])
            );
            expect(difference).to.eql(
                ["0", "0"].map(ethers.utils.parseEther)
            );
        });

        it("Evenly split Ether successfully", async function () {
            const payments = [addr1, addr2].map((a) => ({
                beneficiary: a.address,
                amount: ethers.utils.parseEther("100"),
            }));

            const overrides: PayableOverrides = {
                value: ethers.utils.parseEther("200.1"),
            };

            const initialBalances = await Promise.all([
                addr1.getBalance(),
                addr2.getBalance(),
            ]);
            await splitSend.sendEtherToMultipleBeneficiaries(
                testGreeter.address,
                greetInterface.encodeFunctionData("greet", ["WOZAK"]),
                payments,
                overrides
            );
            const finalBalances = await Promise.all([
                addr1.getBalance(),
                addr2.getBalance(),
            ]);
            const difference = finalBalances.map((v, i) =>
                v.sub(initialBalances[i])
            );
            expect(difference).to.eql(
                ["100", "100"].map(ethers.utils.parseEther)
            );
        });

        it("Unevenly split 150 Ethers", async function () {
            const payments = [
                {
                    beneficiary: addr1.address,
                    amount: ethers.utils.parseEther("50"),
                },
                {
                    beneficiary: addr2.address,
                    amount: ethers.utils.parseEther("100"),
                },
            ];

            const overrides: PayableOverrides = {
                value: ethers.utils.parseEther("151"),
            };

            const initialBalances = await Promise.all([
                addr1.getBalance(),
                addr2.getBalance(),
            ]);

            await splitSend.sendEtherToMultipleBeneficiaries(
                testGreeter.address,
                greetInterface.encodeFunctionData("greet", ["WOZAK"]),
                payments,
                overrides
            );

            const finalBalances = await Promise.all([
                addr1.getBalance(),
                addr2.getBalance(),
            ]);
            const difference = finalBalances.map((v, i) =>
                v.sub(initialBalances[i])
            );

            expect(difference).to.eql(
                ["50", "100"].map(ethers.utils.parseEther)
            );
        });
    });

    describe("Split ERC20", () => {
        // test token
        let ttt: Contract;

        beforeEach(async function () {
            const TTT = await ethers.getContractFactory("TestToken");
            ttt = await TTT.deploy("Test Token", "TTT");

            await ttt.deployed();

            // allow the smart contract to spend on behalf of the owner
            await ttt.approve(splitSend.address, MAX_UINT256);
        });

        it("Insufficient ERC20 splitting", async function () {
            const payments = [addr1, addr2].map((a) => ({
                beneficiary: a.address,
                amount: 1000000,
            }));

            await expect(
                splitSend.sendTokenToMultipleBeneficiaries(
                    testGreeter.address,
                    greetInterface.encodeFunctionData("greet", ["WOZAK"]),
                    ttt.address,
                    payments
                )
            ).to.be.reverted;

            const balances = await Promise.all([
                ttt.balanceOf(addr1.address),
                ttt.balanceOf(addr2.address),
            ]);
            expect(balances).to.eql([0, 0].map(BigNumber.from));
        });

        it("Evenly split ERC20 successfully", async function () {
            const payments = [addr1, addr2].map((a) => ({
                beneficiary: a.address,
                amount: 100,
            }));

            await splitSend.sendTokenToMultipleBeneficiaries(
                testGreeter.address,
                greetInterface.encodeFunctionData("greet", ["WOZAK"]),
                ttt.address,
                payments
            );
            const balances = await Promise.all([
                ttt.balanceOf(addr1.address),
                ttt.balanceOf(addr2.address),
            ]);
            expect(balances).to.eql([100, 100].map(BigNumber.from));
        });

        it("Unevenly split 150 ERC20s", async function () {
            const payments = [
                { beneficiary: addr1.address, amount: 50 },
                { beneficiary: addr2.address, amount: 100 },
            ];

            await splitSend.sendTokenToMultipleBeneficiaries(
                testGreeter.address,
                greetInterface.encodeFunctionData("greet", ["WOZAK"]),
                ttt.address,
                payments
            );

            const balances = await Promise.all([
                ttt.balanceOf(addr1.address),
                ttt.balanceOf(addr2.address),
            ]);
            expect(balances).to.eql([50, 100].map(BigNumber.from));
        });
    });
});
