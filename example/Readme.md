# Content

This is a Web3 example on running the SplitSend contracts via javascript. It

## Prequisities

1. Ethereum node. This can be run from the ethereum folder on the localhost network using the following
   1. Go to ethereum directory.
   2. Run `npx hardhat node`
2. Deployed Smart Contracts. The example uses `SplitSold` and `TestGreeter` contracts from the ethereum folder.
   1. Go to ethereum directory.
   2. Run `npx hardhat deploy --network localhost --tags dev`
   3. This will deploy all contracts with the tag `dev` to the localhost node.
   4. Note down the contract address.
3. `.env` file containing the following (Use the address obtained from Step 2):
   - `RPC_URL` - websocket url of the node
   - `SPLITSEND_ADDRESS` - Address of the SplitSend.sol contract.
   - `TESTGREETER_ADDRESS` - Address of the TestGreeter.sol contract.

It should also be possible to use an external network like ropsten, rinkeby by modifying step3 above.

## Running the example

```shell
npm install
npm start
```
