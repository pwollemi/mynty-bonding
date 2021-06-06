// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import "./interfaces/iGAME_ERC20.sol";
import "./interfaces/iGAME_Game.sol";
import "./interfaces/iGAME_Master.sol";
import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IDiamondCut.sol";
import "./interfaces/IDiamondLoupe.sol";
import "./interfaces/IERC173.sol";
import "./libraries/LibDiamond.sol";
import "./NFTbase.sol";
import "./openzeppelin/contracts/math/SafeMath.sol";

import "hardhat/console.sol";

/// @title GameCreditsBondedNFTS
/// @author Paul Barclay, Daniel Lee
/// @notice You can use this contract for bonded NFT sales
/// @dev All function calls are currently implemented without side effects
contract BondingSale is NFTbase {
    using SafeMath for uint256;

    uint256 baseTokenDecimals = 10**18;
    uint256 SIG_DIGITS = 3;

    address public wMatic = 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270;
    address public quick = 0x831753DD7087CaC61aB5644b308642cc1c33Dc13;

    bool public burningActive;
    bool public mintingActive;
    uint256 public MAX_PRICE = 10**18 * 10**18;
    uint256 public multiple = 10**7;

    address GAMEFEE_RECEIVER;
    iGAME_ERC20 public gameToken;
    iGAME_Game public gameAdmin;
    IUniswapV2Router02 public uniswapRouter;

    mapping(uint256 => uint256) public curves;
    mapping(uint256 => uint256) public saleStarts;
    mapping(uint256 => uint256) public TokenSupply;
    mapping(uint256 => uint256) public multipliers;
    mapping(uint256 => uint256) public nextTokenIDs;
    mapping(address => uint256) internal userLatestBlock;

    event TokenData(
        uint256 tokenId,
        string json,
        uint256 curve,
        uint256 multiplier
    );
    event TokenOnSale(uint256 id, uint256 date);
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
    event TokenBurned(
        address indexed to,
        uint256 id,
        uint256 priceReceived,
        uint256 nextPrintPrice,
        uint256 nextBurnPrice,
        uint256 printsSupply,
        uint256 reserve
    );

    // more arguments are added to this struct
    // this avoids stack too deep errors
    struct DiamondArgs {
        address gameToken;
        address gameAdmin;
        address gameMaster;
    }

    constructor(IDiamondCut.FacetCut[] memory _diamondCut, DiamondArgs memory _args)
        NFTbase("test")
        payable 
     {
        LibDiamond.diamondCut(_diamondCut, address(0), new bytes(0));

        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        // constructor arguments
        gameToken = iGAME_ERC20(_args.gameToken);
        gameAdmin = iGAME_Game(_args.gameAdmin);
        ds.masterContract = iGAME_Master(_args.gameMaster);

        ds.CONTRACT_ERC712_VERSION = "1";
        ds.CONTRACT_ERC712_NAME = "GAME Bonding Curves";

        // adding ERC165 data
        ds.supportedInterfaces[type(IERC165).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;
        ds.supportedInterfaces[type(IERC173).interfaceId] = true;
    }

    // Find facet for function that is called and execute the
    // function if a facet is found and return any value.
    fallback() external payable {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
        address facet = ds.selectorToFacetAndPosition[msg.sig].facetAddress;
        require(facet != address(0), "Diamond: Function does not exist");
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
                case 0 {
                    revert(0, returndatasize())
                }
                default {
                    return(0, returndatasize())
                }
        }
    }

    receive() external payable {}

    function setUniswapRouter(address uniswapRouter_) public isGlobalAdmin() {
        uniswapRouter = IUniswapV2Router02(uniswapRouter_);
    }

    function setFEERECEIVER(address a) public isGlobalAdmin() {
        GAMEFEE_RECEIVER = a;
    }

    function toggleTokenMinting() public isGlobalAdmin() {
        mintingActive = !mintingActive;
    }

    function toggleTokenBurning() public isGlobalAdmin() {
        burningActive = !burningActive;
    }

    function getNextTokenID(uint256 creator) public view returns (uint256) {
        return nextTokenIDs[creator];
    }

    function getTokenID(uint256 _creatorID, uint256 token) public view returns (uint256) {
        return baseTokenDecimals * _creatorID + token;
    }

    function getBuyPrice(uint256 tokenId) public view returns (uint256) {
        uint256 supply = TokenSupply[tokenId];
        return getPrintPrice(tokenId, supply + 1);
    }

    function getSellPrice(uint256 tokenId) public view returns (uint256) {
        uint256 supply = TokenSupply[tokenId];
        return getPrintPrice(tokenId, supply).mul(90).div(100);
    }

    function getPrintPrice(uint256 tokenId, uint256 printNumber) public view returns (uint256) {
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
        uint256 nextTokenId = nextTokenIDs[creatorId] + 1;
        nextTokenIDs[creatorId] = nextTokenId;

        require(nextTokenId < 1000000, "max token of 1000000");
        require(
            curve > 0 && curve <= 20 && multiplier > 0 && multiplier <= 1000000,
            "invalid curve and multipliers"
        );
        require(bytes(json).length > 1, "json must non null");
        require(
            gameAdmin.isOperatorOrMinion(creatorId, _msgSender()) == true,
            "sender must be minion or worker"
        );

        uint256 tokenId = getTokenID(creatorId, nextTokenId);

        curves[tokenId] = curve;
        multipliers[tokenId] = multiplier;
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
        require(curves[tokenId] > 0, "curve must be set");
        curves[tokenId] = curve;
        multipliers[tokenId] = multiplier;
        emit TokenData(tokenId, json, curve, multiplier);
    }

    function SetTokenOnSaleDate(uint256 tokenId, uint256 onSaleDate) public {
        require(hasMinted(tokenId) == false, "token has not been minted");
        require(curves[tokenId] > 0, "curve must be set");
        //require(onSaleDate > 0, "sale date must be nonzero");
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
        require(mintingActive, "minting is not active");
        require(
            block.timestamp > saleStarts[tokenId] && saleStarts[tokenId] > 0,
            "sale has not started yet"
        );
        require(userLatestBlock[_msgSender()] < block.number);
        userLatestBlock[_msgSender()] = block.number;

        uint256 creatorID = tokenId / baseTokenDecimals;
        uint256 price = getBuyPrice(tokenId);
        require(price > 0 && price <= maxPrice, "invalid price");
        TokenSupply[tokenId] += 1;

        gameToken.transferByContract(_msgSender(), address(this), price);
        // console.log(price);
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

    function buyNFTwithMatic(uint256 tokenId, uint256 maxPrice) public payable {
        require(mintingActive, "minting is not active");
        require(
            block.timestamp > saleStarts[tokenId] && saleStarts[tokenId] > 0,
            "sale has not started yet"
        );
        require(userLatestBlock[_msgSender()] < block.number);
        userLatestBlock[_msgSender()] = block.number;

        uint256 creatorID = tokenId / baseTokenDecimals;
        uint256 price = getBuyPrice(tokenId);
        require(price > 0 && price <= maxPrice, "invalid price");
        TokenSupply[tokenId] += 1;

        {
            address[] memory path = new address[](3);
            path[0] = wMatic;
            path[1] = quick;
            path[2] = address(gameToken);

            uint[] memory amountsIn = uniswapRouter.getAmountsIn(price, path);
            require(msg.value >= amountsIn[0], "buyNFTwithMatic: value is not enough");

            uint256[] memory amounts = uniswapRouter.swapETHForExactTokens{value: amountsIn[0]}(price, path, address(this), block.timestamp + 100);

            // send MATIC back
            if (amounts[0] < msg.value) {
                msg.sender.call{value: msg.value.sub(amounts[0])}("");
            }
        }

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

    function buyNFTwithERC20(uint256 tokenId, uint256 maxPrice, address asset) public {
        require(mintingActive, "minting is not active");
        require(
            block.timestamp > saleStarts[tokenId] && saleStarts[tokenId] > 0,
            "sale has not started yet"
        );
        require(userLatestBlock[_msgSender()] < block.number);
        userLatestBlock[_msgSender()] = block.number;

        uint256 creatorID = tokenId / baseTokenDecimals;
        uint256 price = getBuyPrice(tokenId);
        require(price > 0 && price <= maxPrice, "invalid price");
        TokenSupply[tokenId] += 1;

        {
            address[] memory path = new address[](3);
            path[0] = asset;
            path[1] = quick;
            path[2] = address(gameToken);

            uint256[] memory amountsIn = uniswapRouter.getAmountsIn(price, path);
            iERC20(path[0]).transferFrom(msg.sender, address(this), amountsIn[0]);
            iERC20(path[0]).approve(address(uniswapRouter), amountsIn[0]);

            uint256[] memory amounts = uniswapRouter.swapTokensForExactTokens(price, amountsIn[0], path, address(this), block.timestamp + 100);

            // send ERC20 back
            if (amounts[0] < amountsIn[0]) {
                iERC20(path[0]).transferFrom(address(this), msg.sender, amountsIn[0].sub(amounts[0]));
            }
        }

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
        require(burningActive, "burning is not active");
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

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override {
        if (to != address(0)) {
            for (uint256 i = 0; i < amounts.length; ++i) {
                require(amounts[i] == 1, "Amount should be 1");
            }
            if (from != address(0)) {
                for (uint256 i = 0; i < ids.length; ++i) {
                    require(
                        balanceOf(to, ids[i]) == 0,
                        "to_address should own 0 of each"
                    );
                }
            }
        }
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}

