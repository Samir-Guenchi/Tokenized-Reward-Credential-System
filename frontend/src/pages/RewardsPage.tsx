/**
 * @file src/pages/RewardsPage.tsx
 * @description Rewards and vesting management page with humanized design
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWalletStore } from '../store/wallet';
import { rewardApi } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Gift, 
  Wallet, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle,
  Calendar,
  ArrowUpRight,
  Lock,
  Unlock,
  Timer,
  BarChart3,
  Sparkles,
  PartyPopper,
  Coins,
  Loader2
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

export default function RewardsPage() {
  const { isConnected, address } = useWalletStore();
  const queryClient = useQueryClient();
  const [claimSuccess, setClaimSuccess] = useState<{ amount: string; txHash: string } | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['rewardStats'],
    queryFn: () => rewardApi.getStats(),
    select: (res) => res.data.data,
  });

  const { data: vesting, isLoading: vestingLoading } = useQuery({
    queryKey: ['vesting', address],
    queryFn: () => rewardApi.getVesting(address!),
    select: (res) => res.data.data,
    enabled: !!address,
  });

  const { data: claimable } = useQuery({
    queryKey: ['claimable', address],
    queryFn: () => rewardApi.getClaimable(address!),
    select: (res) => res.data.data,
    enabled: !!address,
  });

  // Claim mutation
  const claimMutation = useMutation({
    mutationFn: () => rewardApi.claimRewards(address!),
    onSuccess: (res) => {
      const data = res.data.data;
      setClaimSuccess({ amount: data.amount, txHash: data.transactionHash });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['claimable', address] });
      queryClient.invalidateQueries({ queryKey: ['vesting', address] });
      queryClient.invalidateQueries({ queryKey: ['rewardStats'] });
      // Clear success message after 10 seconds
      setTimeout(() => setClaimSuccess(null), 10000);
    },
  });

  const handleClaim = () => {
    if (address) {
      claimMutation.mutate();
    }
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
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center mx-auto mb-6"
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          >
            <Gift className="w-10 h-10 text-amber-500" />
          </motion.div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Good things await! 🎁</h2>
          <p className="text-slate-600 mb-6">
            Connect your wallet to see what rewards you've earned and what's vesting.
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
      <motion.div variants={itemVariants}>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          Your Rewards
          <Gift className="w-7 h-7 text-amber-500" />
        </h1>
        <p className="text-slate-600 mt-2">The fun part—watching your tokens unlock</p>
      </motion.div>

      {/* Claimable Banner */}
      <AnimatePresence>
        {claimable && parseFloat(claimable.claimable) > 0 && (
          <motion.div 
            className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-6 text-white"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring" as const, stiffness: 100, damping: 15 }}
          >
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <motion.div 
              className="absolute bottom-2 left-1/4"
              animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
            >
              <PartyPopper className="w-8 h-8 text-white/30" />
            </motion.div>
            
            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <motion.div 
                  className="p-3 bg-white/20 rounded-xl backdrop-blur-sm"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                >
                  <Sparkles className="w-6 h-6" />
                </motion.div>
                <div>
                  <p className="text-white/80 text-sm font-medium">You've got tokens waiting!</p>
                  <p className="text-3xl font-bold">
                    {parseFloat(claimable.claimable).toLocaleString()} TRCS
                  </p>
                </div>
              </div>
              <motion.button 
                onClick={handleClaim}
                disabled={claimMutation.isPending}
                className="flex items-center gap-2 px-6 py-3 bg-white text-amber-600 font-semibold rounded-xl shadow-lg hover:shadow-xl transition-shadow disabled:opacity-70 disabled:cursor-not-allowed"
                whileHover={{ scale: claimMutation.isPending ? 1 : 1.02 }}
                whileTap={{ scale: claimMutation.isPending ? 1 : 0.98 }}
              >
                {claimMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Claiming...
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4" />
                    Claim Now
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Message */}
      <AnimatePresence>
        {claimSuccess && (
          <motion.div
            className="rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 p-6 text-white"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
          >
            <div className="flex items-center gap-4">
              <motion.div
                className="p-3 bg-white/20 rounded-xl"
                initial={{ scale: 0 }}
                animate={{ scale: 1, rotate: [0, 360] }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <CheckCircle2 className="w-6 h-6" />
              </motion.div>
              <div>
                <p className="font-semibold text-lg">🎉 Tokens Claimed Successfully!</p>
                <p className="text-white/80">
                  You received <span className="font-bold">{parseFloat(claimSuccess.amount).toLocaleString()} TRCS</span>
                </p>
                <a
                  href={`https://etherscan.io/tx/${claimSuccess.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white/70 hover:text-white underline mt-1 inline-block"
                >
                  View transaction →
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {claimMutation.isError && (
          <motion.div
            className="rounded-2xl bg-gradient-to-r from-red-500 to-rose-500 p-6 text-white"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="font-semibold">Oops! Something went wrong</p>
                <p className="text-white/80 text-sm">
                  {claimMutation.error instanceof Error ? claimMutation.error.message : 'Failed to claim tokens. Please try again.'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { 
            label: 'Locked in Vesting', 
            value: stats?.totalDistributed,
            subtext: 'Slowly unlocking',
            icon: Lock, 
            color: 'indigo',
            loading: statsLoading
          },
          { 
            label: 'Distribution Pool', 
            value: stats?.pendingDistribution,
            subtext: 'Ready for airdrops',
            icon: Gift, 
            color: 'emerald',
            loading: statsLoading
          },
          { 
            label: 'Total Claimed', 
            value: stats?.totalClaimed,
            subtext: 'All claimed tokens',
            icon: BarChart3, 
            color: 'amber',
            loading: statsLoading
          }
        ].map((stat, index) => (
          <motion.div 
            key={stat.label}
            variants={cardVariants}
            whileHover="hover"
            className="card-human"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
                {stat.loading ? (
                  <div className="h-8 w-24 bg-slate-200 rounded-lg animate-pulse" />
                ) : (
                  <motion.p 
                    className={`text-2xl font-bold text-${stat.color}-600`}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    {stat.value ? parseFloat(stat.value).toLocaleString() : '0'}
                  </motion.p>
                )}
                <p className="text-sm text-slate-500 mt-1">{stat.subtext}</p>
              </div>
              <motion.div 
                className={`p-2.5 bg-${stat.color}-50 rounded-xl`}
                whileHover={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.5 }}
              >
                <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Your Vesting Schedule */}
      <motion.div variants={cardVariants} whileHover="hover" className="card-human">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-violet-50 rounded-xl">
            <Timer className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Your Vesting Schedule</h2>
            <p className="text-sm text-slate-500">Watch your tokens unlock over time</p>
          </div>
        </div>
        
        {vestingLoading ? (
          <div className="space-y-4">
            <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
            <div className="h-24 w-full bg-slate-200 rounded-xl animate-pulse" />
          </div>
        ) : vesting?.schedule ? (
          <div className="space-y-6">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-slate-700">Progress</span>
                <motion.span 
                  className="text-sm font-bold text-indigo-600"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {vesting.progress.percent}% unlocked
                </motion.span>
              </div>
              <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${vesting.progress.percent}%` }}
                  transition={{ duration: 1, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Started {new Date(vesting.schedule.startTime).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Ends {new Date(vesting.schedule.vestingEnd).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Status Badges */}
            <div className="flex flex-wrap gap-2">
              {vesting.progress.isCliffPassed ? (
                <motion.span 
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  <Unlock className="w-4 h-4" />
                  Cliff passed! 🎉
                </motion.span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-50 text-amber-700">
                  <Lock className="w-4 h-4" />
                  Cliff pending
                </span>
              )}
              {vesting.progress.isFullyVested ? (
                <motion.span 
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Fully vested!
                </motion.span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-50 text-indigo-700">
                  <TrendingUp className="w-4 h-4" />
                  Vesting in progress
                </span>
              )}
              {vesting.schedule.revoked && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-50 text-red-700">
                  <AlertCircle className="w-4 h-4" />
                  Revoked
                </span>
              )}
            </div>

            {/* Details Grid */}
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Allocation', value: vesting.schedule.totalAmount, bg: 'bg-slate-50', color: 'text-slate-900' },
                { label: 'Already Claimed', value: vesting.schedule.claimed, bg: 'bg-emerald-50', color: 'text-emerald-600' },
                { label: 'Claim Now', value: vesting.schedule.claimable, bg: 'bg-indigo-50', color: 'text-indigo-600' },
                { label: 'Still Locked', value: (parseFloat(vesting.schedule.totalAmount) - parseFloat(vesting.schedule.claimed)).toString(), bg: 'bg-slate-50', color: 'text-slate-900' }
              ].map((item, index) => (
                <motion.div 
                  key={item.label}
                  className={`p-4 rounded-xl ${item.bg}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <dt className="text-sm text-slate-500 mb-1">{item.label}</dt>
                  <dd className={`text-xl font-bold ${item.color}`}>
                    {parseFloat(item.value).toLocaleString()}
                  </dd>
                </motion.div>
              ))}
            </dl>

            {/* Claim Button */}
            {parseFloat(vesting.schedule.claimable) > 0 && (
              <motion.button 
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <Gift className="w-5 h-5" />
                Claim {parseFloat(vesting.schedule.claimable).toLocaleString()} TRCS
              </motion.button>
            )}
          </div>
        ) : (
          <motion.div 
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div 
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4"
              animate={{ y: [0, -5, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            >
              <Coins className="w-10 h-10 text-slate-400" />
            </motion.div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No vesting schedule yet</h3>
            <p className="text-slate-600 max-w-md mx-auto">
              When you earn token rewards, they'll show up here with a vesting schedule. 
              Keep learning and earning!
            </p>
          </motion.div>
        )}
      </motion.div>

      {/* How Vesting Works */}
      <motion.div 
        variants={itemVariants}
        className="card-human bg-gradient-to-br from-slate-50 to-white"
      >
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">How does vesting work?</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          {[
            { step: '1', title: 'Cliff Period', desc: 'Tokens stay locked until the cliff date. Think of it as a warmup.', emoji: '⏳' },
            { step: '2', title: 'Linear Unlock', desc: 'After the cliff, tokens unlock gradually every block. Smooth and steady.', emoji: '📈' },
            { step: '3', title: 'Claim Anytime', desc: 'Unlocked tokens are yours. Claim them whenever you want—no pressure.', emoji: '🎁' }
          ].map((item, index) => (
            <motion.div 
              key={item.step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{item.emoji}</span>
                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm flex items-center justify-center">{item.step}</span>
              </div>
              <p className="font-medium text-slate-900 mb-1">{item.title}</p>
              <p className="text-slate-600">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
