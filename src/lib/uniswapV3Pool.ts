import { IUniswapV3Pool } from "../../typechain-types";
import { ethers } from "hardhat";
import { Wallet } from "ethers";

namespace UniswapV3Pool {
  export interface PoolInfo {
    token0: string;
    token1: string;
    fee: number;
    tickSpacing: number;
  }
  export interface Slot0Response {
    sqrtPriceX96: bigint;
    tick: bigint;
    observationIndex: bigint;
    observationCardinality: bigint;
    observationCardinalityNext: bigint;
    feeProtocol: bigint;
    unlocked: boolean;
  }
  export interface TickResponse {
    liquidityGross: bigint;
    liquidityNet: bigint;
    feeGrowthOutside0X128: bigint;
    feeGrowthOutside1X128: bigint;
    tickCumulativeOutside: bigint;
    secondsPerLiquidityOutsideX128: bigint;
    secondsOutside: bigint;
    initialized: boolean;
  }
}

class UniswapV3Pool {
  public readonly poolContract: IUniswapV3Pool;
  public poolInfo: UniswapV3Pool.PoolInfo | undefined;

  /**
   * Creates an instance of UniswapV3Pool.
   * @param poolContract - The Uniswap V3 pool contract instance.
   */
  constructor(poolContract: IUniswapV3Pool) {
    this.poolContract = poolContract;
  }

  /**
   * Creates a new instance of UniswapV3Pool by connecting to the specified pool address.
   * @param poolAddress - The address of the Uniswap V3 pool contract.
   * @param wallet - Optional wallet to connect to the contract.
   * @returns A promise that resolves to an instance of UniswapV3Pool.
   */
  public static async create(
    poolAddress: string,
    wallet?: Wallet
  ): Promise<UniswapV3Pool> {
    const poolContract = (await ethers.getContractAt(
      "IUniswapV3Pool",
      poolAddress,
      wallet
    )) as IUniswapV3Pool;
    return new UniswapV3Pool(poolContract);
  }

  /**
   * Retrieves the slot0 data from the Uniswap V3 pool.
   * @returns A promise that resolves to the slot0 data of the pool.
   */
  public async getSlot0(): Promise<UniswapV3Pool.Slot0Response> {
    const slot0 = await this.poolContract.slot0();
    return slot0 as UniswapV3Pool.Slot0Response;
  }

  /**
   * Retrieves the tick data for a specific tick index from the Uniswap V3 pool.
   * @param tickIndex - The index of the tick to retrieve.
   * @returns A promise that resolves to the tick data for the specified index.
   */
  public async getTick(tickIndex: bigint): Promise<UniswapV3Pool.TickResponse> {
    const tick = await this.poolContract.ticks(tickIndex);
    return tick as UniswapV3Pool.TickResponse;
  }

  /**
   * Retrieves the pool information from the Uniswap V3 pool.
   * @returns A promise that resolves to the pool information.
   */
  public async getPoolInfo(): Promise<UniswapV3Pool.PoolInfo> {
    if (this.poolInfo) {
      return this.poolInfo;
    }
    const [token0, token1, fee, tickSpacing] = await Promise.all([
      this.poolContract.token0(),
      this.poolContract.token1(),
      this.poolContract.fee(),
      this.poolContract.tickSpacing(),
    ]);
    this.poolInfo = {
      token0,
      token1,
      fee: Number(fee),
      tickSpacing: Number(tickSpacing),
    };
    return this.poolInfo;
  }
}

export { UniswapV3Pool };
