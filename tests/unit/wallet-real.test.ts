/**
 * TDD: Real Wallet (ethers.js)
 *
 * Tests wallet creation, recovery, balance queries, and USDC transfers
 * using mocked ethers.js providers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RealWallet } from '../../src/economy/wallet-real.js';

// Mock ethers
vi.mock('ethers', () => {
  const mockWallet = {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    privateKey: '0xabc123',
    signMessage: vi.fn().mockResolvedValue('0xsignature'),
  };

  const mockContract = {
    balanceOf: vi.fn().mockResolvedValue(50_000_000n), // 50 USDC (6 decimals)
    transfer: vi.fn().mockResolvedValue({
      hash: '0xtxhash123',
      wait: vi.fn().mockResolvedValue({ status: 1 }),
    }),
  };

  return {
    ethers: {
      Wallet: class {
        address: string;
        privateKey: string;
        constructor(pk: string, _provider?: any) {
          this.address = mockWallet.address;
          this.privateKey = pk;
        }
        static createRandom() {
          const obj: any = {
            address: '0xNEWADDRESS',
            privateKey: '0xnewprivkey',
            mnemonic: { phrase: 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12' },
          };
          obj.connect = () => obj;
          return obj;
        }
        static fromPhrase(mnemonic: string) {
          const obj: any = {
            address: '0xRECOVERED',
            privateKey: '0xrecoveredkey',
            mnemonic: { phrase: mnemonic },
          };
          obj.connect = () => obj;
          return obj;
        }
        connect() { return this; }
        signMessage = mockWallet.signMessage;
      },
      JsonRpcProvider: class {
        constructor(_url: string) {}
      },
      Contract: class {
        balanceOf = mockContract.balanceOf;
        transfer = mockContract.transfer;
        constructor() {}
      },
      formatUnits: (value: bigint, decimals: number) => {
        return (Number(value) / Math.pow(10, decimals)).toString();
      },
      parseUnits: (value: string, decimals: number) => {
        return BigInt(Math.floor(parseFloat(value) * Math.pow(10, decimals)));
      },
    },
  };
});

describe('RealWallet — creation and recovery', () => {
  it('should create a new random wallet', () => {
    const wallet = RealWallet.createNew('https://mainnet.base.org');
    expect(wallet.getAddress()).toBe('0xNEWADDRESS');
  });

  it('should provide mnemonic for backup on creation', () => {
    const wallet = RealWallet.createNew('https://mainnet.base.org');
    const mnemonic = wallet.getMnemonic();
    expect(mnemonic).toBeDefined();
    expect(mnemonic!.split(' ')).toHaveLength(12);
  });

  it('should recover wallet from private key', () => {
    const wallet = RealWallet.fromPrivateKey('0xabc123', 'https://mainnet.base.org');
    expect(wallet.getAddress()).toBe('0x1234567890abcdef1234567890abcdef12345678');
  });

  it('should recover wallet from mnemonic', () => {
    const wallet = RealWallet.fromMnemonic(
      'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12',
      'https://mainnet.base.org',
    );
    expect(wallet.getAddress()).toBe('0xRECOVERED');
  });

  it('should return chain name', () => {
    const wallet = RealWallet.fromPrivateKey('0xabc', 'https://mainnet.base.org');
    expect(wallet.getChain()).toBe('base');
  });
});

describe('RealWallet — balance', () => {
  let wallet: RealWallet;

  beforeEach(() => {
    wallet = RealWallet.fromPrivateKey('0xabc123', 'https://mainnet.base.org');
  });

  it('should query USDC balance', async () => {
    const balance = await wallet.getUSDCBalance();
    expect(balance).toBe(50); // 50_000_000 / 1e6
  });

  it('should return balance as formatted string', async () => {
    const formatted = await wallet.getFormattedBalance();
    expect(formatted).toContain('50');
    expect(formatted).toContain('USDC');
  });
});

describe('RealWallet — transfers', () => {
  let wallet: RealWallet;

  beforeEach(() => {
    wallet = RealWallet.fromPrivateKey('0xabc123', 'https://mainnet.base.org');
  });

  it('should send USDC and return tx hash', async () => {
    const txHash = await wallet.sendUSDC('0xrecipient', 10.0);
    expect(txHash).toBe('0xtxhash123');
  });

  it('should reject sending 0 or negative amounts', async () => {
    await expect(wallet.sendUSDC('0xrecipient', 0)).rejects.toThrow();
    await expect(wallet.sendUSDC('0xrecipient', -5)).rejects.toThrow();
  });

  it('should reject sending to empty address', async () => {
    await expect(wallet.sendUSDC('', 10)).rejects.toThrow();
  });
});

describe('RealWallet — cost per token helper', () => {
  it('should convert USDC amount to human readable', () => {
    const wallet = RealWallet.fromPrivateKey('0xabc', 'https://mainnet.base.org');
    // This is a utility, not a blockchain call
    expect(wallet.formatUSDC(1.5)).toBe('$1.50 USDC');
    expect(wallet.formatUSDC(0.003)).toBe('$0.00 USDC');
    expect(wallet.formatUSDC(1234.56)).toBe('$1234.56 USDC');
  });
});
