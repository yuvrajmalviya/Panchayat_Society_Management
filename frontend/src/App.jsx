import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Contexts
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useAppTheme } from './context/ThemeContext';

// Layouts
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Complaints from './pages/Complaints';
import NoticeBoard from './pages/NoticeBoard';
import Documents from './pages/Documents';
import AIHub from './pages/AIHub';
import ResidentManager from './pages/ResidentManager';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';
import ForgotPassword from './pages/ForgotPassword';
import VerifyOtp from './pages/VerifyOtp';
import ResetPassword from './pages/ResetPassword';
import VerifyRegistration from './pages/VerifyRegistration';

const AppContent = () => {
  const { theme } = useAppTheme();

  // Create MUI theme based on the current context mode
  const muiTheme = createTheme({
    palette: {
      mode: theme,
      primary: {
        main: '#1565C0', // Navy Blue
        light: '#42a5f5',
        dark: '#0d47a1',
      },
      secondary: {
        main: '#43A047', // Forest Green
        light: '#66bb6a',
        dark: '#1b5e20',
      },
      background: {
        default: theme === 'light' ? '#F5F7FA' : '#0F172A',
        paper: theme === 'light' ? '#FFFFFF' : '#1E293B',
      },
      text: {
        primary: theme === 'light' ? '#2C3E50' : '#F8FAFC',
        secondary: theme === 'light' ? '#7F8C8D' : '#94A3B8',
      }
    },
    typography: {
      fontFamily: '"Inter", "Outfit", "Roboto", sans-serif',
      h3: {
        fontFamily: '"Outfit", sans-serif',
      },
      h4: {
        fontFamily: '"Outfit", sans-serif',
      },
      h5: {
        fontFamily: '"Outfit", sans-serif',
      },
      h6: {
        fontFamily: '"Outfit", sans-serif',
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            fontWeight: 600,
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          }
        }
      }
    }
  });

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-registration" element={<VerifyRegistration />} />

          {/* Protected Routes (Main Portal Layout) */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Dashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/complaints"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Complaints />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notices"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <NoticeBoard />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Documents />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-hub"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <AIHub />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Profile />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* Admin Exclusive Routes */}
          <Route
            path="/residents"
            element={
              <ProtectedRoute requireAdmin={true}>
                <MainLayout>
                  <ResidentManager />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute requireAdmin={true}>
                <MainLayout>
                  <Analytics />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </MuiThemeProvider>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
