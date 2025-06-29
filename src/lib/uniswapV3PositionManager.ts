import { INonfungiblePositionManager } from "../../typechain-types";
import { ethers } from "hardhat";
import { TransactionResponse, Wallet } from "ethers";

// 抽象类
namespace UniswapV3PositionManager {
  // mintPosition
  export interface MintPositionParams
    extends INonfungiblePositionManager.MintParamsStruct {}
  export interface MintPositionResponse {
    tokenId: bigint;
    liquidity: bigint;
    amount0: bigint;
    amount1: bigint;
  }
  // increaseLiquidity
  export interface IncreaseLiquidityParams
    extends INonfungiblePositionManager.IncreaseLiquidityParamsStruct {}
  export interface IncreaseLiquidityResponse {
    liquidity: bigint;
    amount0: bigint;
    amount1: bigint;
  }
  // collectFees
  export interface CollectFeesParams
    extends INonfungiblePositionManager.CollectParamsStruct {}
  export interface CollectFeesResponse {
    amount0: bigint;
    amount1: bigint;
  }
  // decreaseLiquidity
  export interface DecreaseLiquidityParams
    extends INonfungiblePositionManager.DecreaseLiquidityParamsStruct {}
  export interface DecreaseLiquidityResponse {
    amount0: bigint;
    amount1: bigint;
  }
  // position
  export interface PositionResponse {
    nonce: bigint;
    operator: string;
    token0: string;
    token1: string;
    fee: bigint;
    tickLower: bigint;
    tickUpper: bigint;
    liquidity: bigint;
    feeGrowthInside0LastX128: bigint;
    feeGrowthInside1LastX128: bigint;
    tokensOwed0: bigint;
    tokensOwed1: bigint;
  }
}

class UniswapV3PositionManager {
  /**
   * Uniswap V3 Position Manager
   * 该类封装了 Uniswap V3 Position Manager 的相关操作
   * 包括创建流动性头寸、增加流动性、收取费用和减少流动性等功能
   * @param positionManagerContract - Uniswap V3 Position Manager 合约实例
   * @param wallet - 钱包实例
   */
  public readonly positionManagerContract: INonfungiblePositionManager;
  public readonly wallet: Wallet;

  /**
   * @param positionManager - Uniswap V3 Position Manager 合约实例
   * @param wallet - 钱包实例
   */
  constructor(
    positionManagerContract: INonfungiblePositionManager,
    wallet: Wallet
  ) {
    this.positionManagerContract = positionManagerContract;
    this.wallet = wallet;
  }

  /**
   * 创建 Uniswap V3 Position Manager 实例
   * @param positionManagerContractAddress - Uniswap V3 Position Manager 合约地址
   * @param wallet - 钱包实例
   * @returns UniswapV3PositionManager 实例
   */
  public static async create(
    positionManagerContractAddress: string,
    wallet: Wallet
  ): Promise<UniswapV3PositionManager> {
    const positionManagerContract = (await ethers.getContractAt(
      "INonfungiblePositionManager",
      positionManagerContractAddress,
      wallet
    )) as INonfungiblePositionManager;
    return new UniswapV3PositionManager(positionManagerContract, wallet);
  }

  /**
   * 创建流动性头寸
   * @param params - 创建流动性头寸的参数
   * @param staticCall (optional) - 是否进行静态调用,默认为 false,如果为 true,则不会实际发送交易,而是模拟输出结果
   * @returns 如果是静态调用,返回 MintPositionResponse,否则返回 TransactionResponse
   */
  async mintPosition(
    params: UniswapV3PositionManager.MintPositionParams,
    staticCall: boolean = false
  ): Promise<
    UniswapV3PositionManager.MintPositionResponse | TransactionResponse
  > {
    // 实现逻辑
    // 静态调用模拟输出结果
    if (staticCall) {
      const response = await this.positionManagerContract.mint.staticCall(
        params
      );
      return response as UniswapV3PositionManager.MintPositionResponse;
    }
    const tx: TransactionResponse = await this.positionManagerContract.mint(
      params
    );
    return tx;
  }

  /**
   * 增加流动性
   * @param params - 增加流动性的参数
   * @param staticCall (optional) - 是否进行静态调用,默认为 false,如果为 true,则不会实际发送交易,而是模拟输出结果
   * @returns 如果是静态调用,返回 IncreaseLiquidityResponse,否则返回 TransactionResponse
   */
  async increaseLiquidity(
    params: UniswapV3PositionManager.IncreaseLiquidityParams,
    staticCall: boolean = false
  ): Promise<
    UniswapV3PositionManager.IncreaseLiquidityResponse | TransactionResponse
  > {
    // 实现逻辑
    if (staticCall) {
      const response =
        await this.positionManagerContract.increaseLiquidity.staticCall(params);
      return response as UniswapV3PositionManager.IncreaseLiquidityResponse;
    }
    const tx: TransactionResponse =
      await this.positionManagerContract.increaseLiquidity(params);
    return tx;
  }

  /**
   * 收取费用
   * @param params - 收取费用的参数
   * @param staticCall (optional) - 是否进行静态调用,默认为 false,如果为 true,则不会实际发送交易,而是模拟输出结果
   * @returns 如果是静态调用,返回 CollectFeesResponse,否则返回 TransactionResponse
   */
  async collectFees(
    params: UniswapV3PositionManager.CollectFeesParams,
    staticCall: boolean = false
  ): Promise<
    UniswapV3PositionManager.CollectFeesResponse | TransactionResponse
  > {
    // 实现逻辑
    if (staticCall) {
      const response = await this.positionManagerContract.collect.staticCall(
        params
      );
      return response as UniswapV3PositionManager.CollectFeesResponse;
    }
    const tx: TransactionResponse = await this.positionManagerContract.collect(
      params
    );
    return tx;
  }

  /**
   * 减少流动性
   * @param params - 减少流动性的参数
   * @param staticCall (optional) - 是否进行静态调用,默认为 false,如果为 true,则不会实际发送交易,而是模拟输出结果
   * @returns 如果是静态调用,返回 DecreaseLiquidityResponse,否则返回 TransactionResponse
   */
  async decreaseLiquidity(
    params: UniswapV3PositionManager.DecreaseLiquidityParams,
    staticCall: boolean = false
  ): Promise<
    UniswapV3PositionManager.DecreaseLiquidityResponse | TransactionResponse
  > {
    // 实现逻辑
    if (staticCall) {
      const response =
        await this.positionManagerContract.decreaseLiquidity.staticCall(params);
      return response as UniswapV3PositionManager.DecreaseLiquidityResponse;
    }
    const tx: TransactionResponse =
      await this.positionManagerContract.decreaseLiquidity(params);
    return tx;
  }

  /**
   * 销毁头寸
   * @param tokenId - 头寸的 tokenId
   * @returns 返回销毁头寸的交易响应
   */
  async burnPosition(tokenId: number): Promise<TransactionResponse> {
    const tx: TransactionResponse = await this.positionManagerContract.burn(
      tokenId
    );
    return tx;
  }

  /**
   * 获取头寸信息
   * @param tokenId - 头寸的 tokenId
   * @returns 头寸信息
   */
  async getPositions(
    tokenId: bigint
  ): Promise<UniswapV3PositionManager.PositionResponse> {
    const position = await this.positionManagerContract.positions(tokenId);
    return position as UniswapV3PositionManager.PositionResponse;
  }

  /**
   * 获取指定地址的头寸余额
   * @param owner - 头寸所有者地址
   * @returns 头寸余额
   */
  async balanceOf(owner: string): Promise<bigint> {
    const balance = await this.positionManagerContract.balanceOf(owner);
    return balance;
  }

  /**
   * 获取指定地址的头寸 tokenId
   * @param owner - 头寸所有者地址
   * @param index - 头寸索引
   * @returns 头寸 tokenId
   */
  async getTokenOfOwnerByIndex(owner: string, index: bigint): Promise<bigint> {
    const tokenId = await this.positionManagerContract.tokenOfOwnerByIndex(
      owner,
      index
    );
    return tokenId;
  }

  /**
   * 获取合约地址
   * @returns 合约地址
   */
  async getAddress(): Promise<string> {
    return this.positionManagerContract.getAddress();
  }
}

export { UniswapV3PositionManager };
