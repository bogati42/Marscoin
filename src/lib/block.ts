// Block implementation following the Bitcoin whitepaper structure
import { sha256, calculateMerkleRoot, isValidProofOfWork, numberToHex } from './crypto';
import { Transaction } from './transaction';

export interface BlockHeader {
  version: number;              // Block version
  previousBlockHash: string;    // Hash of the previous block
  merkleRoot: string;          // Merkle root of all transactions
  timestamp: number;           // Block creation timestamp
  difficulty: number;          // Mining difficulty (number of leading zeros)
  nonce: number;              // Proof-of-work nonce
}

export class Block {
  public hash = '';
  public header: BlockHeader;
  public transactions: Transaction[];
  public height: number;

  constructor(
    previousBlockHash: string,
    transactions: Transaction[],
    difficulty: number,
    height = 0
  ) {
    this.header = {
      version: 1,
      previousBlockHash,
      merkleRoot: '',
      timestamp: Date.now(),
      difficulty,
      nonce: 0
    };
    this.transactions = transactions;
    this.height = height;
  }

  // Calculate merkle root of all transactions
  async calculateMerkleRoot(): Promise<string> {
    if (this.transactions.length === 0) {
      this.header.merkleRoot = await sha256('');
      return this.header.merkleRoot;
    }

    const txHashes: string[] = [];
    for (const tx of this.transactions) {
      if (!tx.hash) {
        await tx.calculateHash();
      }
      txHashes.push(tx.hash);
    }

    this.header.merkleRoot = await calculateMerkleRoot(txHashes);
    return this.header.merkleRoot;
  }

  // Calculate block hash
  async calculateHash(): Promise<string> {
    await this.calculateMerkleRoot();

    const headerData = JSON.stringify({
      version: this.header.version,
      previousBlockHash: this.header.previousBlockHash,
      merkleRoot: this.header.merkleRoot,
      timestamp: this.header.timestamp,
      difficulty: this.header.difficulty,
      nonce: this.header.nonce
    });

    this.hash = await sha256(headerData);
    return this.hash;
  }

  // Mine the block (find valid nonce for proof-of-work)
  async mine(): Promise<void> {
    console.log(`Mining block ${this.height} with difficulty ${this.header.difficulty}...`);
    const startTime = Date.now();

    // Calculate merkle root first
    await this.calculateMerkleRoot();

    let attempts = 0;

    while (true) {
      // Calculate hash with current nonce
      await this.calculateHash();

      // Check if hash meets difficulty requirement
      if (isValidProofOfWork(this.hash, this.header.difficulty)) {
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        console.log(`Block ${this.height} mined! Nonce: ${this.header.nonce}, Hash: ${this.hash}, Time: ${duration}s, Attempts: ${attempts}`);
        break;
      }

      // Increment nonce and try again
      this.header.nonce++;
      attempts++;

      // Update timestamp periodically to reflect real mining time
      if (attempts % 10000 === 0 && attempts > 0) {
        this.header.timestamp = Date.now();
        console.log(`Mining attempt ${attempts}, current nonce: ${this.header.nonce}`);
      }

      // Prevent infinite loops in case of extremely high difficulty (reduced timeout)
      if (attempts > 1000000) {
        throw new Error('Mining timeout - difficulty too high');
      }
    }
  }

  // Validate block structure and proof-of-work
  async isValid(previousBlock?: Block): Promise<boolean> {
    // Validate block hash
    const calculatedHash = await this.calculateHash();
    if (calculatedHash !== this.hash) {
      return false;
    }

    // Validate proof-of-work
    if (!isValidProofOfWork(this.hash, this.header.difficulty)) {
      return false;
    }

    // Validate merkle root
    const calculatedMerkleRoot = await this.calculateMerkleRoot();
    if (calculatedMerkleRoot !== this.header.merkleRoot) {
      return false;
    }

    // Validate previous block hash (if not genesis block)
    if (previousBlock && this.header.previousBlockHash !== previousBlock.hash) {
      return false;
    }

    // Validate timestamp (should not be too far in the future)
    const now = Date.now();
    if (this.header.timestamp > now + 2 * 60 * 60 * 1000) { // 2 hours tolerance
      return false;
    }

    // Validate transactions
    for (const tx of this.transactions) {
      if (!tx.hash) {
        await tx.calculateHash();
      }
    }

    // At least one transaction (coinbase)
    if (this.transactions.length === 0) {
      return false;
    }

    // First transaction should be coinbase
    if (!this.transactions[0].isCoinbase()) {
      return false;
    }

    // Only first transaction can be coinbase
    for (let i = 1; i < this.transactions.length; i++) {
      if (this.transactions[i].isCoinbase()) {
        return false;
      }
    }

    return true;
  }

  // Get block size in bytes (approximate)
  getSize(): number {
    const blockData = JSON.stringify(this.toJSON());
    return new Blob([blockData]).size;
  }

  // Get total transaction fees in the block
  getTotalFees(): number {
    let totalFees = 0;
    for (let i = 1; i < this.transactions.length; i++) { // Skip coinbase
      totalFees += this.transactions[i].fee;
    }
    return totalFees;
  }

  // Get block reward (coinbase transaction amount)
  getBlockReward(): number {
    if (this.transactions.length === 0) return 0;
    const coinbase = this.transactions[0];
    return coinbase.getTotalOutputAmount();
  }

  // Create genesis block with creator allocation
  static async createGenesisBlock(difficulty = 1, creatorAddress?: string, creatorAllocation?: number): Promise<Block> {
    const transactions: Transaction[] = [];

    // Regular genesis coinbase transaction
    const genesisTransaction = Transaction.createCoinbase(
      'genesis_address_1a2b3c4d5e6f7890',
      0,
      50 // Initial reward
    );
    transactions.push(genesisTransaction);

    // Creator allocation transaction if specified
    if (creatorAddress && creatorAllocation) {
      const creatorTransaction = Transaction.createCoinbase(
        creatorAddress,
        0,
        creatorAllocation
      );
      transactions.push(creatorTransaction);
    }

    const block = new Block(
      '0000000000000000000000000000000000000000000000000000000000000000',
      transactions,
      difficulty,
      0
    );

    await block.mine();
    return block;
  }

  // Convert to JSON for storage/transmission
  toJSON() {
    return {
      hash: this.hash,
      header: this.header,
      transactions: this.transactions.map(tx => tx.toJSON()),
      height: this.height
    };
  }

  // Create from JSON
  static fromJSON(data: any): Block {
    const block = new Block(
      data.header.previousBlockHash,
      data.transactions.map((tx: any) => Transaction.fromJSON(tx)),
      data.header.difficulty,
      data.height
    );

    block.header = data.header;
    block.hash = data.hash;

    return block;
  }

  // Get human-readable info
  getInfo() {
    return {
      height: this.height,
      hash: this.hash,
      previousHash: this.header.previousBlockHash,
      timestamp: new Date(this.header.timestamp).toISOString(),
      difficulty: this.header.difficulty,
      nonce: this.header.nonce,
      transactionCount: this.transactions.length,
      size: this.getSize(),
      totalFees: this.getTotalFees(),
      blockReward: this.getBlockReward()
    };
  }
}
