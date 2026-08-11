import React, { useState, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import AddIcon from '@mui/icons-material/Add';
import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import FileUpload from '../components/FileUpload';
import LoadingSkeleton from '../components/LoadingSkeleton';

const DOC_TYPES = ["Bylaws", "Meeting Minutes", "Circular"];

const Documents = () => {
  const { isAdmin } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0); // 0 = Bylaws, 1 = Minutes, 2 = Circulars
  const [search, setSearch] = useState('');
  
  // Dialog upload states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [docType, setDocType] = useState('Bylaws');
  const [description, setDescription] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const selectedType = DOC_TYPES[tabValue];
      let url = `/api/documents?type=${selectedType}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      
      const response = await api.get(url);
      setDocuments(response.data);
    } catch (e) {
      console.error('Failed fetching documents:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [tabValue, search]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleFileSelect = (files) => {
    if (files && files[0]) {
      setSelectedFile(files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Please select a PDF file to upload.');
      return;
    }
    setErrorMsg('');
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', docType);
      formData.append('description', description);

      await api.post('/api/documents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Clear values and close
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setDescription('');
      fetchDocuments();
    } catch (err) {
      console.error('Error uploading document:', err);
      setErrorMsg(err.response?.data?.detail || 'Failed to upload document.');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const response = await api.get(`/api/documents/${doc.id}/download`, {
        responseType: 'blob'
      });
      // Create download anchor link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error('Download failed:', e);
      alert('Error downloading file: ' + e.message);
    }
  };

  const handleDelete = async (docId) => {
    if (window.confirm('Are you sure you want to delete this document? (This will also remove its RAG chatbot index if it is a Bylaw PDF)')) {
      try {
        await api.delete(`/api/documents/${docId}`);
        setDocuments(prev => prev.filter(d => d.id !== docId));
      } catch (err) {
        console.error('Failed to delete document:', err);
      }
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="800" fontFamily="Outfit">
          Document Repository
        </Typography>
        {isAdmin && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => {
              setSelectedFile(null);
              setErrorMsg('');
              setUploadDialogOpen(true);
            }}
          >
            Upload PDF
          </Button>
        )}
      </Box>

      {/* Tabs Menu & Search */}
      <Paper sx={{ mb: 3, borderRadius: 3, boxShadow: 'var(--shadow-sm)' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" p={1}>
          <Tabs value={tabValue} onChange={handleTabChange} textColor="primary" indicatorColor="primary">
            <Tab label="Society Bylaws" sx={{ fontWeight: 'bold' }} />
            <Tab label="Meeting Minutes" sx={{ fontWeight: 'bold' }} />
            <Tab label="Official Circulars" sx={{ fontWeight: 'bold' }} />
          </Tabs>
          
          <Box p={1} sx={{ width: { xs: '100%', sm: 300 } }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search files..."
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
          </Box>
        </Box>
      </Paper>

      {/* Documents List */}
      {loading ? (
        <LoadingSkeleton type="table" />
      ) : documents.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <DescriptionIcon color="disabled" sx={{ fontSize: 64, mb: 1 }} />
          <Typography variant="h6" color="text.secondary">No files uploaded in this folder.</Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {documents.map((doc) => (
            <Grid item xs={12} key={doc.id}>
              <Paper
                sx={{
                  p: 2,
                  px: 3,
                  borderRadius: 3,
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  '&:hover': { boxShadow: 'var(--shadow-md)' },
                  transition: 'all 0.2s ease'
                }}
              >
                <Box display="flex" alignItems="center" gap={2}>
                  <DescriptionIcon color="primary" sx={{ fontSize: 36 }} />
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">{doc.filename}</Typography>
                    {doc.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {doc.description}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.disabled">
                      Uploaded by {doc.uploaded_by_name} on {new Date(doc.uploaded_at).toLocaleDateString([], { dateStyle: 'medium' })}
                    </Typography>
                  </Box>
                </Box>
                
                <Stack direction="row" spacing={1.5}>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleDownload(doc)}
                    size="small"
                  >
                    Download
                  </Button>
                  {isAdmin && (
                    <IconButton color="error" onClick={() => handleDelete(doc.id)}>
                      <DeleteIcon />
                    </IconButton>
                  )}
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => !uploadLoading && setUploadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { p: 3, borderRadius: 4 } }}
      >
        <Typography variant="h5" fontWeight="bold" mb={2}>Upload Document PDF</Typography>
        <Divider sx={{ mb: 2 }} />

        {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}

        <Box component="form" onSubmit={handleUploadSubmit}>
          <Stack spacing={2.5}>
            <TextField
              select
              label="Document Folder"
              fullWidth
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
            >
              <MenuItem value="Bylaws">Society Bylaws (Indexed for AI Chat)</MenuItem>
              <MenuItem value="Meeting Minutes">Meeting Minutes</MenuItem>
              <MenuItem value="Circular">Official Circulars</MenuItem>
            </TextField>

            <TextField
              label="Short Description"
              fullWidth
              multiline
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Approved parking and vehicle allocation guidelines 2026."
            />

            <Box>
              <Typography variant="subtitle2" fontWeight="bold" mb={1}>Select File</Typography>
              <FileUpload accept=".pdf" multiple={false} onFilesSelected={handleFileSelect} />
            </Box>

            {docType === 'Bylaws' && (
              <Alert severity="info">
                <strong>AI Vectoring Alert:</strong> Uploading a Bylaws document will execute our PDF text extractor, chunk it, and update the FAISS index. Residents will instantly be able to query the new rules via RAG.
              </Alert>
            )}

            <Stack direction="row" spacing={2} justifyContent="flex-end" pt={1}>
              <Button onClick={() => setUploadDialogOpen(false)} disabled={uploadLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={uploadLoading}>
                {uploadLoading ? <CircularProgress size={24} color="inherit" /> : 'Upload File'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Dialog>
    </Box>
  );
};

export default Documents;
