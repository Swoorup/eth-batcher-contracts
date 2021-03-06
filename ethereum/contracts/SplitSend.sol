// SPDX-License-Identifier: MIT
/* SplitSend contract for executing arbitary contract function calls + send value in a single transaction */
/* Swoorup Joshi 2021 */

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract SplitSend is Ownable, ReentrancyGuard {
  using Address for address payable;
  using SafeMath for uint256;

  struct Payment {
    uint256 amount;               // amount of Ethers(Wei) / ERC20 token to send
    address payable beneficiary;  // beneficiary address
  }

  /*
  * @dev Emitted on end of ether split payment transaction
  */
  event EtherPaymentSent(
    address indexed targetContract,
    bytes targetMessage,
    address indexed payer,
    uint256 indexed totalAmount
  );

  /*
  * @dev Emitted on end of ERC20 split payment transaction
  */
  event TokenPaymentSent(
    address indexed targetContract,
    bytes targetMessage,
    address indexed token,
    address indexed payer,
    uint256 totalAmount
  );

  /**
   * @notice Transfers all tokens of the input adress to the recipient. This is
   * useful tokens are accidentally sent to this contrasct
   * @param _tokenAddress address of token to send
   * @param _dest destination address to send tokens to
   */
  function withdrawToken(address _tokenAddress, address _dest) external onlyOwner {
    uint256 _balance = IERC20(_tokenAddress).balanceOf(address(this));
    SafeERC20.safeTransfer(IERC20(_tokenAddress), _dest, _balance);
  }

  /**
   * @notice Transfers all Ether to the specified address
   * @param _dest destination address to send ETH to
   */
  function withdrawEther(address payable _dest) external onlyOwner {
    uint256 _balance = address(this).balance;
    _dest.sendValue(_balance);
  }

  /**
   * @notice Send ether as well as execute message in the targetContract
   * @param targetContract address of target contract to call
   * @param targetMessage payload containing function and parameters to the target contract address
   * @param _payments array of payment data containing the amount and beneficiary to transfer value to
   * @dev Must be nonRentrant to prevent bugs described in https://consensys.net/diligence/blog/2019/09/stop-using-soliditys-transfer-now/
   */
  function sendEtherToMultipleBeneficiaries(address targetContract, bytes calldata targetMessage, Payment[] calldata _payments) external payable nonReentrant {
    uint256 _ethSentTotal = 0;

    for (uint256 i = 0; i < _payments.length; i++) {
      (bool paymentSuccess,) = _payments[i].beneficiary.call{ value: _payments[i].amount }("");
      if (!paymentSuccess) revert('Failed to make payment.');
      _ethSentTotal = _ethSentTotal.add(_payments[i].amount);
    }

    // Revert if the wrong amount of ETH was sent
    require(msg.value == _ethSentTotal, "amount sent not equal to payments amount sum");

    // execute the payload on the target contract
    (bool success,) = targetContract.call(targetMessage);
    if (!success) revert('transaction failed');

    emit EtherPaymentSent(targetContract, targetMessage, msg.sender, _ethSentTotal);
  }

  /**
   * @notice Send ERC20 token as well as execute message in the targetContract
   * @param targetContract address of target contract to call
   * @param targetMessage payload containing function and parameters to the target contract address
   * @param tokenAddress address of ERC20 token to split send
   * @param _payments array of payment data containing the amount and beneficiary to transfer value to
   */
  function sendTokenToMultipleBeneficiaries(address targetContract, bytes calldata targetMessage, address tokenAddress, Payment[] calldata _payments) external payable nonReentrant {
    uint256 _tokenSentTotal = 0;

    for (uint256 i = 0; i < _payments.length; i++) {
      SafeERC20.safeTransferFrom(IERC20(tokenAddress), msg.sender, _payments[i].beneficiary, _payments[i].amount);
      _tokenSentTotal = _tokenSentTotal.add(_payments[i].amount);
    }

    // execute the payload on the target contract
    (bool success,) = targetContract.call(targetMessage);
    if (!success) revert('transaction failed');

    emit TokenPaymentSent(targetContract, targetMessage, tokenAddress, msg.sender, _tokenSentTotal);
  }

  /**
   * @dev Transfers the current balance to the owner and terminates the contract.
   */
  function destroy() onlyOwner public {
    selfdestruct(payable(owner()));
  }

  function destroyAndSend(address payable _recipient) onlyOwner public {
    selfdestruct(_recipient);
  }
}