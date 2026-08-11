import React, { useState, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';

const FileUpload = ({ accept = '.pdf', multiple = false, onFilesSelected }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFiles = (files) => {
    const validFiles = Array.from(files);
    
    let newSelected;
    if (multiple) {
      newSelected = [...selectedFiles, ...validFiles];
    } else {
      newSelected = validFiles.slice(0, 1);
    }
    
    setSelectedFiles(newSelected);
    onFilesSelected(newSelected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const removeFile = (idx) => {
    const updated = selectedFiles.filter((_, i) => i !== idx);
    setSelectedFiles(updated);
    onFilesSelected(updated);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        sx={{
          p: 3,
          border: '2px dashed',
          borderColor: dragActive ? 'primary.main' : 'divider',
          borderRadius: 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: dragActive ? 'action.hover' : 'background.paper',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          '&:hover': {
            borderColor: 'primary.light',
            bgcolor: 'action.hover'
          }
        }}
        onClick={onButtonClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          style={{ display: 'none' }}
        />
        <CloudUploadIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
        <Typography variant="body1" fontWeight="500">
          Drag and drop files here, or click to browse
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          Accepted formats: {accept}
        </Typography>
      </Box>

      {selectedFiles.length > 0 && (
        <Box sx={{ mt: 2 }}>
          {selectedFiles.map((file, idx) => (
            <Box
              key={idx}
              sx={{
                p: 1,
                px: 2,
                mt: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: 'action.selected',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Box display="flex" alignItems="center" gap={1}>
                <AttachFileIcon color="action" fontSize="small" />
                <Typography variant="body2" noWrap sx={{ maxWidth: 280 }}>
                  {file.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ({(file.size / 1024).toFixed(1)} KB)
                </Typography>
              </Box>
              <IconButton size="small" color="error" onClick={(e) => {
                e.stopPropagation(); // Avoid triggering Box click
                removeFile(idx);
              }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default FileUpload;
