import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import EmailIcon from '@mui/icons-material/Email';
import CircularProgress from '@mui/material/CircularProgress';
import AuthLayout from '../layouts/AuthLayout';
import api from '../services/api';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      navigate(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setErrorMsg(detail);
      } else if (Array.isArray(detail)) {
        setErrorMsg(detail.map(d => d.msg || JSON.stringify(d)).join(', '));
      } else if (detail && typeof detail === 'object') {
        setErrorMsg(detail.msg || JSON.stringify(detail));
      } else {
        setErrorMsg(err.message || 'Email address not found or error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Panchayat AI" subtitle="Account Recovery Portal">
      <Typography variant="h5" align="center" fontWeight="bold" mb={2} color="primary">
        Forgot Password
      </Typography>

      <Typography variant="body2" color="text.secondary" align="center" mb={3}>
        Enter your registered email address. We will verify your account and send a 6-digit OTP code to your inbox.
      </Typography>

      {errorMsg && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMsg}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSendOtp} noValidate>
        <TextField
          margin="normal"
          fullWidth
          id="email"
          label="Registered Email Address"
          name="email"
          type="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <EmailIcon color="action" fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={loading}
          sx={{ mt: 3, mb: 2, py: 1.2, fontWeight: 'bold', textTransform: 'uppercase' }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Send OTP'}
        </Button>

        <Box display="flex" justifyContent="center">
          <Typography variant="body2" color="text.secondary">
            Remember your password?{' '}
            <Link component={RouterLink} to="/login" fontWeight="bold" color="primary">
              Log in here
            </Link>
          </Typography>
        </Box>
      </Box>
    </AuthLayout>
  );
};

export default ForgotPassword;
