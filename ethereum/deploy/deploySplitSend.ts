import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, ethers } = hre;
  const {deploy} = deployments;

  const [owner, _] = await ethers.getSigners();

  await deploy('SplitSend', {
    from: owner.address,
    args: [],
    log: true,
  });
};
export default func;
func.tags = ['dev','prod'];
