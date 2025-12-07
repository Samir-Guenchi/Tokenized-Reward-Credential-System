/**
 * @file src/pages/DemoPage.tsx
 * @description Event Participation Demo page showing the complete participation & rewards journey
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWalletStore } from '../store/wallet';
import { 
  Play, 
  BookOpen, 
  CheckCircle2, 
  Award, 
  Gift, 
  Coins,
  Loader2,
  Wallet,
  Trophy,
  PartyPopper,
  Clock,
  Zap,
  GraduationCap
} from 'lucide-react';
import axios from 'axios';

const API_BASE = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL || 'http://localhost:3001';

// Demo event data - Workshop/Competition/Club Event
const demoCourse = {
  id: 'hackathon-2025',
  title: 'Blockchain Hackathon 2025',
  description: 'Participate in our annual blockchain hackathon. Build innovative DApps, compete with teams, and win prizes!',
  duration: '3 days',
  modules: [
    { id: 1, title: 'Team Registration', duration: '10 min', completed: false },
    { id: 2, title: 'Opening Ceremony', duration: '1 hr', completed: false },
    { id: 3, title: 'Workshop: Smart Contracts', duration: '2 hrs', completed: false },
    { id: 4, title: 'Project Submission', duration: '1 hr', completed: false },
    { id: 5, title: 'Final Presentation', duration: '1 hr', completed: false },
  ],
  reward: {
    tokens: 100,
    credential: 'Hackathon Participant Certificate',
    badge: ''
  }
};

// Alias for backward compatibility
type DemoStep = 'intro' | 'learning' | 'completing' | 'minting' | 'rewarding' | 'claiming' | 'complete';

export default function DemoPage() {
  const { isConnected, address } = useWalletStore();
  const queryClient = useQueryClient();
  
  const [currentStep, setCurrentStep] = useState<DemoStep>('intro');
  const [completedModules, setCompletedModules] = useState<number[]>([]);
  const [currentModule, setCurrentModule] = useState(0);
  const [demoResults, setDemoResults] = useState<{
    credentialId?: string;
    credentialTxHash?: string;
    tokenTxHash?: string;
    tokensEarned?: string;
    error?: string;
  }>({});

  // Issue credential mutation - uses demo endpoint (no auth required)
  const issueCredentialMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post(`${API_BASE}/api/demo/credential`, {
        recipient: address,
        credentialType: 'COURSE_COMPLETION',
        courseName: demoCourse.title,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setDemoResults(prev => ({ 
        ...prev, 
        credentialId: data.data?.credentialId || 'demo-credential',
        credentialTxHash: data.data?.transactionHash 
      }));
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
    },
    onError: (error: any) => {
      console.error('Credential error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Network Error - Is the backend running?';
      setDemoResults(prev => ({ ...prev, error: errorMsg }));
    }
  });

  // Direct token reward mutation - uses demo endpoint (no auth required)
  const rewardTokensMutation = useMutation({
    mutationFn: async () => {
      if (!address) {
        throw new Error('Wallet not connected');
      }
      console.log('Sending reward to:', address, 'API:', API_BASE);
      const response = await axios.post(`${API_BASE}/api/demo/reward`, {
        recipient: address,
        amount: demoCourse.reward.tokens.toString(),
        reason: `Completed: ${demoCourse.title}`,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setDemoResults(prev => ({ 
        ...prev, 
        tokenTxHash: data.data?.transactionHash,
        tokensEarned: data.data?.amount || demoCourse.reward.tokens.toString()
      }));
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
    },
    onError: (error: any) => {
      console.error('Reward error:', error);
      let errorMsg = 'Unknown error';
      if (error.code === 'ERR_NETWORK') {
        errorMsg = 'Cannot connect to backend. Make sure the backend server is running on port 3001.';
      } else if (error.response?.data?.error) {
        errorMsg = error.response.data.error;
      } else if (error.message) {
        errorMsg = error.message;
      }
      setDemoResults(prev => ({ ...prev, error: errorMsg }));
    }
  });

  // Simulate completing a module
  const completeModule = (moduleId: number) => {
    setCompletedModules(prev => [...prev, moduleId]);
    if (moduleId < demoCourse.modules.length) {
      setCurrentModule(moduleId);
    }
  };

  // Progress to next step
  const progressDemo = async () => {
    switch (currentStep) {
      case 'intro':
        setCurrentStep('learning');
        break;
      case 'learning':
        // Complete all remaining modules quickly
        demoCourse.modules.forEach((_, idx) => {
          setTimeout(() => completeModule(idx + 1), idx * 300);
        });
        setTimeout(() => setCurrentStep('completing'), demoCourse.modules.length * 300 + 500);
        break;
      case 'completing':
        setCurrentStep('minting');
        issueCredentialMutation.mutate();
        break;
      case 'minting':
        if (issueCredentialMutation.isSuccess || issueCredentialMutation.isError) {
          setCurrentStep('rewarding');
          rewardTokensMutation.mutate();
        }
        break;
      case 'rewarding':
        if (rewardTokensMutation.isSuccess || rewardTokensMutation.isError) {
          setCurrentStep('complete');
        }
        break;
      case 'claiming':
        // Skip claiming step - tokens are sent directly now
        setCurrentStep('complete');
        break;
    }
  };

  if (!isConnected) {
    return (
      <motion.div 
        className="min-h-[70vh] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="text-center max-w-md">
          <motion.div 
            className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-100 to-purple-200 flex items-center justify-center mx-auto mb-6"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 4 }}
          >
            <Play className="w-12 h-12 text-violet-600" />
          </motion.div>
          <h2 className="text-3xl font-bold text-slate-900 mb-3">Event Participation Demo 🎬</h2>
          <p className="text-slate-600 mb-6">
            Experience the complete participation journey: Participate in an event, earn a credential NFT, and claim your token rewards!
          </p>
          <motion.button
            onClick={() => useWalletStore.getState().connect()}
            className="btn-human"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Wallet className="w-4 h-4" />
            Connect Wallet to Start Demo
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Progress Indicator */}
      <motion.div 
        className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-slate-100"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {[
          { step: 'intro', label: 'Start', icon: Play },
          { step: 'learning', label: 'Learn', icon: BookOpen },
          { step: 'completing', label: 'Complete', icon: CheckCircle2 },
          { step: 'minting', label: 'Mint NFT', icon: Award },
          { step: 'rewarding', label: 'Earn Tokens', icon: Coins },
          { step: 'claiming', label: 'Claim', icon: Gift },
          { step: 'complete', label: 'Done!', icon: Trophy },
        ].map((s, idx) => {
          const steps: DemoStep[] = ['intro', 'learning', 'completing', 'minting', 'rewarding', 'claiming', 'complete'];
          const currentIdx = steps.indexOf(currentStep);
          const stepIdx = steps.indexOf(s.step as DemoStep);
          const isActive = s.step === currentStep;
          const isComplete = stepIdx < currentIdx;
          
          return (
            <div key={s.step} className="flex items-center">
              <motion.div
                className={`flex flex-col items-center ${isActive ? 'scale-110' : ''}`}
                animate={{ scale: isActive ? 1.1 : 1 }}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isComplete ? 'bg-emerald-500 text-white' :
                  isActive ? 'bg-violet-500 text-white ring-4 ring-violet-200' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {isComplete ? <CheckCircle2 className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                </div>
                <span className={`text-xs mt-1 font-medium ${isActive ? 'text-violet-600' : 'text-slate-500'}`}>
                  {s.label}
                </span>
              </motion.div>
              {idx < 6 && (
                <div className={`w-8 h-0.5 mx-1 ${stepIdx < currentIdx ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
      </motion.div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {/* STEP 1: Intro */}
        {currentStep === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="card-human text-center py-12"
          >
            <motion.div 
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-6 text-white"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
            >
              <GraduationCap className="w-10 h-10" />
            </motion.div>
            <h1 className="text-3xl font-bold text-slate-900 mb-3">Welcome to the Demo! 🎉</h1>
            <p className="text-slate-600 max-w-lg mx-auto mb-8">
              You're about to experience the complete TRCS participation journey. Participate in an event, 
              receive a credential NFT, and earn token rewards—all on the blockchain!
            </p>
            <div className="bg-slate-50 rounded-xl p-6 max-w-md mx-auto mb-8">
              <h3 className="font-semibold text-slate-900 mb-2">{demoCourse.title}</h3>
              <p className="text-sm text-slate-600 mb-3">{demoCourse.description}</p>
              <div className="flex items-center justify-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-slate-500">
                  <Clock className="w-4 h-4" /> {demoCourse.duration}
                </span>
                <span className="flex items-center gap-1 text-amber-600 font-medium">
                  <Coins className="w-4 h-4" /> {demoCourse.reward.tokens} TRCS
                </span>
              </div>
            </div>
            <motion.button
              onClick={progressDemo}
              className="btn-human text-lg px-8 py-3"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Play className="w-5 h-5" />
              Start Participating
            </motion.button>
          </motion.div>
        )}

        {/* STEP 2: Learning */}
        {currentStep === 'learning' && (
          <motion.div
            key="learning"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="card-human"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-violet-100 rounded-xl">
                <BookOpen className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{demoCourse.title}</h2>
                <p className="text-sm text-slate-500">Complete all modules to earn your reward</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {demoCourse.modules.map((module) => {
                const isCompleted = completedModules.includes(module.id);
                const isCurrent = currentModule === module.id - 1 && !isCompleted;
                
                return (
                  <motion.div
                    key={module.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                      isCompleted ? 'bg-emerald-50 border-emerald-200' :
                      isCurrent ? 'bg-violet-50 border-violet-300 ring-2 ring-violet-200' :
                      'bg-slate-50 border-slate-100'
                    }`}
                    animate={isCurrent ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ repeat: isCurrent ? Infinity : 0, duration: 1.5 }}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isCompleted ? 'bg-emerald-500 text-white' :
                      isCurrent ? 'bg-violet-500 text-white' :
                      'bg-slate-200 text-slate-500'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <span className="font-bold">{module.id}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${isCompleted ? 'text-emerald-700' : 'text-slate-900'}`}>
                        {module.title}
                      </p>
                      <p className="text-sm text-slate-500">{module.duration}</p>
                    </div>
                    {isCompleted && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-emerald-600 font-medium text-sm"
                      >
                        ✓ Complete
                      </motion.span>
                    )}
                    {isCurrent && (
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="text-violet-600 font-medium text-sm"
                      >
                        In Progress...
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500">
                Progress: {completedModules.length} / {demoCourse.modules.length} modules
              </div>
              <motion.button
                onClick={progressDemo}
                className="btn-human"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Zap className="w-4 h-4" />
                Complete All Modules
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Completing */}
        {currentStep === 'completing' && (
          <motion.div
            key="completing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="card-human text-center py-12"
          >
            <motion.div
              className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center mx-auto mb-6 text-white"
              initial={{ scale: 0 }}
              animate={{ scale: 1, rotate: [0, 360] }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <CheckCircle2 className="w-12 h-12" />
            </motion.div>
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Event Completed! 🎉</h2>
            <p className="text-slate-600 max-w-md mx-auto mb-8">
              Congratulations! You've finished all {demoCourse.modules.length} modules of {demoCourse.title}. 
              Now let's mint your credential NFT!
            </p>
            <motion.button
              onClick={progressDemo}
              className="btn-human bg-gradient-to-r from-violet-500 to-purple-600 text-lg px-8"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Award className="w-5 h-5" />
              Mint Credential NFT
            </motion.button>
          </motion.div>
        )}

        {/* STEP 4: Minting */}
        {currentStep === 'minting' && (
          <motion.div
            key="minting"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="card-human text-center py-12"
          >
            {issueCredentialMutation.isPending ? (
              <>
                <motion.div
                  className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-200 flex items-center justify-center mx-auto mb-6"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                >
                  <Award className="w-12 h-12 text-violet-600" />
                </motion.div>
                <h2 className="text-2xl font-bold text-slate-900 mb-3">Minting Your Credential... 🔨</h2>
                <p className="text-slate-600 mb-4">
                  Creating your unique NFT on the blockchain...
                </p>
                <Loader2 className="w-8 h-8 animate-spin text-violet-500 mx-auto" />
              </>
            ) : issueCredentialMutation.isSuccess ? (
              <>
                <motion.div
                  className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-6 text-white"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 150 }}
                >
                  <Award className="w-12 h-12" />
                </motion.div>
                <h2 className="text-2xl font-bold text-slate-900 mb-3">Credential Minted! ✨</h2>
                <p className="text-slate-600 mb-2">Your NFT credential is now on the blockchain</p>
                {demoResults.credentialId && (
                  <p className="text-sm text-violet-600 font-mono mb-6">Token ID: {demoResults.credentialId}</p>
                )}
                <motion.button
                  onClick={progressDemo}
                  className="btn-human bg-gradient-to-r from-amber-500 to-orange-500"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Coins className="w-5 h-5" />
                  Earn Token Rewards
                </motion.button>
              </>
            ) : issueCredentialMutation.isError ? (
              <>
                <div className="w-24 h-24 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-6">
                  <Award className="w-12 h-12 text-amber-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-3">Credential Skipped</h2>
                <p className="text-slate-600 mb-6 text-sm">
                  (Minting requires admin permissions—continuing demo flow)
                </p>
                <motion.button
                  onClick={progressDemo}
                  className="btn-human bg-gradient-to-r from-amber-500 to-orange-500"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Coins className="w-5 h-5" />
                  Continue to Token Rewards
                </motion.button>
              </>
            ) : null}
          </motion.div>
        )}

        {/* STEP 5: Rewarding */}
        {currentStep === 'rewarding' && (
          <motion.div
            key="rewarding"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="card-human text-center py-12"
          >
            {rewardTokensMutation.isPending ? (
              <>
                <motion.div
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-100 to-orange-200 flex items-center justify-center mx-auto mb-6"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  <Coins className="w-12 h-12 text-amber-600" />
                </motion.div>
                <h2 className="text-2xl font-bold text-slate-900 mb-3">Sending Rewards... 💰</h2>
                <p className="text-slate-600 mb-4">
                  Transferring TRCS tokens to your wallet...
                </p>
                <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
              </>
            ) : rewardTokensMutation.isSuccess ? (
              <>
                <motion.div
                  className="relative w-32 h-32 mx-auto mb-6"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                  <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
                    <span className="text-4xl font-bold text-amber-600">{demoCourse.reward.tokens}</span>
                  </div>
                </motion.div>
                <h2 className="text-2xl font-bold text-slate-900 mb-3">Tokens Received! 🎁</h2>
                <p className="text-slate-600 mb-2">
                  {demoCourse.reward.tokens} TRCS tokens have been sent to your wallet!
                </p>
                {demoResults.tokenTxHash && (
                  <p className="text-xs text-slate-400 font-mono mb-4 truncate max-w-xs mx-auto">
                    TX: {demoResults.tokenTxHash}
                  </p>
                )}
                <motion.button
                  onClick={progressDemo}
                  className="btn-human bg-gradient-to-r from-violet-500 to-purple-600"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Trophy className="w-5 h-5" />
                  See Summary
                </motion.button>
              </>
            ) : rewardTokensMutation.isError ? (
              <>
                <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
                  <Coins className="w-12 h-12 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-3">Reward Failed</h2>
                <p className="text-red-600 mb-4 text-sm">
                  {demoResults.error || 'Failed to send tokens. Make sure the backend is running.'}
                </p>
                <motion.button
                  onClick={() => setCurrentStep('complete')}
                  className="btn-human"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Trophy className="w-5 h-5" />
                  Complete Demo Anyway
                </motion.button>
              </>
            ) : null}
          </motion.div>
        )}

        {/* STEP 7: Complete - skipped STEP 6 Claiming since tokens are sent directly */}
        {currentStep === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Celebration Banner */}
            <motion.div 
              className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-8 text-white text-center"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
            >
              <div className="absolute top-0 left-0 w-full h-full">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 bg-white/30 rounded-full"
                    style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
                    animate={{ 
                      y: [0, -30, 0],
                      opacity: [0.3, 1, 0.3],
                      scale: [1, 1.5, 1]
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 2 + Math.random() * 2,
                      delay: Math.random() * 2
                    }}
                  />
                ))}
              </div>
              <motion.div
                className="relative"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <PartyPopper className="w-16 h-16 mx-auto mb-4" />
              </motion.div>
              <h1 className="text-4xl font-bold mb-2 relative">Demo Complete! 🎉</h1>
              <p className="text-white/80 text-lg relative">
                You've experienced the full TRCS participation & rewards journey
              </p>
            </motion.div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div
                className="card-human text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-7 h-7 text-violet-600" />
                </div>
                <h3 className="font-bold text-slate-900 mb-1">Event Completed</h3>
                <p className="text-sm text-slate-600">{demoCourse.title}</p>
                <p className="text-xs text-slate-400 mt-1">{demoCourse.modules.length} modules</p>
              </motion.div>

              <motion.div
                className="card-human text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-3">
                  <Award className="w-7 h-7 text-purple-600" />
                </div>
                <h3 className="font-bold text-slate-900 mb-1">Credential NFT</h3>
                <p className="text-sm text-slate-600">{demoCourse.reward.credential}</p>
                <p className="text-xs text-slate-400 mt-1">On-chain verified ✓</p>
              </motion.div>

              <motion.div
                className="card-human text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-3">
                  <Coins className="w-7 h-7 text-amber-600" />
                </div>
                <h3 className="font-bold text-slate-900 mb-1">Tokens Earned</h3>
                <p className="text-2xl font-bold text-amber-600">{demoCourse.reward.tokens} TRCS</p>
                <p className="text-xs text-slate-400 mt-1">In your wallet</p>
              </motion.div>
            </div>

            {/* Wallet Info */}
            <motion.div 
              className="card-human"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-slate-600" />
                Your Wallet
              </h3>
              <div className="bg-slate-50 rounded-xl p-4 font-mono text-sm text-slate-600 break-all">
                {address}
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div 
              className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Link to="/tokens">
                <motion.div
                  className="btn-human bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Coins className="w-4 h-4" />
                  View Your Tokens
                </motion.div>
              </Link>
              <Link to="/credentials">
                <motion.div
                  className="btn-human bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Award className="w-4 h-4" />
                  View Credentials
                </motion.div>
              </Link>
              <motion.button
                onClick={() => {
                  setCurrentStep('intro');
                  setCompletedModules([]);
                  setCurrentModule(0);
                  setDemoResults({});
                }}
                className="btn-human bg-slate-500 hover:bg-slate-600"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Play className="w-4 h-4" />
                Run Demo Again
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
