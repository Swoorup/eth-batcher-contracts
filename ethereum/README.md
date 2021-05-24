# Content

## Ethereum SplitSend contract

`SplitSend.sol` - contract to allow batching payments of ERC20 or Ethers as well as execute function calls to a specific target contract.

This is useful for

- direct payment of multiple recipient addresses
- calling a smart contract function (such as withdrawing from a liquidity pool or a call to a dex exchange) and split the resulting payment to multiple recipients in one go.

The [solidity code](https://github.com/Swoorup/eth-batcher-contracts/blob/master/contracts/SplitSend.sol) is here.

The contract contains 2 functions to split ethereum or ERC20 tokens and send as a batch, while also allowing to execute a target contract with the payload.

The functions are:

- `function sendEtherToMultipleBeneficiaries(address targetContract, bytes calldata targetMessage, Payment[] calldata _payments) external payable nonReentrant`

  - Send ethers to an array of payment struct of payable address and amount.
  - Amount of ether sent to this contract must equal the sum of payment amount of all beneficiaries or entire transaction is reverted.

- `function sendTokenToMultipleBeneficiaries(address targetContract, bytes calldata targetMessage, address tokenAddress, Payment[] calldata _payments) external payable nonReentrant`

  - Send ERC20 tokens to an array of payment struct of payable address and amount.
  - The msg.sender must approve this contract to spend at least the total sum of payment amount of all beneficiaries.

### Usage

Install the package `npm install @sytherax/eth-batcher-contracts` in your contracts npm folder.

And use it in your contract for example:

```sol
pragma solidity ^0.8.0;
import "@sytherax/eth-batcher-contracts/contracts/SplitSend.sol";

contract MyContract is SplitSend { }
```

### Building

#### Install Dependencies

```shell
npm install
```

#### Testing

```shell
npm test
```


### Contract Deployment

If running locally you can execute to deploy all deployments inside `deploy` folder to localhost network like follows.

```shell
npx hardhat deploy --network localhost
```

If you want to deploy test contracts for the web3 examples to run. You can run all deploys with the tag `dev`

```shell
npx hardhat deploy --network localhost --tags dev
```

For mainnet launch, you would want to do something like follows:

```shell
npx hardhat deploy --network mainnet --tags prod
```
