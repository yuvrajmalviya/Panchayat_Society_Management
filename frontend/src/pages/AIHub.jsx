import React, { useState, useEffect, useRef } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'; // Fallback to AutoAwesome
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import VoiceChatIcon from '@mui/icons-material/VoiceChat';
import SummarizeIcon from '@mui/icons-material/Summarize';
import ListAltIcon from '@mui/icons-material/ListAlt';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import CheckIcon from '@mui/icons-material/Check';
import KeyboardVoiceIcon from '@mui/icons-material/KeyboardVoice';
import DescriptionIcon from '@mui/icons-material/Description';
import { useLocation } from 'react-router-dom';

import api from '../services/api';
import VoiceRecorder from '../components/VoiceRecorder';

const AIHub = () => {
  const location = useLocation();
  const [tabValue, setTabValue] = useState(0);
  
  // URL tab selection tracking
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const tab = query.get('tab');
    if (tab === 'bylaws') setTabValue(0);
    else if (tab === 'digest') setTabValue(1);
    else if (tab === 'voice') setTabValue(2);
  }, [location]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // -----------------------------------------------------------
  // 1. RAG CHATBOT STATE & LOGIC
  // -----------------------------------------------------------
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'ai',
      text: 'Hello! I am your Bylaws Assistant. Ask me anything about society rules, parking spaces, maintenance fees, or guest policies.',
      citations: [],
      timestamp: new Date()
    }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = { sender: 'user', text: chatInput, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await api.post('/api/ai/ask-bylaw', { 
        question: userMsg.text,
        language: selectedLanguage
      });
      setChatMessages(prev => [...prev, {
        sender: 'ai',
        text: response.data.answer,
        citations: response.data.citations,
        timestamp: new Date()
      }]);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, {
        sender: 'ai',
        text: 'Sorry, I encountered an issue retrieving the answer. Please verify that the bylaws PDF has been uploaded.',
        citations: [],
        timestamp: new Date()
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // -----------------------------------------------------------
  // 2. CHAT DIGEST STATE & LOGIC
  // -----------------------------------------------------------
  const [chatLogsText, setChatLogsText] = useState('');
  const [digestResult, setDigestResult] = useState(null);
  const [digestLoading, setDigestLoading] = useState(false);

  const handleGenerateDigest = async () => {
    if (!chatLogsText.trim()) return;
    setDigestLoading(true);
    setDigestResult(null);
    try {
      const response = await api.post('/api/ai/chat-summary', { chat_text: chatLogsText });
      setDigestResult(response.data);
    } catch (err) {
      console.error(err);
      alert('Error parsing chat transcript.');
    } finally {
      setDigestLoading(false);
    }
  };

  // -----------------------------------------------------------
  // 3. VOICE COMPLAINT STATE & LOGIC
  // -----------------------------------------------------------
  const [voiceRecordBlob, setVoiceRecordBlob] = useState(null);
  const [voiceUploadLoading, setVoiceUploadLoading] = useState(false);
  const [createdVoiceTicket, setCreatedVoiceTicket] = useState(null);

  const handleVoiceRecord = (blob, duration) => {
    setVoiceRecordBlob(blob);
  };

  const handlePublishVoiceComplaint = async () => {
    if (!voiceRecordBlob) return;
    setVoiceUploadLoading(true);
    setCreatedVoiceTicket(null);
    
    try {
      const formData = new FormData();
      formData.append('voice', voiceRecordBlob, 'voice_complaint.wav');

      const response = await api.post('/api/ai/voice-to-ticket', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setCreatedVoiceTicket(response.data);
      setVoiceRecordBlob(null);
    } catch (e) {
      console.error('Error in voice-to-ticket pipeline:', e);
      alert('Error processing voice: ' + (e.response?.data?.detail || e.message));
    } finally {
      setVoiceUploadLoading(false);
    }
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1.5} mb={3}>
        <SmartToyIcon color="primary" sx={{ fontSize: 40 }} />
        <Typography variant="h4" fontWeight="800" fontFamily="Outfit">
          Panchayat AI Hub
        </Typography>
      </Box>

      {/* Action Tabs */}
      <Paper sx={{ mb: 3, borderRadius: 3, boxShadow: 'var(--shadow-sm)' }}>
        <Tabs value={tabValue} onChange={handleTabChange} indicatorColor="primary" textColor="primary" variant="fullWidth">
          <Tab icon={<SmartToyIcon />} iconPosition="start" label="Bylaws Chatbot" sx={{ fontWeight: 'bold' }} />
          <Tab icon={<SummarizeIcon />} iconPosition="start" label="Chat Digest Tool" sx={{ fontWeight: 'bold' }} />
          <Tab icon={<KeyboardVoiceIcon />} iconPosition="start" label="Voice Ticket Builder" sx={{ fontWeight: 'bold' }} />
        </Tabs>
      </Paper>

      {/* ----------------- TAB 0: BYLAWS CHATBOT ----------------- */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper
              sx={{
                p: 3,
                borderRadius: 4,
                boxShadow: 'var(--shadow-md)',
                height: 520,
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'var(--panel-bg)'
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2} mb={1}>
                <Box>
                  <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    RAG Smart Rules Assistant
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Queries the uploaded bylaws PDF. Answers are formatted in simple layperson terms.
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">Language:</Typography>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      background: 'var(--card-bg)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    <option value="English">English</option>
                    <option value="Hinglish">Hinglish (Hindi + English)</option>
                    <option value="Hindi">Hindi (हिंदी)</option>
                    <option value="Marathi">Marathi (मराठी)</option>
                    <option value="Gujarati">Gujarati (ગુજરાતી)</option>
                    <option value="Tamil">Tamil (தமிழ்)</option>
                    <option value="Telugu">Telugu (తెలుగు)</option>
                    <option value="Kannada">Kannada (ಕನ್ನಡ)</option>
                    <option value="Bengali">Bengali (বাংলা)</option>
                    <option value="Spanish">Spanish (Español)</option>
                  </select>
                </Box>
              </Box>
              
              <Divider sx={{ my: 1.5 }} />

              {/* Chat Messages Pane */}
              <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: 1, mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {chatMessages.map((msg, idx) => (
                  <Box
                    key={idx}
                    alignSelf={msg.sender === 'user' ? 'flex-end' : 'flex-start'}
                    sx={{
                      maxWidth: '80%',
                      display: 'flex',
                      gap: 1.5,
                      flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row'
                    }}
                  >
                    <Avatar sx={{ bgcolor: msg.sender === 'user' ? 'primary.main' : 'secondary.main', width: 36, height: 36 }}>
                      {msg.sender === 'user' ? <PersonIcon /> : <SmartToyIcon />}
                    </Avatar>
                    
                    <Box>
                      <Paper
                        sx={{
                          p: 1.8,
                          borderRadius: 3,
                          borderTopRightRadius: msg.sender === 'user' ? 0 : 3,
                          borderTopLeftRadius: msg.sender === 'user' ? 3 : 0,
                          bgcolor: msg.sender === 'user' ? 'primary.main' : 'action.selected',
                          color: msg.sender === 'user' ? 'white' : 'text.primary'
                        }}
                      >
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{msg.text}</Typography>
                      </Paper>
                      
                      {/* Citations list */}
                      {msg.sender === 'ai' && msg.citations && msg.citations.length > 0 && (
                        <Box sx={{ mt: 0.8, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {msg.citations.map((c, i) => (
                            <Chip
                              key={i}
                              size="small"
                              label={`Page ${c.page} - ${c.document_name}`}
                              icon={<DescriptionIcon fontSize="inherit" />}
                              sx={{ fontSize: 10, bgcolor: 'background.default' }}
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Box>
                ))}
                
                {chatLoading && (
                  <Box alignSelf="flex-start" display="flex" gap={1.5} alignItems="center">
                    <Avatar sx={{ bgcolor: 'secondary.main', width: 36, height: 36 }}>
                      <SmartToyIcon />
                    </Avatar>
                    <CircularProgress size={18} />
                    <Typography variant="caption" color="text.secondary">Searching bylaws vector indices...</Typography>
                  </Box>
                )}
                <div ref={chatEndRef} />
              </Box>

              {/* Chat Input Area */}
              <Box component="form" onSubmit={handleSendMessage} display="flex" gap={1.5}>
                <TextField
                  fullWidth
                  placeholder="Ask a question (e.g. What is the garbage disposal fee? or Parking space rules)"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  size="small"
                  disabled={chatLoading}
                />
                <Button type="submit" variant="contained" endIcon={<SendIcon />} disabled={chatLoading}>
                  Ask
                </Button>
              </Box>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, borderRadius: 4, boxShadow: 'var(--shadow-md)', height: '100%', bgcolor: 'var(--panel-bg)' }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Sample Questions to Test</Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1.5}>
                <Button
                  variant="outlined"
                  size="small"
                  align="left"
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                  onClick={() => setChatInput('What are the rules regarding parking slots?')}
                >
                  "What are the rules regarding parking slots?"
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  align="left"
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                  onClick={() => setChatInput('Is there a penalty for late maintenance fee?')}
                >
                  "Is there a penalty for late maintenance fee?"
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  align="left"
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                  onClick={() => setChatInput('What are the pet rules in the society?')}
                >
                  "What are the pet rules in the society?"
                </Button>
              </Stack>

              <Alert severity="info" sx={{ mt: 3 }}>
                The RAG chatbot retrieves data exclusively from document files uploaded as <strong>Bylaws</strong> in the Document Library. Make sure to upload a bylaws PDF first.
              </Alert>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ----------------- TAB 1: GROUP CHAT DIGEST ----------------- */}
      {tabValue === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, borderRadius: 4, boxShadow: 'var(--shadow-md)', bgcolor: 'var(--panel-bg)' }}>
              <Typography variant="h6" fontWeight="bold" mb={1} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Telegram / WhatsApp Chat Parser
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2.5}>
                Paste chat exports containing suggestions, meetings discussions, or circular feedback. AI will digest the text and list action plans.
              </Typography>

              <TextField
                fullWidth
                multiline
                rows={10}
                placeholder="Paste chats here... (e.g.
[10:15 AM] Sharma: We need to fix the streetlights in Block C.
[10:17 AM] Secretary: I will assign the electrician to check on Saturday.
[10:20 AM] Verma: Also, what about the fee date?
[10:21 AM] Secretary: The deadline is extended to 18th August.)"
                value={chatLogsText}
                onChange={(e) => setChatLogsText(e.target.value)}
                sx={{ mb: 2 }}
              />

              <Button
                variant="contained"
                fullWidth
                startIcon={digestLoading ? <CircularProgress size={20} color="inherit" /> : <ListAltIcon />}
                disabled={digestLoading || !chatLogsText.trim()}
                onClick={handleGenerateDigest}
              >
                {digestLoading ? 'Analyzing Chat Logs...' : 'Generate Chat Summary'}
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            {digestLoading && (
              <Paper sx={{ p: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', borderRadius: 4 }}>
                <CircularProgress size={48} sx={{ mb: 2 }} />
                <Typography variant="body1" fontWeight="bold">AI is reading the chat logs...</Typography>
                <Typography variant="body2" color="text.secondary">Structuring summary, tasks, decisions, announcements, and deadlines.</Typography>
              </Paper>
            )}

            {!digestLoading && !digestResult && (
              <Paper sx={{ p: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', borderRadius: 4, border: '2px dashed', borderColor: 'divider' }}>
                <SummarizeIcon color="disabled" sx={{ fontSize: 64, mb: 1.5 }} />
                <Typography variant="h6" color="text.secondary">No digest generated yet.</Typography>
                <Typography variant="body2" color="text.secondary" align="center">Paste chat transcripts on the left and run analysis.</Typography>
              </Paper>
            )}

            {!digestLoading && digestResult && (
              <Stack spacing={2.5}>
                <Paper sx={{ p: 3, borderRadius: 4, boxShadow: 'var(--shadow-md)' }}>
                  <Typography variant="subtitle1" fontWeight="bold" color="primary" display="flex" alignItems="center" gap={1} mb={1}>
                    <SummarizeIcon /> Conversation Summary
                  </Typography>
                  <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.6 }}>
                    {digestResult.summary}
                  </Typography>
                </Paper>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Paper sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                      <Typography variant="subtitle2" fontWeight="bold" color="success.main" display="flex" alignItems="center" gap={1} mb={1.5}>
                        <CheckCircleOutlinedIcon /> Major Decisions
                      </Typography>
                      <Stack component="ul" spacing={1} sx={{ pl: 2, fontSize: '0.85rem' }}>
                        {digestResult.decisions.map((dec, i) => (
                          <li key={i}>{dec}</li>
                        ))}
                      </Stack>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Paper sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                      <Typography variant="subtitle2" fontWeight="bold" color="warning.main" display="flex" alignItems="center" gap={1} mb={1.5}>
                        <ListAltIcon /> Action Tasks
                      </Typography>
                      <Stack component="ul" spacing={1} sx={{ pl: 2, fontSize: '0.85rem' }}>
                        {digestResult.tasks.map((task, i) => (
                          <li key={i}>{task}</li>
                        ))}
                      </Stack>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Paper sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                      <Typography variant="subtitle2" fontWeight="bold" color="primary.main" display="flex" alignItems="center" gap={1} mb={1.5}>
                        <SmartToyIcon /> Announcements
                      </Typography>
                      <Stack component="ul" spacing={1} sx={{ pl: 2, fontSize: '0.85rem' }}>
                        {digestResult.announcements.map((ann, i) => (
                          <li key={i}>{ann}</li>
                        ))}
                      </Stack>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Paper sx={{ p: 2.5, borderRadius: 3, height: '100%' }}>
                      <Typography variant="subtitle2" fontWeight="bold" color="error.main" display="flex" alignItems="center" gap={1} mb={1.5}>
                        <CalendarMonthIcon /> Deadlines
                      </Typography>
                      <Stack component="ul" spacing={1} sx={{ pl: 2, fontSize: '0.85rem' }}>
                        {digestResult.deadlines.map((dl, i) => (
                          <li key={i}>{dl}</li>
                        ))}
                      </Stack>
                    </Paper>
                  </Grid>
                </Grid>
              </Stack>
            )}
          </Grid>
        </Grid>
      )}

      {/* ----------------- TAB 2: VOICE TICKET BUILDER ----------------- */}
      {tabValue === 2 && (
        <Paper sx={{ p: 4, borderRadius: 4, boxShadow: 'var(--shadow-md)', maxW: '600px', mx: 'auto', bgcolor: 'var(--panel-bg)' }}>
          <Typography variant="h6" fontWeight="bold" mb={1} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            Voice-to-Ticket Creator
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Record your voice details. Whisper translates the speech, and our LLM fills the complaint Title, Description, Category, and Priority, automatically creating the ticket!
          </Typography>

          {voiceUploadLoading && (
            <Box display="flex" flexDirection="column" alignItems="center" py={6} gap={2}>
              <CircularProgress size={50} />
              <Typography variant="body1" fontWeight="bold">Processing Speech & Creating Ticket...</Typography>
              <Typography variant="caption" color="text.secondary">Whisper is transcribing audio. LLM is formatting fields.</Typography>
            </Box>
          )}

          {!voiceUploadLoading && !createdVoiceTicket && (
            <Stack spacing={3} alignItems="center">
              <VoiceRecorder onRecordComplete={handleVoiceRecord} />
              
              {voiceRecordBlob && (
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  startIcon={<CheckIcon />}
                  onClick={handlePublishVoiceComplaint}
                  sx={{ py: 1.2 }}
                >
                  Submit Voice Recording to AI
                </Button>
              )}
            </Stack>
          )}

          {!voiceUploadLoading && createdVoiceTicket && (
            <Box>
              <Alert severity="success" sx={{ mb: 3 }}>
                <strong>Complaint Registered Successfully!</strong> AI structured the voice log and generated the ticket.
              </Alert>

              <Card sx={{ bgcolor: 'action.hover', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                    <Typography variant="caption" fontFamily="monospace" fontWeight="bold">
                      {createdVoiceTicket.complaint_number}
                    </Typography>
                    <Chip size="small" label={createdVoiceTicket.category} color="primary" />
                    <Chip size="small" label={createdVoiceTicket.priority} color="error" />
                  </Stack>
                  
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    {createdVoiceTicket.title}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
                    {createdVoiceTicket.description}
                  </Typography>

                  <Divider sx={{ mb: 2 }} />
                  
                  <Typography variant="caption" color="text.disabled">
                    Status: PENDING | Automatically created at {new Date(createdVoiceTicket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </CardContent>
              </Card>

              <Button
                variant="outlined"
                fullWidth
                sx={{ mt: 3 }}
                onClick={() => setCreatedVoiceTicket(null)}
              >
                Log Another Voice Complaint
              </Button>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default AIHub;
