import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import BlockIcon from '@mui/icons-material/Block';

import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Profile = () => {
  const { user, refreshUser } = useAuth();
  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    defaultValues: {
      name: user?.name || '',
      phone: user?.phone || '',
      house_number: user?.house_number || '',
      address: user?.address || '',
      password: ''
    }
  });

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const onSubmitProfile = async (data) => {
    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      // Filter empty password
      const payload = { ...data };
      if (!payload.password) delete payload.password;

      await api.put('/api/auth/me', payload);
      await refreshUser();
      
      setSuccessMsg('Profile updated successfully!');
      reset({ ...data, password: '' });
    } catch (e) {
      console.error(e);
      setErrorMsg(e.response?.data?.detail || 'Failed to update profile details.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusAlert = () => {
    if (user?.status === 'pending') {
      return (
        <Alert severity="warning" variant="filled" sx={{ mb: 3, borderRadius: 3, fontWeight: 'bold' }}>
          Your account is PENDING approval. An administrator must verify and approve your registration before you can log tickets or access announcements.
        </Alert>
      );
    }
    if (user?.status === 'suspended') {
      return (
        <Alert severity="error" variant="filled" sx={{ mb: 3, borderRadius: 3 }}>
          Your account has been SUSPENDED. Please contact society administration.
        </Alert>
      );
    }
    return (
      <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3, borderRadius: 3 }}>
        Your account is fully APPROVED and active. You have full access to society portals.
      </Alert>
    );
  };

  return (
    <Box maxWidth="700px" mx="auto">
      <Typography variant="h4" fontWeight="800" fontFamily="Outfit" mb={3}>
        My Profile Settings
      </Typography>

      {/* Account Status Alert */}
      {getStatusAlert()}

      {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}

      <Paper sx={{ p: 4, borderRadius: 4, boxShadow: 'var(--shadow-md)' }}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>Personal Information</Typography>
        <Divider sx={{ mb: 3 }} />

        <Box component="form" onSubmit={handleSubmit(onSubmitProfile)}>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Full Name"
                fullWidth
                error={!!errors.name}
                helperText={errors.name?.message}
                {...register('name', { required: 'Name is required' })}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email Address (Locked)"
                fullWidth
                disabled
                value={user?.email || ''}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone Number"
                fullWidth
                error={!!errors.phone}
                helperText={errors.phone?.message}
                {...register('phone', { required: 'Phone is required' })}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="House / Flat Number"
                fullWidth
                error={!!errors.house_number}
                helperText={errors.house_number?.message}
                {...register('house_number', { required: 'House No. is required' })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Society Address"
                fullWidth
                error={!!errors.address}
                helperText={errors.address?.message}
                {...register('address', { required: 'Address is required' })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Change Password (Leave blank to keep current)"
                type="password"
                fullWidth
                error={!!errors.password}
                helperText={errors.password?.message}
                {...register('password', {
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters'
                  }
                })}
              />
            </Grid>
          </Grid>

          <Box mt={4} display="flex" justifyContent="flex-end">
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{ px: 4, py: 1, fontWeight: 'bold' }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Save Changes'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default Profile;
