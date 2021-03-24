pragma solidity >=0.6.0 <0.8.0;

import "./ERC20Access.sol";
import "../interfaces/iSupportContract.sol";


// @title Game ERC20 Token Contract
// @dev Contract for managing the GAME ERC20 token
// @author GAME Credits Platform (https://www.gamecredits.org)
// (c) 2020 GAME Credits. All Rights Reserved. This code is not open source.
contract ERC20Contract is ERC20Access {
  using SafeMath for uint;
  string public url = "https://www.gamecredits.org";
  string public name = "GAME Credits";
  string public symbol = "GAME";
  uint8 public decimals = 18;

  // Listing of all the support contracts registered to this contract
  // @notice Support contracts can be added, but cannot be removed. If an erroneous one
  //   is added, it is up to users to not call it
  mapping (address => iSupportContract) supportContracts;

  event SupportContractAdded(address indexed supportContract);

  // @notice The constructor mints 200 million GAME tokens to the contract creator
  //   There is no other way to create GAME tokens, capping supply at 200 million
  constructor()
    public
  {
    _mint(msg.sender, 200 * 10 ** 24);
  }

 
  // @dev Used to set the support contract reference for this contract
  // @param _supportContract - the address of the support contract
  // @notice This is a one-shot function. Once the address is set, it's locked
  function setSupportContract(address _supportContract)
    external
    ownerOrRecovery
  {
    iSupportContract supportContract = iSupportContract(_supportContract);
    require(supportContract.isSupportContract(), "Must implement isSupportContract");
    supportContracts[_supportContract] = supportContract;
    emit SupportContractAdded(_supportContract);
  }

  // @dev Lets any user add funds to the supporting pool spread over a period of weeks
  // @param _rewardsContract - the contract that will be funded
  // @param _amount - the total amount of GAME tokens to add to the support pool
  // @param _startWeek - the first week in which tokens will be added to the support pool
  // @param _numberOfWeeks - the number of weeks over which the _amount will be spread
  // @notice - The _amount must be exactly divisible by the _numberOfWeeks
  function fundRewardsContract(address _rewardsContract, uint _amount, uint _startWeek, uint _numberOfWeeks)
    external
  {
    iSupportContract rewardsContract = _getSupportContract(_rewardsContract);
    _transfer(msg.sender, address(rewardsContract), _amount);
    rewardsContract.fundRewardsPool(_amount, _startWeek, _numberOfWeeks);
  }

  // @dev Sets the sender's support on a game to the specific value
  // @param _rewardsContract - the contract that will set support
  // @param _game - the game to be supported
  // @param _increase - the amount support to be added
  // @notice - this will throw if the user has insufficient tokens available
  // @notice - this does not throw on an _amount of 0
  function setSupport(address _rewardsContract, uint _game, uint _amount) public {
    iSupportContract rewardsContract = _getSupportContract(_rewardsContract);
    _setSupport(rewardsContract, msg.sender, _game, _amount);
  }

  // @dev Increases the sender's support on a game
  // @param _rewardsContract - the contract that will increase support
  // @param _game - the game to be supported
  // @param _increase - the amount support to be added
  // @notice - this will throw if the user has insufficient tokens available
  // @notice - this will throw if an increase of 0 is requested
  function increaseSupport(address _rewardsContract, uint _game, uint _increase) public {
    iSupportContract rewardsContract = _getSupportContract(_rewardsContract);
    uint supportBalance = rewardsContract.getGameAccountSupport(_game, msg.sender);
    require(_increase > 0, "can't increase by 0");
    _setSupport(rewardsContract, msg.sender, _game, supportBalance.add(_increase));
  }

  // @dev Reduces the sender's support on a game
  // @param _rewardsContract - the contract that will decrease support
  // @param _game - the game to be supported
  // @param _decrease - the amount support to be reduced
  // @notice - this will throw if the user has fewer tokens support
  // @notice - this will throw if a decrease of 0 is requested
  function decreaseSupport(address _rewardsContract, uint _game, uint _decrease) public {
    iSupportContract rewardsContract = _getSupportContract(_rewardsContract);
    uint supportBalance = rewardsContract.getGameAccountSupport(_game, msg.sender);
    require(_decrease > 0, "can't decrease by 0");
    _setSupport(rewardsContract, msg.sender, _game, supportBalance.sub(_decrease));
  }

  // @dev Transfers tokens to a set of user accounts, and sets their support for them
  // @param _rewardsContract - the contract that will set the support
  // @param _recipients - the accounts to receive the tokens
  // @param _games - the games to be supported
  // @param _amounts - the amount of tokens to be transferred
  // @notice - this function is designed for air dropping by/to a game
  function airDropAndSupport(
    address _rewardsContract,
    address[] calldata _recipients,
    uint[] calldata _games,
    uint[] calldata _amounts
  )
    external
  {
    iSupportContract rewardsContract = _getSupportContract(_rewardsContract);
    require(_recipients.length == _games.length, "must be equal number of recipients and games");
    require(_recipients.length == _amounts.length, "must be equal number of recipients and amounts");
    for (uint i = 0; i < _recipients.length; i++) {
      require(_recipients[i] != msg.sender, "can't airDrop to your own account");
      uint supportBalance = rewardsContract.getGameAccountSupport(_games[i], _recipients[i]);
      uint supportAmount = _amounts[i].add(supportBalance);
      _transfer(msg.sender, _recipients[i], _amounts[i]);
      _setSupport(rewardsContract, _recipients[i], _games[i], supportAmount);
    }
  }

  // @dev Pays an amount of game credits to a given support contract.
  //   The support contract will often route the payment to multiple destinations.
  //   The exact functionality will depend on the support contract in question.
  //   Not all support contracts will implement the receiveGameCredits function
  // @param _supportContract - the support contract to be called
  // @param _game - a field to enter a game Id if it is required by the support contract
  // @param _tokenId - a field to enter a token Id if it is required by the support contract
  // @param _payment - the amount of GAME Credits that will be paid
  // @param _data - a field to enter additional data if it is required by the support contract
  function payGameCredits(
    address _supportContract,
    uint _game,
    uint _tokenId,
    uint _payment,
    bytes32 _data
  )
    external
  {
    iSupportContract supportContract = _getSupportContract(_supportContract);

    _transfer(msg.sender, _supportContract, _payment);
    supportContract.receiveGameCredits(_game, msg.sender, _tokenId, _payment, _data);
  }

  // @dev Requests a payment of an amount of Loyalty Points in the sidechain.
  //   The payment is made on the sidechain by the oracle.
  //   There is no error checking, other than ensuring the game exists.
  //   The exact functionality will depend on the oracle, and the sidechain contract in question.
  //   Not all support contracts will implement the payLoyaltyPoints function, and even
  //     if they do, the oracle might not pick it up.
  // @param _supportContract - the support contract to be called
  // @param _game - a field to enter a game Id if it is required by the support contract
  // @param _tokenId - a field to enter a token Id if it is required by the support contract
  // @param _payment - the amount of Loyalty Points requested to be paid
  // @param _data - a field to enter additional data if it is required by the support contract
  function payLoyaltyPoints(
    address _supportContract,
    uint _game,
    uint _tokenId,
    uint _loyaltyPayment,
    bytes32 _data
  )
    external
  {
    iSupportContract supportContract = _getSupportContract(_supportContract);
    supportContract.receiveLoyaltyPayment(_game, msg.sender, _tokenId, _loyaltyPayment, _data);
  }

  // @dev Pays an amount of game credits to a given support contract.
  //   The support contract will often route the payment to multiple destinations.
  //   The exact functionality will depend on the support contract in question.
  //   Not all support contracts will implement the contestEntry function
  // @param _supportContract - the support contract to be called
  // @param _game - a field to enter a game Id if it is required by the support contract
  // @param _tokenId - a field to enter a token Id if it is required by the support contract
  // @param _contestId - a field to enter a contest Id if it is required by the support contract
  // @param _payment - the amount of GAME Credits that will be paid
  // @param _data - a field to enter additional data if it is required by the support contract
  function enterContest(
    address _supportContract,
    uint _game,
    uint _tokenId,
    uint _contestId,
    uint _payment,
    bytes32 _data
  )
    external
  {
    iSupportContract supportContract = _getSupportContract(_supportContract);
    _transfer(msg.sender, _supportContract, _payment);
    supportContract.contestEntry(_game, msg.sender, _tokenId, _contestId, _payment, _data);
  }

  // @dev returns the iSupportContract for the input address. Throws if it doesn't exist.
  // @param _contractAddress - the address to test
  // @returns iSupportContract - the support contract address, typed as iSupportContract
  function _getSupportContract(address _contractAddress)
    internal
    view
  returns (iSupportContract)
  {
    iSupportContract supportContract = supportContracts[_contractAddress];
    require(address(supportContract) != address(0), "support contract must be valid");
    return supportContract;
  }

  // @dev Sends the new support level to the rewards contract; transfers tokens to the
  //   contract (for increased support) or from the contract (for decreased support)
  // @param iSupportContract - the contract that will set the support
  // @param _supporter - the account doing the supporting
  // @param _game - the game to be supported
  // @param _amount - the amount of tokens to set the support to
  function _setSupport(iSupportContract rewardsContract, address _supporter, uint _game, uint _amount)
    internal
  {
    // get user's balance from rewards contract
    uint supportBalance = rewardsContract.getGameAccountSupport(_game, _supporter);

    if (_amount == supportBalance) {
      return;
    } else if (_amount > supportBalance) {
      // transfer diff to rewards contract
      _transfer(_supporter, address(rewardsContract), _amount.sub(supportBalance));
    } else if (_amount < supportBalance) {
      // transfer diff to account
      _transfer(address(rewardsContract), _supporter, supportBalance.sub(_amount));
    }
    rewardsContract.updateSupport(_game, _supporter, _amount);
  }
}