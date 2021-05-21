//SPDX-License-Identifier: MIT
/* Test contract to test calling the greet function via SplitSend contract */
pragma solidity ^0.8.0;

import "hardhat/console.sol";

contract TestGreeter {
  constructor() {
  }

  function greet(string memory who) public view {
    console.log("Hello", who);
  }
  
  function fail() public pure  {
    revert("Failed to greet");
  }
}
