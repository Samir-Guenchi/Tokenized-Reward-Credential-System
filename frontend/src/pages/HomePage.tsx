import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Coins, 
  Award, 
  Gift, 
  Shield, 
  Zap, 
  Users,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Lock
} from 'lucide-react';

// Staggered container animation
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1
    }
  }
};

// Gentle fade up for children
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15
    }
  }
};

// Bouncy entrance for cards
const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 120,
      damping: 12
    }
  },
  hover: {
    y: -6,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 20
    }
  }
};

export default function HomePage() {
  const features = [
    {
      icon: Coins,
      title: 'Earn Through Participation',
      description: 'Participate in workshops, competitions, and club events to earn TRCS tokens. Your involvement pays off!',
      color: 'text-amber-500',
      bgColor: 'bg-amber-50'
    },
    {
      icon: Award,
      title: 'Verifiable Credentials',
      description: 'Get blockchain-verified certificates for workshops, hackathons, and events that nobody can dispute.',
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-50'
    },
    {
      icon: Gift,
      title: 'Rewards You Control',
      description: 'Claim your earned rewards on your schedule. No middlemen, no waiting for approvals.',
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50'
    },
    {
      icon: Shield,
      title: 'Your Data, Your Rules',
      description: 'Everything lives on the blockchain. Transparent, immutable, and truly yours.',
      color: 'text-rose-500',
      bgColor: 'bg-rose-50'
    }
  ];

  const stats = [
    { value: '2,847', label: 'Active Participants', icon: Users },
    { value: '156K', label: 'TRCS Distributed', icon: TrendingUp },
    { value: '1,203', label: 'Credentials Issued', icon: Award },
    { value: '99.9%', label: 'Uptime', icon: Zap }
  ];

  const howItWorks = [
    {
      step: '01',
      title: 'Connect Your Wallet',
      description: 'Just click connect. MetaMask, WalletConnect, whatever you prefer.'
    },
    {
      step: '02',
      title: 'Join Event',
      description: 'Join a workshop, compete in a hackathon, or attend club events.'
    },
    {
      step: '03',
      title: 'Earn Rewards',
      description: 'Complete activities and watch your TRCS balance grow automatically.'
    },
    {
      step: '04',
      title: 'Claim & Celebrate',
      description: 'Claim your tokens and credentials whenever you\'re ready. They\'re yours.'
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <motion.section 
        className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-amber-500 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-8">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium">Reward student participation on blockchain.</span>
            </motion.div>
            
            <motion.h1 
              variants={itemVariants}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
              style={{ lineHeight: '1.1' }}
            >
              Participate.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                Get rewarded.
              </span>
              <br />
              Own your credentials.
            </motion.h1>
            
            <motion.p 
              variants={itemVariants}
              className="text-lg sm:text-xl text-slate-300 mb-10 max-w-2xl mx-auto"
            >
              TRCS rewards student participation in workshops, competitions, and club events with blockchain tokens. 
              Real tokens and verifiable credentials for your campus involvement.
            </motion.p>
            
            <motion.div 
              variants={itemVariants}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link to="/tokens">
                <motion.button 
                  className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 transition-shadow"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Join Events
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </Link>
              <Link to="/credentials">
                <motion.button 
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  View Credentials
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="white"/>
          </svg>
        </div>
      </motion.section>

      {/* Stats Section */}
      <motion.section 
        className="py-16 bg-white"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {stats.map((stat) => (
              <motion.div
                key={stat.label}
                variants={cardVariants}
                whileHover="hover"
                className="card-human text-center p-6"
              >
                <stat.icon className="w-8 h-8 text-indigo-500 mx-auto mb-3" />
                <div className="text-3xl lg:text-4xl font-bold text-slate-900 mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-slate-500 font-medium">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Features Section */}
      <motion.section 
        className="py-20 bg-slate-50"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={itemVariants} className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              Why people actually use this
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Not just another EdTech platform. We put your achievements on-chain 
              so they're truly, permanently yours.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={cardVariants}
                whileHover="hover"
                className="card-human p-6 cursor-pointer"
              >
                <div className={`inline-flex p-3 rounded-xl ${feature.bgColor} mb-4`}>
                  <feature.icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* How It Works */}
      <motion.section 
        className="py-20 bg-white"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={itemVariants} className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              Dead simple to get started
            </h2>
            <p className="text-lg text-slate-600">
              Four steps. That's it. No 47-page whitepaper required.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((item, index) => (
              <motion.div
                key={item.step}
                variants={itemVariants}
                className="relative"
              >
                {/* Connecting line */}
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-1/2 w-full h-0.5 bg-gradient-to-r from-indigo-200 to-transparent" />
                )}
                
                <div className="relative text-center">
                  <motion.div 
                    className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-bold text-xl mb-4 shadow-lg shadow-indigo-500/25"
                    whileHover={{ rotate: [0, -5, 5, 0], transition: { duration: 0.5 } }}
                  >
                    {item.step}
                  </motion.div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-slate-600 text-sm">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Trust Section */}
      <motion.section 
        className="py-20 bg-slate-900 text-white"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div variants={itemVariants}>
              <h2 className="text-3xl lg:text-4xl font-bold mb-6">
                Built on trust.{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                  Verified by code.
                </span>
              </h2>
              <p className="text-slate-300 text-lg mb-8">
                Smart contracts don't lie, don't forget, and don't play favorites. 
                Every token distribution, every credential—it's all on-chain and auditable.
              </p>
              
              <div className="space-y-4">
                {[
                  { icon: Lock, text: 'Audited smart contracts' },
                  { icon: Shield, text: 'Non-custodial by design' },
                  { icon: Zap, text: 'Gas-optimized transactions' }
                ].map((item) => (
                  <motion.div 
                    key={item.text}
                    className="flex items-center gap-3"
                    variants={itemVariants}
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-amber-400" />
                    </div>
                    <span className="font-medium">{item.text}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div 
              variants={cardVariants}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur-2xl opacity-20" />
              <div className="relative bg-slate-800 rounded-2xl p-8 border border-slate-700">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                </div>
                <pre className="text-sm text-slate-300 font-mono overflow-x-auto">
{`// RewardDistributor.sol
function claimReward(
    address recipient
) external {
    VestingSchedule storage schedule = 
        vestingSchedules[recipient];
    
    uint256 releasable = 
        getReleasableAmount(recipient);
    
    require(releasable > 0, "Nothing to claim");
    
    schedule.releasedAmount += releasable;
    rewardToken.transfer(recipient, releasable);
    
    emit RewardClaimed(recipient, releasable);
}`}
                </pre>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section 
        className="py-20 bg-gradient-to-br from-indigo-600 to-purple-700"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={containerVariants}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2 
            variants={itemVariants}
            className="text-3xl lg:text-4xl font-bold text-white mb-6"
          >
            Ready to Join Events?
          </motion.h2>
          <motion.p 
            variants={itemVariants}
            className="text-xl text-indigo-100 mb-10"
          >
            Join thousands of learners who are already building their on-chain reputation.
          </motion.p>
          <motion.div variants={itemVariants}>
            <Link to="/tokens">
              <motion.button 
                className="inline-flex items-center gap-2 px-10 py-4 bg-white text-indigo-600 font-semibold rounded-xl shadow-xl hover:shadow-2xl transition-shadow"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                Get Started Now
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}
