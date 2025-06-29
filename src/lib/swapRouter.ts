import { ethers } from "hardhat";
import { ISwapRouter } from "../../typechain-types";
import { Wallet, TransactionResponse } from "ethers";
import "dotenv/config";

namespace SwapRouter {
  export interface ExactInputSingleParams
    extends ISwapRouter.ExactInputSingleParamsStruct {}
}

class SwapRouter {
  public readonly swapRouterContract: ISwapRouter;
  public readonly wallet: Wallet;

  constructor(swapRouter: ISwapRouter, wallet: Wallet) {
    this.swapRouterContract = swapRouter;
    this.wallet = wallet;
  }

  /**
   * @dev 创建 SwapRouter 实例
   * @param swapRouterAddress SwapRouter 合约地址
   * @param wallet 钱包实例
   * @return 返回 SwapRouter 实例
   */
  static async create(
    swapRouterAddress: string,
    wallet: Wallet
  ): Promise<SwapRouter> {
    const swapRouter = await ethers.getContractAt(
      "ISwapRouter",
      swapRouterAddress,
      wallet
    );
    const instance = new SwapRouter(swapRouter, wallet);
    return instance;
  }

  /**
   * @dev 执行单一输入交换(单个池进行交换)
   * @dev 注意，调用前需要对SwapRouter合约授权需要交换的代币数量
   * @param params 交换参数
   * @param staticCall 是否为静态调用，默认为 false, 如果为 true则返回模拟的交易结果
   * @return 返回交易响应或模拟结果
   */
  async exactInputSingle(
    params: SwapRouter.ExactInputSingleParams,
    staticCall: boolean = false
  ): Promise<TransactionResponse | bigint> {
    const response = staticCall
      ? await this.swapRouterContract.exactInputSingle.staticCall(params)
      : await this.swapRouterContract.exactInputSingle(params);
    return response;
  }

  public async getAddress(): Promise<string> {
    return this.swapRouterContract.getAddress();
  }
}

export { SwapRouter };
