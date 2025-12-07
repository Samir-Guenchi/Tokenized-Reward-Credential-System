/**
 * @file src/pages/TokensPage.tsx
 * @description Token management page with humanized design
 */

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWalletStore } from '../store/wallet';
import { tokenApi } from '../services/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Coins, 
  Send, 
  Wallet, 
  ArrowUpRight, 
  RefreshCw,
  Info,
  AlertCircle,
  CheckCircle2,
  Copy,
  Sparkles,
  TrendingUp
} from 'lucide-react';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 100, damping: 15 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 100, damping: 12 }
  },
  hover: {
    y: -4,
    transition: { type: "spring" as const, stiffness: 300, damping: 20 }
  }
};

export default function TokensPage() {
  const { isConnected, address, trcsBalance, refreshTRCSBalance, transferTRCS } = useWalletStore();
  const queryClient = useQueryClient();
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [copied, setCopied] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  const { data: tokenInfo, isLoading: tokenLoading, refetch: refetchInfo } = useQuery({
    queryKey: ['tokenInfo'],
    queryFn: () => tokenApi.getInfo(),
    select: (res) => res.data.data,
  });

  const { data: balance, isLoading: balanceLoading, refetch: refetchBalance } = useQuery({
    queryKey: ['tokenBalance', address],
    queryFn: () => tokenApi.getBalance(address!),
    select: (res) => res.data.data.balance,
    enabled: !!address,
  });

  // Refresh TRCS balance on mount
  useEffect(() => {
    if (isConnected) {
      refreshTRCSBalance();
    }
  }, [isConnected, refreshTRCSBalance]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTo || !transferAmount) {
      toast.error('Fill in both fields first');
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(transferTo)) {
      toast.error('That doesn\'t look like a valid address');
      return;
    }
    if (isNaN(parseFloat(transferAmount)) || parseFloat(transferAmount) <= 0) {
      toast.error('Amount needs to be a positive number');
      return;
    }
    
    setIsTransferring(true);
    try {
      const result = await transferTRCS(transferTo, transferAmount);
      toast.success(`Tokens sent! 🎉 TX: ${result.hash.slice(0, 10)}...`);
      queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });
      setTransferTo('');
      setTransferAmount('');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Transfer failed';
      toast.error(errorMessage);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied!');
    }
  };

  const handleRefresh = () => {
    refetchInfo();
    refetchBalance();
    toast.success('All fresh!');
  };

  if (!isConnected) {
    return (
      <motion.div 
        className="min-h-[60vh] flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="text-center max-w-md">
          <motion.div 
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-6"
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          >
            <Wallet className="w-10 h-10 text-slate-400" />
          </motion.div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Hey there! 👋</h2>
          <p className="text-slate-600 mb-6">
            Connect your wallet to see what you've got and send tokens around.
          </p>
          <motion.button
            onClick={() => useWalletStore.getState().connect()}
            className="btn-human"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Wallet className="w-4 h-4" />
            Connect Wallet
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            Your Tokens
            <Sparkles className="w-6 h-6 text-amber-500" />
          </h1>
          <p className="text-slate-600 mt-2">Here's what you're working with</p>
        </div>
        <motion.button 
          onClick={handleRefresh} 
          className="btn-ghost"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </motion.button>
      </motion.div>

      {/* Balance Card */}
      <motion.div 
        variants={cardVariants}
        whileHover="hover"
        className="card-human bg-gradient-to-br from-indigo-50 via-white to-amber-50 overflow-hidden relative"
      >
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-100/50 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <div className="relative">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <motion.div 
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25"
                whileHover={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.5 }}
              >
                <Coins className="w-7 h-7 text-white" />
              </motion.div>
              <div>
                <p className="text-sm font-medium text-slate-500">Your Balance</p>
                <p className="text-sm font-mono text-slate-400">{tokenInfo?.symbol || 'TRCS'}</p>
              </div>
            </div>
            <motion.button 
              onClick={handleCopyAddress}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-sm text-sm text-slate-600 hover:bg-white transition-colors border border-slate-200/50"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div
                    key="check"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="copy"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Copy className="w-4 h-4" />
                  </motion.div>
                )}
              </AnimatePresence>
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
            </motion.button>
          </div>
          
          {balanceLoading ? (
            <div className="h-14 w-48 bg-slate-200 rounded-xl animate-pulse" />
          ) : (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <p className="text-4xl md:text-5xl font-bold text-slate-900 flex items-baseline gap-3">
                {(() => {
                  const walletBal = parseFloat(trcsBalance || '0');
                  const apiBal = parseFloat(balance || '0');
                  const displayBal = walletBal > 0 ? walletBal : apiBal;
                  return displayBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
                })()}
                <span className="text-xl text-slate-400">{tokenInfo?.symbol}</span>
              </p>
              <p className="text-sm text-slate-500 mt-2 flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                {parseFloat(trcsBalance || balance || '0') > 0 ? 'Looking good!' : 'Ready to earn some tokens?'}
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Token Info */}
        <motion.div variants={cardVariants} whileHover="hover" className="card-human">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-indigo-50 rounded-xl">
              <Info className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Token Details</h2>
          </div>
          
          {tokenLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : tokenInfo ? (
            <dl className="space-y-4">
              {[
                { label: 'Name', value: tokenInfo.name },
                { label: 'Symbol', value: tokenInfo.symbol },
                { label: 'Decimals', value: tokenInfo.decimals },
                { label: 'Total Supply', value: parseFloat(tokenInfo.totalSupply).toLocaleString() },
                { label: 'Max Cap', value: parseFloat(tokenInfo.cap).toLocaleString(), last: true }
              ].map((item, index) => (
                <motion.div 
                  key={item.label}
                  className={`flex justify-between py-3 ${!item.last ? 'border-b border-slate-100' : ''}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <dt className="text-slate-500">{item.label}</dt>
                  <dd className="font-medium text-slate-900">{item.value}</dd>
                </motion.div>
              ))}
            </dl>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm">Couldn't load token info. Try refreshing?</p>
            </div>
          )}
        </motion.div>

        {/* Transfer Form */}
        <motion.div variants={cardVariants} whileHover="hover" className="card-human">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-emerald-50 rounded-xl">
              <Send className="w-5 h-5 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Send Tokens</h2>
          </div>
          
          <form onSubmit={handleTransfer} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Who's getting these?
              </label>
              <input
                type="text"
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                How many?
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 pr-16 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">
                  {tokenInfo?.symbol || 'TRCS'}
                </span>
              </div>
              {balance && (
                <button
                  type="button"
                  onClick={() => setTransferAmount(balance)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 mt-2 font-medium"
                >
                  Send it all: {parseFloat(balance).toLocaleString()} {tokenInfo?.symbol}
                </button>
              )}
            </div>
            <motion.button
              type="submit"
              disabled={isTransferring || !transferTo || !transferAmount}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {isTransferring ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-4 h-4" />
                  Send Tokens
                </>
              )}
            </motion.button>
          </form>
        </motion.div>
      </div>
    </motion.div>
  );
}
