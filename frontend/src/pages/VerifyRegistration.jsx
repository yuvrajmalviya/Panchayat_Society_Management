import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import KeyIcon from '@mui/icons-material/Key';
import EmailIcon from '@mui/icons-material/Email';
import CircularProgress from '@mui/material/CircularProgress';
import AuthLayout from '../layouts/AuthLayout';
import api from '../services/api';

const VerifyRegistration = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get email from query params
  const searchParams = new URLSearchParams(location.search);
  const email = searchParams.get('email') || '';

  const [emailOtp, setEmailOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 10-minute expiry timer (600 seconds)
  const [timeLeft, setTimeLeft] = useState(600);
  // 60-second resend cooldown timer
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (!email) {
      navigate('/register');
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
    if (!emailOtp) {
      setErrorMsg('Please enter the email verification code.');
      return;
    }
    if (timeLeft <= 0) {
      setErrorMsg('Verification code has expired. Please register again.');
      return;
    }

    setErrorMsg('');
    setLoading(true);
    try {
      await api.post('/api/auth/verify-registration', { 
        email, 
        email_otp: emailOtp
      });
      setSuccessMsg('Verification successful! Redirecting to login page...');
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
        setErrorMsg(err.message || 'Verification failed. The code may be incorrect or expired.');
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
      await api.post('/api/auth/resend-registration-otps', { email });
      setResendCooldown(60);
      setTimeLeft(600); // Reset expiry to 10 minutes
      setSuccessMsg('New email verification code has been sent.');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setErrorMsg(detail);
      } else if (Array.isArray(detail)) {
        setErrorMsg(detail.map(d => d.msg || JSON.stringify(d)).join(', '));
      } else if (detail && typeof detail === 'object') {
        setErrorMsg(detail.msg || JSON.stringify(detail));
      } else {
        setErrorMsg(err.message || 'Failed to resend verification code.');
      }
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <AuthLayout title="Panchayat AI" subtitle="Account Registration Verification">
      <Typography variant="h5" align="center" fontWeight="bold" mb={2} color="primary">
        Verify Account
      </Typography>

      <Typography variant="body2" color="text.secondary" align="center" mb={3}>
        We have sent a verification code to your email address:
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
          id="emailOtp"
          label="Email Verification Code"
          placeholder="6-digit Email OTP"
          name="emailOtp"
          autoFocus
          value={emailOtp}
          onChange={(e) => setEmailOtp(e.target.value)}
          inputProps={{ maxLength: 6 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <EmailIcon color="action" fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <Typography variant="body2" color="error" align="center" sx={{ mt: 1.5, mb: 1, fontWeight: 'medium' }}>
          {timeLeft > 0 ? `Code expires in: ${formatTime(timeLeft)}` : 'Code expired! Please register again.'}
        </Typography>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={loading || timeLeft <= 0}
          sx={{ mt: 2, mb: 2, py: 1.2, fontWeight: 'bold', textTransform: 'uppercase' }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Verify & Register'}
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
              `Resend Code (${resendCooldown}s)`
            ) : (
              'Resend Code'
            )}
          </Button>
        </Box>
      </Box>
    </AuthLayout>
  );
};

export default VerifyRegistration;
