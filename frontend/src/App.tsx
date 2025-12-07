/**
 * @file src/App.tsx
 * @description Main application component
 *
 * =============================================================================
 * LEARNING PATH - React Application Structure
 * =============================================================================
 *
 * This demo application showcases:
 * - Wallet connection with MetaMask
 * - Token balance display
 * - Credential viewing
 * - Reward claiming interface
 *
 * ARCHITECTURE:
 * - React Router for navigation
 * - Zustand for state management
 * - React Query for data fetching
 * - Tailwind CSS for styling
 *
 * =============================================================================
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import TokensPage from './pages/TokensPage';
import CredentialsPage from './pages/CredentialsPage';
import RewardsPage from './pages/RewardsPage';
import DemoPage from './pages/DemoPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="tokens" element={<TokensPage />} />
          <Route path="credentials" element={<CredentialsPage />} />
          <Route path="rewards" element={<RewardsPage />} />
          <Route path="demo" element={<DemoPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
