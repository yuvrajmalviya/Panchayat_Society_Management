import React, { useState, useEffect } from 'react';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import NotificationsIcon from '@mui/icons-material/Notifications';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import ListItem from '@mui/material/ListItem';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/api/notifications');
      setNotifications(response.data);
    } catch (e) {
      console.error('Error fetching notifications:', e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll notifications every 45 seconds
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, []);

  const handleOpen = (e) => {
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMarkRead = async (id, type) => {
    try {
      await api.put(`/api/notifications/${id}/read`);
      // Update local state
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      
      // Navigate based on type
      if (type === 'complaint') {
        navigate('/complaints');
      } else if (type === 'announcement' || type === 'notice') {
        navigate('/notices');
      }
      handleClose();
    } catch (e) {
      console.error('Error marking read:', e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/api/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      console.error('Error marking all read:', e);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation(); // Avoid triggering MenuItem onClick
    try {
      await api.delete(`/api/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Error deleting notification', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      <IconButton color="inherit" onClick={handleOpen}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: { width: 320, maxHeight: 400, mt: 1.5 }
        }}
      >
        <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight="bold">Notifications</Typography>
          {unreadCount > 0 && (
            <Button size="small" startIcon={<CheckIcon />} onClick={handleMarkAllRead}>
              Mark all read
            </Button>
          )}
        </Box>
        <Divider />
        
        {notifications.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary" sx={{ width: '100%', textAlign: 'center', py: 2 }}>
              No notifications yet.
            </Typography>
          </MenuItem>
        ) : (
          <List sx={{ p: 0 }}>
            {notifications.map((notif) => (
              <MenuItem
                key={notif.id}
                onClick={() => handleMarkRead(notif.id, notif.type)}
                sx={{
                  whiteSpace: 'normal',
                  bgcolor: notif.read ? 'inherit' : 'action.hover',
                  py: 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}
              >
                <ListItemText
                  primary={
                    <Typography variant="body2" fontWeight={notif.read ? 'normal' : 'bold'}>
                      {notif.title}
                    </Typography>
                  }
                  secondary={
                    <Box component="span">
                      <Typography variant="caption" color="text.secondary" display="block">
                        {notif.message}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Box>
                  }
                />
                <IconButton
                  size="small"
                  color="default"
                  onClick={(e) => handleDelete(notif.id, e)}
                  sx={{ ml: 1, opacity: 0.6, '&:hover': { opacity: 1 } }}
                >
                  <ClearIcon fontSize="inherit" />
                </IconButton>
              </MenuItem>
            ))}
          </List>
        )}
      </Menu>
    </>
  );
};

export default NotificationBell;
