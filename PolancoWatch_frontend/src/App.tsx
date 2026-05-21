import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Documentation = React.lazy(() => import('./pages/Documentation'));
const Processes = React.lazy(() => import('./pages/Processes'));
const Alerts = React.lazy(() => import('./pages/Alerts'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const Profile = React.lazy(() => import('./pages/Profile'));
const WebMonitors = React.lazy(() => import('./pages/WebMonitors'));
const WebMonitorDetails = React.lazy(() => import('./pages/WebMonitorDetails'));
const Backups = React.lazy(() => import('./pages/Backups'));
import Sidebar from './components/Sidebar';
import { authService } from './services/api';

import ReloadPrompt from './components/ReloadPrompt';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  return authService.isAuthenticated() ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  const [collapsed, setCollapsed] = React.useState(false);

  const Layout = ({ children }: { children: React.ReactNode }) => (
    <div className="flex bg-obsidian-950 min-h-screen text-slate-300 font-sans selection:bg-brand-primary/30">
      {/* Unified Background Texture Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
      </div>
      
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className={`flex-1 transition-all duration-500 relative z-10 w-full overflow-x-hidden pt-24 lg:pt-0 ${collapsed ? 'lg:pl-20' : 'lg:pl-72'}`}>
        {children}
      </div>
    </div>
  );

  const CyberpunkLoader = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-obsidian-950 text-brand-primary">
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 bg-brand-primary/20 blur-[40px] rounded-full animate-pulse-slow"></div>
        <Loader2 size={48} className="animate-spin text-brand-primary relative z-10" />
      </div>
      <p className="mt-6 text-sm font-black uppercase tracking-[0.3em] text-brand-primary/80 animate-pulse">Initializing Subsystem...</p>
    </div>
  );

  return (
    <>
      <BrowserRouter>
        <React.Suspense fallback={<CyberpunkLoader />}>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route 
            path="/" 
            element={
              <PrivateRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </PrivateRoute>
            } 
          />
          <Route 
            path="/alerts" 
            element={
              <PrivateRoute>
                <Layout>
                  <Alerts />
                </Layout>
              </PrivateRoute>
            } 
          />
          <Route 
            path="/processes" 
            element={
              <PrivateRoute>
                <Layout>
                  <Processes />
                </Layout>
              </PrivateRoute>
            } 
          />
          <Route 
            path="/documentation" 
            element={
              <PrivateRoute>
                <Layout>
                  <Documentation />
                </Layout>
              </PrivateRoute>
            } 
          />
          <Route 
            path="/backups" 
            element={
              <PrivateRoute>
                <Layout>
                  <Backups />
                </Layout>
              </PrivateRoute>
            } 
          />
          <Route 
            path="/web-monitors" 
            element={
              <PrivateRoute>
                <Layout>
                  <WebMonitors />
                </Layout>
              </PrivateRoute>
            } 
          />
          <Route 
            path="/web-monitors/:id" 
            element={
              <PrivateRoute>
                <Layout>
                  <WebMonitorDetails />
                </Layout>
              </PrivateRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <PrivateRoute>
                <Layout>
                  <Profile />
                </Layout>
              </PrivateRoute>
            } 
          />
          </Routes>
        </React.Suspense>
      </BrowserRouter>
      <ReloadPrompt />
    </>
  );
}

export default App;
