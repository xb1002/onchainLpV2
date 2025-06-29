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
};
export const config = {
  pool,
  swapRouterAddress,
  positionManagerAddress,
  loggerConfig,
  baseToken,
};
