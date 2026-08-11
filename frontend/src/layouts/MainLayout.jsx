import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';

// Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import AnnouncementIcon from '@mui/icons-material/Announcement';
import AssignmentIcon from '@mui/icons-material/Assignment';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PeopleIcon from '@mui/icons-material/People';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';

import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import NotificationBell from '../components/NotificationBell';

const drawerWidth = 260;

const MainLayout = ({ children }) => {
  const { user, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useAppTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(true);
  const [profileAnchorEl, setProfileAnchorEl] = useState(null);
  const [globalSearch, setGlobalSearch] = useState('');

  const handleDrawerToggle = () => {
    setOpen(!open);
  };

  const handleProfileOpen = (event) => {
    setProfileAnchorEl(event.currentTarget);
  };

  const handleProfileClose = () => {
    setProfileAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      // Direct user to complaints with a search query or a search page
      navigate(`/complaints?search=${encodeURIComponent(globalSearch)}`);
      setGlobalSearch('');
    }
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Complaints', icon: <AssignmentIcon />, path: '/complaints' },
    { text: 'Notice Board', icon: <AnnouncementIcon />, path: '/notices' },
    { text: 'Document Library', icon: <LibraryBooksIcon />, path: '/documents' },
    { text: 'AI Operations', icon: <SmartToyIcon />, path: '/ai-hub' },
  ];

  const adminItems = [
    { text: 'Resident Manager', icon: <PeopleIcon />, path: '/residents' },
    { text: 'System Analytics', icon: <AssessmentIcon />, path: '/analytics' },
  ];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Top Navbar */}
      <AppBar
        position="fixed"
        elevation={1}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          width: '100%',
          bgcolor: 'var(--panel-bg)',
          color: 'var(--text-primary)',
          borderBottom: '1px solid',
          borderColor: 'var(--border-color)',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: 2 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              onClick={handleDrawerToggle}
              edge="start"
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h5" fontWeight="900" color="primary" fontFamily="Outfit" sx={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
              Panchayat <Box component="span" color="secondary.main">AI</Box>
            </Typography>
          </Box>

          {/* Global Search */}
          <Box component="form" onSubmit={handleSearchSubmit} sx={{ width: { xs: 150, sm: 300, md: 400 }, mx: 2 }}>
            <TextField
              size="small"
              placeholder="Search complaints, notices, docs..."
              fullWidth
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" fontSize="small" />
                  </InputAdornment>
                ),
                sx: { borderRadius: 3, bgcolor: 'var(--bg-color)', border: 'none', '& fieldset': { border: 'none' } }
              }}
            />
          </Box>

          {/* Actions */}
          <Box display="flex" alignItems="center" gap={1.5}>
            <Tooltip title={`Toggle to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}>
              <IconButton color="inherit" onClick={toggleTheme}>
                {theme === 'light' ? <Brightness4Icon /> : <Brightness7Icon />}
              </IconButton>
            </Tooltip>
            
            <NotificationBell />

            <Tooltip title="User Profile">
              <IconButton onClick={handleProfileOpen} sx={{ p: 0.5 }}>
                <Avatar sx={{ bgcolor: 'primary.main', fontWeight: 'bold' }}>
                  {user?.name ? user.name[0].toUpperCase() : 'U'}
                </Avatar>
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={profileAnchorEl}
              open={Boolean(profileAnchorEl)}
              onClose={handleProfileClose}
              PaperProps={{
                elevation: 3,
                sx: {
                  width: 250,
                  mt: 1.5,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'var(--border-color)',
                  overflow: 'visible',
                  filter: 'drop-shadow(0px 4px 20px rgba(0,0,0,0.08))'
                }
              }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <Box sx={{ p: 2, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="subtitle1" fontWeight="700" color="var(--text-primary)" sx={{ lineHeight: 1.2 }}>
                  {user?.name || 'Resident User'}
                </Typography>
                <Typography 
                  variant="caption" 
                  color="text.secondary" 
                  sx={{ 
                    wordBreak: 'break-all', 
                    fontSize: '0.75rem',
                    lineHeight: 1.2
                  }}
                >
                  {user?.email}
                </Typography>
                <Box mt={1} display="flex">
                  <Typography
                    variant="caption"
                    sx={{
                      bgcolor: user?.role === 'admin' ? 'rgba(211, 47, 47, 0.1)' : 'rgba(46, 125, 50, 0.1)',
                      color: user?.role === 'admin' ? 'error.main' : 'success.main',
                      px: 1.5,
                      py: 0.4,
                      borderRadius: 2,
                      fontSize: '0.7rem',
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    {user?.role || 'resident'}
                  </Typography>
                </Box>
              </Box>
              <Divider sx={{ my: 1 }} />
              <MenuItem 
                onClick={() => { handleProfileClose(); navigate('/profile'); }}
                sx={{ py: 1, px: 2, mx: 1, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}><AccountCircleIcon fontSize="small" color="primary" /></ListItemIcon>
                <Typography variant="body2" fontWeight="600">My Profile</Typography>
              </MenuItem>
              <MenuItem 
                onClick={handleLogout} 
                sx={{ py: 1, px: 2, mx: 1, borderRadius: 2, color: 'error.main', '&:hover': { bgcolor: 'error.50' } }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}><ExitToAppIcon fontSize="small" color="error" /></ListItemIcon>
                <Typography variant="body2" fontWeight="600">Logout</Typography>
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar Drawer */}
      <Drawer
        variant="permanent"
        open={open}
        sx={{
          width: open ? drawerWidth : 70,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: open ? drawerWidth : 70,
            boxSizing: 'border-box',
            transition: 'width 0.2s ease',
            overflowX: 'hidden',
            bgcolor: 'var(--panel-bg)',
            color: 'var(--text-primary)',
            borderRight: '1px solid',
            borderColor: 'var(--border-color)',
            top: 64, // below Navbar
            height: 'calc(100vh - 64px)'
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', py: 1 }}>
          <List>
            {menuItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
                  <ListItemButton
                    onClick={() => navigate(item.path)}
                    selected={active}
                    sx={{
                      minHeight: 48,
                      justifyContent: open ? 'initial' : 'center',
                      px: 2.5,
                      mx: open ? 1.5 : 0.5,
                      borderRadius: 3,
                      my: 0.5,
                      color: active ? 'primary.main' : 'inherit',
                      bgcolor: active ? 'primary.100' : 'transparent',
                      '&.Mui-selected': {
                        bgcolor: 'primary.100',
                        color: 'primary.main',
                        '&:hover': { bgcolor: 'primary.200' }
                      }
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        mr: open ? 3 : 'auto',
                        justifyContent: 'center',
                        color: active ? 'primary.main' : 'inherit'
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    {open && <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: active ? 700 : 500 }} />}
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>

          {isAdmin && (
            <>
              <Divider sx={{ my: 1, mx: 2 }} />
              {open && (
                <Typography variant="caption" sx={{ px: 4, py: 0.5, textTransform: 'uppercase', fontWeight: 'bold', color: 'text.disabled', letterSpacing: '0.05em' }}>
                  Administration
                </Typography>
              )}
              <List>
                {adminItems.map((item) => {
                  const active = location.pathname === item.path;
                  return (
                    <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
                      <ListItemButton
                        onClick={() => navigate(item.path)}
                        selected={active}
                        sx={{
                          minHeight: 48,
                          justifyContent: open ? 'initial' : 'center',
                          px: 2.5,
                          mx: open ? 1.5 : 0.5,
                          borderRadius: 3,
                          my: 0.5,
                          color: active ? 'secondary.main' : 'inherit',
                          '&.Mui-selected': {
                            bgcolor: 'success.100',
                            color: 'secondary.main',
                            '&:hover': { bgcolor: 'success.200' }
                          }
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            minWidth: 0,
                            mr: open ? 3 : 'auto',
                            justifyContent: 'center',
                            color: active ? 'secondary.main' : 'inherit'
                          }}
                        >
                          {item.icon}
                        </ListItemIcon>
                        {open && <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: active ? 700 : 500 }} />}
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </>
          )}
          
          <Box sx={{ mt: 'auto', p: open ? 2 : 1 }}>
            {open ? (
              <Box sx={{ bgcolor: 'var(--bg-color)', p: 1.5, borderRadius: 3, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Logged in as</Typography>
                <Typography variant="body2" fontWeight="bold" noWrap>{user?.name}</Typography>
              </Box>
            ) : (
              <Avatar size="small" sx={{ mx: 'auto', width: 32, height: 32, bgcolor: 'secondary.main' }}>
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </Avatar>
            )}
          </Box>
        </Box>
      </Drawer>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8, // below AppBar height
          bgcolor: 'var(--bg-color)',
          minHeight: 'calc(100vh - 64px)'
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default MainLayout;
