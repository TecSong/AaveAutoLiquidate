import { BigNumber, ethers } from 'ethers';
import {
  UiPoolDataProvider,
  ChainId,
  Pool
} from '@aave/contract-helpers';
import * as markets from '@bgd-labs/aave-address-book';
import { formatReserves, formatUserSummary } from '@aave/math-utils';
import dayjs from 'dayjs';

// ES5 Alternative imports
//  const {
//    ChainId,
//    UiIncentiveDataProvider,
//    UiPoolDataProvider,
//  } = require('@aave/contract-helpers');
//  const markets = require('@bgd-labs/aave-address-book');
//  const ethers = require('ethers');

// Sample RPC address for querying ETH mainnet
const provider = new ethers.providers.JsonRpcProvider(
  'https://eth-mainnet.public.blastapi.io',
);

// User address to fetch data for, insert address here
const currentAccount = '0x95af7FfFE0e7d40956D77bF3f55156D4483b4693';
const LIQUIDATOR = '0x5853eD4f26A3fceA565b3FBC698bb19cdF6DEB85';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

// View contract used to fetch all reserves data (including market base currency data), and user reserves
// Using Aave V3 Eth Mainnet address for demo
const poolDataProviderContract = new UiPoolDataProvider({
  uiPoolDataProviderAddress: markets.AaveV3Ethereum.UI_POOL_DATA_PROVIDER,
  provider,
  chainId: ChainId.mainnet,
});

// get lending pool
const lendingPool = new Pool(provider, {
    POOL: markets.AaveV3Ethereum.POOL,
    WETH_GATEWAY: markets.AaveV3Ethereum.WETH_GATEWAY,
  });


// Object containing array of pool reserves and market base currency data
// { reservesArray, baseCurrencyData }
const reserves = await poolDataProviderContract.getReservesHumanized({
lendingPoolAddressProvider: markets.AaveV3Ethereum.POOL_ADDRESSES_PROVIDER,
});

// Object containing array or users aave positions and active eMode category
// { userReserves, userEmodeCategoryId }
const userReserves = await poolDataProviderContract.getUserReservesHumanized({
lendingPoolAddressProvider: markets.AaveV3Ethereum.POOL_ADDRESSES_PROVIDER,
user: currentAccount,
});

const reservesArray = reserves.reservesData;
const baseCurrencyData = reserves.baseCurrencyData;

const userReservesArray = userReserves.userReserves;

const currentTimestamp = dayjs().unix();

const formattedPoolReserves = formatReserves({
  reserves: reservesArray,
  currentTimestamp,
  marketReferenceCurrencyDecimals:
    baseCurrencyData.marketReferenceCurrencyDecimals,
  marketReferencePriceInUsd: baseCurrencyData.marketReferenceCurrencyPriceInUsd,
});
// console.log('test:',formattedPoolReserves.find(r => r.underlyingAsset === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'))
// console.log('type:', 'find' in formattedPoolReserves)


/*
- @param `currentTimestamp` Current UNIX timestamp in seconds, Math.floor(Date.now() / 1000)
- @param `marketReferencePriceInUsd` Input from [Fetching Protocol Data](#fetching-protocol-data), `reserves.baseCurrencyData.marketReferencePriceInUsd`
- @param `marketReferenceCurrencyDecimals` Input from [Fetching Protocol Data](#fetching-protocol-data), `reserves.baseCurrencyData.marketReferenceCurrencyDecimals`
- @param `userReserves` Input from [Fetching Protocol Data](#fetching-protocol-data), combination of `userReserves.userReserves` and `reserves.reservesArray`
- @param `userEmodeCategoryId` Input from [Fetching Protocol Data](#fetching-protocol-data), `userReserves.userEmodeCategoryId`
*/
const userSummary = formatUserSummary({
    currentTimestamp,
    marketReferencePriceInUsd: baseCurrencyData.marketReferenceCurrencyPriceInUsd,
    marketReferenceCurrencyDecimals:
      baseCurrencyData.marketReferenceCurrencyDecimals,
    userReserves: userReservesArray,
    formattedReserves: formattedPoolReserves,
    userEmodeCategoryId: userReserves.userEmodeCategoryId,
  });

// console.log('userSummary', userSummary.user)
  

//auto liquidate
async function autoLiquidateForWethCollateral(userSummary) {
    if (userSummary.healthFactor < 1) {
        const userReservesData = userSummary.userReservesData;
        const totalCollateralWETH = BigNumber(0);
        for (let i = 0; i < userReservesData.length; i++) {
            if (userReservesData[i].underlyingAsset === WETH) {
                totalCollateralWETH = userReservesData[i].underlyingBalance;
                break;
            }
        }
        if (totalCollateralWETH == BigNumber(0)) return;

        const txs = lendingPool.liquidationCall({
            liquidator: LIQUIDATOR,
            liquidatedUser: currentAccount,
            debtReserve: USDC,
            collateralReserve: WETH,
            purchaseAmount: totalCollateralWETH * 0.5,
            getAToken: false,
        });
    }
}

autoLiquidateForWethCollateral(userSummary);