import { Token, FeeAmount, Pool } from "./utils/common";

const fee: FeeAmount = 3000; // 0.3% 的手续费
const tokenA: Token = {
  address: "0x4200000000000000000000000000000000000006", // 示例地址
  symbol: "WETH",
  decimals: 18,
};
const tokenB: Token = {
  address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // 示例地址
  symbol: "USDC",
  decimals: 6,
};

const baseToken: Token = tokenB;

const pool: Pool = Pool.create(tokenA, tokenB, fee);

const swapRouterAddress = "0x2626664c2603336e57b271c5c0b26f421741e481"; // Uniswap V3 路由合约地址
const positionManagerAddress = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";

const loggerConfig = {
  name: "UniswapV3LpLogger",
  level: "debug",
  logFlag: true,
  logFile: "logs/uniswapV3Lp.log",
  webhookUrl:
    "https://open.feishu.cn/open-apis/bot/v2/hook/011986cf-824b-44fc-8577-9238d3b63ce7",
};

const feeCollectConfig = {
  collectMinFee0: BigInt(Math.floor(0.4 * 1e15)), // 当token0（这里是WETH）大于此值时，收取费用
  collectMinFee1: BigInt(Math.floor(1e6)), // 当token1（这里是USDC）大于此值时，收取费用
};
const increaseLiquidityConfig = {
  increaseLiquidityMinAmount0: BigInt(Math.floor(1e15)), // 当token0（这里是WETH）大于此值时，增加流动性
  increaseLiquidityMinAmount1: BigInt(Math.floor(2.5 * 1e6)), // 当token1（这里是USDC）大于此值时，增加流动性
};
export const config = {
  pool,
  swapRouterAddress,
  positionManagerAddress,
  loggerConfig,
  baseToken,
  feeCollectConfig,
  increaseLiquidityConfig,
};
