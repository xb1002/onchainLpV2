import { SwapRouter } from "./lib/swapRouter";
import { UniswapV3Pool } from "./lib/uniswapV3Pool";
import { ERC20, WETH9 } from "./lib/token";
import { createLogger } from "./utils/logger";
import { Wallet, TransactionResponse } from "ethers";
import { UniswapV3PositionManager } from "./lib/uniswapV3PositionManager";
import {
  IERC20Metadata as IERC20,
  INonfungiblePositionManager,
  uniswap,
} from "../typechain-types";
import { ethers } from "hardhat";
import { Pool, Token, FeeAmount, getPoolAddress } from "./utils/common";
import { RestClient as OkxRestClient } from "okx-api";
import { config } from "./config";

// 配置日志
const logger = createLogger(
  config.loggerConfig.name,
  config.loggerConfig.level,
  config.loggerConfig.logFlag,
  config.loggerConfig.logFile
);

namespace UniswapV3Lp {
  export type exchangeType = "cex" | "dex";
  //   export type OrderInfo = {};
  export type CexPositionInfo = {};
  export type DexPositionInfo = {};
  export type PositionInfo = CexPositionInfo | DexPositionInfo;
}

class ERC20Token extends ERC20 {
  public token: Token;

  constructor(tokenContract: IERC20, token: Token, wallet: Wallet) {
    super(tokenContract, wallet);
    this.token = token;
  }

  // 创建ERC20代币实例, 不要通过create方法创建，因为create方法返回的是ERC20实例
  static async createErc20(token: Token, wallet: Wallet): Promise<ERC20Token> {
    const tokenContract = (await ethers.getContractAt(
      "IERC20",
      token.address,
      wallet
    )) as IERC20;
    return new ERC20Token(tokenContract, token, wallet);
  }

  /**
   * 如果授权数量小于阈值，则自动授权最大额度
   * @param spender 授权地址
   * @param thresholdAmount 授权阈值, 单位为代币数量
   * @returns
   */
  public async checkAndApproveMax(
    spender: string,
    thresholdAmount: bigint
  ): Promise<TransactionResponse | void> {
    const allowance = await this.allowance(this.wallet!.address, spender);
    logger.debug(
      `Checking allowance for spender ${spender}: ${allowance}. Threshold: ${thresholdAmount}.`
    );
    if (allowance < thresholdAmount) {
      const tx = await this.approve(spender, BigInt(2 ** 256 - 1));
      await tx.wait(1);
      logger.info(
        `Approved ${await this.tokenContract.getAddress()} for spender ${spender} with max amount.`
      );
      return tx;
    }
    logger.debug(
      `Allowance for spender ${spender} is sufficient: ${allowance}. No need to approve.`
    );
    return Promise.resolve();
  }
}

class UniswapV3PositionManagerExtended extends UniswapV3PositionManager {
  public static async create(
    positionManagerAddress: string,
    wallet: Wallet
  ): Promise<UniswapV3PositionManagerExtended> {
    const positionManager = (await ethers.getContractAt(
      "INonfungiblePositionManager",
      positionManagerAddress,
      wallet
    )) as INonfungiblePositionManager;
    return new UniswapV3PositionManagerExtended(positionManager, wallet);
  }

  // 查询所有 tokenId
  public async getAllTokenIds(): Promise<bigint[]> {
    const tokenIds: bigint[] = [];
    const balance = await this.positionManagerContract.balanceOf(
      this.wallet.address
    );
    for (let i = 0; i < balance; i++) {
      const tokenId = await this.positionManagerContract.tokenOfOwnerByIndex(
        this.wallet.address,
        i
      );
      tokenIds.push(tokenId);
    }
    logger.debug(`TokenIDs ${tokenIds} owned by wallet ${this.wallet.address}`);
    return tokenIds;
  }

  // 清理所有流动性为0的头寸
  public async clearZeroLiquidityPositions(): Promise<void> {
    const tokenIds = await this.getAllTokenIds();
    for (const tokenId of tokenIds) {
      const position = await this.positionManagerContract.positions(tokenId);
      if (position.liquidity == 0n) {
        if (position.tokensOwed0 > 0n || position.tokensOwed1 > 0n) {
          // 如果有未结算的代币，则先提取
          const tx = await this.positionManagerContract.collect({
            tokenId: tokenId,
            recipient: this.wallet.address,
            amount0Max: position.tokensOwed0,
            amount1Max: position.tokensOwed1,
          });
          await tx.wait(1);
          logger.info(
            `Collected tokens owed for position ${tokenId}: ${position.tokensOwed0} token0, ${position.tokensOwed1} token1.`
          );
        }
        // 销毁头寸
        const tx = await this.positionManagerContract.burn(tokenId);
        await tx.wait(1);
        logger.info(`Burned position with tokenId ${tokenId}.`);
      }
    }
  }

  // 关闭全部的流动性头寸
  public async closeAllPositions(): Promise<void> {
    // 清楚剩余的头寸
    const tokenIds = await this.getAllTokenIds();
    for (const tokenId of tokenIds) {
      // 获取头寸信息
      const position = await this.positionManagerContract.positions(tokenId);
      // 移除流动性
      if (position.liquidity === 0n) {
        continue;
      }
      const tx = await this.positionManagerContract.decreaseLiquidity({
        tokenId: tokenId,
        liquidity: position.liquidity,
        amount0Min: 0, // 可以根据需要设置最小值
        amount1Min: 0, // 可以根据需要设置最小值
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1小时后过期
      });
      await tx.wait(1);
      logger.info(`Removed liquidity for position ${tokenId}.`);
    }
    // 清理所有流动性为0的头寸
    await this.clearZeroLiquidityPositions();
  }

  // 移除流动性
  public async removeLiquidity(tokenId: bigint): Promise<void> {
    // 获取头寸信息
    const position = await this.positionManagerContract.positions(tokenId);
    if (position.liquidity === 0n) {
      logger.warn(`Position ${tokenId} has no liquidity to remove.`);
      return;
    }
    // 移除流动性
    const tx = await this.positionManagerContract.decreaseLiquidity({
      tokenId: tokenId,
      liquidity: position.liquidity,
      amount0Min: 0, // 可以根据需要设置最小值
      amount1Min: 0, // 可以根据需要设置最小值
      deadline: Math.floor(Date.now() / 1000) + 3600, // 1小时后过期
    });
    await tx.wait(1);
    logger.info(`Removed liquidity for position ${tokenId}.`);
  }

  // 收集全部的费用
  public async collectAllFees(tokenId: bigint) {
    const position = await this.positionManagerContract.positions(tokenId);
    // 收集费用
    if (position.tokensOwed0 > 0n || position.tokensOwed1 > 0n) {
      const tx = await this.positionManagerContract.collect({
        tokenId: tokenId,
        recipient: this.wallet.address,
        amount0Max: position.tokensOwed0,
        amount1Max: position.tokensOwed1,
      });
      await tx.wait(1);
      logger.info(
        `Collected fees for position ${tokenId}: ${position.tokensOwed0} token0, ${position.tokensOwed1} token1.`
      );
    } else {
      logger.info(`No fees to collect for position ${tokenId}.`);
    }
  }
}

// 目前只支持一个Pool
// 未来可以扩展支持多个Pool
class UniswapV3Lp {
  public readonly pool: Pool;
  public readonly wallet: Wallet;
  public readonly swapRouter: SwapRouter;
  public readonly positionManager: UniswapV3PositionManagerExtended;
  public readonly uniswapV3Pool: UniswapV3Pool;
  public readonly okxRestClient: OkxRestClient;
  public readonly baseToken: Token;

  public token0Contract?: ERC20Token;
  public token1Contract?: ERC20Token;

  //   目前先不考虑订单管理
  //   public orderMap: Map<number, UniswapV3Lp.OrderInfo> = new Map(); //id -> orderInfo

  //   仓位管理 也暂时不考虑
  // public positionMap: Map<
  //   UniswapV3Lp.exchangeType,
  //   UniswapV3Lp.PositionInfo[]
  // > = new Map(); //exchangeType -> positionInfo
  public currentPosition:
    | UniswapV3PositionManager.PositionResponse
    | undefined = undefined;
  public hedgeAmountReadable?: number; // OKX对冲的数量,

  /**
   * Creates an instance of UniswapV3Lp.
   * @param pool - The Uniswap V3 pool configuration.
   * @param wallet - The wallet instance to interact with the blockchain.
   * @param swapRouter - The swap router instance.
   * @param positionManager - The position manager instance.
   * @param uniswapV3Pool - The Uniswap V3 pool instance.
   * @param okxRestClient - The OKX REST client for trading operations.
   * @param baseToken - The base token used for liquidity provision, typically WETH or USDC.
   * @dev 注意这里pool与uniswapV3Pool应该是同一个池的配置和实例，
   */
  constructor(
    pool: Pool,
    wallet: Wallet,
    swapRouter: SwapRouter,
    positionManager: UniswapV3PositionManagerExtended,
    uniswapV3Pool: UniswapV3Pool,
    okxRestClient: OkxRestClient,
    baseToken: Token
  ) {
    if (
      baseToken.address !== pool.token0.address &&
      baseToken.address !== pool.token1.address
    ) {
      throw new Error("Base token must be one of the pool tokens.");
    }
    this.pool = pool;
    this.wallet = wallet;
    this.swapRouter = swapRouter;
    this.positionManager = positionManager;
    this.uniswapV3Pool = uniswapV3Pool;
    this.okxRestClient = okxRestClient; // OKX REST API 客户端
    this.baseToken = baseToken; // 基础代币，通常是WETH或USDC等
  }

  // 初始化
  public async initialize() {
    this.token0Contract = await ERC20Token.createErc20(
      this.pool.token0,
      this.wallet
    );
    this.token1Contract = await ERC20Token.createErc20(
      this.pool.token1,
      this.wallet
    );
  }

  // 通过tokenId计算当前头寸的费用
  public async getFeesByTokenId(tokenId: bigint): Promise<{
    fee0: bigint;
    fee1: bigint;
  }> {
    const position = await this.positionManager.getPositions(tokenId);
    const {
      tickLower,
      tickUpper,
      liquidity,
      feeGrowthInside0LastX128,
      feeGrowthInside1LastX128,
    } = position;

    // 获取当前池的slot0信息
    const slot0 = await this.uniswapV3Pool.getSlot0();
    const currentTick = slot0.tick;

    // 获取全局费用增长信息
    const feeGrowthGlobal0X128 =
      await this.uniswapV3Pool.poolContract.feeGrowthGlobal0X128();
    const feeGrowthGlobal1X128 =
      await this.uniswapV3Pool.poolContract.feeGrowthGlobal1X128();

    // 获取tick信息
    const tickLowerInfo = await this.uniswapV3Pool.getTick(tickLower);
    const tickUpperInfo = await this.uniswapV3Pool.getTick(tickUpper);

    // 计算头寸范围内的费用增长
    let feeGrowthInside0X128: bigint;
    let feeGrowthInside1X128: bigint;

    if (currentTick < tickLower) {
      // 当前价格在头寸范围下方
      feeGrowthInside0X128 =
        tickLowerInfo.feeGrowthOutside0X128 -
        tickUpperInfo.feeGrowthOutside0X128;
      feeGrowthInside1X128 =
        tickLowerInfo.feeGrowthOutside1X128 -
        tickUpperInfo.feeGrowthOutside1X128;
    } else if (currentTick >= tickUpper) {
      // 当前价格在头寸范围上方
      feeGrowthInside0X128 =
        tickUpperInfo.feeGrowthOutside0X128 -
        tickLowerInfo.feeGrowthOutside0X128;
      feeGrowthInside1X128 =
        tickUpperInfo.feeGrowthOutside1X128 -
        tickLowerInfo.feeGrowthOutside1X128;
    } else {
      // 当前价格在头寸范围内
      feeGrowthInside0X128 =
        feeGrowthGlobal0X128 -
        tickLowerInfo.feeGrowthOutside0X128 -
        tickUpperInfo.feeGrowthOutside0X128;
      feeGrowthInside1X128 =
        feeGrowthGlobal1X128 -
        tickLowerInfo.feeGrowthOutside1X128 -
        tickUpperInfo.feeGrowthOutside1X128;
    }

    // 计算费用增长差值
    const feeGrowthDelta0X128 = feeGrowthInside0X128 - feeGrowthInside0LastX128;
    const feeGrowthDelta1X128 = feeGrowthInside1X128 - feeGrowthInside1LastX128;

    // 计算实际费用 (fees = liquidity * feeGrowthDelta / 2^128)
    const Q128 = BigInt(2) ** BigInt(128);
    const fee0 = (liquidity * feeGrowthDelta0X128) / Q128;
    const fee1 = (liquidity * feeGrowthDelta1X128) / Q128;

    logger.debug(
      `Calculated fees for tokenId ${tokenId}: fee0=${fee0}, fee1=${fee1}, liquidity=${liquidity}`
    );

    return { fee0, fee1 };
  }

  /**
   * 检查现在的流动性是否在设定区间内
   * @param tokenId - The token ID of the position to check.
   * @returns A boolean indicating whether the current liquidity is within the set range.
   */
  public async isLiquidityInRange(tokenId: bigint): Promise<boolean> {
    // 获取头寸信息
    if (this.currentPosition === undefined) {
      const position = await this.positionManager.getPositions(tokenId);
      this.currentPosition = position;
    }
    const { tickLower, tickUpper } = this.currentPosition;
    // 使用链上数据判断，之后可以通过交易所数据进行判断
    // 查看pool的当前tick
    const slot0 = await this.uniswapV3Pool.getSlot0();
    const currentTick = slot0.tick;
    // 检查当前tick是否在设定区间内
    const inRange = currentTick >= tickLower && currentTick <= tickUpper;
    logger.debug(
      `Checking liquidity for tokenId ${tokenId}: currentTick=${currentTick}, tickLower=${tickLower}, tickUpper=${tickUpper}, inRange=${inRange}`
    );
    return inRange;
  }

  public async createPosition(
    tickDeltaRange: {
      lower: number;
      upper: number;
    } = { lower: 200, upper: 200 } // 默认价格区间为当前tick的上下200个tick
  ): Promise<bigint> {
    logger.info("Starting to create position and OKX hedge...");

    try {
      // 获取当前池状态
      const slot0 = await this.uniswapV3Pool.getSlot0();
      const currentTick = Number(slot0.tick);

      // 计算价格区间 (可以根据策略调整)
      const tickSpacing = Number(
        (await this.uniswapV3Pool.getPoolInfo())["tickSpacing"]
      );
      const tickLower =
        Math.ceil((currentTick - tickDeltaRange.lower) / tickSpacing) *
        tickSpacing;
      const tickUpper =
        Math.ceil((currentTick + tickDeltaRange.upper) / tickSpacing) *
        tickSpacing;

      logger.info(
        `Creating position with tick range: ${tickLower} to ${tickUpper}, current tick: ${currentTick}`
      );

      // 获取当前余额
      const balance0SwapBefore = await this.token0Contract!.balanceOf(
        this.wallet.address
      );
      const balance1SwapBefore = await this.token1Contract!.balanceOf(
        this.wallet.address
      );
      logger.info(
        `Current amount before swap - ${this.pool.token0.symbol} Amount: ${balance0SwapBefore} , ${this.pool.token1.symbol} Amount: ${balance1SwapBefore}`
      );
      // 调整余额价值，通过baseToken进行价值计算,从currentTick计算当前价格
      const currentPrice =
        Math.pow(1.0001, currentTick) *
        10 ** (this.pool.token0.decimals - this.pool.token1.decimals);
      logger.debug(
        `Current price calculated from slot0: ${currentPrice} ${this.pool.token1.symbol} per ${this.pool.token0.symbol}`
      );
      const balance0Value =
        (Number(balance0SwapBefore) * currentPrice) /
        10 ** this.pool.token0.decimals;
      const balance1Value =
        Number(balance1SwapBefore) / 10 ** this.pool.token1.decimals;
      logger.info(
        `Current balancesValue - Token0Value: ${balance0Value} ${this.pool.token1.symbol}, Token1Value: ${balance1Value} ${this.pool.token1.symbol}`
      );
      //
      const totalValue = balance0Value + balance1Value;
      const targetValue = totalValue / 2; // 平均分配到两个代币
      // 调整余额
      if (balance0Value > targetValue * 1.05) {
        let amount0Desired = BigInt(
          Math.floor(
            ((balance0Value - targetValue) / currentPrice) *
              10 ** this.pool.token0.decimals
          )
        );
        const swapParams: SwapRouter.ExactInputSingleParams = {
          tokenIn: this.pool.token0.address,
          tokenOut: this.pool.token1.address,
          // fee: this.pool.fee,
          fee: FeeAmount.LOW, // 使用低费率
          recipient: this.wallet.address,
          amountIn: amount0Desired,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        };
        const tx = (await this.swapRouter.exactInputSingle(
          swapParams
        )) as TransactionResponse;
        await tx.wait(1);
        logger.info(
          `Swapped ${amount0Desired} amount ${this.pool.token0.symbol} for ${this.pool.token1.symbol}`
        );
      } else if (balance1Value > targetValue * 1.05) {
        let amount1Desired = BigInt(
          Math.floor(
            (balance1Value - targetValue) * 10 ** this.pool.token1.decimals
          )
        );
        const swapParams: SwapRouter.ExactInputSingleParams = {
          tokenIn: this.pool.token1.address,
          tokenOut: this.pool.token0.address,
          // fee: this.pool.fee,
          fee: FeeAmount.LOW, // 使用低费率
          recipient: this.wallet.address,
          amountIn: amount1Desired,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        };
        const tx = (await this.swapRouter.exactInputSingle(
          swapParams
        )) as TransactionResponse;
        await tx.wait(1);
        logger.info(
          `Swapped ${amount1Desired} amount ${this.pool.token1.symbol} for ${this.pool.token0.symbol}`
        );
      } else {
        logger.info(
          `No need to rebalance - Token0Value: ${balance0Value}, Token1Value: ${balance1Value}`
        );
      }

      // swap后的余额
      const balance0SwapAfter = await this.token0Contract!.balanceOf(
        this.wallet.address
      );
      // 因为这里是对冲eth，是token0，所以根据balance0SwapAfter进行对冲
      this.hedgeAmountReadable =
        Number(balance0SwapAfter) / 10 ** this.pool.token0.decimals;
      logger.debug(
        `Hedge amount set to ${this.hedgeAmountReadable} ${this.pool.token0.symbol}`
      );

      const balance1SwapAfter = await this.token1Contract!.balanceOf(
        this.wallet.address
      );

      logger.info(
        `Amounts after swap - ${this.pool.token0.symbol} Amount: ${balance0SwapAfter} , ${this.pool.token1.symbol} Amount: ${balance1SwapAfter}`
      );

      // 计算流动性参数 (简化版本，实际应该根据价格比例分配)
      const amount0Desired = balance0SwapAfter; // 使用全部余额
      const amount1Desired = balance1SwapAfter; // 使用全部余额

      // 创建流动性头寸参数
      const mintParams = {
        token0: this.pool.token0.address,
        token1: this.pool.token1.address,
        fee: this.pool.fee,
        tickLower: tickLower,
        tickUpper: tickUpper,
        amount0Desired: amount0Desired,
        amount1Desired: amount1Desired,
        amount0Min: 0, // 最小值可以根据实际情况调整
        amount1Min: 0, // 最小值可以根据实际情况调整
        recipient: this.wallet.address,
        deadline: Math.floor(Date.now() / 1000) + 3600, // 1小时后过期
      };

      logger.info("Minting new position...");

      // 创建头寸
      const { tokenId } = (await this.positionManager.mintPosition(
        mintParams,
        true
      )) as UniswapV3PositionManager.MintPositionResponse;
      const createPositionTx = (await this.positionManager.mintPosition(
        mintParams
      )) as TransactionResponse;
      await createPositionTx.wait(1); // 等待交易确认

      logger.info(`Successfully created position with tokenId: ${tokenId}`);
      // 剩余余额
      const balance0MintAfter = await this.token0Contract!.balanceOf(
        this.wallet.address
      );
      const balance1MintAfter = await this.token1Contract!.balanceOf(
        this.wallet.address
      );
      logger.info(
        `Amounts after mint - ${this.pool.token0.symbol} Amount: ${balance0MintAfter} , ${this.pool.token1.symbol} Amount: ${balance1MintAfter}`
      );

      // 更新当前头寸信息
      this.currentPosition = await this.positionManager.getPositions(tokenId);

      return tokenId;
    } catch (error) {
      logger.error("Error creating position and OKX hedge:", error);
      throw new Error(
        `Failed to create position and OKX hedge: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 执行 OKX 对冲策略 (占位符实现)
   * @param tokenId - 创建的头寸 ID
   * @param amount0 - Token0 数量
   * @param amount1 - Token1 数量
   */
  private async executeOkxHedge(): Promise<void> {
    // TODO: 实现 OKX 对冲逻辑
    // 这里需要根据具体的对冲策略实现，例如：
    // 1. 计算对冲数量
    // 2. 调用 OKX API 下单
    // 3. 监控对冲状态

    // TODO: 在这里添加 OKX 对冲逻辑
    // 这部分需要根据具体的 OKX API 实现
    logger.debug("Executing OKX hedge strategy...");

    // 示例对冲逻辑（需要根据实际需求实现）
    if (this.hedgeAmountReadable === undefined) {
      logger.warn("Hedge amount is not set. Skipping OKX hedge execution.");
      return;
    } else if (this.hedgeAmountReadable <= 0) {
      logger.warn(
        "Hedge amount is zero or negative. Skipping OKX hedge execution."
      );
      return;
    } else {
      logger.debug(
        `Executing OKX hedge with amount: ${this.hedgeAmountReadable} ${this.pool.token0.symbol}`
      );
      // 查看当前的ETH仓位
      const okxPositions = await this.okxRestClient.getPositions({
        instType: "SWAP",
        instId: "ETH-USDT-SWAP",
      });
      const ethPosition = okxPositions.find(
        (position) =>
          position.instId === "ETH-USDT-SWAP" && position.posSide === "net"
      );
      logger.debug(
        `Current ETH position on OKX: ${JSON.stringify(ethPosition)}`
      );
      const needOpenPosition = Number(
        (-10 * this.hedgeAmountReadable - Number(ethPosition!["pos"])).toFixed(
          2
        )
      );
      // 市价单, 开3倍杠杆
      await this.okxRestClient.setLeverage({
        instId: "ETH-USDT-SWAP",
        lever: "3",
        mgnMode: "cross",
      });
      if (needOpenPosition < 0) {
        await this.okxRestClient.submitOrder({
          instId: "ETH-USDT-SWAP",
          side: "sell",
          ordType: "market",
          sz: Math.abs(needOpenPosition).toFixed(2),
          tdMode: "cross",
          posSide: "net",
        });
        logger.info(
          `Opened short position on OKX with size: ${Math.abs(
            needOpenPosition / 10
          ).toFixed(3)} ETH`
        );
      } else if (needOpenPosition > 0) {
        await this.okxRestClient.submitOrder({
          instId: "ETH-USDT-SWAP",
          side: "buy",
          ordType: "market",
          sz: needOpenPosition.toFixed(2),
          tdMode: "cross",
          posSide: "net",
        });
        logger.info(
          `Opened long position on OKX with size: ${(
            needOpenPosition / 10
          ).toFixed(3)} ETH`
        );
      } else {
        logger.debug("No need to open position on OKX, already hedged.");
      }
    }
  }

  /**
   * run the Uniswap V3 LP service.
   */
  public async run() {
    logger.info("Starting Uniswap V3 LP service...");
    // 运行参数
    try {
      // 一次性事务
      // 获取池信息
      ({
        token0: this.pool.token0.address,
        token1: this.pool.token1.address,
        fee: this.pool.fee,
      } = await this.uniswapV3Pool.getPoolInfo());

      // 向合约授权最大额度，如果授权数量小于最大额度的80%，则重新授权
      const thresholdAmount = BigInt(Math.floor(0.8 * (2 ** 256 - 1)));
      try {
        // 向swapRouter合约授权
        await this.token0Contract!.checkAndApproveMax(
          await this.swapRouter.getAddress(),
          thresholdAmount
        );
        await this.token1Contract!.checkAndApproveMax(
          await this.swapRouter.getAddress(),
          thresholdAmount
        );
        // 向positionManager合约授权
        await this.token0Contract!.checkAndApproveMax(
          await this.positionManager.getAddress(),
          thresholdAmount
        );
        await this.token1Contract!.checkAndApproveMax(
          await this.positionManager.getAddress(),
          thresholdAmount
        );
      } catch (error) {
        throw new Error(
          `Error approving tokens: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      // 清理所有流动性为0的头寸
      try {
        await this.positionManager.clearZeroLiquidityPositions();
      } catch (error) {
        throw new Error(
          `Error clearing zero liquidity positions: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      let tokenId = undefined;
      // 获取所有tokenId
      const tokenIds = await this.positionManager.getAllTokenIds();
      if (tokenIds.length > 0) {
        tokenId = tokenIds[0]; // 目前只处理第一个tokenId
      }
      while (true) {
        try {
          // 这里可以添加更多的逻辑，比如定时检查池的状态，或者根据市场情况进行流动性管理
          logger.debug(
            `Current pool: ${this.pool.token0.address} - ${this.pool.token1.address}, fee: ${this.pool.fee}, tokenId: ${tokenId}`
          );
          if (tokenId !== undefined) {
            // 检查流动性是否在设定区间内
            const inRange = await this.isLiquidityInRange(tokenId);
            if (!inRange) {
              logger.warn(
                `Liquidity for tokenId ${tokenId} is out of range. Consider removing position.`
              );
              // 移除流动性并且创建新的头寸
              await this.positionManager.removeLiquidity(tokenId);
              // 收集费用
              await this.positionManager.collectAllFees(tokenId);
              tokenId = await this.createPosition();
              // 执行OKX对冲
              await this.executeOkxHedge();
              logger.info(`New position created with tokenId: ${tokenId}.`);
            } else {
              logger.debug(`Liquidity for tokenId ${tokenId} is in range.`);
            }
          } else {
            // 创建新的头寸
            logger.debug("No tokenId found. Consider creating a new position.");
            // 创建新的头寸并对冲
            tokenId = await this.createPosition();
            // 执行OKX对冲
            await this.executeOkxHedge();
            logger.info(`New position created with tokenId: ${tokenId}.`);
          }
        } catch (error) {
          logger.error(
            `Error processing position with tokenId ${tokenId}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          // 如果发生错误，可以选择重试或退出
          // 这里可以添加重试逻辑
        } finally {
          logger.debug(
            `Waiting for 30 seconds before checking the position again...`
          );
          await new Promise(
            (resolve) => setTimeout(resolve, 30000) // 每30秒检查一次
          ); // 等待30秒后继续检查
        }
      }
    } catch (error) {
      logger.error("Error running Uniswap V3 LP service:", error);
    }
  }
}

if (require.main === module) {
  (async () => {
    const wallet = new Wallet(process.env.PRIVATE_KEY!, ethers.provider);
    // 如果是本地网络则先mine a block并且发送一点ETH到钱包地址
    if ((await ethers.provider.getNetwork()).name === "localhost") {
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("hardhat_setBalance", [
        wallet.address,
        `0x${(10e18).toString(16)}`, // 发送10ETH
      ]);
      //
      const wethContract = await WETH9.create(
        "0x4200000000000000000000000000000000000006",
        wallet
      );
      // await wethContract.deposit(BigInt(ethers.parseEther("0.002"))); // 存入1 ETH
    }
    try {
      // 配置
      const positionManagerAddress = config.positionManagerAddress;
      const swapRouterAddress = config.swapRouterAddress;
      const pool: Pool = config.pool;
      const baseToken: Token = config.baseToken;

      const positionManager = await UniswapV3PositionManagerExtended.create(
        positionManagerAddress,
        wallet
      );
      const swapRouter = await SwapRouter.create(swapRouterAddress, wallet);
      const uniswapV3Pool = await UniswapV3Pool.create(
        getPoolAddress(pool.token0.address, pool.token1.address, pool.fee),
        wallet
      );

      // 创建OKX REST API客户端
      const okxRestClient = new OkxRestClient(
        {
          apiKey: process.env.OKX_API_KEY!,
          apiSecret: process.env.OKX_API_SECRET!,
          apiPass: process.env.OKX_API_PASSPHRASE!,
        },
        "prod"
      );
      const uniswapV3Lp = new UniswapV3Lp(
        pool,
        wallet,
        swapRouter,
        positionManager,
        uniswapV3Pool,
        okxRestClient,
        baseToken
      );
      await uniswapV3Lp.initialize();
      // 在运行前先关闭所有的流动性头寸
      // await positionManager.closeAllPositions(); // 一般是测试重新mint流动性头寸的表现
      await uniswapV3Lp.run();
    } catch (error) {
      logger.error("Error initializing UniswapV3Lp:", error);
      process.exit(1);
    }
  })();
}
