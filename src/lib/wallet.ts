// Wallet implementation for managing keys and creating transactions
import { generatePrivateKey, generatePublicKey, generateAddress } from './crypto';
import { Transaction, type TransactionInput, type TransactionOutput, type UTXO } from './transaction';
import type { Blockchain } from './blockchain';

export interface WalletInfo {
  address: string;
  publicKey: string;
  balance: number;
}

export class Wallet {
  private privateKey: string;
  private publicKey = '';
  public address = '';

  constructor(privateKey?: string) {
    if (privateKey) {
      this.privateKey = privateKey;
    } else {
      this.privateKey = generatePrivateKey();
    }

    this.initializeKeys();
  }

  private async initializeKeys(): Promise<void> {
    this.publicKey = await generatePublicKey(this.privateKey);
    this.address = await generateAddress(this.publicKey);
  }

  // Get wallet information
  async getInfo(): Promise<WalletInfo> {
    if (!this.address) {
      await this.initializeKeys();
    }

    return {
      address: this.address,
      publicKey: this.publicKey,
      balance: 0 // Will be updated when getting balance from blockchain
    };
  }

  // Get private key (should be kept secure in real applications)
  getPrivateKey(): string {
    return this.privateKey;
  }

  // Get public key
  getPublicKey(): string {
    return this.publicKey;
  }

  // Get wallet address
  getAddress(): string {
    return this.address;
  }

  // Get balance from blockchain
  getBalance(blockchain: Blockchain): number {
    return blockchain.getBalance(this.address);
  }

  // Get UTXOs for this wallet
  getUtxos(blockchain: Blockchain): UTXO[] {
    return blockchain.getUtxosForAddress(this.address);
  }

  // Create a transaction
  async createTransaction(
    recipientAddress: string,
    amount: number,
    fee: number,
    blockchain: Blockchain
  ): Promise<Transaction | null> {
    // Get available UTXOs
    const availableUtxos = this.getUtxos(blockchain);

    if (availableUtxos.length === 0) {
      console.log('No UTXOs available');
      return null;
    }

    // Calculate total available amount
    const totalAvailable = availableUtxos.reduce((sum, utxo) => sum + utxo.output.amount, 0);

    if (totalAvailable < amount + fee) {
      console.log(`Insufficient funds. Available: ${totalAvailable}, Required: ${amount + fee}`);
      return null;
    }

    // Select UTXOs to spend (simple strategy - use oldest first)
    const selectedUtxos: UTXO[] = [];
    let selectedAmount = 0;

    for (const utxo of availableUtxos.sort((a, b) => a.blockHeight - b.blockHeight)) {
      selectedUtxos.push(utxo);
      selectedAmount += utxo.output.amount;

      if (selectedAmount >= amount + fee) {
        break;
      }
    }

    // Create transaction inputs
    const inputs: TransactionInput[] = selectedUtxos.map(utxo => ({
      previousTxHash: utxo.txHash,
      outputIndex: utxo.outputIndex,
      signature: '', // Will be filled when signing
      publicKey: this.publicKey
    }));

    // Create transaction outputs
    const outputs: TransactionOutput[] = [
      {
        amount: amount,
        recipientAddress: recipientAddress
      }
    ];

    // Create change output if necessary
    const change = selectedAmount - amount - fee;
    if (change > 0) {
      outputs.push({
        amount: change,
        recipientAddress: this.address // Send change back to ourselves
      });
    }

    // Create transaction
    const transaction = new Transaction(inputs, outputs, fee);

    // Sign the transaction
    const privateKeys = new Array(inputs.length).fill(this.privateKey);
    await transaction.signInputs(privateKeys);

    return transaction;
  }

  // Send transaction to the network (add to mempool)
  async sendTransaction(
    recipientAddress: string,
    amount: number,
    fee: number,
    blockchain: Blockchain
  ): Promise<boolean> {
    const transaction = await this.createTransaction(recipientAddress, amount, fee, blockchain);

    if (!transaction) {
      return false;
    }

    // Add transaction to blockchain mempool
    return await blockchain.addTransaction(transaction);
  }

  // Get transaction history for this wallet
  getTransactionHistory(blockchain: Blockchain): any[] {
    const history: any[] = [];

    // Search all blocks for transactions involving this wallet
    for (const block of blockchain.chain) {
      for (const tx of block.transactions) {
        let involved = false;
        let txType = '';
        let amount = 0;

        // Check if we're the recipient of any outputs
        for (const output of tx.outputs) {
          if (output.recipientAddress === this.address) {
            involved = true;
            txType = 'received';
            amount += output.amount;
          }
        }

        // Check if we're the sender (any of our UTXOs are being spent)
        if (!tx.isCoinbase()) {
          for (const input of tx.inputs) {
            const utxoKey = `${input.previousTxHash}:${input.outputIndex}`;
            // This is a simplified check - in practice we'd need to verify the UTXO was ours
            // For now, we'll check if the public key matches
            if (input.publicKey === this.publicKey) {
              involved = true;
              if (txType !== 'received') {
                txType = 'sent';
                // Calculate amount sent (would need UTXO lookup for exact amount)
                amount = tx.getTotalOutputAmount();
              }
            }
          }
        }

        if (involved) {
          history.push({
            hash: tx.hash,
            type: txType,
            amount: amount,
            fee: tx.fee,
            timestamp: new Date(tx.timestamp).toISOString(),
            blockHeight: block.height,
            confirmations: blockchain.getHeight() - block.height + 1
          });
        }
      }
    }

    // Also check pending transactions in mempool
    for (const tx of blockchain.mempool) {
      let involved = false;
      let txType = '';
      let amount = 0;

      // Check outputs
      for (const output of tx.outputs) {
        if (output.recipientAddress === this.address) {
          involved = true;
          txType = 'received';
          amount += output.amount;
        }
      }

      // Check inputs
      for (const input of tx.inputs) {
        if (input.publicKey === this.publicKey) {
          involved = true;
          if (txType !== 'received') {
            txType = 'sent';
            amount = tx.getTotalOutputAmount();
          }
        }
      }

      if (involved) {
        history.push({
          hash: tx.hash,
          type: txType,
          amount: amount,
          fee: tx.fee,
          timestamp: new Date(tx.timestamp).toISOString(),
          blockHeight: null,
          confirmations: 0,
          pending: true
        });
      }
    }

    // Sort by timestamp (newest first)
    return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // Export wallet to JSON (WARNING: includes private key)
  export(): string {
    return JSON.stringify({
      privateKey: this.privateKey,
      publicKey: this.publicKey,
      address: this.address
    });
  }

  // Import wallet from JSON
  static async import(walletData: string): Promise<Wallet> {
    const data = JSON.parse(walletData);
    const wallet = new Wallet(data.privateKey);
    await wallet.initializeKeys();
    return wallet;
  }

  // Import wallet from private key
  static async importFromPrivateKey(privateKey: string): Promise<Wallet> {
    const wallet = new Wallet(privateKey);
    await wallet.initializeKeys();
    return wallet;
  }

  // Generate a new random wallet
  static async generate(): Promise<Wallet> {
    const wallet = new Wallet();
    await wallet.initializeKeys();
    return wallet;
  }

  // Create wallet from seed phrase (simplified - real implementations use BIP39)
  static async fromSeed(seed: string): Promise<Wallet> {
    // This is a very simplified version - real implementations use proper key derivation
    const privateKey = await import('./crypto').then(crypto => crypto.sha256(seed));
    const wallet = new Wallet(privateKey);
    await wallet.initializeKeys();
    return wallet;
  }

  // Find private key that generates a specific address (for demo purposes)
  static async findPrivateKeyForAddress(targetAddress: string, maxAttempts = 1000000): Promise<string | null> {
    console.log(`Searching for private key that generates address: ${targetAddress}`);

    for (let i = 0; i < maxAttempts; i++) {
      // Generate a deterministic private key based on the target address and iteration
      const testSeed = `creator_${targetAddress}_${i}`;
      const { sha256 } = await import('./crypto');
      const privateKey = await sha256(testSeed);

      // Generate public key and address from this private key
      const { generatePublicKey, generateAddress } = await import('./crypto');
      const publicKey = await generatePublicKey(privateKey);
      const address = await generateAddress(publicKey);

      if (address === targetAddress) {
        console.log(`Found matching private key after ${i + 1} attempts!`);
        return privateKey;
      }

      // Log progress every 10000 attempts
      if (i % 10000 === 0 && i > 0) {
        console.log(`Searched ${i} keys...`);
      }
    }

    console.log(`Could not find private key for address ${targetAddress} after ${maxAttempts} attempts`);
    return null;
  }

  // Create wallet for specific address (finds corresponding private key)
  static async createForAddress(targetAddress: string): Promise<Wallet | null> {
    const privateKey = await this.findPrivateKeyForAddress(targetAddress);
    if (!privateKey) {
      return null;
    }

    const wallet = new Wallet(privateKey);
    await wallet.initializeKeys();
    return wallet;
  }

  // Get a readable summary of wallet
  async getSummary(blockchain: Blockchain): Promise<any> {
    const info = await this.getInfo();
    const balance = this.getBalance(blockchain);
    const utxos = this.getUtxos(blockchain);
    const history = this.getTransactionHistory(blockchain);

    return {
      address: info.address,
      balance: balance,
      utxoCount: utxos.length,
      transactionCount: history.length,
      pendingTransactions: history.filter(tx => tx.pending).length
    };
  }
}
