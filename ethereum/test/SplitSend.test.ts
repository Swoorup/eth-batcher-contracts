import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { PayableOverrides } from "@ethersproject/contracts";
import { BigNumber, Contract } from "ethers";

const MAX_UINT256 = ethers.constants.MaxUint256;
const parseEther = ethers.utils.parseEther;

const getEtherBalances = (addresses: SignerWithAddress[]) => 
    Promise.all(addresses.map(address => address.getBalance()));

const getERC20Balances = (contract: Contract, addresses: SignerWithAddress[]) => 
    Promise.all(addresses.map(address => contract.balanceOf(address.address)));

describe("SplitSend", function () {
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;
    let splitSend: Contract;
    let testGreeter: Contract;

    const greetInterface = new ethers.utils.Interface([
        "function greet(string memory who) public view",
        "function fail() public pure",
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

    describe("Test splitting Ethers", () => {
        it("Try sending insufficient ether amount lesser than sum of beneficiaries payment amount", async function () {
            const payments = [addr1, addr2].map((addr) => ({ beneficiary: addr.address, amount: parseEther("100"), }));
            const overrides: PayableOverrides = { value: parseEther("100"), };

            const initialBalances = await getEtherBalances([addr1, addr2]);
            await expect(splitSend.sendEtherToMultipleBeneficiaries(
                testGreeter.address,
                greetInterface.encodeFunctionData("greet", ["WOZAK"]),
                payments,
                overrides
            )).to.be.revertedWith("Failed to make payment");

            const finalBalances = await getEtherBalances([addr1, addr2]);

            const difference = finalBalances.map((v, i) => v.sub(initialBalances[i]));
            expect(difference).to.eql(["0", "0"].map(parseEther));
        });

        it("Try sending excess ether amount greater than sum of beneficiaries payment amount", async function () {
            const payments = [addr1, addr2].map((addr) => ({ beneficiary: addr.address, amount: parseEther("1"), }));

            // value sent should be 2 instead, but we try to send 10 ethers
            const overrides: PayableOverrides = { value: parseEther("10"), };

            const initialBalances = await getEtherBalances([addr1, addr2]);
            await expect(splitSend.sendEtherToMultipleBeneficiaries(
                testGreeter.address,
                greetInterface.encodeFunctionData("greet", ["WOZAK"]),
                payments,
                overrides
            )).to.be.revertedWith("amount sent not equal to payments amount sum");

            const finalBalances = await getEtherBalances([addr1, addr2]);

            const difference = finalBalances.map((v, i) => v.sub(initialBalances[i]));
            expect(difference).to.eql(["0", "0"].map(parseEther));
        });

        it("Try to evenly split 200 ethers to 2 beneficiaries", async function () {
            const payments = [addr1, addr2].map((a) => ({
                beneficiary: a.address,
                amount: parseEther("100"),
            }));

            const overrides: PayableOverrides = { value: parseEther("200"), };
            const initialBalances = await getEtherBalances([addr1, addr2]);
            const result = await splitSend.sendEtherToMultipleBeneficiaries(
                testGreeter.address,
                greetInterface.encodeFunctionData("greet", ["WOZAK"]),
                payments,
                overrides
            );

            expect(result)
                .to.emit(splitSend, 'EtherPaymentSent')
                .withArgs(
                    testGreeter.address,
                    greetInterface.encodeFunctionData("greet", ["WOZAK"]),
                    owner.address,
                    parseEther("200")
                );

            const finalBalances = await getEtherBalances([addr1, addr2]);
            const difference = finalBalances.map((v, i) => v.sub(initialBalances[i]));
            expect(difference).to.eql(["100", "100"].map(parseEther));
        });

        it("Try to unevenly split 200 ethers to 2 beneficiaries", async function () {
            const payments = [
                { beneficiary: addr1.address, amount: parseEther("50"), },
                { beneficiary: addr2.address, amount: parseEther("100"), },
            ];

            const overrides: PayableOverrides = { value: parseEther("150"), };
            const initialBalances = await getEtherBalances([addr1, addr2]);

            const result = await splitSend.sendEtherToMultipleBeneficiaries(
                testGreeter.address,
                greetInterface.encodeFunctionData("greet", ["WOZAK"]),
                payments,
                overrides
            );

            expect(result)
                .to.emit(splitSend, 'EtherPaymentSent')
                .withArgs(
                    testGreeter.address,
                    greetInterface.encodeFunctionData("greet", ["WOZAK"]),
                    owner.address,
                    parseEther("150")
                );


            const finalBalances = await getEtherBalances([addr1, addr2]);
            const difference = finalBalances.map((v, i) => v.sub(initialBalances[i]));

            expect(difference).to.eql(["50", "100"].map(parseEther));
        });

        it("Try to send ether successfully but fail callback contract payload", async function () {
            const payments = [ { beneficiary: addr1.address, amount: parseEther("1"), }, ];

            const overrides: PayableOverrides = { value: parseEther("1"), };
            const initialBalance = await addr1.getBalance();
            await expect(splitSend.sendEtherToMultipleBeneficiaries(
                testGreeter.address,
                greetInterface.encodeFunctionData("fail", []),
                payments,
                overrides
            )).to.be.revertedWith("transaction failed");
            const finalBalance = await addr1.getBalance();
            const difference = finalBalance.sub(initialBalance);

            // no ether amount should be transferred in this case.
            expect(difference).to.equal(parseEther("0"));
        });
    });

    describe("Test splitting ERC20 tokens", () => {
        // test token
        let tttErc20: Contract;

        beforeEach(async function () {
            const TTTERC20 = await ethers.getContractFactory("TestToken");
            tttErc20 = await TTTERC20.deploy("Test Token", "TTT");

            await tttErc20.deployed();
        });

        it("Try sending token exceeding total supply to beneficiaries", async function () {
            // allow the smart contract to spend on behalf of the owner
            await tttErc20.approve(splitSend.address, MAX_UINT256);

            const payments = [addr1, addr2].map((a) => ({
                beneficiary: a.address,
                amount: 100000000,
            }));

            await expect(splitSend.sendTokenToMultipleBeneficiaries(
                testGreeter.address,
                greetInterface.encodeFunctionData("greet", ["WOZAK"]),
                tttErc20.address,
                payments
            )).to.be.revertedWith("ERC20: transfer amount exceeds balance");

            const balances = await getERC20Balances(tttErc20, [addr1, addr2]);
            expect(balances).to.eql([0, 0].map(BigNumber.from));
        });

        it("Try sending token exceeding allowed approved amount to beneficiaries", async function () {
            // allow the smart contract to spend on behalf of the owner
            await tttErc20.approve(splitSend.address, 2);

            const payments = [addr1, addr2].map((a) => ({
                beneficiary: a.address,
                amount: 10,
            }));

            await expect(splitSend.sendTokenToMultipleBeneficiaries(
                testGreeter.address,
                greetInterface.encodeFunctionData("greet", ["WOZAK"]),
                tttErc20.address,
                payments
            )).to.be.revertedWith("ERC20: transfer amount exceeds allowance");

            const balances = await getERC20Balances(tttErc20, [addr1, addr2]);
            expect(balances).to.eql([0, 0].map(BigNumber.from));
        });

        it("Try send token amounts only sufficiant for 1 beneficiary out of 2 beneficiaries", async function () {
            // allow the smart contract to spend on behalf of the owner
            await tttErc20.approve(splitSend.address, 2);

            const payments = [
                { beneficiary: addr1.address, amount: 2 },
                { beneficiary: addr2.address, amount: 1 },
            ];

            await expect(splitSend.sendTokenToMultipleBeneficiaries(
                testGreeter.address,
                greetInterface.encodeFunctionData("greet", ["WOZAK"]),
                tttErc20.address,
                payments
            )).to.be.revertedWith("ERC20: transfer amount exceeds allowance");

            const balances = await getERC20Balances(tttErc20, [addr1, addr2]);
            expect(balances).to.eql([0, 0].map(BigNumber.from));
        });

        it("Try to evenly split 2 tokens to 2 beneficiaries", async function () {
            // allow the smart contract to spend on behalf of the owner
            await tttErc20.approve(splitSend.address, 2);

            const payments = [addr1, addr2].map((a) => ({
                beneficiary: a.address,
                amount: 1,
            }));

            const result = await splitSend.sendTokenToMultipleBeneficiaries(
                testGreeter.address,
                greetInterface.encodeFunctionData("greet", ["WOZAK"]),
                tttErc20.address,
                payments
            );

            expect(result)
                .to.emit(splitSend, 'TokenPaymentSent')
                .withArgs(
                    testGreeter.address,
                    greetInterface.encodeFunctionData("greet", ["WOZAK"]),
                    tttErc20.address,
                    owner.address,
                    2);

            const balances = await getERC20Balances(tttErc20, [addr1, addr2]);
            expect(balances).to.eql([1, 1].map(BigNumber.from));
        });

        it("Try to unevenly split 2 tokens to 2 beneficiaries", async function () {
            // allow the smart contract to spend on behalf of the owner
            await tttErc20.approve(splitSend.address, 3);

            const payments = [
                { beneficiary: addr1.address, amount: 2 },
                { beneficiary: addr2.address, amount: 1 },
            ];

            const result = await splitSend.sendTokenToMultipleBeneficiaries(
                testGreeter.address,
                greetInterface.encodeFunctionData("greet", ["WOZAK"]),
                tttErc20.address,
                payments
            );

            expect(result)
                .to.emit(splitSend, 'TokenPaymentSent')
                .withArgs(
                    testGreeter.address,
                    greetInterface.encodeFunctionData("greet", ["WOZAK"]),
                    tttErc20.address,
                    owner.address,
                    3);

            const balances = await getERC20Balances(tttErc20, [addr1, addr2]);
            expect(balances).to.eql([2, 1].map(BigNumber.from));
        });

        it("Try to send ERC20 tokens successfully but fail callback contract payload", async function () {
            // allow the smart contract to spend on behalf of the owner
            await tttErc20.approve(splitSend.address, 3);
            const payments = [ { beneficiary: addr1.address, amount: 1 }, ];
            
            await expect(splitSend.sendTokenToMultipleBeneficiaries(
                testGreeter.address,
                greetInterface.encodeFunctionData("fail", []),
                tttErc20.address,
                payments
            )).to.be.revertedWith("transaction failed");
            const balance = await tttErc20.balanceOf(addr1.address);

            // no ERC20 token amount should be transferred in this case.
            expect(balance).to.equal(0);
        });
    });
});
