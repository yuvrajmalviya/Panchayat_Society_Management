import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import CircularProgress from '@mui/material/CircularProgress';
import AuthLayout from '../layouts/AuthLayout';
import Dialog from '@mui/material/Dialog';
import Stack from '@mui/material/Stack';
import api from '../services/api';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, formState: { errors } } = useForm();
  
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if user was redirected due to token expiry
  const queryParams = new URLSearchParams(location.search);
  const sessionExpired = queryParams.get('expired') === 'true';

  const onSubmit = async (data) => {
    setErrorMsg('');
    setLoading(true);
    try {
      await login(data.email, data.password);
      // Redirect to target path or dashboard
      const origin = location.state?.from?.pathname || '/';
      navigate(origin, { replace: true });
    } catch (err) {
      setErrorMsg(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Panchayat AI" subtitle="Resident & Administrator Portal">
      <Typography variant="h5" align="center" fontWeight="bold" mb={3} color="primary">
        Sign In
      </Typography>

      {sessionExpired && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Your session has expired. Please sign in again.
        </Alert>
      )}

      {errorMsg && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMsg}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField
          margin="normal"
          fullWidth
          id="email"
          label="Email Address"
          name="email"
          autoComplete="email"
          autoFocus
          error={!!errors.email}
          helperText={errors.email?.message}
          {...register('email', {
            required: 'Email address is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address'
            }
          })}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <EmailIcon color="action" fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        
        <TextField
          margin="normal"
          fullWidth
          name="password"
          label="Password"
          type="password"
          id="password"
          autoComplete="current-password"
          error={!!errors.password}
          helperText={errors.password?.message}
          {...register('password', {
            required: 'Password is required',
            minLength: {
              value: 6,
              message: 'Password must be at least 6 characters'
            }
          })}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockIcon color="action" fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <Box display="flex" justifyContent="flex-end" sx={{ mt: 1 }}>
          <Link
            component={RouterLink}
            to="/forgot-password"
            variant="body2"
            sx={{ textDecoration: 'none', fontWeight: 'medium' }}
          >
            Forgot Password?
          </Link>
        </Box>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={loading}
          sx={{ mt: 3, mb: 2, py: 1.2, fontWeight: 'bold', textTransform: 'uppercase' }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Log In'}
        </Button>

        <Box display="flex" justifyContent="center">
          <Typography variant="body2" color="text.secondary">
            Don't have an account?{' '}
            <Link component={RouterLink} to="/register" fontWeight="bold" color="primary">
              Register here
            </Link>
          </Typography>
        </Box>
      </Box>
    </AuthLayout>
  );
};

export default Login;
