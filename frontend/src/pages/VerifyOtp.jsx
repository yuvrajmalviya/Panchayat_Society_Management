import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import KeyIcon from '@mui/icons-material/Key';
import CircularProgress from '@mui/material/CircularProgress';
import AuthLayout from '../layouts/AuthLayout';
import api from '../services/api';

const VerifyOtp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get email from query params
  const searchParams = new URLSearchParams(location.search);
  const email = searchParams.get('email') || '';

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 5-minute expiry timer (300 seconds)
  const [timeLeft, setTimeLeft] = useState(300);
  // 60-second resend cooldown timer
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (!email) {
      navigate('/forgot-password');
    }
  }, [email, navigate]);

  // Expiry Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Resend Cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!otp) {
      setErrorMsg('Please enter the 6-digit OTP code.');
      return;
    }
    if (timeLeft <= 0) {
      setErrorMsg('OTP has expired. Please request a new OTP.');
      return;
    }

    setErrorMsg('');
    setLoading(true);
    try {
      await api.post('/api/auth/verify-otp', { email, otp });
      navigate(`/reset-password?email=${encodeURIComponent(email)}&otp=${encodeURIComponent(otp)}`);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setErrorMsg(detail);
      } else if (Array.isArray(detail)) {
        setErrorMsg(detail.map(d => d.msg || JSON.stringify(d)).join(', '));
      } else if (detail && typeof detail === 'object') {
        setErrorMsg(detail.msg || JSON.stringify(detail));
      } else {
        setErrorMsg(err.message || 'Invalid or expired OTP.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setResendLoading(true);
    try {
      await api.post('/api/auth/resend-otp', { email });
      setResendCooldown(60);
      setTimeLeft(300); // Reset expiry to 5 minutes
      setSuccessMsg('A new OTP verification code has been sent to your email.');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setErrorMsg(detail);
      } else if (Array.isArray(detail)) {
        setErrorMsg(detail.map(d => d.msg || JSON.stringify(d)).join(', '));
      } else if (detail && typeof detail === 'object') {
        setErrorMsg(detail.msg || JSON.stringify(detail));
      } else {
        setErrorMsg(err.message || 'Failed to resend OTP.');
      }
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <AuthLayout title="Panchayat AI" subtitle="Account Security Verification">
      <Typography variant="h5" align="center" fontWeight="bold" mb={2} color="primary">
        Verify OTP
      </Typography>

      <Typography variant="body2" color="text.secondary" align="center" mb={2}>
        Please enter the 6-digit verification code sent to:
        <br />
        <strong style={{ wordBreak: 'break-all' }}>{email}</strong>
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

      <Box component="form" onSubmit={handleVerify} noValidate>
        <TextField
          margin="normal"
          fullWidth
          id="otp"
          label="Verification Code"
          placeholder="6-digit OTP code"
          name="otp"
          autoFocus
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          inputProps={{ maxLength: 6 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <KeyIcon color="action" fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <Typography variant="body2" color="error" align="center" sx={{ mt: 1.5, mb: 1, fontWeight: 'medium' }}>
          {timeLeft > 0 ? `Code expires in: ${formatTime(timeLeft)}` : 'Code expired! Please request a new OTP.'}
        </Typography>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={loading || timeLeft <= 0}
          sx={{ mt: 2, mb: 2, py: 1.2, fontWeight: 'bold', textTransform: 'uppercase' }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Verify Code'}
        </Button>

        <Box display="flex" justifyContent="center" alignItems="center" mt={1}>
          <Button
            variant="text"
            onClick={handleResend}
            disabled={resendCooldown > 0 || resendLoading}
            sx={{ fontWeight: 'bold' }}
          >
            {resendLoading ? (
              <CircularProgress size={20} color="inherit" />
            ) : resendCooldown > 0 ? (
              `Resend OTP (${resendCooldown}s)`
            ) : (
              'Resend OTP'
            )}
          </Button>
        </Box>
      </Box>
    </AuthLayout>
  );
};

export default VerifyOtp;
