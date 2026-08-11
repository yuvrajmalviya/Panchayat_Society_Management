import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { motion } from 'framer-motion';

const DashboardCard = ({ title, value, icon, color = '#1565C0', subtitle = '' }) => {
  return (
    <Box
      component={motion.div}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      sx={{ height: '100%' }}
    >
      <Card
        sx={{
          height: '100%',
          borderRadius: 4,
          boxShadow: 'var(--shadow-md)',
          borderLeft: `6px solid ${color}`,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -20,
            right: -20,
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: `${color}10`, // 10% opacity
            zIndex: 0,
          }
        }}
      >
        <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 3, position: 'relative', zIndex: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Typography variant="subtitle2" color="text.secondary" fontWeight="700" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {title}
            </Typography>
            <Box
              sx={{
                p: 1.2,
                borderRadius: 3,
                bgcolor: `${color}15`, // 15% opacity
                color: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {icon}
            </Box>
          </Box>
          
          <Typography variant="h3" fontWeight="800" sx={{ mt: 'auto', mb: 1, letterSpacing: '-0.03em', fontFamily: 'Outfit, sans-serif' }}>
            {value}
          </Typography>
          
          {subtitle && (
            <Typography variant="caption" color="text.secondary" fontWeight="500">
              {subtitle}
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default DashboardCard;
