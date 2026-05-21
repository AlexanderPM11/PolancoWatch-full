import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Documentation from './pages/Documentation';
import Processes from './pages/Processes';
import Alerts from './pages/Alerts';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

import Profile from './pages/Profile';
import WebMonitors from './pages/WebMonitors';
import WebMonitorDetails from './pages/WebMonitorDetails';
import Backups from './pages/Backups';
import Sidebar from './components/Sidebar';
import { authService } from './services/api';

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
      <div className={`flex-1 transition-all duration-500 relative z-10 w-full overflow-x-hidden ${collapsed ? 'lg:pl-20' : 'lg:pl-72'}`}>
        {children}
      </div>
    </div>
  );

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;
