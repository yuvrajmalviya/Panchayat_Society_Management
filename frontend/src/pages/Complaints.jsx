import React, { useState, useEffect } from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import Avatar from '@mui/material/Avatar';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import Alert from '@mui/material/Alert';
import { useForm, Controller } from 'react-hook-form';

import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import VoiceRecorder from '../components/VoiceRecorder';
import FileUpload from '../components/FileUpload';
import LoadingSkeleton from '../components/LoadingSkeleton';

const CATEGORIES = ["Water", "Electricity", "Security", "Road", "Garbage", "Sanitation", "Garden", "Street Light", "Other"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const STATUSES = ["Pending", "In Progress", "Assigned", "Resolved", "Closed"];

const STATUS_COLORS = {
  "Pending": "error",
  "In Progress": "info",
  "Assigned": "warning",
  "Resolved": "success",
  "Closed": "default"
};

const PRIORITY_COLORS = {
  "Low": "success",
  "Medium": "info",
  "High": "warning",
  "Critical": "error"
};

const Complaints = () => {
  const { user, isAdmin } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [adminsList, setAdminsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  // Filters state
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const { register, handleSubmit, control, reset, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      title: '',
      description: '',
      category: 'Other',
      priority: 'Medium',
      location: ''
    }
  });

  const [attachedFiles, setAttachedFiles] = useState([]);
  const [recordedVoiceBlob, setRecordedVoiceBlob] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Admin action states
  const [adminStatusUpdate, setAdminStatusUpdate] = useState('');
  const [adminAssignUpdate, setAdminAssignUpdate] = useState('');
  const [adminComment, setAdminComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      let url = `/api/complaints?limit=100`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (categoryFilter) url += `&category=${categoryFilter}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      
      const response = await api.get(url);
      setComplaints(response.data);
    } catch (e) {
      console.error('Error fetching complaints:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    if (isAdmin) {
      try {
        const response = await api.get('/api/users?role=admin');
        setAdminsList(response.data);
      } catch (e) {
        console.error('Error fetching admins list:', e);
      }
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, [statusFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    fetchAdmins();
  }, [isAdmin]);

  const handleOpenDrawer = async (complaint) => {
    try {
      const response = await api.get(`/api/complaints/${complaint.id}`);
      setSelectedComplaint(response.data);
      setAdminStatusUpdate(response.data.status);
      setAdminAssignUpdate(response.data.assigned_to || '');
      setAdminComment('');
      setDrawerOpen(true);
    } catch (err) {
      console.error('Failed to get ticket details', err);
    }
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedComplaint(null);
  };

  const handleVoiceRecordComplete = (blob, duration) => {
    setRecordedVoiceBlob(blob);
  };

  const handleFilesSelected = (files) => {
    setAttachedFiles(files);
  };

  const onSubmitComplaint = async (data) => {
    setSubmitLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('description', data.description);
      formData.append('category', data.category);
      formData.append('priority', data.priority);
      formData.append('location', data.location);

      attachedFiles.forEach(file => {
        formData.append('images', file);
      });

      if (recordedVoiceBlob) {
        formData.append('voice', recordedVoiceBlob, 'complaint_voice.wav');
      }

      const response = await api.post('/api/complaints', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setCreateDialogOpen(false);
      reset();
      setAttachedFiles([]);
      setRecordedVoiceBlob(null);
      fetchComplaints();
    } catch (e) {
      console.error('Error submitting complaint:', e);
      alert('Error creating complaint: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleAdminUpdateSubmit = async () => {
    if (!selectedComplaint) return;
    setActionLoading(true);
    try {
      const formData = new FormData();
      if (adminStatusUpdate) formData.append('status_update', adminStatusUpdate);
      formData.append('assigned_to', adminAssignUpdate);
      if (adminComment) formData.append('comment', adminComment);

      const response = await api.put(`/api/complaints/${selectedComplaint.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Update active selected complaint view
      setSelectedComplaint(response.data);
      setAdminComment('');
      
      // Update complaints list
      setComplaints(prev => prev.map(c => c.id === response.data.id ? response.data : c));
      
    } catch (e) {
      console.error('Failed to submit updates:', e);
      alert('Failed to update ticket: ' + (e.response?.data?.detail || e.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResidentCloseSubmit = async () => {
    if (!selectedComplaint) return;
    if (window.confirm('Are you sure you want to mark this complaint as Closed?')) {
      setActionLoading(true);
      try {
        const formData = new FormData();
        formData.append('status_update', 'Closed');
        formData.append('comment', 'Complaint closed by the resident.');

        const response = await api.put(`/api/complaints/${selectedComplaint.id}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        setSelectedComplaint(response.data);
        setComplaints(prev => prev.map(c => c.id === response.data.id ? response.data : c));
      } catch (e) {
        console.error('Failed to close complaint:', e);
      } finally {
        setActionLoading(false);
      }
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="800" fontFamily="Outfit">
          Complaints Registry
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            reset();
            setAttachedFiles([]);
            setRecordedVoiceBlob(null);
            setCreateDialogOpen(true);
          }}
        >
          File Complaint
        </Button>
      </Box>

      {/* Filters Toolbar */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3, boxShadow: 'var(--shadow-sm)' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search by ticket no. or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: <FilterListIcon fontSize="small" color="action" sx={{ mr: 1 }} />
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
              {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField
              select
              size="small"
              fullWidth
              label="Filter by Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <MenuItem value="">All Categories</MenuItem>
              {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Complaints List */}
      {loading ? (
        <LoadingSkeleton type="table" />
      ) : complaints.length === 0 ? (
        <Paper sx={{ p: 6, borderRadius: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">No complaints found matching current filters.</Typography>
          <Button variant="outlined" color="primary" sx={{ mt: 2 }} onClick={() => { setStatusFilter(''); setCategoryFilter(''); setSearchQuery(''); }}>
            Reset Filters
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {complaints.map((ticket) => (
            <Grid item xs={12} key={ticket.id}>
              <Card
                sx={{
                  borderRadius: 3,
                  boxShadow: 'var(--shadow-sm)',
                  cursor: 'pointer',
                  borderLeft: '5px solid',
                  borderColor: `${STATUS_COLORS[ticket.status]}.main`,
                  '&:hover': { boxShadow: 'var(--shadow-md)', transform: 'translateY(-1px)' },
                  transition: 'all 0.15s ease'
                }}
                onClick={() => handleOpenDrawer(ticket)}
              >
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                        <Typography variant="caption" color="text.secondary" fontFamily="monospace" fontWeight="bold">
                          {ticket.complaint_number}
                        </Typography>
                        <Chip size="small" label={ticket.category} color="primary" variant="outlined" />
                        <Chip size="small" label={ticket.priority} color={PRIORITY_COLORS[ticket.priority]} />
                      </Stack>
                      <Typography variant="h6" fontWeight="bold">{ticket.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {ticket.description}
                      </Typography>
                    </Box>
                    
                    <Box display="flex" flexDirection="column" alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
                      <Chip label={ticket.status} color={STATUS_COLORS[ticket.status]} sx={{ mb: 1, fontWeight: 'bold' }} />
                      <Typography variant="caption" color="text.secondary">
                        Logged by {ticket.created_by_name}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Drawer: Detailed Ticket View & Timelines */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={handleCloseDrawer}
        PaperProps={{ sx: { width: { xs: '100%', sm: 500, md: 550 }, p: 3, bgcolor: 'var(--bg-color)' } }}
      >
        {selectedComplaint && (
          <Box display="flex" flexDirection="column" height="100%" sx={{ overflowY: 'auto' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h5" fontWeight="bold" fontFamily="Outfit">Complaint Detail</Typography>
              <IconButton onClick={handleCloseDrawer}><CloseIcon /></IconButton>
            </Box>
            
            <Divider sx={{ mb: 2.5 }} />

            <Paper sx={{ p: 2.5, borderRadius: 3, mb: 3 }}>
              <Typography variant="caption" color="text.secondary" fontFamily="monospace" fontWeight="bold" display="block" gutterBottom>
                TICKET NO: {selectedComplaint.complaint_number}
              </Typography>
              
              <Typography variant="h6" fontWeight="bold" gutterBottom>{selectedComplaint.title}</Typography>
              
              <Stack direction="row" spacing={1.5} flexWrap="wrap" mb={2}>
                <Chip size="small" label={selectedComplaint.status} color={STATUS_COLORS[selectedComplaint.status]} sx={{ fontWeight: 'bold' }} />
                <Chip size="small" label={`Priority: ${selectedComplaint.priority}`} color={PRIORITY_COLORS[selectedComplaint.priority]} />
                <Chip size="small" label={selectedComplaint.category} variant="outlined" color="primary" />
              </Stack>

              <Typography variant="body2" color="text.primary" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
                {selectedComplaint.description}
              </Typography>

              <Stack spacing={1} color="text.secondary">
                {selectedComplaint.location && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <LocationOnIcon fontSize="small" />
                    <Typography variant="body2">{selectedComplaint.location}</Typography>
                  </Box>
                )}
                <Box display="flex" alignItems="center" gap={1}>
                  <CalendarTodayIcon fontSize="small" />
                  <Typography variant="body2">
                    Logged: {new Date(selectedComplaint.created_at).toLocaleDateString([], { dateStyle: 'medium' })}
                  </Typography>
                </Box>
              </Stack>

              {/* Display Voice Recording */}
              {selectedComplaint.voice_url && (
                <Box sx={{ mt: 3, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default' }}>
                  <Typography variant="subtitle2" fontWeight="bold" mb={1}>Voice Description Attachment:</Typography>
                  <audio src={`http://localhost:8000/${selectedComplaint.voice_url}`} controls style={{ width: '100%' }} />
                </Box>
              )}

              {/* Display Images */}
              {selectedComplaint.image_urls && selectedComplaint.image_urls.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" fontWeight="bold" mb={1}>Attached Photo(s):</Typography>
                  <Grid container spacing={1}>
                    {selectedComplaint.image_urls.map((img, idx) => (
                      <Grid item xs={4} key={idx}>
                        <Box
                          component="img"
                          src={`http://localhost:8000/${img}`}
                          alt="Attachment"
                          sx={{
                            width: '100%',
                            height: 100,
                            objectFit: 'cover',
                            borderRadius: 2,
                            cursor: 'pointer',
                            '&:hover': { opacity: 0.8 }
                          }}
                          onClick={() => window.open(`http://localhost:8000/${img}`, '_blank')}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </Paper>

            {/* Vertical Resolution Timeline */}
            <Typography variant="h6" fontWeight="bold" mb={2}>Resolution Timeline</Typography>
            <Paper sx={{ p: 2.5, borderRadius: 3, mb: 3 }}>
              {selectedComplaint.timeline.map((event, idx) => (
                <Box key={idx} sx={{ display: 'flex', mb: 2, '&:last-child': { mb: 0 } }}>
                  {/* Timeline line */}
                  <Box display="flex" flexDirection="column" alignItems="center" mr={2}>
                    <Avatar sx={{ width: 30, height: 30, bgcolor: `${STATUS_COLORS[event.status]}.light`, fontSize: 12, fontWeight: 'bold' }}>
                      {event.status[0]}
                    </Avatar>
                    {idx < selectedComplaint.timeline.length - 1 && (
                      <Box sx={{ width: 2, bgcolor: 'divider', flexGrow: 1, my: 1 }} />
                    )}
                  </Box>
                  <Box flexGrow={1} sx={{ mt: 0.5 }}>
                    <Box display="flex" justifyContent="space-between" flexWrap="wrap" mb={0.5}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {event.status}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(event.updated_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {event.comment}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                      By: {event.updated_by_name}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Paper>

            {/* Actions for Admin */}
            {isAdmin && (
              <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2 }}>
                <Typography variant="h6" fontWeight="bold" mb={2}>Admin Progress Panel</Typography>
                <Stack spacing={2}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Update Ticket Status"
                    value={adminStatusUpdate}
                    onChange={(e) => setAdminStatusUpdate(e.target.value)}
                  >
                    {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </TextField>

                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Assign Administrator"
                    value={adminAssignUpdate}
                    onChange={(e) => setAdminAssignUpdate(e.target.value)}
                  >
                    <MenuItem value="">Unassigned</MenuItem>
                    {adminsList.map(adm => <MenuItem key={adm.id} value={adm.id}>{adm.name}</MenuItem>)}
                  </TextField>

                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    size="small"
                    label="Timeline Comments"
                    placeholder="Provide details about actions taken or assignment notes..."
                    value={adminComment}
                    onChange={(e) => setAdminComment(e.target.value)}
                  />

                  <Button
                    variant="contained"
                    onClick={handleAdminUpdateSubmit}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Saving...' : 'Publish Update'}
                  </Button>
                </Stack>
              </Paper>
            )}

            {/* Actions for Resident Creator */}
            {!isAdmin && selectedComplaint.status !== 'Closed' && selectedComplaint.status !== 'Resolved' && (
              <Button
                variant="outlined"
                color="error"
                fullWidth
                onClick={handleResidentCloseSubmit}
                disabled={actionLoading}
                sx={{ mb: 2 }}
              >
                Close Ticket
              </Button>
            )}
          </Box>
        )}
      </Drawer>

      {/* Dialog: File New Complaint */}
      <Dialog
        open={createDialogOpen}
        onClose={() => !submitLoading && setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { p: 3, borderRadius: 4 } }}
      >
        <Typography variant="h5" fontWeight="bold" mb={2}>File New Complaint</Typography>
        <Divider sx={{ mb: 2 }} />

        <Box component="form" onSubmit={handleSubmit(onSubmitComplaint)}>
          <Stack spacing={2.5}>
            <TextField
              label="Complaint Title"
              fullWidth
              error={!!errors.title}
              helperText={errors.title?.message}
              {...register('title', { required: 'Title is required', minLength: { value: 3, message: 'Title must be at least 3 characters' } })}
            />

            <TextField
              label="Detailed Description"
              fullWidth
              multiline
              rows={4}
              error={!!errors.description}
              helperText={errors.description?.message}
              {...register('description', { required: 'Description is required', minLength: { value: 10, message: 'Description must be at least 10 characters' } })}
            />

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  select
                  label="Category"
                  fullWidth
                  {...register('category')}
                >
                  {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  select
                  label="Priority"
                  fullWidth
                  {...register('priority')}
                >
                  {PRIORITIES.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>

            <TextField
              label="Location (House Block, Sector or Area)"
              fullWidth
              placeholder="e.g. Near Block C lift lobby, or Main gate entrance"
              {...register('location')}
            />

            {/* Images Attachment */}
            <Box>
              <Typography variant="subtitle2" fontWeight="bold" mb={1}>Upload Photos (Max 3)</Typography>
              <FileUpload accept="image/*" multiple={true} onFilesSelected={handleFilesSelected} />
            </Box>

            {/* Voice Recording Attachment */}
            <Box>
              <Typography variant="subtitle2" fontWeight="bold" mb={1}>Record Voice Message (Optional)</Typography>
              <VoiceRecorder onRecordComplete={handleVoiceRecordComplete} />
              {recordedVoiceBlob && (
                <Alert severity="success" sx={{ mt: 1 }}>
                  Voice message attached successfully!
                </Alert>
              )}
            </Box>

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button onClick={() => setCreateDialogOpen(false)} disabled={submitLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={submitLoading} sx={{ minWidth: 120 }}>
                {submitLoading ? <CircularProgress size={24} color="inherit" /> : 'Log Ticket'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Dialog>
    </Box>
  );
};

export default Complaints;
