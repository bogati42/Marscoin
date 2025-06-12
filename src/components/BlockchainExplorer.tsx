import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Blockchain } from '@/lib/blockchain';
import type { Block } from '@/lib/block';
import type { Transaction } from '@/lib/transaction';

interface BlockchainExplorerProps {
  blockchain: Blockchain;
}

export function BlockchainExplorer({ blockchain }: BlockchainExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const recentBlocks = blockchain.getRecentBlocks(10);
  const pendingTransactions = blockchain.getPendingTransactions();

  const formatHash = (hash: string) => {
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;

    // Try to find block by hash or height
    const block = blockchain.getBlockByHash(searchQuery) ||
                  blockchain.getBlockByHeight(Number.parseInt(searchQuery));

    if (block) {
      setSelectedBlock(block);
      return;
    }

    // Try to find transaction by hash
    const transaction = blockchain.getTransactionByHash(searchQuery);
    if (transaction) {
      setSelectedTransaction(transaction);
      return;
    }

    alert('Block or transaction not found');
  };

  const BlockDetails = ({ block }: { block: Block }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium">Height</p>
          <p className="text-sm text-muted-foreground">{block.height}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Difficulty</p>
          <p className="text-sm text-muted-foreground">{block.header.difficulty}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Nonce</p>
          <p className="text-sm text-muted-foreground">{block.header.nonce}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Size</p>
          <p className="text-sm text-muted-foreground">{(block.getSize() / 1024).toFixed(2)} KB</p>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">Hash</p>
        <p className="text-xs font-mono break-all">{block.hash}</p>
      </div>

      <div>
        <p className="text-sm font-medium">Previous Hash</p>
        <p className="text-xs font-mono break-all">{block.header.previousBlockHash}</p>
      </div>

      <div>
        <p className="text-sm font-medium">Merkle Root</p>
        <p className="text-xs font-mono break-all">{block.header.merkleRoot}</p>
      </div>

      <div>
        <p className="text-sm font-medium">Timestamp</p>
        <p className="text-sm text-muted-foreground">
          {new Date(block.header.timestamp).toLocaleString()}
        </p>
      </div>

      <div>
        <p className="text-sm font-medium">Transactions ({block.transactions.length})</p>
        <div className="mt-2 space-y-2">
          {block.transactions.map((tx, index) => (
            <div key={tx.hash} className="p-2 border rounded">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono">{formatHash(tx.hash)}</span>
                <div className="flex gap-2">
                  {tx.isCoinbase() && <Badge variant="secondary">Coinbase</Badge>}
                  <Badge variant="outline">{tx.outputs.length} outputs</Badge>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Amount: {tx.getTotalOutputAmount()} MRC
                {tx.fee > 0 && ` | Fee: ${tx.fee} MRC`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const TransactionDetails = ({ transaction }: { transaction: Transaction }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium">Hash</p>
          <p className="text-xs font-mono break-all">{transaction.hash}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Fee</p>
          <p className="text-sm text-muted-foreground">{transaction.fee} MRC</p>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">Timestamp</p>
        <p className="text-sm text-muted-foreground">
          {new Date(transaction.timestamp).toLocaleString()}
        </p>
      </div>

      {!transaction.isCoinbase() && (
        <div>
          <p className="text-sm font-medium">Inputs ({transaction.inputs.length})</p>
          <div className="mt-2 space-y-2">
            {transaction.inputs.map((input, index) => (
              <div key={index} className="p-2 border rounded">
                <p className="text-xs">Previous TX: {formatHash(input.previousTxHash)}</p>
                <p className="text-xs">Output Index: {input.outputIndex}</p>
                <p className="text-xs">Public Key: {formatHash(input.publicKey)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-medium">Outputs ({transaction.outputs.length})</p>
        <div className="mt-2 space-y-2">
          {transaction.outputs.map((output, index) => (
            <div key={index} className="p-2 border rounded">
              <div className="flex justify-between">
                <span className="text-xs">To: {formatAddress(output.recipientAddress)}</span>
                <span className="text-xs font-medium">{output.amount} MRC</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle>Blockchain Explorer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search by block hash, height, or transaction hash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch}>Search</Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Blocks */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Blocks</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Height</TableHead>
                <TableHead>Hash</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Transactions</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentBlocks.map((block) => (
                <TableRow key={block.hash}>
                  <TableCell>{block.height}</TableCell>
                  <TableCell className="font-mono">{formatHash(block.hash)}</TableCell>
                  <TableCell>{new Date(block.header.timestamp).toLocaleTimeString()}</TableCell>
                  <TableCell>{block.transactions.length}</TableCell>
                  <TableCell>{(block.getSize() / 1024).toFixed(1)} KB</TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">View</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Block #{block.height}</DialogTitle>
                        </DialogHeader>
                        <BlockDetails block={block} />
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending Transactions */}
      {pendingTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Transactions ({pendingTransactions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hash</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Outputs</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingTransactions.slice(0, 10).map((tx) => (
                  <TableRow key={tx.hash}>
                    <TableCell className="font-mono">{formatHash(tx.hash)}</TableCell>
                    <TableCell>{tx.getTotalOutputAmount()} MRC</TableCell>
                    <TableCell>{tx.fee} MRC</TableCell>
                    <TableCell>{tx.outputs.length}</TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">View</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Transaction Details</DialogTitle>
                          </DialogHeader>
                          <TransactionDetails transaction={tx} />
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Search Result Dialogs */}
      {selectedBlock && (
        <Dialog open={!!selectedBlock} onOpenChange={() => setSelectedBlock(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Block #{selectedBlock.height}</DialogTitle>
            </DialogHeader>
            <BlockDetails block={selectedBlock} />
          </DialogContent>
        </Dialog>
      )}

      {selectedTransaction && (
        <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Transaction Details</DialogTitle>
            </DialogHeader>
            <TransactionDetails transaction={selectedTransaction} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
