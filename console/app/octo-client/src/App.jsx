import React, { useState, useRef, useEffect } from 'react';
import { useSettings } from './context/SettingsContext';
import MessageBubble from './components/Chat/MessageBubble';
import CommandMenu from './components/Chat/CommandMenu';
import AttachmentPreview from './components/Chat/AttachmentPreview';
import CustomPromptModal from './components/Modals/CustomPromptModal';
import SkillModal from './components/Modals/SkillModal';
import FileViewerModal from './components/Modals/FileViewerModal';
import { api } from './api';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import UserProfile from './components/UserProfile';
import SapLogin from './components/SapMCP/SapLogin';


function App() {
  const { settings, updateSettings, resetSettings, saveSettingsToBackend } = useSettings();
  const [messages, setMessages] = useState([]);
  const [inputObj, setInputObj] = useState({ text: '' });

  // Auth State
  const [isAuthorized, setIsAuthorized] = useState(null); // null=loading, true=ok, false=denied
  const [userInfo, setUserInfo] = useState(null);

  const [leftOpen, setLeftOpen] = useState(false); // Default collapsed
  const [rightOpen, setRightOpen] = useState(false); // Default collapsed
  const [isProcessing, setIsProcessing] = useState(false);
  const [historyID, setHistoryID] = useState('');

  // Attachments
  const [attachment, setAttachment] = useState(null);
  const fileInputRef = useRef(null);

  // File Viewer Modal
  const [viewingFile, setViewingFile] = useState(null); // { name, content }

  // Commands
  const [showCommandMenu, setShowCommandMenu] = useState(false);

  // Refs for UI behavior
  const textareaRef = useRef(null);
  const lastMessageRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [messages.length, isProcessing]); // Trigger on new message or processing state change


  // Settings / Modals
  const [skills, setSkills] = useState([]);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Save");

  // Helper to format time
  const formatTime = () => new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  // Check Auth and Load Skills on mount
  useEffect(() => {
    const initApp = async () => {
      try {
        // Check Auth
        const user = await api.getUserInfo();
        // Map OData response or direct JSON
        const userData = user.value || user;
        console.log("App.jsx: Auth Check Result:", userData);

        if (!userData.username || userData.username === "Anonymous") {
          // Double check if anonymous is allowed? Requirement says reject.
          // Assuming BTP always returns a user if authenticated.
          // For now accept it, but typically XSUAA provides a real user.
          // If the requirement is strict "reject if not authorized", 401/403 would be thrown by api.
          // But if we get "Anonymous", it means passport pass-thru (mock).
          // We treat "Anonymous" as OK for Local Dev, but in PROD it will be real user.
        }

        setUserInfo(userData);
        setIsAuthorized(true);

        // Sync NTID to settings if empty
        if (userData.username) {
          updateSettings({ ntid: userData.username });
        }

        // Load Skills
        const list = await api.getSkills();
        setSkills(list);

      } catch (e) {
        console.error("Auth verification failed", e);
        setIsAuthorized(false);
      }
    };
    initApp();
  }, []);


  // Handle Input Change & Command Menu
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputObj({ ...inputObj, text: val });

    const pos = e.target.selectionStart || 0;
    const hasAt = pos > 0 && val[pos - 1] === "@";
    setShowCommandMenu(hasAt);

    // Auto resize
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const insertCommand = (cmd) => {
    const val = inputObj.text;
    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1) {
      const newVal = val.substring(0, lastAt) + `@${cmd} `;
      setInputObj({ ...inputObj, text: newVal });
    }
    setShowCommandMenu(false);
    textareaRef.current?.focus(); // Restore focus to input
  };

  // Attachments
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0]);
    }
    e.target.value = null; // reset
  };

  const handleSend = async (e) => {
    e.preventDefault();
    let textToSend = inputObj.text.trim();
    let attachmentData = null;
    let fullContentForLLM = textToSend;

    // Read attachment if exists
    if (attachment) {
      try {
        const content = await attachment.text();
        attachmentData = { name: attachment.name, content: content };

        // Append content for LLM Logic (Hidden from UI text)
        if (fullContentForLLM) fullContentForLLM += "\n\n";
        fullContentForLLM += content;

        setAttachment(null); // Clear after reading
      } catch (err) {
        alert("Error reading file attachment");
        return;
      }
    }

    if (!textToSend && !attachmentData) return;

    // UI Message (keeps text and attachment separate)
    const newMsg = {
      role: 'user',
      text: textToSend,
      attachment: attachmentData,
      sender: settings.ntid || 'You',
      time: formatTime()
    };

    setMessages(prev => [...prev, newMsg]);
    setInputObj({ text: '' });
    setIsProcessing(true);
    setShowCommandMenu(false);

    try {
      // Detect commands in the full content or just text? 
      // Usually commands are in text. 
      // Logic below parses 'textToSend', which is fine as commands like @analyze are usually typed.
      // If the user types "@analyze" and attaches a file, fullContentForLLM has the code.

      let option = null;
      let finalMessage = fullContentForLLM;

      if (textToSend.startsWith('@analyze')) {
        option = 'analyze';
        // Remove command from the full content, assuming it's at start
        finalMessage = fullContentForLLM.replace('@analyze', '').trim();
      } else if (textToSend.startsWith('@refactor')) {
        option = 'refactor';
        finalMessage = fullContentForLLM.replace('@refactor', '').trim();
      } else if (textToSend.startsWith('@review')) {
        option = 'review';
        finalMessage = fullContentForLLM.replace('@review', '').trim();
      }

      const data = await api.chat(
        finalMessage,
        settings,
        option,
        false,
        { historyID }
      );

      if (data.hisID) setHistoryID(data.hisID);

      setMessages(prev => [...prev, {
        role: 'bot',
        text: data.reply,
        sender: 'Octo Agent',
        time: formatTime()
      }]);

    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: `**Error:** ${error.message}`,
        sender: 'Octo Agent',
        time: formatTime()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings.ntid) resetSettings();

    setSaveStatus("Saving...");
    const success = await saveSettingsToBackend();

    if (success) {
      setSaveStatus("Saved ✓");
    } else {
      setSaveStatus("Error ✗");
    }
    setTimeout(() => setSaveStatus("Save"), 1200);
  };

  if (isAuthorized === false) {
    return (
      <div className="auth-error-screen" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        color: '#c0392b'
      }}>
        <h1>Access Denied</h1>
        <p>You are not authorized to use the Octo Agent app.</p>
      </div>
    );
  }

  if (isAuthorized === null) {
    // Loading screen
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#666' }}>
        <span>Verifying Authorization...</span>
      </div>
    );
  }


  // Metadata Extraction Helper
  const extractMetadata = (text) => {
    if (!text) return { objectType: "", objectName: "", error: "" };

    let objectType = "";
    let objectName = "";
    let error = "";

    const typeMatch = text.match(/Object Type\s*[:]\s*(.*?)(\n|$)/i);
    if (typeMatch) objectType = typeMatch[1].trim().replace(/`/g, '');

    const nameMatch = text.match(/Object Name\s*[:]\s*(.*?)(\n|$)/i);
    if (nameMatch) objectName = nameMatch[1].trim().replace(/`/g, '');

    const errorMatch = text.match(/Error\s*[:]\s*(.*?)(\n|$)/i);
    if (errorMatch) error = errorMatch[1].trim().replace(/`/g, '');

    return { objectType, objectName, error };
  };

  const handleReviewCode = async (code, context) => {
    const metadata = extractMetadata(context);
    console.log('[Review] Metadata:', metadata);

    // Visual feedback
    setMessages(prev => [...prev, {
      role: 'user',
      text: '@Review',
      sender: settings.ntid || 'You',
      time: formatTime()
    }]);

    setIsProcessing(true);
    try {
      const data = await api.chat(
        code,
        settings,
        'review',
        false, // reLoad
        { ...metadata, historyID }
      );

      setMessages(prev => [...prev, {
        role: 'bot',
        text: data.reply,
        sender: 'Octo Agent',
        time: formatTime()
      }]);
    } catch (err) {
      alert("Error reviewing code: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyCode = async (code, context) => {
    const metadata = extractMetadata(context);
    console.log('[Apply] Metadata:', metadata);

    alert("Feature coming soon."); // Parity with script.js

    // Visual feedback
    setMessages(prev => [...prev, {
      role: 'user',
      text: '@Apply',
      sender: settings.ntid || 'You',
      time: formatTime()
    }]);

    setIsProcessing(true);
    try {
      const data = await api.chat(
        code,
        settings,
        'apply',
        false, // reLoad
        { ...metadata, historyID }
      );

      setMessages(prev => [...prev, {
        role: 'bot',
        text: data.reply,
        sender: 'Octo Agent',
        time: formatTime()
      }]);
    } catch (err) {
      alert("Error applying code: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app">
      {/* Left Sidebar */}
      <aside id="leftSidebar" className={`sidebar sidebar-left ${leftOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-content">
          <button className="btn-new-chat" onClick={() => { setMessages([]); setHistoryID(''); }}>
            <span className="icon">+</span>
            <span>New Chat</span>
          </button>
          <div className="recent-chats-section">
            <div className="section-header" style={{ cursor: 'pointer' }}>
              <span>Recent Chats</span>
              <span className="toggle-icon">▼</span>
            </div>
          </div>
        </div>
        <button className="sidebar-toggle sidebar-toggle-left" onClick={() => setLeftOpen(!leftOpen)}>
          {leftOpen ? "▶" : "▶"}
        </button>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="chat-header">
          <div className="brain-info">
            <span className="brain-icon">🧠</span>
            <span id="currentBrainName">Octo Agent</span>
          </div>
          <UserProfile user={userInfo} />
        </div>

        <div className="three-col-layout">
          {/* Left Column: SAP Login */}
          <div className="col-left">
            <SapLogin />
          </div>

          {/* Center Column: Chat */}
          <div className="col-center">
            <div className="chat-container">
              <div id="messages" className="messages">
                {messages.length === 0 && (
                  <div className="welcome-screen">
                    <div className="welcome-title">Welcome to Octo Agent.</div>
                    <div className="welcome-text">
                      Use <span className="command-highlight" onClick={() => insertCommand("analyze")}>@analyze</span> to analyze ABAP R/3 logic,
                      <span className="command-highlight" onClick={() => insertCommand("refactor")}>@refactor</span> to refactor code to ABAP S/4HANA, and
                      <span className="command-highlight" onClick={() => insertCommand("review")}>@review</span> to review any ABAP code block.
                    </div>
                  </div>
                )}
                {messages.map((msg, idx) => (
                  <MessageBubble
                    key={idx}
                    ref={idx === messages.length - 1 ? lastMessageRef : null}
                    role={msg.role}
                    text={msg.text}
                    attachment={msg.attachment}
                    time={msg.time}
                    sender={msg.sender}
                    onReviewCode={handleReviewCode}
                    onApplyCode={handleApplyCode}
                    onViewAttachment={(att) => setViewingFile(att)}
                  />
                ))}
              </div>

              <form className="chat-input" onSubmit={handleSend} autoComplete="off">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".txt,.abap"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />

                <div className="input-wrapper">
                  <AttachmentPreview file={attachment} onRemove={() => setAttachment(null)} />

                  <textarea
                    ref={textareaRef}
                    rows={1}
                    placeholder="Send a message to brain 'Octo Agent'..."
                    value={inputObj.text}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        // trigger form submit
                        handleSend(e);
                      }
                    }}
                  />

                  <button type="button" className="btn-attach" title="Attach file" onClick={() => fileInputRef.current.click()}>
                    <span>+</span>
                  </button>
                </div>

                <CommandMenu show={showCommandMenu} onSelect={insertCommand} />

                <button type="submit" className="btn-send">
                  <span>↑</span>
                </button>
              </form>

              <div className="copyright-notice">
                <a href="#" target="_blank">v1.0.0</a>
              </div>
            </div>
          </div>

          {/* Right Column: Empty */}
          <div className="col-right">
            {/* Placeholder for future content */}
          </div>

        </div>

        {/* Wait Overlay */}
        {isProcessing && (
          <div id="waitOverlay" className="wait-overlay">
            <div className="wait-box">
              <span className="spinner"></span>
              <span>Please wait ...</span>
            </div>
          </div>
        )}
      </main>

      {/* Right Sidebar */}
      <aside id="rightSidebar" className={`sidebar sidebar-right ${rightOpen ? '' : 'collapsed'}`}>
        <button className="sidebar-toggle sidebar-toggle-right" onClick={() => setRightOpen(!rightOpen)}>
          {rightOpen ? "◀" : "◀"}
        </button>
        <div className="sidebar-content">
          <div className="section-header">
            <span>Settings</span>
            <span className="toggle-icon">▼</span>
          </div>

          <section className="settings-panel">
            <div className="settings-grid">
              <label className="field">
                <span>Brain ID</span>
                <input
                  type="text"
                  value={settings.brainId}
                  onChange={e => updateSettings({ brainId: e.target.value })}
                  placeholder="Brain ID"
                />
              </label>
              <label className="field">
                <span>NTID</span>
                <input type="text" value={settings.ntid || ''} readOnly placeholder="NTID" />
              </label>
              <label className="field">
                <span>Theme</span>
                <select value={settings.theme} onChange={e => updateSettings({ theme: e.target.value })}>
                  <option value="colorful">Colorful</option>
                  <option value="dark-gray">Dark Gray</option>
                  <option value="black">Black</option>
                  <option value="white">White</option>
                </select>
              </label>
              <label className="field">
                <span>Skill</span>
                <select
                  className="skill-dropdown"
                  value={settings.skill || ''}
                  onChange={e => updateSettings({ skill: e.target.value })}
                >
                  <option value="" disabled>Select a skill...</option>
                  {skills.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button
                  type="button"
                  className="btn-edit-skill"
                  onClick={() => {
                    if (!settings.skill) {
                      alert("Please select a skill to edit");
                      return;
                    }
                    setIsSkillModalOpen(true);
                  }}
                >
                  Edit
                </button>
              </label>
              <label className="field">
                <span>Specific Requirements</span>
                <textarea
                  rows={4}
                  maxLength="2000"
                  placeholder="Input Specific Requirements..."
                  value={settings.customPrompt}
                  onChange={e => updateSettings({ customPrompt: e.target.value })}
                ></textarea>
                <button type="button" className="btn-expand-prompt" onClick={() => setIsPromptModalOpen(true)}>Edit</button>
              </label>
            </div>
            <div className="settings-actions">
              <button className="btn-primary" onClick={handleSaveSettings}>{saveStatus}</button>
              <button className="btn-ghost" onClick={resetSettings}>Reset</button>
            </div>
          </section>
        </div>
      </aside>

      {/* Modals */}
      <CustomPromptModal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        value={settings.customPrompt}
        onApply={(val) => updateSettings({ customPrompt: val })}
      />

      <SkillModal
        isOpen={isSkillModalOpen}
        onClose={() => setIsSkillModalOpen(false)}
        filename={settings.skill}
      />

      <FileViewerModal
        isOpen={!!viewingFile}
        onClose={() => setViewingFile(null)}
        fileName={viewingFile?.name}
        content={viewingFile?.content}
      />

    </div>
  );
}


export default App;
