import React, { useState, useEffect } from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import DownloadIcon from '@mui/icons-material/Download';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SpeedIcon from '@mui/icons-material/Speed';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import api from '../services/api';
import DashboardCard from '../components/DashboardCard';
import LoadingSkeleton from '../components/LoadingSkeleton';

import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';
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
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

const Analytics = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadLoading, setDownloadLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/analytics/dashboard-stats');
      setStats(response.data);
    } catch (e) {
      console.error('Failed fetching analytics data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleExportPDF = async () => {
    setDownloadLoading(true);
    try {
      const response = await api.get('/api/analytics/download-report', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Panchayat_AI_Executive_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error('PDF generation failed:', e);
      alert('Error generating report: ' + e.message);
    } finally {
      setDownloadLoading(false);
    }
  };

  if (loading) {
    return (
      <Box p={1}>
        <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          Analytics Overview <CircularProgress size={24} />
        </Typography>
        <LoadingSkeleton type="cards" />
      </Box>
    );
  }

  if (!stats) return null;

  // Chart configs
  const categoriesLabels = Object.keys(stats.category_counts);
  const categoriesData = Object.values(stats.category_counts);

  const doughnutData = {
    labels: categoriesLabels,
    datasets: [
      {
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
        label: 'Tickets Filed',
        data: monthlyTrendsData,
        borderColor: '#1565C0',
        backgroundColor: 'rgba(21, 101, 192, 0.15)',
        tension: 0.35,
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
        label: 'Resident Growth',
        data: registrationsData,
        backgroundColor: '#43A047',
        borderRadius: 4,
      },
    ],
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <AssessmentIcon color="secondary" sx={{ fontSize: 32 }} />
          <Typography variant="h5" fontWeight="800" fontFamily="Outfit">
            System Analytics
          </Typography>
        </Box>
        
        <Button
          variant="contained"
          color="secondary"
          size="small"
          startIcon={downloadLoading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
          onClick={handleExportPDF}
          disabled={downloadLoading}
          sx={{ py: 0.8, px: 2, fontWeight: 'bold' }}
        >
          {downloadLoading ? 'Compiling PDF...' : 'Download Executive Report'}
        </Button>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2.5} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Avg Resolution Time"
            value={`${stats.complaints.avg_resolution_hours.toFixed(1)} hrs`}
            icon={<SpeedIcon />}
            color="#9C27B0"
            subtitle="Time to resolve tickets"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Resolution Rate"
            value={`${stats.complaints.resolution_rate.toFixed(1)}%`}
            icon={<CheckCircleIcon />}
            color="#43A047"
            subtitle="Resolved vs Open ratio"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Monthly Growth"
            value={stats.monthly_registrations[stats.monthly_registrations.length - 1]?.count || 0}
            icon={<TrendingUpIcon />}
            color="#1565C0"
            subtitle="Signups in past 30 days"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DashboardCard
            title="Unassigned Tickets"
            value={stats.complaints.pending}
            icon={<AssessmentIcon />}
            color="#FFA000"
            subtitle="Awaiting admin review"
          />
        </Grid>
      </Grid>

      {/* Graphs Grid */}
      <Grid container spacing={3}>
        {/* Left Column: Line & Bar trends */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2.5, borderRadius: 3, boxShadow: 'var(--shadow-md)' }}>
                <Typography variant="subtitle1" fontWeight="700" mb={1.5} color="text.primary">
                  Monthly Complaint Trends
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ position: 'relative', height: 210 }}>
                  <Line data={lineData} options={{ responsive: true, maintainAspectRatio: false }} />
                </Box>
              </Paper>
            </Grid>
            
            <Grid item xs={12}>
              <Paper sx={{ p: 2.5, borderRadius: 3, boxShadow: 'var(--shadow-md)' }}>
                <Typography variant="subtitle1" fontWeight="700" mb={1.5} color="text.primary">
                  New Resident Sign-ups (6 months)
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ position: 'relative', height: 210 }}>
                  <Bar data={barData} options={{ responsive: true, maintainAspectRatio: false }} />
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Grid>

        {/* Right Column: Category Distribution */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5, borderRadius: 3, boxShadow: 'var(--shadow-md)', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle1" fontWeight="700" mb={1.5} color="text.primary">
              Complaint Categories
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ position: 'relative', flexGrow: 1, minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {categoriesData.some(c => c > 0) ? (
                <Doughnut 
                  data={doughnutData} 
                  options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          boxWidth: 12,
                          font: { size: 11 }
                        }
                      }
                    }
                  }} 
                />
              ) : (
                <Typography variant="body2" color="text.secondary" align="center">
                  No complaints logged to render distribution.
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Analytics;
