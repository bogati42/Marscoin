import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Blockchain } from '@/lib/blockchain';
import { Wallet } from '@/lib/wallet';

interface WalletInterfaceProps {
  blockchain: Blockchain;
  wallet: Wallet;
  onUpdate: () => void;
}

export function WalletInterface({ blockchain, wallet, onUpdate }: WalletInterfaceProps) {
  const [balance, setBalance] = useState(0);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('1');
  const [isSending, setIsSending] = useState(false);
  const [transactionHistory, setTransactionHistory] = useState<any[]>([]);
  const [utxos, setUtxos] = useState<any[]>([]);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [importPrivateKey, setImportPrivateKey] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  useEffect(() => {
    const updateWalletData = () => {
      setBalance(wallet.getBalance(blockchain));
      setTransactionHistory(wallet.getTransactionHistory(blockchain));
      setUtxos(wallet.getUtxos(blockchain));
    };

    updateWalletData();
    const interval = setInterval(updateWalletData, 2000);
    return () => clearInterval(interval);
  }, [blockchain, wallet]);

  const handleSendTransaction = async () => {
    if (!recipientAddress || !amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      alert('Please enter valid recipient address and amount');
      return;
    }

    if (Number(amount) + Number(fee) > balance) {
      alert('Insufficient balance');
      return;
    }

    setIsSending(true);
    try {
      const success = await wallet.sendTransaction(
        recipientAddress,
        Number(amount),
        Number(fee),
        blockchain
      );

      if (success) {
        alert('Transaction sent successfully!');
        setRecipientAddress('');
        setAmount('');
        onUpdate();
      } else {
        alert('Failed to send transaction');
      }
    } catch (error) {
      console.error('Transaction error:', error);
      alert('Transaction failed');
    } finally {
      setIsSending(false);
    }
  };

  const formatHash = (hash: string) => {
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  // Generate a sample recipient address for testing
  const generateSampleAddress = async () => {
    const sampleWallet = await Wallet.generate();
    setRecipientAddress(sampleWallet.getAddress());
  };

  // Import wallet from private key
  const handleImportWallet = async () => {
    if (!importPrivateKey.trim()) {
      alert('Please enter a private key');
      return;
    }

    setIsImporting(true);
    try {
      const importedWallet = await Wallet.importFromPrivateKey(importPrivateKey.trim());

      // Replace the current wallet data
      const newWalletData = JSON.stringify({
        privateKey: importedWallet.getPrivateKey(),
        publicKey: importedWallet.getPublicKey(),
        address: importedWallet.getAddress()
      });

      // Store in sessionStorage and reload
      sessionStorage.setItem('importedWallet', newWalletData);
      alert(`Wallet imported successfully!\nAddress: ${importedWallet.getAddress()}`);
      window.location.reload();

    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import wallet. Please check the private key.');
    } finally {
      setIsImporting(false);
    }
  };

  // Generate creator wallet private key (for the specific creator address)
  const generateCreatorKey = async () => {
    try {
      // Generate a deterministic private key for the creator address
      // This is a simplified approach - in production, you'd have the actual private key
      const { sha256 } = await import('@/lib/crypto');
      const creatorSeed = 'rs_bogati_creator_marscoin_1a964aaf3bc24324b1b9be5a2b115f2108ea309e';
      const creatorKey = await sha256(creatorSeed);
      setImportPrivateKey(creatorKey);

      // Verify this generates the correct address
      const testWallet = await Wallet.importFromPrivateKey(creatorKey);
      console.log('Generated test address:', testWallet.getAddress());

    } catch (error) {
      console.error('Error generating creator key:', error);
      // Fallback demo key
      setImportPrivateKey('a'.repeat(64));
    }
  };

  return (
    <div className="space-y-6">
      {/* Wallet Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Wallet Overview
            <Badge variant="default">{balance} MRC</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium">Address</p>
            <div className="flex items-center gap-2">
              <p className="text-xs font-mono flex-1">{wallet.getAddress()}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(wallet.getAddress())}
              >
                Copy
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium">Balance</p>
              <p className="text-lg font-bold">{balance} MRC</p>
            </div>
            <div>
              <p className="text-sm font-medium">UTXOs</p>
              <p className="text-lg font-bold">{utxos.length}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">Public Key</p>
            <div className="flex items-center gap-2">
              <p className="text-xs font-mono flex-1">{formatHash(wallet.getPublicKey())}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(wallet.getPublicKey())}
              >
                Copy
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Private Key</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPrivateKey(!showPrivateKey)}
              >
                {showPrivateKey ? 'Hide' : 'Show'}
              </Button>
            </div>
            {showPrivateKey && (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs font-mono flex-1 text-red-600">{wallet.getPrivateKey()}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(wallet.getPrivateKey())}
                >
                  Copy
                </Button>
              </div>
            )}
            {showPrivateKey && (
              <p className="text-xs text-red-500 mt-1">
                ⚠️ Never share your private key with anyone!
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Send Transaction */}
      <Card>
        <CardHeader>
          <CardTitle>Send Transaction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Recipient Address</label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder="Enter recipient address..."
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" onClick={generateSampleAddress}>
                Sample
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Amount (MRC)</label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Fee (MRC)</label>
              <Input
                type="number"
                placeholder="1"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Total: {Number(amount || 0) + Number(fee || 0)} MRC
              {balance > 0 && (
                <span className="ml-2">
                  (Available: {balance} MRC)
                </span>
              )}
            </div>
            <Button
              onClick={handleSendTransaction}
              disabled={isSending || balance === 0}
              className="min-w-[120px]"
            >
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* UTXOs */}
      {utxos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Unspent Transaction Outputs (UTXOs)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction Hash</TableHead>
                  <TableHead>Output Index</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Block Height</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {utxos.map((utxo, index) => (
                  <TableRow key={`${utxo.txHash}:${utxo.outputIndex}`}>
                    <TableCell className="font-mono">{formatHash(utxo.txHash)}</TableCell>
                    <TableCell>{utxo.outputIndex}</TableCell>
                    <TableCell>{utxo.output.amount} MRC</TableCell>
                    <TableCell>{utxo.blockHeight}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History ({transactionHistory.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {transactionHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No transactions yet. Start by mining some blocks or receiving coins!
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hash</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionHistory.slice(0, 20).map((tx) => (
                  <TableRow key={tx.hash}>
                    <TableCell className="font-mono">{formatHash(tx.hash)}</TableCell>
                    <TableCell>
                      <Badge variant={tx.type === 'received' ? 'default' : 'secondary'}>
                        {tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={tx.type === 'received' ? 'text-green-600' : 'text-red-600'}
                    >
                      {tx.type === 'received' ? '+' : '-'}{tx.amount} MRC
                    </TableCell>
                    <TableCell>{tx.fee} MRC</TableCell>
                    <TableCell>
                      {tx.pending ? (
                        <Badge variant="outline">Pending</Badge>
                      ) : (
                        <Badge variant="default">{tx.confirmations} conf</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(tx.timestamp).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Wallet Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Wallet Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  Export Wallet
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Export Wallet</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Export your wallet data (contains private key - keep secure!)
                  </p>
                  <div className="p-3 bg-gray-100 rounded font-mono text-xs break-all">
                    {wallet.export()}
                  </div>
                  <Button
                    onClick={() => copyToClipboard(wallet.export())}
                    className="w-full"
                  >
                    Copy Wallet Data
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  Import Wallet
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import Wallet from Private Key</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Enter a private key to import an existing wallet.
                  </p>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Private Key</label>
                    <Input
                      type="password"
                      placeholder="Enter 64-character private key..."
                      value={importPrivateKey}
                      onChange={(e) => setImportPrivateKey(e.target.value)}
                    />
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm text-blue-800 font-medium">Creator Wallet</p>
                    <p className="text-xs text-blue-700 mt-1">
                      For RS Bogati's creator wallet with 1M MRC allocation:
                    </p>
                    <p className="text-xs font-mono text-blue-600 mt-1 break-all">
                      Address: 1a964aaf3bc24324b1b9be5a2b115f2108ea309e
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateCreatorKey}
                      className="mt-2"
                    >
                      Use Creator Key (Demo)
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleImportWallet}
                      disabled={isImporting || !importPrivateKey.trim()}
                      className="flex-1"
                    >
                      {isImporting ? 'Importing...' : 'Import Wallet'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowImportDialog(false);
                        setImportPrivateKey('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>

                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-xs text-red-700">
                      ⚠️ Only import private keys you trust. Importing will replace your current wallet.
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full"
            >
              Generate New Wallet
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>• Export: Save your wallet data securely</p>
            <p>• Import: Load an existing wallet using private key</p>
            <p>• New Wallet: Generate a fresh wallet (current wallet will be lost)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
