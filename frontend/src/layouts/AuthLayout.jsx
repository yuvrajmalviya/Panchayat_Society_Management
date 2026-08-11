import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import { motion } from 'framer-motion';

const AuthLayout = ({ children, title = "Panchayat AI", subtitle = "AI-Powered Society Portal" }) => {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        py: 4,
        overflowY: 'auto',
        backgroundImage: `linear-gradient(180deg, rgba(10, 30, 55, 0.32) 0%, rgba(10, 30, 55, 0.18) 40%, rgba(10, 30, 55, 0.48) 100%), url('/login-bg.jpg')`,
        backgroundSize: '120%',
        backgroundPosition: 'center 20%',
        backgroundRepeat: 'no-repeat',
        backgroundBlendMode: 'soft-light',
      }}
    >
      <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 2 }}>
        <Box
          component={motion.div}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          display="flex"
          flexDirection="column"
          alignItems="center"
        >
          <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
            <Box
              sx={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                bgcolor: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 3,
                mb: 1.5
              }}
            >
              <Typography variant="h4" color="primary" fontWeight="900" fontFamily="Outfit">P</Typography>
            </Box>
            <Typography variant="h3" color="white" fontWeight="900" align="center" fontFamily="Outfit" gutterBottom>
              {title}
            </Typography>
            <Typography variant="subtitle1" color="rgba(255,255,255,0.8)" align="center" fontWeight="500">
              {subtitle}
            </Typography>
          </Box>

          <Paper
            elevation={6}
            sx={{
              p: 4,
              width: '100%',
              borderRadius: 5,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.20)',
              bgcolor: 'rgba(255,255,255,0.94)',
              backdropFilter: 'blur(18px)',
              border: '1px solid rgba(255,255,255,0.5)',
            }}
          >
            {children}
          </Paper>
        </Box>
      </Container>
    </Box>
  );
};

export default AuthLayout;
