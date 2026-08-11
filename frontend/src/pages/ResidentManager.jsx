import React, { useState, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckIcon from '@mui/icons-material/Check';
import BlockIcon from '@mui/icons-material/Block';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import Alert from '@mui/material/Alert';

import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import LoadingSkeleton from '../components/LoadingSkeleton';

const ResidentManager = () => {
  const { user: currentUser } = useAuth();
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchResidents = async () => {
    setLoading(true);
    try {
      let url = `/api/users?limit=100`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (roleFilter) url += `&role=${roleFilter}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      
      const response = await api.get(url);
      setResidents(response.data);
    } catch (e) {
      console.error('Failed fetching residents:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResidents();
  }, [search, roleFilter, statusFilter]);

  const handleUpdateStatus = async (userId, newStatus) => {
    try {
      const response = await api.put(`/api/users/${userId}`, { status: newStatus });
      setResidents(prev => prev.map(u => u.id === userId ? response.data : u));
    } catch (e) {
      alert('Failed to update status: ' + (e.response?.data?.detail || e.message));
    }
  };

  const handleToggleRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'resident' : 'admin';
    const confirmMsg = `Are you sure you want to change this user role to ${newRole.toUpperCase()}?`;
    
    if (window.confirm(confirmMsg)) {
      try {
        const response = await api.put(`/api/users/${userId}`, { role: newRole });
        setResidents(prev => prev.map(u => u.id === userId ? response.data : u));
      } catch (e) {
        alert('Failed to update role: ' + (e.response?.data?.detail || e.message));
      }
    }
  };

  const handleDeleteResident = async (userId, name) => {
    if (window.confirm(`Are you absolutely sure you want to delete resident ${name}? This action is irreversible.`)) {
      try {
        await api.delete(`/api/users/${userId}`);
        setResidents(prev => prev.filter(u => u.id !== userId));
      } catch (e) {
        alert('Failed to delete resident: ' + (e.response?.data?.detail || e.message));
      }
    }
  };

  const getStatusChipColor = (status) => {
    if (status === 'approved') return 'success';
    if (status === 'suspended') return 'error';
    return 'warning';
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight="800" fontFamily="Outfit" mb={3}>
        Resident Directory Manager
      </Typography>

      {/* Filter Toolbar */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3, boxShadow: 'var(--shadow-sm)' }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search by name, email, flat no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
                sx: { borderRadius: 2 }
              }}
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField
              select
              size="small"
              fullWidth
              label="Filter by Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField
              select
              size="small"
              fullWidth
              label="Filter by Role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <MenuItem value="">All Roles</MenuItem>
              <MenuItem value="resident">Resident Only</MenuItem>
              <MenuItem value="admin">Administrator Only</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Directory Table */}
      {loading ? (
        <LoadingSkeleton type="table" />
      ) : residents.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <Typography variant="h6" color="text.secondary">No residents found matching search parameters.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 4, boxShadow: 'var(--shadow-sm)' }}>
          <Table>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell fontWeight="bold">Name</TableCell>
                <TableCell fontWeight="bold">Flat Number</TableCell>
                <TableCell fontWeight="bold">Contact Details</TableCell>
                <TableCell fontWeight="bold">Role</TableCell>
                <TableCell fontWeight="bold">Status</TableCell>
                <TableCell align="right" fontWeight="bold">Account Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {residents.map((res) => {
                const isSelf = res.id === currentUser.id;
                return (
                  <TableRow key={res.id} hover>
                    <TableCell>
                      <Typography fontWeight="bold">{res.name}</Typography>
                      <Typography variant="caption" color="text.secondary">Joined: {new Date(res.created_at).toLocaleDateString()}</Typography>
                    </TableCell>
                    <TableCell fontWeight="bold">{res.house_number}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{res.email}</Typography>
                      <Typography variant="caption" color="text.secondary">{res.phone}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={res.role}
                        color={res.role === 'admin' ? 'error' : 'primary'}
                        size="small"
                        sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={res.status}
                        color={getStatusChipColor(res.status)}
                        size="small"
                        sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {isSelf ? (
                        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                          Current Account
                        </Typography>
                      ) : (
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {res.status !== 'approved' && (
                            <Tooltip title="Approve Registration">
                              <IconButton color="success" size="small" onClick={() => handleUpdateStatus(res.id, 'approved')}>
                                <CheckIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          {res.status !== 'suspended' && (
                            <Tooltip title="Suspend Account">
                              <IconButton color="warning" size="small" onClick={() => handleUpdateStatus(res.id, 'suspended')}>
                                <BlockIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}

                          <Tooltip title={res.role === 'admin' ? "Demote to Resident" : "Promote to Admin"}>
                            <IconButton color="secondary" size="small" onClick={() => handleToggleRole(res.id, res.role)}>
                              <SupervisorAccountIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Delete Account">
                            <IconButton color="error" size="small" onClick={() => handleDeleteResident(res.id, res.name)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default ResidentManager;
