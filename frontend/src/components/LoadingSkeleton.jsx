import React from 'react';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Grid from '@mui/material/Grid';

const LoadingSkeleton = ({ type = 'cards' }) => {
  if (type === 'list') {
    return (
      <Box sx={{ width: '100%' }}>
        {[1, 2, 3, 4].map((i) => (
          <Box key={i} sx={{ my: 2, p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
            <Skeleton variant="text" width="40%" height={30} />
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="60%" />
          </Box>
        ))}
      </Box>
    );
  }

  if (type === 'table') {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <Skeleton variant="rectangular" width="100%" height={40} sx={{ mb: 1 }} />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} variant="rectangular" width="100%" height={50} sx={{ mb: 1 }} />
        ))}
      </Box>
    );
  }

  // Default: Grid of cards
  return (
    <Grid container spacing={3}>
      {[1, 2, 3, 4].map((i) => (
        <Grid item xs={12} sm={6} md={3} key={i}>
          <Box sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
            <Skeleton variant="circular" width={40} height={40} sx={{ mb: 2 }} />
            <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="40%" height={32} />
          </Box>
        </Grid>
      ))}
    </Grid>
  );
};

export default LoadingSkeleton;
