import React, { useState, useEffect } from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import { useNavigate } from 'react-router-dom';

// Icons
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AnnouncementIcon from '@mui/icons-material/Announcement';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import PaymentIcon from '@mui/icons-material/Payment';
import PeopleIcon from '@mui/icons-material/People';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckIcon from '@mui/icons-material/Check';
import BlockIcon from '@mui/icons-material/Block';

import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import DashboardCard from '../components/DashboardCard';
import LoadingSkeleton from '../components/LoadingSkeleton';

// Chart.js imports
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register ChartJS modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend
);

const Dashboard = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [notices, setNotices] = useState([]);
  const [myComplaintsCount, setMyComplaintsCount] = useState({ active: 0, solved: 0, pending: 0 });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isAdmin) {
        // Fetch Admin Analytics & Pending Approvals
        const [statsRes, pendingRes] = await Promise.all([
          api.get('/api/analytics/dashboard-stats'),
          api.get('/api/users?status=pending')
        ]);
        setStats(statsRes.data);
        setPendingApprovals(pendingRes.data);
      } else {
        // Fetch Resident Dashboard Data
        const [noticesRes, complaintsRes] = await Promise.all([
          api.get('/api/notices?limit=5'),
          api.get('/api/complaints')
        ]);
        
        setNotices(noticesRes.data);
        
        // Count statuses
        const active = complaintsRes.data.filter(c => ['In Progress', 'Assigned', 'Pending'].includes(c.status)).length;
        const solved = complaintsRes.data.filter(c => ['Resolved', 'Closed'].includes(c.status)).length;
        const pending = complaintsRes.data.filter(c => c.status === 'Pending').length;
        setMyComplaintsCount({ active, solved, pending });
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Could not connect to the backend server. Make sure the database and API server are running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAdmin]);

  const handleApproveResident = async (userId) => {
    try {
      await api.put(`/api/users/${userId}`, { status: 'approved' });
      // Remove from list
      setPendingApprovals(prev => prev.filter(u => u.id !== userId));
      // Refresh statistics
      if (stats) {
        setStats(prev => ({
          ...prev,
          residents: {
            ...prev.residents,
            approved: prev.residents.approved + 1,
            pending: prev.residents.pending - 1
          }
        }));
      }
    } catch (e) {
      console.error('Failed to approve resident:', e);
    }
  };

  const handleRejectResident = async (userId) => {
    if (window.confirm('Are you sure you want to suspend this registration request?')) {
      try {
        await api.put(`/api/users/${userId}`, { status: 'suspended' });
        setPendingApprovals(prev => prev.filter(u => u.id !== userId));
      } catch (e) {
        console.error('Failed to reject resident:', e);
      }
    }
  };

  if (loading) {
    return (
      <Box p={1}>
        <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          Dashboard <CircularProgress size={24} />
        </Typography>
        <LoadingSkeleton type="cards" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={fetchData}>Retry</Button>}>
          {error}
        </Alert>
      </Box>
    );
  }

  // -----------------------------------------------------------
  // RENDER ADMIN VIEW
  // -----------------------------------------------------------
  if (isAdmin && stats) {
    const categoriesLabels = Object.keys(stats.category_counts);
    const categoriesData = Object.values(stats.category_counts);
    
    const doughnutData = {
      labels: categoriesLabels,
      datasets: [
        {
          label: 'Complaints',
          data: categoriesData,
          backgroundColor: [
            '#1565C0', '#43A047', '#FFA000', '#F44336', '#9C27B0',
            '#00BCD4', '#009688', '#FF9800', '#795548'
          ],
          borderWidth: 1,
        },
      ],
    };

    const monthlyTrendsLabels = stats.monthly_trends.map(t => t.month);
    const monthlyTrendsData = stats.monthly_trends.map(t => t.count);

    const lineData = {
      labels: monthlyTrendsLabels,
      datasets: [
        {
          label: 'Complaints Filed',
          data: monthlyTrendsData,
          borderColor: '#1565C0',
          backgroundColor: 'rgba(21, 101, 192, 0.1)',
          tension: 0.3,
          fill: true,
        },
      ],
    };

    const registrationsLabels = stats.monthly_registrations.map(r => r.month);
    const registrationsData = stats.monthly_registrations.map(r => r.count);

    const barData = {
      labels: registrationsLabels,
      datasets: [
        {
          label: 'New Residents Approved',
          data: registrationsData,
          backgroundColor: '#43A047',
        },
      ],
    };

    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" fontWeight="800" fontFamily="Outfit">
            Administrator Dashboard
          </Typography>
          <Button variant="contained" color="secondary" onClick={() => navigate('/analytics')}>
            Detailed Analytics
          </Button>
        </Box>

        {/* Info Cards */}
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} sm={6} md={3}>
            <DashboardCard
              title="Total Residents"
              value={stats.residents.total}
              icon={<PeopleIcon />}
              color="#1565C0"
              subtitle={`${stats.residents.pending} pending approval`}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <DashboardCard
              title="Active Complaints"
              value={stats.complaints.active}
              icon={<ReportProblemIcon />}
              color="#FFA000"
              subtitle="Pending review or assignment"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <DashboardCard
              title="Solved Complaints"
              value={stats.complaints.solved}
              icon={<CheckCircleIcon />}
              color="#43A047"
              subtitle="Resolved or closed"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <DashboardCard
              title="Bylaws Vector Index"
              value={stats.documents.bylaws}
              icon={<DescriptionIcon />}
              color="#9C27B0"
              subtitle="PDFs active in RAG Chatbot"
            />
          </Grid>
        </Grid>

        <Grid container spacing={3} mb={4}>
          {/* Charts Row */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, borderRadius: 4, boxShadow: 'var(--shadow-md)', height: 350, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>Complaints by Category</Typography>
              <Box sx={{ flexGrow: 1, position: 'relative', height: '80%', display: 'flex', justifyContent: 'center' }}>
                {categoriesData.some(c => c > 0) ? (
                  <Doughnut data={doughnutData} options={{ responsive: true, maintainAspectRatio: false }} />
                ) : (
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 10 }}>No complaints recorded yet.</Typography>
                )}
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, borderRadius: 4, boxShadow: 'var(--shadow-md)', height: 350, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>Complaint Log Trends</Typography>
              <Box sx={{ flexGrow: 1, position: 'relative', height: '80%' }}>
                <Line data={lineData} options={{ responsive: true, maintainAspectRatio: false }} />
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, borderRadius: 4, boxShadow: 'var(--shadow-md)', height: 350, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>Monthly registrations</Typography>
              <Box sx={{ flexGrow: 1, position: 'relative', height: '80%' }}>
                <Bar data={barData} options={{ responsive: true, maintainAspectRatio: false }} />
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Approvals Table */}
        <Paper sx={{ p: 3, borderRadius: 4, boxShadow: 'var(--shadow-md)' }}>
          <Typography variant="h6" fontWeight="bold" mb={2}>
            Pending Resident Registrations ({pendingApprovals.length})
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          {pendingApprovals.length === 0 ? (
            <Typography variant="body1" color="text.secondary" align="center" py={4}>
              All resident registrations have been processed. No pending requests.
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>House No.</TableCell>
                    <TableCell>Address</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingApprovals.map((resident) => (
                    <TableRow key={resident.id} hover>
                      <TableCell fontWeight="bold">{resident.name}</TableCell>
                      <TableCell>{resident.email}</TableCell>
                      <TableCell>{resident.phone}</TableCell>
                      <TableCell>{resident.house_number}</TableCell>
                      <TableCell>{resident.address}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            variant="contained"
                            color="success"
                            size="small"
                            startIcon={<CheckIcon />}
                            onClick={() => handleApproveResident(resident.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            startIcon={<BlockIcon />}
                            onClick={() => handleRejectResident(resident.id)}
                          >
                            Suspend
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>
    );
  }

  // -----------------------------------------------------------
  // RENDER RESIDENT VIEW
  // -----------------------------------------------------------
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="800" fontFamily="Outfit" gutterBottom>
            Welcome, {user?.name}!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            House No: {user?.house_number} | {user?.address}
          </Typography>
        </Box>
        <Button variant="contained" color="primary" onClick={() => navigate('/complaints')}>
          File New Complaint
        </Button>
      </Box>

      {/* Info Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Active Complaints"
            value={myComplaintsCount.active}
            icon={<ReportProblemIcon />}
            color="#FFA000"
            subtitle="Tickets in progress"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Resolved Complaints"
            value={myComplaintsCount.solved}
            icon={<CheckCircleIcon />}
            color="#43A047"
            subtitle="Completed feedback loops"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Bylaw Chatbot"
            value="AI Active"
            icon={<SupportAgentIcon />}
            color="#1565C0"
            subtitle="Ask about parking, fees, bylaws"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Maintenance Fee"
            value="Paid"
            icon={<PaymentIcon />}
            color="#008080"
            subtitle="Next payment due in 25 days"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Notice Board Preview */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, borderRadius: 4, boxShadow: 'var(--shadow-md)', height: '100%' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" fontWeight="bold">Latest Board Notices</Typography>
              <Button size="small" onClick={() => navigate('/notices')}>View All</Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            {notices.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center" py={4}>
                No active announcements on the board.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {notices.map((notice) => (
                  <Box
                    key={notice.id}
                    sx={{
                      p: 2,
                      bgcolor: notice.pinned ? 'action.selected' : 'background.paper',
                      borderLeft: notice.pinned ? '4px solid' : '1px solid',
                      borderLeftColor: notice.pinned ? 'warning.main' : 'divider',
                      borderRadius: 2,
                      border: notice.pinned ? 'none' : '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                      <Typography variant="subtitle2" fontWeight="bold" color={notice.pinned ? 'warning.dark' : 'text.primary'}>
                        {notice.title} {notice.pinned && '📌'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(notice.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {notice.content}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>

        {/* Quick Operations */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, borderRadius: 4, boxShadow: 'var(--shadow-md)', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" fontWeight="bold" mb={2}>AI Assistant Quick Links</Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={2} sx={{ flexGrow: 1, justifyContent: 'center' }}>
              <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Ask Bylaws RAG Chatbot</Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                  Query specific guidelines from society bylaws documents.
                </Typography>
                <Button variant="outlined" fullWidth size="small" onClick={() => navigate('/ai-hub?tab=bylaws')}>
                  Open Chatbot
                </Button>
              </Box>

              <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 3, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Summarize WhatsApp Conversations</Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                  Paste Telegram / WhatsApp chat exports to extract decisions and tasks.
                </Typography>
                <Button variant="outlined" fullWidth size="small" onClick={() => navigate('/ai-hub?tab=digest')}>
                  Generate Digest
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
