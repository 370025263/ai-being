/**
 * Real Wallet — ethers.js integration for Base L2.
 *
 * Manages a real Ethereum wallet on Base L2 with USDC support.
 * Provides balance queries, USDC transfers, and address management.
 */
import { ethers } from 'ethers';

// Base L2 USDC contract address
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Minimal ERC-20 ABI for balanceOf and transfer
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];

export class RealWallet {
  private wallet: ethers.Wallet;
  private provider: ethers.JsonRpcProvider;
  private usdcContract: ethers.Contract;
  private mnemonic?: string;

  private constructor(wallet: ethers.Wallet, provider: ethers.JsonRpcProvider, mnemonic?: string) {
    this.wallet = wallet;
    this.provider = provider;
    this.mnemonic = mnemonic;
    this.usdcContract = new ethers.Contract(BASE_USDC_ADDRESS, ERC20_ABI, wallet);
  }

  /**
   * Create a brand new random wallet.
   */
  static createNew(rpcUrl: string): RealWallet {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = ethers.Wallet.createRandom().connect(provider) as ethers.Wallet;
    return new RealWallet(wallet, provider, (wallet as any).mnemonic?.phrase);
  }

  /**
   * Recover wallet from private key.
   */
  static fromPrivateKey(privateKey: string, rpcUrl: string): RealWallet {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    return new RealWallet(wallet, provider);
  }

  /**
   * Recover wallet from mnemonic phrase.
   */
  static fromMnemonic(mnemonic: string, rpcUrl: string): RealWallet {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = ethers.Wallet.fromPhrase(mnemonic).connect(provider) as ethers.Wallet;
    return new RealWallet(wallet, provider, mnemonic);
  }

  getAddress(): string {
    return this.wallet.address;
  }

  getMnemonic(): string | undefined {
    return this.mnemonic;
  }

  getChain(): string {
    return 'base';
  }

  /**
   * Query USDC balance (returns human-readable number, e.g. 50.0 = $50 USDC).
   */
  async getUSDCBalance(): Promise<number> {
    const raw: bigint = await this.usdcContract.balanceOf(this.wallet.address);
    return parseFloat(ethers.formatUnits(raw, 6));
  }

  /**
   * Get formatted balance string.
   */
  async getFormattedBalance(): Promise<string> {
    const balance = await this.getUSDCBalance();
    return `${balance} USDC`;
  }

  /**
   * Send USDC to an address. Returns transaction hash.
   */
  async sendUSDC(to: string, amount: number): Promise<string> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    if (!to || to.length === 0) {
      throw new Error('Recipient address is required');
    }

    const parsedAmount = ethers.parseUnits(amount.toString(), 6);
    const tx = await this.usdcContract.transfer(to, parsedAmount);
    const receipt = await tx.wait();

    if (receipt.status !== 1) {
      throw new Error(`Transaction failed: ${tx.hash}`);
    }

    return tx.hash;
  }

  /**
   * Format a USDC amount for display.
   */
  formatUSDC(amount: number): string {
    return `$${amount.toFixed(2)} USDC`;
  }
}
