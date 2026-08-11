import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import LockIcon from '@mui/icons-material/Lock';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import AuthLayout from '../layouts/AuthLayout';
import api from '../services/api';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const email = searchParams.get('email') || '';
  const otp = searchParams.get('otp') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Password strength checks
  const checks = {
    length: password.length >= 6,
    number: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    uppercase: /[A-Z]/.test(password)
  };

  const allValid = Object.values(checks).every(Boolean);

  const handleReset = async (e) => {
    e.preventDefault();
    if (!email || !otp) {
      setErrorMsg('Invalid session. Please restart the password reset process.');
      return;
    }
    if (!password || !confirmPassword) {
      setErrorMsg('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!allValid) {
      setErrorMsg('Password does not meet all security requirements.');
      return;
    }

    setErrorMsg('');
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', {
        email,
        otp,
        new_password: password
      });
      setSuccessMsg('Password updated successfully! Redirecting to login page...');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setErrorMsg(detail);
      } else if (Array.isArray(detail)) {
        setErrorMsg(detail.map(d => d.msg || JSON.stringify(d)).join(', '));
      } else if (detail && typeof detail === 'object') {
        setErrorMsg(detail.msg || JSON.stringify(detail));
      } else {
        setErrorMsg(err.message || 'Failed to reset password. The session may have expired.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Panchayat AI" subtitle="Create New Credentials">
      <Typography variant="h5" align="center" fontWeight="bold" mb={2} color="primary">
        Reset Password
      </Typography>

      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      {errorMsg && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMsg}
        </Alert>
      )}

      <Box component="form" onSubmit={handleReset} noValidate>
        <TextField
          margin="normal"
          fullWidth
          name="password"
          label="New Password"
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockIcon color="action" fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          margin="normal"
          fullWidth
          name="confirmPassword"
          label="Confirm Password"
          type="password"
          id="confirmPassword"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockIcon color="action" fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        {/* Strength Meter Checklist */}
        <Box sx={{ mt: 2, mb: 1, p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
          <Typography variant="caption" fontWeight="bold" color="text.secondary" display="block" mb={1}>
            Password Strength Requirements:
          </Typography>
          <Stack spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              {checks.length ? <CheckCircleIcon fontSize="inherit" color="success" /> : <RadioButtonUncheckedIcon fontSize="inherit" color="action" />}
              <Typography variant="caption" color={checks.length ? 'success.main' : 'text.secondary'}>
                Minimum 6 characters
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              {checks.uppercase ? <CheckCircleIcon fontSize="inherit" color="success" /> : <RadioButtonUncheckedIcon fontSize="inherit" color="action" />}
              <Typography variant="caption" color={checks.uppercase ? 'success.main' : 'text.secondary'}>
                At least one uppercase letter (A-Z)
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              {checks.number ? <CheckCircleIcon fontSize="inherit" color="success" /> : <RadioButtonUncheckedIcon fontSize="inherit" color="action" />}
              <Typography variant="caption" color={checks.number ? 'success.main' : 'text.secondary'}>
                At least one number (0-9)
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              {checks.special ? <CheckCircleIcon fontSize="inherit" color="success" /> : <RadioButtonUncheckedIcon fontSize="inherit" color="action" />}
              <Typography variant="caption" color={checks.special ? 'success.main' : 'text.secondary'}>
                At least one special character (!@#$%^&*)
              </Typography>
            </Stack>
          </Stack>
        </Box>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={loading || !allValid}
          sx={{ mt: 3, mb: 2, py: 1.2, fontWeight: 'bold', textTransform: 'uppercase' }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Reset Password'}
        </Button>
      </Box>
    </AuthLayout>
  );
};

export default ResetPassword;
