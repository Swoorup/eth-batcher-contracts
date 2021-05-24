require("dotenv").config({ path: require("find-config")(".env") });
const { RPC_URL, SPLITSEND_ADDRESS, TESTGREETER_ADDRESS } = process.env;

const Web3 = require("web3");
const web3 = new Web3(Web3.givenProvider || RPC_URL);

const splitSendArtifact = require("../ethereum/artifacts/contracts/SplitSend.sol/SplitSend.json");
const testGreeterArtifact = require("../ethereum/artifacts/contracts/TestGreeter.sol/TestGreeter.json");

async function main() {
    // web3.eth.getAccounts(console.log);
    const accounts = await web3.eth.getAccounts();

    // instantiate contract instance and assign to component ref variable
    const splitSendContract = new web3.eth.Contract(
        splitSendArtifact.abi,
        SPLITSEND_ADDRESS,
        { from: accounts[0] }
    );
    const greeterContract = new web3.eth.Contract(
        testGreeterArtifact.abi,
        TESTGREETER_ADDRESS,
        { from: accounts[0] }
    );

    const greetEncoded = greeterContract.methods.greet("SWOORUP").encodeABI();

    splitSendContract.events.EtherPaymentSent(
        {
            filter: { targetContract: TESTGREETER_ADDRESS },
            fromBlock: 0,
        },
        function (_, event) {
            console.log(event);
        }
    )
    .on("data", function (event) {
        console.log(event); // same results as the optional callback above
    })
    .on("changed", function (event) {
        // remove event from local database
    })
    .on("error", console.error);

    splitSendContract.methods
        .sendEtherToMultipleBeneficiaries(TESTGREETER_ADDRESS, greetEncoded, [
            { amount: 0x1, beneficiary: accounts[0] },
        ])
        .send({ from: accounts[0], value: 0x1 })
        .then((result) => console.log(result));
}

main();
