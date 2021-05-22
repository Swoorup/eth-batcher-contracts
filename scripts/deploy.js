require("dotenv").config();

const hre = require("hardhat");

async function main() {
  const Contract = await ethers.getContractFactory("SplitSend");
  [owner, investor] = await ethers.getSigners();
  console.log("contract deployer address:", owner.address);

  const contract = await Contract.deploy();
  await contract.deployed();
  console.log("contract deployed address:", contract.address);

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
