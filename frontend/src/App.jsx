import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ErrorForm from './pages/ErrorForm';
import ErrorDetail from './pages/ErrorDetail';
import Analytics from './pages/Analytics';
import Users from './pages/Users';

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="errors/new" element={<ProtectedRoute><ErrorForm /></ProtectedRoute>} />
        <Route path="errors/:id" element={<ErrorDetail />} />
        <Route path="errors/:id/edit" element={<ProtectedRoute><ErrorForm /></ProtectedRoute>} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="users" element={<ProtectedRoute role="admin"><Users /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-light)',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
              },
              success: { iconTheme: { primary: '#10b981', secondary: '#0b0e17' } },
              error:   { iconTheme: { primary: '#ef4444', secondary: '#0b0e17' } },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
