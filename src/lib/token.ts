import { IERC20Metadata as IERC20, IWETH9 } from "../../typechain-types";
import { Wallet, TransactionResponse } from "ethers";
import { ethers } from "hardhat";

abstract class Token {
  public abstract readonly tokenContract: IERC20 | IWETH9;

  public async transfer(
    recipient: string,
    amount: bigint
  ): Promise<TransactionResponse> {
    const tx = await this.tokenContract.transfer(recipient, amount);
    return tx;
  }

  public async approve(
    spender: string,
    amount: bigint
  ): Promise<TransactionResponse> {
    const tx = await this.tokenContract.approve(spender, amount);
    return tx;
  }

  public async allowance(owner: string, spender: string): Promise<bigint> {
    return await this.tokenContract.allowance(owner, spender);
  }

  public async balanceOf(address: string): Promise<bigint> {
    return await this.tokenContract.balanceOf(address);
  }
}

class ERC20 extends Token {
  public readonly tokenContract: IERC20;
  public wallet?: Wallet;

  constructor(tokenContract: IERC20, wallet?: Wallet) {
    super();
    this.tokenContract = tokenContract;
    this.wallet = wallet;
  }

  static async create(tokenAddress: string, wallet?: Wallet): Promise<ERC20> {
    const tokenContract = (await ethers.getContractAt(
      "IERC20",
      tokenAddress,
      wallet
    )) as IERC20;
    return new ERC20(tokenContract, wallet);
  }
}

class WETH9 extends Token {
  public readonly tokenContract: IWETH9;

  constructor(tokenContract: IWETH9) {
    super();
    this.tokenContract = tokenContract;
  }

  static async create(tokenAddress: string, wallet?: Wallet): Promise<WETH9> {
    const tokenContract = (await ethers.getContractAt(
      "IWETH9",
      tokenAddress,
      wallet
    )) as IWETH9;
    return new WETH9(tokenContract);
  }

  public async deposit(value: bigint): Promise<TransactionResponse> {
    const tx = await this.tokenContract.deposit({
      value: value,
    });
    return tx;
  }

  public async withdraw(value: bigint): Promise<TransactionResponse> {
    const tx = await this.tokenContract.withdraw(value);
    return tx;
  }
}

export { ERC20, WETH9 };
