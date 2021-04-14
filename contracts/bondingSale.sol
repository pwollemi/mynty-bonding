import "./interfaces/iGAME_ERC20.sol";
//import "./openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/iGAME_Game.sol";
import "./interfaces/iGAME_Master.sol";
import "./NFTbase.sol";
import "./WorkerMetaTransactions.sol";
import "hardhat/console.sol";

contract bondingSale is NFTbase, WorkerMetaTransactions {
    using SafeMath for uint256;
    bool public mintingActive;
    bool public burningActive;

    uint256 SIG_DIGITS = 3;

    uint256 baseTokenDecimals = 10**18;

    uint256 public MAX_PRICE = 10**18 * 10**18;

    address GAMEFEE_RECEIVER;
    iGAME_ERC20 public gameToken;
    iGAME_Game public gameAdmin;
    iGAME_Master public masterContract;
    mapping(uint256 => uint256) public curves;
    mapping(uint256 => bool) public initialized;
    mapping(uint256 => uint256) public saleStarts;
    mapping(uint256 => uint256) public TokenSupply;
    mapping(uint256 => uint256) public multipliers;
    mapping(uint256 => uint256) public nextTokenIDs;

    uint256 public multiple = 10**7;
    uint256 public nextTokenId;

    event TokenData(
        uint256 tokenId,
        string json,
        uint256 curve,
        uint256 multiplier
    );
    //event TokensBought();
    event TokenOnSale(uint256 id, uint256 date);
    //event TokenBought(uint256 id, address account, uint256 supply);
    event TokenBought(
        address indexed to,
        uint256 id,
        uint256 pricePaid,
        uint256 nextPrintPrice,
        uint256 nextBurnPrice,
        uint256 tokenSupply,
        uint256 royaltyPaid,
        uint256 reserve,
        address indexed royaltyRecipient
    );

    /**
     * @dev Emitted when an print is burned
     */
    event TokenBurned(
        address indexed to,
        uint256 id,
        uint256 priceReceived,
        uint256 nextPrintPrice,
        uint256 nextBurnPrice,
        uint256 printsSupply,
        uint256 reserve
    );

    constructor(address _gameToken, address _gameMaster)
        public
        NFTbase("test")
        NetworkAgnostic("bonding", "1")
    {
        gameToken = iGAME_ERC20(_gameToken);
        gameAdmin = iGAME_Game(_gameMaster);
    }

    function toggleTokenMinting() public isGlobalAdmin() {
        mintingActive = !mintingActive;
    }

    function metaTxSenderIsWorkerOrMinion() internal override returns (bool) {
        return masterContract.makeFundedCall(msg.sender);
    }

    function updateLocalContract(address contract_, bool isLocal_)
        external
        override
    {
        //require(contract_ != address(masterContract), "can't reset the master contract");
        //require(contract_ != address(erc721Contract), "can't reset the erc721 contract");
        // require(contract_ != address(0), "can't be the zero address");
        //localContracts[contract_] = isLocal_;
    }

    function creatorAddress(uint256 c) public view returns (address) {
        return address(c);
    }

    function toggleTokenBurning() public isGlobalAdmin() {
        burningActive = !burningActive;
    }

    function getNextTokenID(uint256 creator) public view returns (uint256) {
        return nextTokenIDs[creator];
    }

    function getTokenID(uint256 _creatorID, uint256 token)
        public
        view
        returns (uint256)
    {
        return baseTokenDecimals * _creatorID + token;
    }

    function setFEERECEIVER(address a) public isGlobalAdmin() {
        GAMEFEE_RECEIVER = a;
    }

    function getBuyPrice(uint256 tokenId) public view returns (uint256) {
        uint256 supply = TokenSupply[tokenId];
        return getPrintPrice(tokenId, supply + 1);
    }

    function getSellPrice(uint256 tokenId) public view returns (uint256) {
        uint256 supply = TokenSupply[tokenId];
        return getPrintPrice(tokenId, supply).mul(90).div(100);
    }

    function getPrintPrice(uint256 tokenId, uint256 printNumber)
        public
        view
        returns (uint256 price)
    {
        uint256 C = curves[tokenId];
        // C must be set at between 1 to 16;
        // 0 will throw, and above 16 will cause errors
        uint256 multiplier = multipliers[tokenId];
        // multiplier is 1 to 1000000, and lets us scale from
        // 1000x smaller to 1000x larger.
        uint256 decimals = 10**SIG_DIGITS; // Sig is 3.
        // sig digits ensures that we have more easily readable
        // and accurate numbers
        uint256 n = 50;
        uint256 price = (printNumber**3).mul(decimals).div(9**C);
        //console.log(price);
        price = price.add(printNumber.mul(decimals).div(C));
        //console.log(price);
        price = price.add(n.mul(decimals));
        //console.log(price);
        price = price.div(C).mul(multiplier).div(1000);
        //console.log(price);

        // with a multiplier between 1 and 1000000
        price = (price.mul(1 ether)).div(decimals);
        return price;
        //console.log(price);
    }

    // switch isWorkerOrMinion to isOperatorOrMinion
    function CreateToken(
        uint256 creatorId,
        string memory json,
        uint256 curve,
        uint256 multiplier
    ) public {
        nextTokenIDs[creatorId] += 1;
        uint256 nextTokenId = getNextTokenID(creatorId);

        require(nextTokenId < 1000000, "max token of 1000000");
        require(
            curve > 0 && curve <= 20 && multiplier > 0 && multiplier <= 1000000,
            "valid curve and multipliers"
        );
        require(bytes(json).length > 1, "json must non null");
        require(
            gameAdmin.isOperatorOrMinion(creatorId, _msgSender()) == true,
            "sender must be minion or worker"
        );

        uint256 tokenId = getTokenID(creatorId, nextTokenId);

        curves[tokenId] = curve;
        multipliers[tokenId] = multiplier;
        initialized[tokenId] = true;
        emit TokenData(tokenId, json, curve, multiplier);
    }

    function UpdateTokenData(
        uint256 tokenId,
        string memory json,
        uint256 curve,
        uint256 multiplier
    ) public {
        // require(balanceOf(tokenId)==0 && "");
        uint256 creator = tokenId / baseTokenDecimals;
        require(hasMinted(tokenId) == false, "token has not been minted");
        //
        require(
            gameAdmin.isOperatorOrMinion(creator, _msgSender()) == true,
            "sender must be operator or worker"
        );
        require(
            curve > 0 && curve <= 20 && multiplier > 0 && multiplier <= 1000000,
            "invalid curve or multipliers"
        );
        require(bytes(json).length > 1, "json must non null");
        //require(initialized[tokenId] == true, "token must be initialized");
        require(curves[tokenId] > 0, "curve must be set");
        curves[tokenId] = curve;
        multipliers[tokenId] = multiplier;
        emit TokenData(tokenId, json, curve, multiplier);
    }

    function SetTokenOnSaleDate(uint256 tokenId, uint256 onSaleDate) public {
        require(hasMinted(tokenId) == false, "token has not been minted");
        require(curves[tokenId] > 0, "curve must be set");
        //require(onSaleDate > 0, "sale date must be nonzero");
        //require(initialized[tokenId] == true, "token must be initialized");
        uint256 creator = tokenId / baseTokenDecimals;
        require(
            gameAdmin.isOperatorOrMinion(creator, _msgSender()) == true,
            "sender must be operator or worker"
        );
        if (onSaleDate < block.timestamp && onSaleDate > 0) {
            onSaleDate = block.timestamp;
        }
        saleStarts[tokenId] = onSaleDate;
        emit TokenOnSale(tokenId, onSaleDate);
    }

    function buyNFTwithGAME(uint256 tokenId, uint256 maxPrice) public {
        require(
            block.timestamp > saleStarts[tokenId] && saleStarts[tokenId] > 0,
            "sale has not started yet"
        );
        uint256 creatorID = tokenId / baseTokenDecimals;
        uint256 price = getBuyPrice(tokenId);
        require(price > 0 && price <= maxPrice, "invalid price");
        TokenSupply[tokenId] += 1;

        gameToken.transferByContract(_msgSender(), address(this), price);

        uint256 gamefee = price.div(50);
        uint256 creatorfee = (price.mul(8)).div(100);

        _mint(_msgSender(), tokenId, 1, "");

        //emit TokenBought(tokenId, msg.sender, TokenSupply[tokenId]);
        emit TokenBought(
            _msgSender(),
            tokenId,
            price,
            getBuyPrice(tokenId),
            getSellPrice(tokenId),
            TokenSupply[tokenId],
            creatorfee,
            gameToken.balanceOf(address(this)),
            address(creatorID)
        );
        gameToken.transferByContract(address(this), GAMEFEE_RECEIVER, gamefee);
        gameToken.transferByContract(
            address(this),
            address(creatorID),
            creatorfee
        );
    }

    function burn(uint256 tokenId) public {
        require(
            balanceOf(msg.sender, tokenId) >= 1,
            "sender must have at least one token"
        );
        uint256 price = getSellPrice(tokenId);
        TokenSupply[tokenId] -= 1;
        _burn(_msgSender(), tokenId, 1);
        emit TokenBurned(
            _msgSender(),
            tokenId,
            price,
            getBuyPrice(tokenId),
            getSellPrice(tokenId),
            TokenSupply[tokenId],
            gameToken.balanceOf(address(this))
        );
        gameToken.transferByContract(address(this), _msgSender(), price);
    }
}
