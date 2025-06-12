// Blockchain implementation following Bitcoin whitepaper principles
import { Block } from './block';
import { Transaction, type UTXO } from './transaction';

export class Blockchain {
  public chain: Block[] = [];
  public difficulty = 1;
  public miningReward = 50;
  public readonly maxSupply = 21000000; // 21 million total supply
  public readonly creatorAddress = '1a964aaf3bc24324b1b9be5a2b115f2108ea309e';
  public readonly creatorAllocation = 1000000; // 1 million for creator
  public utxoSet: Map<string, UTXO> = new Map();
  public mempool: Transaction[] = []; // Pending transactions

  // Difficulty adjustment parameters
  public targetBlockTime = 5000; // 5 seconds (very fast for demo)
  public difficultyAdjustmentInterval = 10; // Adjust every 10 blocks

  constructor() {
    // Initialize with genesis block
    this.initializeGenesis();
  }

  private async initializeGenesis(): Promise<void> {
    console.log('Creating genesis block with creator allocation...');
    const genesisBlock = await Block.createGenesisBlock(
      this.difficulty,
      this.creatorAddress,
      this.creatorAllocation
    );
    this.chain.push(genesisBlock);

    // Add all genesis transaction outputs to UTXO set
    for (const tx of genesisBlock.transactions) {
      for (let i = 0; i < tx.outputs.length; i++) {
        const utxoKey = `${tx.hash}:${i}`;
        this.utxoSet.set(utxoKey, {
          txHash: tx.hash,
          outputIndex: i,
          output: tx.outputs[i],
          blockHeight: 0
        });
      }
    }

    console.log('Genesis block created:', genesisBlock.getInfo());
    console.log(`Creator allocation: ${this.creatorAllocation} MRC allocated to ${this.creatorAddress}`);
  }

  // Get the latest block in the chain
  getLatestBlock(): Block {
    return this.chain[this.chain.length - 1];
  }

  // Get blockchain height (number of blocks)
  getHeight(): number {
    return this.chain.length - 1;
  }

  // Add a new block to the chain
  async addBlock(newBlock: Block): Promise<boolean> {
    const previousBlock = this.getLatestBlock();

    // Validate the new block
    if (!(await newBlock.isValid(previousBlock))) {
      console.log('Invalid block rejected');
      return false;
    }

    // Validate all transactions in the block
    for (let i = 1; i < newBlock.transactions.length; i++) { // Skip coinbase
      const tx = newBlock.transactions[i];
      if (!(await tx.isValid(this.utxoSet))) {
        console.log(`Invalid transaction in block: ${tx.hash}`);
        return false;
      }
    }

    // Add block to chain
    this.chain.push(newBlock);

    // Update UTXO set
    await this.updateUtxoSet(newBlock);

    // Remove mined transactions from mempool
    this.removeMinedTransactions(newBlock);

    // Adjust difficulty if needed
    this.adjustDifficulty();

    console.log(`Block ${newBlock.height} added to blockchain`);
    return true;
  }

  // Update UTXO set when a new block is added
  private async updateUtxoSet(block: Block): Promise<void> {
    // Process all transactions in the block
    for (const tx of block.transactions) {
      // Remove spent UTXOs (except for coinbase transactions)
      if (!tx.isCoinbase()) {
        for (const input of tx.inputs) {
          const utxoKey = `${input.previousTxHash}:${input.outputIndex}`;
          this.utxoSet.delete(utxoKey);
        }
      }

      // Add new UTXOs
      for (let i = 0; i < tx.outputs.length; i++) {
        const utxoKey = `${tx.hash}:${i}`;
        this.utxoSet.set(utxoKey, {
          txHash: tx.hash,
          outputIndex: i,
          output: tx.outputs[i],
          blockHeight: block.height
        });
      }
    }
  }

  // Remove transactions that were included in a block from mempool
  private removeMinedTransactions(block: Block): void {
    const minedTxHashes = new Set(block.transactions.map(tx => tx.hash));
    this.mempool = this.mempool.filter(tx => !minedTxHashes.has(tx.hash));
  }

  // Adjust mining difficulty based on block times
  private adjustDifficulty(): void {
    if (this.chain.length % this.difficultyAdjustmentInterval !== 0) {
      return;
    }

    const startBlock = this.chain[this.chain.length - this.difficultyAdjustmentInterval];
    const endBlock = this.chain[this.chain.length - 1];

    const timeExpected = this.targetBlockTime * this.difficultyAdjustmentInterval;
    const timeActual = endBlock.header.timestamp - startBlock.header.timestamp;

    const ratio = timeActual / timeExpected;

    if (ratio < 0.25) {
      // Blocks mined too fast, increase difficulty
      this.difficulty++;
      console.log(`Difficulty increased to ${this.difficulty}`);
    } else if (ratio > 4) {
      // Blocks mined too slow, decrease difficulty
      this.difficulty = Math.max(1, this.difficulty - 1);
      console.log(`Difficulty decreased to ${this.difficulty}`);
    }
  }

  // Mine a new block with pending transactions
  async mineBlock(minerAddress: string): Promise<Block | null> {
    console.log('Starting to mine new block...');

    // Check if we've reached the maximum supply
    const currentSupply = this.getTotalSupply();
    if (currentSupply >= this.maxSupply) {
      console.log('Maximum supply of 21 million MRC reached. No more mining allowed.');
      return null;
    }

    // Create coinbase transaction for mining reward
    const totalFees = this.mempool.reduce((sum, tx) => sum + tx.fee, 0);
    let coinbaseReward = this.miningReward + totalFees;

    // Ensure we don't exceed maximum supply
    if (currentSupply + coinbaseReward > this.maxSupply) {
      coinbaseReward = this.maxSupply - currentSupply;
      console.log(`Adjusting mining reward to ${coinbaseReward} MRC to not exceed maximum supply`);
    }

    const coinbaseTx = Transaction.createCoinbase(minerAddress, this.getHeight() + 1, coinbaseReward);

    // Select transactions from mempool (simplified - in real Bitcoin this involves fee prioritization)
    const blockTransactions = [coinbaseTx, ...this.mempool.slice(0, 100)]; // Limit to 100 transactions

    // Create new block
    const newBlock = new Block(
      this.getLatestBlock().hash,
      blockTransactions,
      this.difficulty,
      this.getHeight() + 1
    );

    try {
      // Mine the block
      await newBlock.mine();

      // Add to blockchain
      const success = await this.addBlock(newBlock);
      if (success) {
        console.log(`Successfully mined block ${newBlock.height}`);
        return newBlock;
      } else {
        console.log('Failed to add mined block to chain');
        return null;
      }
    } catch (error) {
      console.error('Mining failed:', error);
      return null;
    }
  }

  // Add transaction to mempool
  async addTransaction(transaction: Transaction): Promise<boolean> {
    // Validate transaction
    if (!(await transaction.isValid(this.utxoSet))) {
      console.log('Invalid transaction rejected');
      return false;
    }

    // Check if transaction already exists in mempool
    if (this.mempool.some(tx => tx.hash === transaction.hash)) {
      console.log('Transaction already in mempool');
      return false;
    }

    // Add to mempool
    this.mempool.push(transaction);
    console.log(`Transaction ${transaction.hash} added to mempool`);
    return true;
  }

  // Get balance for an address
  getBalance(address: string): number {
    let balance = 0;

    for (const utxo of this.utxoSet.values()) {
      if (utxo.output.recipientAddress === address) {
        balance += utxo.output.amount;
      }
    }

    return balance;
  }

  // Get UTXOs for an address
  getUtxosForAddress(address: string): UTXO[] {
    const utxos: UTXO[] = [];

    for (const utxo of this.utxoSet.values()) {
      if (utxo.output.recipientAddress === address) {
        utxos.push(utxo);
      }
    }

    return utxos;
  }

  // Get total supply of coins in circulation
  getTotalSupply(): number {
    return Array.from(this.utxoSet.values()).reduce((sum, utxo) => sum + utxo.output.amount, 0);
  }

  // Validate the entire blockchain
  async isChainValid(): Promise<boolean> {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (!(await currentBlock.isValid(previousBlock))) {
        return false;
      }
    }

    return true;
  }

  // Get blockchain statistics
  getStats() {
    const totalTransactions = this.chain.reduce((sum, block) => sum + block.transactions.length, 0);
    const totalSupply = this.getTotalSupply();

    return {
      height: this.getHeight(),
      difficulty: this.difficulty,
      totalBlocks: this.chain.length,
      totalTransactions,
      totalSupply,
      maxSupply: this.maxSupply,
      supplyPercentage: (totalSupply / this.maxSupply) * 100,
      mempoolSize: this.mempool.length,
      utxoSetSize: this.utxoSet.size,
      latestBlockHash: this.getLatestBlock().hash,
      latestBlockTime: new Date(this.getLatestBlock().header.timestamp).toISOString(),
      creatorAddress: this.creatorAddress,
      creatorAllocation: this.creatorAllocation
    };
  }

  // Get block by hash
  getBlockByHash(hash: string): Block | undefined {
    return this.chain.find(block => block.hash === hash);
  }

  // Get block by height
  getBlockByHeight(height: number): Block | undefined {
    return this.chain[height];
  }

  // Get transaction by hash (searches all blocks)
  getTransactionByHash(hash: string): Transaction | undefined {
    for (const block of this.chain) {
      const tx = block.transactions.find(tx => tx.hash === hash);
      if (tx) return tx;
    }

    // Also check mempool
    return this.mempool.find(tx => tx.hash === hash);
  }

  // Get recent blocks (for blockchain explorer)
  getRecentBlocks(count = 10): Block[] {
    const start = Math.max(0, this.chain.length - count);
    return this.chain.slice(start).reverse();
  }

  // Get pending transactions from mempool
  getPendingTransactions(): Transaction[] {
    return [...this.mempool];
  }

  // Calculate network hash rate (simplified)
  getNetworkHashRate(): number {
    if (this.chain.length < 2) return 0;

    const recentBlocks = this.chain.slice(-10); // Last 10 blocks
    const totalTime = recentBlocks[recentBlocks.length - 1].header.timestamp - recentBlocks[0].header.timestamp;
    const avgBlockTime = totalTime / (recentBlocks.length - 1);

    // Simplified hash rate calculation
    const difficulty = this.difficulty;
    const hashesPerSecond = 16 ** difficulty / (avgBlockTime / 1000);

    return hashesPerSecond;
  }
}
