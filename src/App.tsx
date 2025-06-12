import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BlockchainDashboard } from '@/components/BlockchainDashboard';
import { WalletInterface } from '@/components/WalletInterface';
import { BlockchainExplorer } from '@/components/BlockchainExplorer';
import { Blockchain } from '@/lib/blockchain';
import { Wallet } from '@/lib/wallet';

function App() {
  const [blockchain, setBlockchain] = useState<Blockchain | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [updateTrigger, setUpdateTrigger] = useState(0);

  useEffect(() => {
    const initializeBlockchain = async () => {
      console.log('Initializing cryptocurrency system...');

      // Create blockchain instance
      const bc = new Blockchain();

      // Wait for genesis block to be created
      await new Promise(resolve => {
        const checkGenesis = () => {
          if (bc.chain.length > 0) {
            resolve(true);
          } else {
            setTimeout(checkGenesis, 100);
          }
        };
        checkGenesis();
      });

      // Create or load wallet (check for imported wallet first)
      let wt: Wallet;
      const importedWalletData = sessionStorage.getItem('importedWallet');

      if (importedWalletData) {
        try {
          const walletData = JSON.parse(importedWalletData);
          wt = await Wallet.importFromPrivateKey(walletData.privateKey);
          sessionStorage.removeItem('importedWallet'); // Clear after use
          console.log('Loaded imported wallet:', wt.getAddress());
        } catch (error) {
          console.error('Failed to load imported wallet:', error);
          wt = await Wallet.generate();
        }
      } else {
        wt = await Wallet.generate();
      }

      setBlockchain(bc);
      setWallet(wt);
      setIsInitialized(true);

      console.log('Cryptocurrency system initialized!');
      console.log('Blockchain height:', bc.getHeight());
      console.log('Wallet address:', wt.getAddress());
    };

    initializeBlockchain();
  }, []);

  const handleUpdate = () => {
    setUpdateTrigger(prev => prev + 1);
  };

  if (!isInitialized || !blockchain || !wallet) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
              <h2 className="text-lg font-semibold">Initializing Cryptocurrency</h2>
              <p className="text-sm text-muted-foreground">
                Creating blockchain and generating wallet...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">Marscoin</h1>
              <Badge variant="secondary">Testnet</Badge>
            </div>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <span className="text-muted-foreground">Height:</span>
                <Badge variant="outline">{blockchain.getHeight()}</Badge>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-muted-foreground">Difficulty:</span>
                <Badge variant="outline">{blockchain.difficulty}</Badge>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-muted-foreground">Balance:</span>
                <Badge variant="default">{wallet.getBalance(blockchain)} MRC</Badge>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="wallet">Wallet</TabsTrigger>
            <TabsTrigger value="explorer">Explorer</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Blockchain Dashboard</h2>
              <p className="text-muted-foreground">
                Monitor blockchain statistics, mine blocks, and view network health.
              </p>
            </div>
            <BlockchainDashboard
              blockchain={blockchain}
              wallet={wallet}
              onUpdate={handleUpdate}
            />
          </TabsContent>

          <TabsContent value="wallet" className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Wallet Management</h2>
              <p className="text-muted-foreground">
                Manage your cryptocurrency wallet, send transactions, and view history.
              </p>
            </div>
            <WalletInterface
              blockchain={blockchain}
              wallet={wallet}
              onUpdate={handleUpdate}
            />
          </TabsContent>

          <TabsContent value="explorer" className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Blockchain Explorer</h2>
              <p className="text-muted-foreground">
                Explore blocks, transactions, and search the blockchain.
              </p>
            </div>
            <BlockchainExplorer blockchain={blockchain} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">Marscoin Cryptocurrency</h3>
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
              A fully functional cryptocurrency implementation based on the Bitcoin whitepaper by Satoshi Nakamoto.
              Features include proof-of-work consensus, UTXO model, digital signatures, mining, and a complete blockchain explorer.
              Created by RS Bogati with a 21 million MRC maximum supply.
            </p>
            <div className="flex justify-center space-x-6 text-xs text-muted-foreground">
              <span>• 21M Max Supply</span>
              <span>• Easy Mining (Low Difficulty)</span>
              <span>• UTXO Transaction Model</span>
              <span>• Digital Signatures</span>
              <span>• Creator: RS Bogati</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
