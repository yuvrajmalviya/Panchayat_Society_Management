import React, { useState, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import PushPinIcon from '@mui/icons-material/PushPin';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Dialog from '@mui/material/Dialog';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import { useForm } from 'react-hook-form';

import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import LoadingSkeleton from '../components/LoadingSkeleton';

const NoticeBoard = () => {
  const { isAdmin } = useAuth();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    defaultValues: {
      title: '',
      content: '',
      pinned: false
    }
  });

  const fetchNotices = async () => {
    setLoading(true);
    try {
      let url = `/api/notices?limit=100`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const response = await api.get(url);
      setNotices(response.data);
    } catch (e) {
      console.error('Failed fetching notices:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, [search]);

  const handleOpenCreate = () => {
    setEditingNotice(null);
    reset({ title: '', content: '', pinned: false });
    setDialogOpen(true);
  };

  const handleOpenEdit = (notice) => {
    setEditingNotice(notice);
    reset({
      title: notice.title,
      content: notice.content,
      pinned: notice.pinned
    });
    setDialogOpen(true);
  };

  const handleDelete = async (noticeId) => {
    if (window.confirm('Are you sure you want to delete this notice?')) {
      try {
        await api.delete(`/api/notices/${noticeId}`);
        setNotices(prev => prev.filter(n => n.id !== noticeId));
      } catch (e) {
        console.error('Failed to delete notice:', e);
      }
    }
  };

  const onSubmitNotice = async (data) => {
    setSubmitLoading(true);
    try {
      if (editingNotice) {
        // Edit Notice
        const response = await api.put(`/api/notices/${editingNotice.id}`, data);
        setNotices(prev => prev.map(n => n.id === editingNotice.id ? response.data : n));
      } else {
        // Create Notice
        const response = await api.post('/api/notices', data);
        setNotices(prev => [response.data, ...prev].sort((a,b) => (b.pinned - a.pinned)));
      }
      setDialogOpen(false);
    } catch (e) {
      console.error('Error saving notice:', e);
      alert('Failed to save notice: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="800" fontFamily="Outfit">
          Notice Board
        </Typography>
        {isAdmin && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
          >
            Create Notice
          </Button>
        )}
      </Box>

      {/* Search Bar */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3, boxShadow: 'var(--shadow-sm)' }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search notice titles or contents..."
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
      </Paper>

      {/* Notices Cards List */}
      {loading ? (
        <LoadingSkeleton type="list" />
      ) : notices.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <Typography variant="h6" color="text.secondary">No announcements or notices found.</Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {notices.map((notice) => (
            <Grid item xs={12} key={notice.id}>
              <Paper
                sx={{
                  p: 3,
                  borderRadius: 4,
                  boxShadow: 'var(--shadow-sm)',
                  borderLeft: notice.pinned ? '6px solid' : '1px solid',
                  borderLeftColor: notice.pinned ? 'warning.main' : 'divider',
                  borderStyle: notice.pinned ? 'solid' : 'solid',
                  borderColor: notice.pinned ? 'warning.light' : 'divider',
                  position: 'relative'
                }}
              >
                {notice.pinned && (
                  <PushPinIcon
                    color="warning"
                    sx={{ position: 'absolute', top: 16, right: 16, fontSize: 20 }}
                  />
                )}
                
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5} pr={4}>
                  <Box>
                    <Typography variant="h6" fontWeight="bold" color={notice.pinned ? 'warning.dark' : 'text.primary'}>
                      {notice.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Published on {new Date(notice.created_at).toLocaleDateString([], { dateStyle: 'long' })} | By {notice.created_by_name}
                    </Typography>
                  </Box>
                  
                  {isAdmin && (
                    <Stack direction="row" spacing={1}>
                      <IconButton size="small" color="primary" onClick={() => handleOpenEdit(notice)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(notice.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  )}
                </Box>
                
                <Divider sx={{ mb: 2 }} />
                
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', color: 'text.primary' }}>
                  {notice.content}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => !submitLoading && setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { p: 3, borderRadius: 4 } }}
      >
        <Typography variant="h5" fontWeight="bold" mb={2}>
          {editingNotice ? 'Edit Board Notice' : 'Publish New Notice'}
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Box component="form" onSubmit={handleSubmit(onSubmitNotice)}>
          <Stack spacing={2.5}>
            <TextField
              label="Notice Title"
              fullWidth
              error={!!errors.title}
              helperText={errors.title?.message}
              {...register('title', { required: 'Title is required', minLength: { value: 3, message: 'Title must be at least 3 characters' } })}
            />

            <TextField
              label="Detailed Contents"
              fullWidth
              multiline
              rows={6}
              error={!!errors.content}
              helperText={errors.content?.message}
              {...register('content', { required: 'Content is required', minLength: { value: 10, message: 'Content must be at least 10 characters' } })}
            />

            <FormControlLabel
              control={
                <Checkbox
                  {...register('pinned')}
                />
              }
              label="Pin notice to the top of the board"
            />

            <Stack direction="row" spacing={2} justifyContent="flex-end" pt={1}>
              <Button onClick={() => setDialogOpen(false)} disabled={submitLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={submitLoading}>
                {submitLoading ? 'Saving...' : 'Publish Notice'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Dialog>
    </Box>
  );
};

export default NoticeBoard;
