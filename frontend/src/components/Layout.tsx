/**
 * @file src/components/Layout.tsx
 * @description Main layout component with navigation and human-friendly design
 */

import { Outlet, Link, useLocation } from 'react-router-dom';
import { useWalletStore } from '../store/wallet';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, 
  Coins, 
  Award, 
  Gift, 
  Wallet, 
  LogOut, 
  Menu,
  X,
  Github,
  Book,
  Heart,
  Coffee,
  Play
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'Demo', path: '/demo', icon: Play, highlight: true },
  { name: 'Tokens', path: '/tokens', icon: Coins },
  { name: 'Credentials', path: '/credentials', icon: Award },
  { name: 'Rewards', path: '/rewards', icon: Gift },
];

// Smooth slide animation for mobile menu
const menuVariants = {
  closed: { 
    opacity: 0, 
    height: 0,
    transition: { 
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number]
    }
  },
  open: { 
    opacity: 1, 
    height: 'auto' as const,
    transition: { 
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number]
    }
  }
};

// Staggered nav items
const navItemVariants = {
  closed: { opacity: 0, x: -10 },
  open: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.2
    }
  })
};

export default function Layout() {
  const location = useLocation();
  const { address, isConnected, isConnecting, balance, connect, disconnect } = useWalletStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleConnect = async () => {
    try {
      await connect();
      toast.success('You\'re in! Wallet connected.');
    } catch {
      toast.error('Hmm, couldn\'t connect. Try again?');
    }
  };

  const handleDisconnect = () => {
    disconnect();
    toast.success('Disconnected. See you soon!');
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <motion.header 
        className="glass sticky top-0 z-50 border-b border-slate-200/60"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <motion.div 
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25"
                whileHover={{ rotate: [0, -5, 5, 0], scale: 1.05 }}
                transition={{ duration: 0.4 }}
              >
                <Coins className="w-5 h-5 text-white" />
              </motion.div>
              <div className="hidden sm:block">
                <span className="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">TRCS</span>
                <span className="text-xs text-slate-500 block -mt-1">Learn. Earn. Own.</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item, index) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                const isHighlight = 'highlight' in item && item.highlight;
                return (
                  <motion.div
                    key={item.path}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 + 0.2 }}
                  >
                    <Link
                      to={item.path}
                      className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-lg'
                          : isHighlight
                          ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.name}
                      {isHighlight && !isActive && (
                        <motion.span
                          className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full"
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        />
                      )}
                      {isActive && (
                        <motion.div
                          className="absolute inset-0 rounded-xl bg-slate-900 -z-10"
                          layoutId="activeNav"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            {/* Wallet Connection */}
            <div className="flex items-center gap-3">
              <AnimatePresence mode="wait">
                {isConnected && address ? (
                  <motion.div 
                    className="flex items-center gap-3"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key="connected"
                  >
                    <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-slate-100 rounded-xl">
                      <motion.div 
                        className="w-2 h-2 bg-emerald-500 rounded-full"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      />
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-900 font-mono">
                          {formatAddress(address)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {parseFloat(balance).toFixed(4)} ETH
                        </p>
                      </div>
                    </div>
                    <motion.button
                      onClick={handleDisconnect}
                      className="btn-ghost text-sm"
                      title="Disconnect wallet"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="hidden sm:inline">Disconnect</span>
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="disconnected"
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="btn-human text-sm"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Wallet className="w-4 h-4" />
                    {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Mobile menu button */}
              <motion.button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden btn-ghost p-2"
                whileTap={{ scale: 0.95 }}
              >
                <AnimatePresence mode="wait">
                  {mobileMenuOpen ? (
                    <motion.div
                      key="close"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <X className="w-5 h-5" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="menu"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Menu className="w-5 h-5" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              className="md:hidden border-t border-slate-200/60 bg-white overflow-hidden"
              variants={menuVariants}
              initial="closed"
              animate="open"
              exit="closed"
            >
              <nav className="px-4 py-4 space-y-1">
                {navigation.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <motion.div
                      key={item.path}
                      custom={index}
                      variants={navItemVariants}
                      initial="closed"
                      animate="open"
                    >
                      <Link
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {item.name}
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1">
        <motion.div 
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Outlet />
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/60 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Coins className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">TRCS Platform</p>
                <p className="text-xs text-slate-500">Where learning meets earning</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors">
                <Book className="w-4 h-4" />
                Docs
              </a>
              <a href="#" className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors">
                <Github className="w-4 h-4" />
                GitHub
              </a>
              <a href="#" className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors">
                <Coffee className="w-4 h-4" />
                Buy us a coffee
              </a>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
              Made with <Heart className="w-3 h-3 text-rose-400 inline" /> for learners everywhere
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
