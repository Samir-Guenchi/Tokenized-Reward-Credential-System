/**
 * @file src/pages/CredentialsPage.tsx
 * @description Credentials management page with humanized design
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWalletStore } from '../store/wallet';
import { credentialApi } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Award, 
  Search, 
  Wallet, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  User, 
  Clock,
  ExternalLink,
  Shield,
  AlertCircle,
  FileText,
  ChevronDown,
  Sparkles,
  BadgeCheck
} from 'lucide-react';

const CREDENTIAL_TYPES: Record<number, { name: string; color: string; bgColor: string; emoji: string }> = {
  0: { name: 'Course Completion', color: 'text-blue-700', bgColor: 'bg-blue-50', emoji: '📚' },
  1: { name: 'Skill Certification', color: 'text-violet-700', bgColor: 'bg-violet-50', emoji: '🎯' },
  2: { name: 'Achievement Badge', color: 'text-amber-700', bgColor: 'bg-amber-50', emoji: '🏆' },
  3: { name: 'Membership', color: 'text-emerald-700', bgColor: 'bg-emerald-50', emoji: '🤝' },
  4: { name: 'Custom', color: 'text-slate-700', bgColor: 'bg-slate-100', emoji: '✨' },
};

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

export default function CredentialsPage() {
  const { isConnected, address } = useWalletStore();
  const [verifyTokenId, setVerifyTokenId] = useState('');
  const [searchedCredential, setSearchedCredential] = useState<number | null>(null);
  const [showMetadata, setShowMetadata] = useState(false);

  const { data: credentialCount } = useQuery({
    queryKey: ['credentialCount', address],
    queryFn: () => credentialApi.getByOwner(address!),
    select: (res) => res.data.data.credentialCount,
    enabled: !!address,
  });

  const { data: credential, isLoading: credentialLoading, isError } = useQuery({
    queryKey: ['credential', searchedCredential],
    queryFn: () => credentialApi.getCredential(searchedCredential!),
    select: (res) => res.data.data,
    enabled: searchedCredential !== null,
  });

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const tokenId = parseInt(verifyTokenId, 10);
    if (!isNaN(tokenId) && tokenId > 0) {
      setSearchedCredential(tokenId);
      setShowMetadata(false);
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
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-200 flex items-center justify-center mx-auto mb-6"
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          >
            <Award className="w-10 h-10 text-violet-500" />
          </motion.div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Show off your credentials 🎓</h2>
          <p className="text-slate-600 mb-6">
            Connect your wallet to see the credentials you've earned and verify others.
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
          Your Credentials
          <BadgeCheck className="w-7 h-7 text-violet-500" />
        </h1>
        <p className="text-slate-600 mt-2">Proof that you've done the work</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div variants={cardVariants} whileHover="hover" className="card-human bg-gradient-to-br from-violet-50 via-white to-purple-50">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">You've earned</p>
              <motion.p 
                className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 150, delay: 0.2 }}
              >
                {credentialCount ?? 0}
              </motion.p>
              <p className="text-sm text-slate-500 mt-1">
                {credentialCount === 1 ? 'credential' : 'credentials'} so far
              </p>
            </div>
            <motion.div 
              className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25"
              whileHover={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.5 }}
            >
              <Award className="w-6 h-6 text-white" />
            </motion.div>
          </div>
        </motion.div>
        
        <motion.div variants={cardVariants} whileHover="hover" className="card-human">
          <p className="text-sm font-medium text-slate-500 mb-3">What you can earn</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CREDENTIAL_TYPES).map(([type, { name, color, bgColor, emoji }]) => (
              <motion.span 
                key={type} 
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${bgColor} ${color}`}
                whileHover={{ scale: 1.05 }}
              >
                <span>{emoji}</span>
                {name}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Verify Credential */}
      <motion.div variants={cardVariants} whileHover="hover" className="card-human">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-indigo-50 rounded-xl">
            <Search className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Verify a Credential</h2>
            <p className="text-sm text-slate-500">Got a token ID? Let's check if it's legit.</p>
          </div>
        </div>
        
        <form onSubmit={handleVerify} className="flex gap-3">
          <input
            type="text"
            value={verifyTokenId}
            onChange={(e) => setVerifyTokenId(e.target.value)}
            placeholder="Enter Token ID (1, 2, 3...)"
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          <motion.button 
            type="submit" 
            className="btn-human"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Search className="w-4 h-4" />
            Check It
          </motion.button>
        </form>
      </motion.div>

      {/* Credential Details */}
      <AnimatePresence>
        {searchedCredential !== null && (
          <motion.div 
            className="card-human"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 100, damping: 15 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-violet-50 rounded-xl">
                  <Award className="w-5 h-5 text-violet-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Credential #{searchedCredential}
                </h2>
              </div>
              <motion.button
                onClick={() => setSearchedCredential(null)}
                className="btn-ghost text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <XCircle className="w-4 h-4" />
                Clear
              </motion.button>
            </div>
            
            {credentialLoading ? (
              <div className="space-y-4">
                <div className="h-8 w-32 bg-slate-200 rounded-lg animate-pulse" />
                <div className="grid grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i}>
                      <div className="h-4 w-20 bg-slate-200 rounded animate-pulse mb-2" />
                      <div className="h-5 w-full bg-slate-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ) : isError ? (
              <motion.div 
                className="flex items-center gap-3 p-4 rounded-xl bg-red-50 text-red-700"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">Hmm, can't find that one. Maybe double-check the ID?</p>
              </motion.div>
            ) : credential ? (
              <div className="space-y-6">
                {/* Status Badges */}
                <div className="flex items-center gap-3 flex-wrap">
                  {credential.isValid ? (
                    <motion.span 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Valid & Verified ✓
                    </motion.span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-50 text-red-700">
                      <XCircle className="w-4 h-4" />
                      Invalid
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${CREDENTIAL_TYPES[credential.credentialType]?.bgColor || 'bg-slate-100'} ${CREDENTIAL_TYPES[credential.credentialType]?.color || 'text-slate-700'}`}>
                    {CREDENTIAL_TYPES[credential.credentialType]?.emoji} {credential.typeName}
                  </span>
                  {credential.metadata?.revoked && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-50 text-red-700">
                      <Shield className="w-4 h-4" />
                      Revoked
                    </span>
                  )}
                </div>

                {/* Details Grid */}
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { icon: User, label: 'Owner', value: credential.owner, mono: true },
                    { icon: Shield, label: 'Issued by', value: credential.metadata?.issuer || 'Unknown', mono: true },
                    { icon: Calendar, label: 'Issued on', value: credential.metadata?.issuedAt 
                      ? new Date(credential.metadata.issuedAt * 1000).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'long', day: 'numeric'
                        })
                      : 'Unknown' },
                    { icon: Clock, label: 'Expires', value: credential.metadata?.expiresAt 
                      ? new Date(credential.metadata.expiresAt * 1000).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'long', day: 'numeric'
                        })
                      : 'Never (permanent)' }
                  ].map((item, index) => (
                    <motion.div 
                      key={item.label}
                      className="p-4 rounded-xl bg-slate-50"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <dt className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </dt>
                      <dd className={`text-sm text-slate-900 break-all ${item.mono ? 'font-mono' : ''}`}>
                        {item.value}
                      </dd>
                    </motion.div>
                  ))}
                </dl>

                {/* Token URI Link */}
                {credential.tokenURI && (
                  <motion.a
                    href={credential.tokenURI.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${credential.tokenURI.slice(7)}` : credential.tokenURI}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
                    whileHover={{ x: 3 }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    View on IPFS →
                  </motion.a>
                )}

                {/* Raw Metadata Toggle */}
                {credential.metadata && (
                  <div className="border-t border-slate-100 pt-4">
                    <motion.button
                      onClick={() => setShowMetadata(!showMetadata)}
                      className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                      whileHover={{ x: 2 }}
                    >
                      <FileText className="w-4 h-4" />
                      Raw On-Chain Data
                      <motion.div
                        animate={{ rotate: showMetadata ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </motion.div>
                    </motion.button>
                    
                    <AnimatePresence>
                      {showMetadata && (
                        <motion.pre 
                          className="mt-4 bg-slate-900 text-slate-100 rounded-xl p-4 text-sm overflow-x-auto"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          {JSON.stringify(credential.metadata, null, 2)}
                        </motion.pre>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!searchedCredential && credentialCount === 0 && (
        <motion.div 
          variants={itemVariants}
          className="card-human text-center py-12"
        >
          <motion.div 
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4"
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          >
            <Sparkles className="w-10 h-10 text-slate-400" />
          </motion.div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Your collection starts here</h3>
          <p className="text-slate-600 max-w-md mx-auto">
            No credentials yet, but that's about to change! Complete a course or earn a certification 
            and you'll see your NFT credentials right here.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
