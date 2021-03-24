

import "./interfaces/iGAME_ERC20.sol";
import "./openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/iGAME_Master.sol";
import "./NFTbase.sol";
contract bondingSale is NFTbase{
    using SafeMath for uint;
    iGAME_ERC20 public gameToken;
    iGAME_Master public gameAdmin;
    address GAMEFEE_RECEIVER;
    uint SIG_DIGITS=18;
    uint baseTokenDecimals=10**18;
    uint public MAX_PRICE;
    bool public mintingActive;
    mapping(uint=>uint) public curves;
    mapping(uint=>bool) public initialized;
    mapping(uint=>uint) public saleStarts;
    mapping(uint=>uint) public TokenSupply;
    mapping(uint=>uint) public multipliers;

    bool public mintingEnabled;
    uint public multiple=10**7;
    uint public nextTokenId;

    event PrintMinted(
        address indexed to,
        uint256 creator,
        uint256 id,
        uint256 indexed seed,
        uint256 pricePaid,
        uint256 nextPrintPrice,
        uint256 nextBurnPrice,
        uint256 printsSupply,
        uint256 royaltyPaid,
        uint256 reserve,
        address indexed royaltyRecipient
    );

    /**
     * @dev Emitted when an print is burned
     */
    event PrintBurned(
        address indexed to,
        uint256 creator,
        uint256 id,
        uint256 indexed seed,
        uint256 priceReceived,
        uint256 nextPrintPrice,
        uint256 nextBurnPrice,
        uint256 printsSupply,
        uint256 reserve
    );
  
    event TokenData(
        uint tokenId,
        string  json, 
        uint curve,
        uint multiplier
    );
    //event TokensBought();
    event TokenOnSale(uint id,uint date);
    constructor(address _gameToken,address _gameMaster) public NFTbase() {
      gameToken=iGAME_ERC20(_gameToken);
      gameAdmin=iGAME_Master(_gameMaster);
    }

    function getTokenID(uint _creatorID,uint token) internal returns(uint){
        return baseTokenDecimals*_creatorID+token;
    }
  

    function getBuyPrice(uint256 tokenId) public view returns(uint){
	      uint supply = TokenSupply[tokenId];
        return getPrintPrice(tokenId, supply+1);
    }
    function getSellPrice(uint256 tokenId) public view returns(uint) {
	      uint supply = TokenSupply[tokenId];
        return getPrintPrice(tokenId, supply).mul(90).div(100);
    }

    function getPrintPrice(uint256 tokenId, uint256 printNumber) public view 

     returns (uint256 price)
  {
    uint256 C = curves[tokenId];
      // C must be set at between 1 to 16;
      // 0 will throw, and above 16 will cause errors
    uint256 multiplier = multipliers[tokenId];
      // multiplier is 1 to 1000000, and lets us scale from
      // 1000x smaller to 1000x larger.
    uint256 decimals = 10 ** SIG_DIGITS; // Sig is 3.
      // sig digits ensures that we have more easily readable
      // and accurate numbers
    uint n=50;
    uint256 price = (printNumber ** 3).mul(decimals).div(9 ** C);
    price = price.add(printNumber.mul(decimals).div(C));
    price = price.add(n.mul(decimals)); 
    price = price.div(C).mul(multiplier).div(1000);
      // with a multiplier between 1 and 1000000
    price = price.mul(1 ether).div(decimals);
  }
  function CreateToken(uint creatorId,string memory json,uint curve,uint multiplier ) public {
      require(nextTokenId<1000000,"");
      require(curve > 0 && curve <= 20 && multiplier > 0 && multiplier <=1000000,"valid curve and multipliers");
      require(gameAdmin.isWorkerOrMinion(msg.sender)==true,"sender must be operator or worker");
      uint tokenId=creatorId*multiplier+nextTokenId;
      nextTokenId+=1;
      curves[tokenId]=curve;
      multipliers[tokenId]=multiplier;
      initialized[tokenId]=true;
      emit TokenData(tokenId,json,curve,multiplier);
  }
  function UpdateTokenData(uint tokenId,string memory json,uint curve,uint multiplier ) public {
   // require(balanceOf(tokenId)==0 && "");
    require(hasMinted(tokenId)==false,"token has not been minted");
    require(gameAdmin.isWorkerOrMinion(msg.sender)==true,"sender must be operator or worker");
    require(curve > 0 && curve <= 20 && multiplier > 0 && multiplier <=1000000,"valid curve and multipliers");
    require(bytes(json).length>1,"json must non null");
    require(initialized[tokenId]==true,"token must be initialized");
    uint creator= tokenId/multiple;
    curves[tokenId]=curve;
    multipliers[tokenId]=multiplier;
    emit TokenData(tokenId,json,curve,multiplier);
    
  }
  function SetTokenOnSaleDate(uint tokenId,uint onSaleDate) public {
       require(hasMinted(tokenId)==false,"token has been minted");
       require(curves[tokenId]>0,"curve must be set");
       require(onSaleDate>0,"sale date must be nonzero");
       require(initialized[tokenId]==true,"token must be initialized");
       require(gameAdmin.isWorkerOrMinion(msg.sender)==true,"sender must be operator or worker");
       if(onSaleDate==1){
           onSaleDate=block.timestamp;
       }
       saleStarts[tokenId]=onSaleDate;
       emit  TokenOnSale(tokenId, onSaleDate);
  }
  
  function buyNFTwithGAME(uint tokenId, uint maxPrice) public{
       require(block.timestamp>saleStarts[tokenId] && saleStarts[tokenId]>0,"");
       uint price=getPrintPrice(tokenId, TokenSupply[tokenId]);
       require(price > 0 && price < MAX_PRICE);
      TokenSupply[tokenId]+=1;
       gameToken.transferByContract(msg.sender, address(this), price);
       gameToken.transferByContract(address(this), msg.sender,maxPrice.sub(price));
       uint gamefee= price.div(50);
       uint creatorfee= (price.mul(10)).div(125);
       gameToken.transferByContract(address(this),GAMEFEE_RECEIVER,price);
       uint creatorID= tokenId/multiple;
       gameToken.transferByContract( address(this),address(creatorID), creatorfee);
       _mint(msg.sender, tokenId, 1, "");
  }
  function burn(uint tokenId) public{
    require(balanceOf(msg.sender,tokenId)>=1,"sender must have at least one token");
    uint price=getSellPrice(tokenId);
    TokenSupply[tokenId]-=1;
    _burn(msg.sender, tokenId, 1);
    gameToken.transferByContract(address(this), msg.sender,price);
  }

}