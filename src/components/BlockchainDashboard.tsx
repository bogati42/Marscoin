import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Blockchain } from '@/lib/blockchain';
import type { Wallet } from '@/lib/wallet';
import type { Block } from '@/lib/block';

interface BlockchainDashboardProps {
  blockchain: Blockchain;
  wallet: Wallet;
  onUpdate: () => void;
}

export function BlockchainDashboard({ blockchain, wallet, onUpdate }: BlockchainDashboardProps) {
  const [isMining, setIsMining] = useState(false);
  const [stats, setStats] = useState(blockchain.getStats());
  const [balance, setBalance] = useState(0);
  const [lastMinedBlock, setLastMinedBlock] = useState<Block | null>(null);

  useEffect(() => {
    const updateStats = () => {
      setStats(blockchain.getStats());
      setBalance(wallet.getBalance(blockchain));
    };

    updateStats();
    const interval = setInterval(updateStats, 1000);
    return () => clearInterval(interval);
  }, [blockchain, wallet]);

  const handleMineBlock = async () => {
    if (isMining) return;

    setIsMining(true);
    try {
      const newBlock = await blockchain.mineBlock(wallet.getAddress());
      if (newBlock) {
        setLastMinedBlock(newBlock);
        onUpdate();
      }
    } catch (error) {
      console.error('Mining failed:', error);
    } finally {
      setIsMining(false);
    }
  };

  const formatHash = (hash: string) => {
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatHashRate = (hashRate: number) => {
    if (hashRate > 1000000) {
      return `${(hashRate / 1000000).toFixed(2)} MH/s`;
    } else if (hashRate > 1000) {
      return `${(hashRate / 1000).toFixed(2)} KH/s`;
    } else {
      return `${hashRate.toFixed(2)} H/s`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Block Height</CardTitle>
            <Badge variant="secondary">{stats.height}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalBlocks)}</div>
            <p className="text-xs text-muted-foreground">Total blocks mined</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Difficulty</CardTitle>
            <Badge variant="outline">{stats.difficulty}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHashRate(blockchain.getNetworkHashRate())}</div>
            <p className="text-xs text-muted-foreground">Network hash rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Balance</CardTitle>
            <Badge variant="default">{balance} MRC</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalSupply)}</div>
            <p className="text-xs text-muted-foreground">
              Total supply / {formatNumber(stats.maxSupply)} max ({stats.supplyPercentage?.toFixed(2)}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mempool</CardTitle>
            <Badge variant="secondary">{stats.mempoolSize}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalTransactions)}</div>
            <p className="text-xs text-muted-foreground">Total transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Mining Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Mining Controls
            {isMining && <Badge variant="destructive">Mining...</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Miner Address</p>
              <p className="text-xs text-muted-foreground">{formatHash(wallet.getAddress())}</p>
            </div>
            <Button
              onClick={handleMineBlock}
              disabled={isMining}
              className="min-w-[120px]"
            >
              {isMining ? 'Mining...' : 'Mine Block'}
            </Button>
          </div>

          {lastMinedBlock && (
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-sm font-medium text-green-800">
                Successfully mined block #{lastMinedBlock.height}
              </p>
              <p className="text-xs text-green-600">
                Hash: {formatHash(lastMinedBlock.hash)}
              </p>
              <p className="text-xs text-green-600">
                Reward: {lastMinedBlock.getBlockReward()} MRC
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Latest Block Info */}
      <Card>
        <CardHeader>
          <CardTitle>Latest Block</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Hash:</span>
              <span className="text-sm font-mono">{formatHash(stats.latestBlockHash)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Timestamp:</span>
              <span className="text-sm">{new Date(stats.latestBlockTime).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Transactions:</span>
              <span className="text-sm">{blockchain.getLatestBlock().transactions.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Size:</span>
              <span className="text-sm">{(blockchain.getLatestBlock().getSize() / 1024).toFixed(2)} KB</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Creator Information */}
      <Card>
        <CardHeader>
          <CardTitle>Creator Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Creator</span>
              <span className="text-sm font-medium">RS Bogati</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm">Creator Address</span>
              <span className="text-xs font-mono break-all">{stats.creatorAddress}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Creator Allocation</span>
              <span className="text-sm font-medium">{formatNumber(stats.creatorAllocation)} MRC</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Creator Balance</span>
              <span className="text-sm font-medium">{formatNumber(blockchain.getBalance(stats.creatorAddress))} MRC</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Network Health */}
      <Card>
        <CardHeader>
          <CardTitle>Network Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Chain Validation</span>
              <Badge variant="default">Valid</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Maximum Supply</span>
              <span className="text-sm">{formatNumber(stats.maxSupply)} MRC</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Supply Progress</span>
              <span className="text-sm">{stats.supplyPercentage?.toFixed(2)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">UTXO Set Size</span>
              <span className="text-sm">{stats.utxoSetSize} UTXOs</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Block Time Target</span>
              <span className="text-sm">{blockchain.targetBlockTime / 1000}s (Very Fast)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Next Difficulty Adjustment</span>
              <span className="text-sm">
                {blockchain.difficultyAdjustmentInterval - (stats.height % blockchain.difficultyAdjustmentInterval)} blocks
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
