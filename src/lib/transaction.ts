// Transaction implementation following the UTXO model from Bitcoin whitepaper
import { sha256, signMessage, verifySignature } from './crypto';

// Transaction Input (references previous transaction output)
export interface TransactionInput {
  previousTxHash: string;  // Hash of the previous transaction
  outputIndex: number;     // Index of the output in the previous transaction
  signature: string;       // Digital signature proving ownership
  publicKey: string;       // Public key of the spender
}

// Transaction Output (specifies recipient and amount)
export interface TransactionOutput {
  amount: number;          // Amount of coins
  recipientAddress: string; // Address of the recipient
}

// Unspent Transaction Output (UTXO)
export interface UTXO {
  txHash: string;
  outputIndex: number;
  output: TransactionOutput;
  blockHeight: number;
}

export class Transaction {
  public hash = '';
  public timestamp: number;

  constructor(
    public inputs: TransactionInput[],
    public outputs: TransactionOutput[],
    public fee = 0
  ) {
    this.timestamp = Date.now();
  }

  // Calculate transaction hash
  async calculateHash(): Promise<string> {
    const data = JSON.stringify({
      inputs: this.inputs.map(input => ({
        previousTxHash: input.previousTxHash,
        outputIndex: input.outputIndex,
        publicKey: input.publicKey
      })),
      outputs: this.outputs,
      timestamp: this.timestamp,
      fee: this.fee
    });

    this.hash = await sha256(data);
    return this.hash;
  }

  // Get transaction data for signing (without signatures)
  getDataForSigning(): string {
    return JSON.stringify({
      inputs: this.inputs.map(input => ({
        previousTxHash: input.previousTxHash,
        outputIndex: input.outputIndex,
        publicKey: input.publicKey
      })),
      outputs: this.outputs,
      timestamp: this.timestamp,
      fee: this.fee
    });
  }

  // Sign transaction inputs
  async signInputs(privateKeys: string[]): Promise<void> {
    if (privateKeys.length !== this.inputs.length) {
      throw new Error('Number of private keys must match number of inputs');
    }

    const dataToSign = this.getDataForSigning();

    for (let i = 0; i < this.inputs.length; i++) {
      this.inputs[i].signature = await signMessage(dataToSign, privateKeys[i]);
    }

    await this.calculateHash();
  }

  // Verify all input signatures
  async verifySignatures(): Promise<boolean> {
    const dataToSign = this.getDataForSigning();

    for (const input of this.inputs) {
      const isValid = await verifySignature(dataToSign, input.signature, input.publicKey);
      if (!isValid) {
        return false;
      }
    }

    return true;
  }

  // Calculate total input amount (requires UTXO set to look up previous outputs)
  getTotalInputAmount(utxoSet: Map<string, UTXO>): number {
    let total = 0;

    for (const input of this.inputs) {
      const utxoKey = `${input.previousTxHash}:${input.outputIndex}`;
      const utxo = utxoSet.get(utxoKey);

      if (utxo) {
        total += utxo.output.amount;
      }
    }

    return total;
  }

  // Calculate total output amount
  getTotalOutputAmount(): number {
    return this.outputs.reduce((total, output) => total + output.amount, 0);
  }

  // Validate transaction
  async isValid(utxoSet: Map<string, UTXO>): Promise<boolean> {
    // Check if transaction has inputs and outputs
    if (this.inputs.length === 0 || this.outputs.length === 0) {
      return false;
    }

    // Verify signatures
    if (!(await this.verifySignatures())) {
      return false;
    }

    // Check if all inputs exist in UTXO set
    for (const input of this.inputs) {
      const utxoKey = `${input.previousTxHash}:${input.outputIndex}`;
      if (!utxoSet.has(utxoKey)) {
        return false;
      }
    }

    // Check if input amount >= output amount + fee
    const totalInput = this.getTotalInputAmount(utxoSet);
    const totalOutput = this.getTotalOutputAmount();

    if (totalInput < totalOutput + this.fee) {
      return false;
    }

    // Check for positive amounts
    for (const output of this.outputs) {
      if (output.amount <= 0) {
        return false;
      }
    }

    return true;
  }

  // Check if this is a coinbase transaction (mining reward)
  isCoinbase(): boolean {
    return this.inputs.length === 1 &&
           this.inputs[0].previousTxHash === '0000000000000000000000000000000000000000000000000000000000000000' &&
           this.inputs[0].outputIndex === 0xFFFFFFFF;
  }

  // Create a coinbase transaction for mining rewards
  static createCoinbase(minerAddress: string, blockHeight: number, reward: number): Transaction {
    const coinbaseInput: TransactionInput = {
      previousTxHash: '0000000000000000000000000000000000000000000000000000000000000000',
      outputIndex: 0xFFFFFFFF,
      signature: `coinbase_${blockHeight}`,
      publicKey: `coinbase_${blockHeight}`
    };

    const coinbaseOutput: TransactionOutput = {
      amount: reward,
      recipientAddress: minerAddress
    };

    const tx = new Transaction([coinbaseInput], [coinbaseOutput], 0);
    tx.calculateHash();
    return tx;
  }

  // Convert to JSON for storage/transmission
  toJSON() {
    return {
      hash: this.hash,
      inputs: this.inputs,
      outputs: this.outputs,
      fee: this.fee,
      timestamp: this.timestamp
    };
  }

  // Create from JSON
  static fromJSON(data: any): Transaction {
    const tx = new Transaction(data.inputs, data.outputs, data.fee);
    tx.hash = data.hash;
    tx.timestamp = data.timestamp;
    return tx;
  }
}
