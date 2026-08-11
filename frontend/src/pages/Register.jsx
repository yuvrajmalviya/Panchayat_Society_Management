import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import HomeIcon from '@mui/icons-material/Home';
import MapIcon from '@mui/icons-material/Map';
import LockIcon from '@mui/icons-material/Lock';
import CircularProgress from '@mui/material/CircularProgress';
import AuthLayout from '../layouts/AuthLayout';
import api from '../services/api';

const Register = () => {
  const { register: registerAction } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      role: 'resident'
    }
  });
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      await api.post('/api/auth/register', data);
      setSuccessMsg('Verification codes sent successfully! Redirecting to verify your account...');
      setTimeout(() => {
        navigate(`/verify-registration?email=${encodeURIComponent(data.email)}`);
      }, 2000);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setErrorMsg(detail);
      } else if (Array.isArray(detail)) {
        setErrorMsg(detail.map(d => d.msg || JSON.stringify(d)).join(', '));
      } else if (detail && typeof detail === 'object') {
        setErrorMsg(detail.msg || JSON.stringify(detail));
      } else {
        setErrorMsg(err.message || 'Failed to register.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Panchayat AI" subtitle="Create Your Resident Account (approval may be required)">
      <Typography variant="h5" align="center" fontWeight="bold" mb={2} color="primary">
        Register Profile
      </Typography>

      <Typography variant="body2" align="center" color="text.secondary" mb={2}>
        Once registered, your account will be created immediately and may require administrator approval before full access.
      </Typography>

      {errorMsg && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMsg}
        </Alert>
      )}

      {successMsg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMsg}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Grid container spacing={1.5}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              id="name"
              label="Full Name"
              error={!!errors.name}
              helperText={errors.name?.message}
              {...register('name', { required: 'Name is required' })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              id="email"
              label="Email Address"
              error={!!errors.email}
              helperText={errors.email?.message}
              {...register('email', {
                required: 'Email is required',
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
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              id="phone"
              label="Phone Number"
              error={!!errors.phone}
              helperText={errors.phone?.message}
              {...register('phone', { required: 'Phone number is required' })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid item xs={6}>
            <TextField
              fullWidth
              id="house_number"
              label="House/Flat No."
              error={!!errors.house_number}
              helperText={errors.house_number?.message}
              {...register('house_number', { required: 'House No. is required' })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <HomeIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid item xs={6}>
            <TextField
              select
              fullWidth
              id="role"
              label="Role"
              {...register('role')}
            >
              <MenuItem value="resident">Resident</MenuItem>
              <MenuItem value="admin">Administrator</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              id="address"
              label="Society Address"
              placeholder="Block, sector or area name"
              error={!!errors.address}
              helperText={errors.address?.message}
              {...register('address', { required: 'Address is required' })}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MapIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
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
          </Grid>
        </Grid>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={loading}
          sx={{ mt: 3, mb: 2, py: 1.2, fontWeight: 'bold', textTransform: 'uppercase' }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Register'}
        </Button>

        <Box display="flex" justifyContent="center">
          <Typography variant="body2" color="text.secondary">
            Already have an account?{' '}
            <Link component={RouterLink} to="/login" fontWeight="bold" color="primary">
              Log in here
            </Link>
          </Typography>
        </Box>
      </Box>
    </AuthLayout>
  );
};

export default Register;
