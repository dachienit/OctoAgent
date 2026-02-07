# 🏗️ Cấu Trúc Frontend & Backend Của OctoAgent

## 📋 Tổng Quan

Document này mô tả chi tiết **architecture** và **cấu trúc code** của project OctoAgent, bao gồm Frontend (React), Backend (CAP), và cách chúng tương tác với nhau.

---

## 🎯 High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                      OctoAgent Project                          │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐       │
│  │   Frontend   │   │   Backend    │   │  Approuter   │       │
│  │              │   │              │   │              │       │
│  │  React SPA   │   │  CAP + CDS   │   │  SAP Router  │       │
│  │  (Vite)      │   │  Express.js  │   │  (Gateway)   │       │
│  └──────────────┘   └──────────────┘   └──────────────┘       │
│         │                   │                   │              │
│         └───────────────────┴───────────────────┘              │
│                             │                                  │
│                    ┌────────┴────────┐                         │
│                    │  Database (CDS) │                         │
│                    │  SQLite (Dev)   │                         │
│                    │  HANA (Prod)    │                         │
│                    └─────────────────┘                         │
└────────────────────────────────────────────────────────────────┘
```

---

## 📁 Complete Project Structure

```
d:\VSCode\OctoAgent\console\
│
├── 📂 app/                           # Frontend Applications
│   └── octo-client/                  # React Frontend
│       ├── src/                      # Source code
│       │   ├── App.jsx              # Main React component
│       │   ├── main.jsx             # Entry point
│       │   ├── api.js               # API client functions
│       │   ├── components/          # UI Components
│       │   │   ├── ChatWindow.jsx   # Chat interface
│       │   │   ├── MessageBubble.jsx
│       │   │   ├── Settings.jsx     # Settings panel
│       │   │   ├── DeployModal.jsx  # Deploy to SAP modal
│       │   │   └── CodeBlock.jsx    # Code syntax highlighting
│       │   ├── styles/              # CSS modules
│       │   └── assets/              # Static files
│       ├── public/                  # Public assets
│       │   └── favicon.ico
│       ├── dist/                    # Build output (generated)
│       ├── node_modules/            # Dependencies
│       ├── package.json             # Frontend dependencies
│       ├── vite.config.js           # Vite configuration
│       └── index.html               # HTML template
│
├── 📂 approuter/                     # SAP Approuter (Gateway)
│   ├── xs-app.json                  # Routing configuration
│   ├── package.json                 # Approuter dependencies
│   └── node_modules/               # Dependencies
│
├── 📂 srv/                           # Backend Services
│   ├── server.js                    # Express server entry
│   ├── chat-service.cds             # Chat service definition
│   ├── chat-service.cjs             # Chat service implementation
│   ├── setting-service.cds          # Settings service definition
│   ├── setting-service.cjs          # Settings implementation
│   └── ask.js                       # DIA Brain integration (imported from src/)
│
├── 📂 db/                            # Database Models
│   └── setting.cds                  # UserEnv entity definition
│
├── 📂 src/                           # Business Logic
│

   ├── index.js                     # CLI entry point
│   ├── ask.js                       # DIA Brain API client
│   └── utils/                       # Utility functions
│
├── 📂 docs/                          # AI Prompts
│   ├── analysis.md                  # Code analysis prompt
│   ├── refactor.md                  # Code refactoring prompt
│   └── review.md                    # Code review prompt
│
├── 📂 gen/                           # Generated Code (build output)
│   ├── srv/                         # Backend build
│   │   ├── srv/                     # Service files
│   │   ├── node_modules/            # Production dependencies
│   │   └── package.json             # Auto-generated
│   └── db/                          # Database build
│
├── 📂 guide/                         # Documentation (this folder!)
│   ├── 01_APPROUTER_NO_DIST_EXPLAINED.md
│   ├── 02_BTP_RUNTIME_FLOW.md
│   ├── 03_PROJECT_STRUCTURE.md      # ← You are here!
│   ├── 04_LOCAL_SETUP_GUIDE.md
│   └── 05_BTP_DEPLOYMENT_GUIDE.md
│
├── 📂 node_modules/                  # Root dependencies
│
├── 📄 mta.yaml                       # MTA deployment descriptor
├── 📄 xs-security.json               # XSUAA security config
├── 📄 package.json                   # Root dependencies
├── 📄 .env.example                   # Environment variables template
├── 📄 .gitignore                     # Git ignore rules
└── 📄 README.md                      # Project readme

```

---

## 🎨 Frontend Architecture (React SPA)

### Technology Stack:
- **Framework:** React 19.x
- **Build Tool:** Vite 7.x
- **UI Icons:** Lucide React
- **Markdown:** Marked library
- **State:** React Hooks (useState, useEffect)

### Component Hierarchy:

```
App.jsx (Root)
│
├── Header
│   ├── Logo
│   ├── UserInfo
│   └── SettingsButton
│
├── ChatWindow
│   ├── MessageList
│   │   └── MessageBubble (multiple)
│   │       ├── UserMessage
│   │       ├── AssistantMessage
│   │       └── CodeBlock
│   └── InputArea
│       ├── TextArea
│       └── SendButton
│
├── Settings (Modal)
│   ├── BrainIdInput
│   ├── ThemeSelector
│   ├── CustomPromptEditor
│   └── SaveButton
│
└── DeployModal
    ├── ObjectTypeSelect
    ├── ObjectNameInput
    ├── CodeEditor
    └── DeployButton
```

### Key Files Explained:

#### 1. `src/App.jsx` - Main Component

**Purpose:** Root component, manages state, orchestrates UI

**Code Structure:**
```jsx
import React, { useState, useEffect } from 'react';
import ChatWindow from './components/ChatWindow';
import Settings from './components/Settings';
import { sendMessage, loadSettings, saveSettings } from './api';

function App() {
    // State management
    const [messages, setMessages] = useState([]);
    const [settings, setSettings] = useState({
        brainId: '',
        theme: 'dark',
        customPrompt: ''
    });
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);
    
    // Effects
    useEffect(() => {
        // Load user info on mount
        fetchUserInfo();
        // Load user settings
        fetchSettings();
    }, []);
    
    // Handlers
    const handleSendMessage = async (message) => {
        setLoading(true);
        try {
            const response = await sendMessage(message, settings.brainId);
            setMessages([...messages, 
                { role: 'user', content: message },
                { role: 'assistant', content: response.response }
            ]);
        } catch (error) {
            console.error('Send message failed:', error);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className={`app theme-${settings.theme}`}>
            <header>
                <h1>OctoAgent</h1>
                <UserInfo user={user} />
            </header>
            <ChatWindow 
                messages={messages} 
                onSend={handleSendMessage}
                loading={loading}
            />
            <Settings 
                settings={settings}
                onSave={handleSaveSettings}
            />
        </div>
    );
}
```

**Key Responsibilities:**
- Global state management (messages, settings, user)
- API integration (send messages, load/save settings)
- Theme management
- Error handling

#### 2. `src/api.js` - API Client

**Purpose:** Centralized API calls to backend

**Code Structure:**
```javascript
const API_BASE = '';  // Same origin (via Approuter)

export async function sendMessage(message, brainId) {
    const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',  // Include cookies (JWT)
        body: JSON.stringify({
            messages: [{ role: 'user', content: message }],
            brainId: brainId,
            stream: false
        })
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
}

export async function loadSettings() {
    const response = await fetch(`${API_BASE}/settings/UserEnv`, {
        credentials: 'include'
    });
    
    if (response.ok) {
        const data = await response.json();
        return data.value.length > 0 ? data.value[0] : null;
    }
    
    return null;
}

export async function saveSettings(settings) {
    const response = await fetch(`${API_BASE}/settings/UserEnv`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(settings)
    });
    
    return response.json();
}

export async function getUserInfo() {
    const response = await fetch(`${API_BASE}/api/me`, {
        credentials: 'include'
    });
    
    return response.json();
}
```

**Key Features:**
- All API calls in one file
- Consistent error handling
- Credentials included (JWT cookies)
- Type-safe responses

#### 3. `src/components/ChatWindow.jsx` - Chat UI

**Purpose:** Display chat messages and input

**Code Structure:**
```jsx
import React, { useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import { Send } from 'lucide-react';

export default function ChatWindow({ messages, onSend, loading }) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);
    
    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (input.trim() && !loading) {
            onSend(input);
            setInput('');
        }
    };
    
    return (
        <div className="chat-window">
            <div className="messages-container">
                {messages.map((msg, idx) => (
                    <MessageBubble 
                        key={idx}
                        message={msg}
                        isUser={msg.role === 'user'}
                    />
                ))}
                <div ref={messagesEndRef} />
            </div>
            
            <form onSubmit={handleSubmit} className="input-area">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    disabled={loading}
                />
                <button type="submit" disabled={loading || !input.trim()}>
                    <Send size={20} />
                </button>
            </form>
        </div>
    );
}
```

**Key Features:**
- Auto-scroll to newest message
- Loading state handling
- Keyboard shortcuts (Enter to send)
- Message rendering with Markdown support

---

## ⚙️ Backend Architecture (CAP + Express)

### Technology Stack:
- **Framework:** SAP CAP (Cloud Application Programming)
- **Runtime:** Node.js 20.x
- **Server:** Express.js 4.x
- **Authentication:** Passport.js + @sap/xssec
- **Database:** SQLite (dev), HANA (prod via CAP)
- **ORM:** CDS (Core Data Services)

### Layer Architecture:

```
┌─────────────────────────────────────────┐
│        HTTP Layer (Express)              │
│  - CORS, Body Parser                     │
│  - Passport Authentication              │
│  - User Normalization                   │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      Service Layer (CAP CDS)            │
│  - ChatService                          │
│  - EnvService                           │
│  - Row-level security                   │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│    Business Logic Layer                 │
│  - DIA Brain API integration           │
│  - Message processing                   │
│  - Settings management                  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│       Data Layer (CDS Entities)         │
│  - UserEnv (SQLite/HANA)               │
└─────────────────────────────────────────┘
```

### Key Files Explained:

#### 1. `srv/server.js` - Server Entry Point

**Purpose:** Initialize Express, setup auth, mount CAP

**Code Structure:**
```javascript
const cds = require('@sap/cds');
const express = require('express');
const passport = require('passport');
const cors = require('cors');

// Environment detection
const isProduction = !!process.env.VCAP_SERVICES;

// Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

if (isProduction) {
    // Production: XSUAA authentication
    const xsenv = require('@sap/xsenv');
    const { JWTStrategy } = require('@sap/xssec');
    
    const services = xsenv.getServices({ uaa: { tag: 'xsuaa' } });
    passport.use(new JWTStrategy(services.uaa));
    
    app.use(passport.initialize());
    app.use(passport.authenticate('JWT', { session: false }));
    
    // Normalize req.user for CAP
    app.use((req, res, next) => {
        if (req.authInfo) {
            req.user = {
                id: req.authInfo.getLogonName(),
                locale: req.authInfo.getLocale() || 'en'
            };
        }
        next();
    });
} else {
    // Development: Mock authentication
    app.use((req, res, next) => {
        req.user = {
            id: 'localUser',
            locale: 'en'
        };
        next();
    });
}

// Custom routes
app.get('/api/me', (req, res) => {
    res.json({
        user: req.user.id,
        locale: req.user.locale,
        authenticated: true
    });
});

// Mount CAP services
cds.on('bootstrap', async (app) => {
    // CAP will mount /api and /settings routes
});

// Start server
const PORT = process.env.PORT || 4004;
cds.server.start().then(() => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
```

**Key Features:**
- Environment-aware (dev vs prod)
- XSUAA integration for production
- Mock auth for local development
- User normalization for CAP compatibility

#### 2. `srv/chat-service.cds` - Chat Service Definition

**Purpose:** Define chat API contract

**Code:**
```cds
using { UserEnv } from '../db/setting';

service ChatService @(requires: 'authenticated-user') {
    // Chat action
    action chat(
        messages: many {
            role: String;
            content: String;
        },
        brainId: String,
        stream: Boolean
    ) returns {
        response: String;
        timestamp: DateTime;
        tokens: Integer;
    };
}
```

**Explanation:**
- `@(requires: 'authenticated-user')` → Must be authenticated
- `action chat(...)` → RPC-style endpoint (not CRUD)
- Type-safe parameters and return values
- CAP auto-generates `/api/chat` endpoint

#### 3. `srv/chat-service.cjs` - Chat Implementation

**Purpose:** Handle chat logic, integrate with DIA Brain

**Code Structure:**
```javascript
const cds = require('@sap/cds');
const { chat } = require('../src/ask');

module.exports = cds.service.impl(async function() {
    // Register handler for chat action
    this.on('chat', async (req) => {
        const { messages, brainId, stream } = req.data;
        const userId = req.user.id;  // From normalized req.user
        
        // Validate input
        if (!brainId) {
            req.error(400, 'Brain ID is required');
            return;
        }
        
        if (!messages || messages.length === 0) {
            req.error(400, 'Messages are required');
            return;
        }
        
        try {
            // Call DIA Brain API
            const response = await chat(
                messages[messages.length - 1].content,  // Last message
                brainId,
                userId
            );
            
            return {
                response: response.choices[0].message.content,
                timestamp: new Date().toISOString(),
                tokens: response.usage.total_tokens
            };
        } catch (error) {
            console.error('DIA Brain API error:', error);
            req.error(500, 'Failed to get AI response');
        }
    });
});
```

**Key Features:**
- Service implementation pattern
- Input validation
- Error handling
- External API integration
- Type-safe CAP responses

#### 4. `srv/setting-service.cds` - Settings Service

**Purpose:** Manage user settings with row-level security

**Code:**
```cds
using { UserEnv } from '../db/setting';

service EnvService @(requires: 'authenticated-user') {
    // Automatic row-level security
    entity UserEnv as projection on db.UserEnv
        where userId = $user.id;
}
```

**Magic Happens Here:**
- `where userId = $user.id` → Auto-filter by current user
- User A cannot access User B's settings
- CAP automatically adds WHERE clause to ALL queries
- CRUD operations auto-generated: GET, POST, PUT, DELETE

#### 5. `db/setting.cds` - Data Model

**Purpose:** Define database schema

**Code:**
```cds
namespace db;

using { cuid, managed } from '@sap/cds/common';

entity UserEnv : cuid, managed {
    userId        : String(255) not null;
    brainId       : String(255);
    theme         : String(50) default 'dark';
    customPrompt  : String(5000);
}

// Unique constraint
annotate UserEnv with @assert.unique: { userId: [userId] };
```

**Explained:**
- `cuid` → Auto-generate UUID as ID
- `managed` → Auto-add createdAt, modifiedAt, createdBy, modifiedBy
- `@assert.unique` → Database constraint

**Generated SQL (SQLite):**
```sql
CREATE TABLE UserEnv (
    ID TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    brainId TEXT,
    theme TEXT DEFAULT 'dark',
    customPrompt TEXT,
    createdAt TIMESTAMP,
    modifiedAt TIMESTAMP,
    createdBy TEXT,
    modifiedBy TEXT,
    UNIQUE(userId)
);
```

#### 6. `src/ask.js` - DIA Brain Integration

**Purpose:** Call external AI API

**Code Structure:**
```javascript
const { fetch } = require('undici');
const { ProxyAgent, setGlobalDispatcher } = require('undici');

// Token cache
let cachedToken = null;
let tokenExpiry = 0;

// Get OAuth token for DIA Brain
async function getToken() {
    const now = Date.now();
    
    // Use cached token if valid
    if (cachedToken && now < tokenExpiry) {
        return cachedToken;
    }
    
    // Fetch new token
    const response = await fetch(process.env.URL_TOKEN, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: process.env.GRANT_TYPE,
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            scope: process.env.SCOPE
        })
    });
    
    const data = await response.json();
    
    // Cache token
    cachedToken = data.access_token;
    tokenExpiry = now + (data.expires_in - 60) * 1000;  // 60s buffer
    
    return cachedToken;
}

// Call DIA Brain chat API
async function chat(message, brainId, userId) {
    const token = await getToken();
    
    const response = await fetch(process.env.DIA_CHAT_RAG, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Correlation-ID': `octo-${Date.now()}`
        },
        body: JSON.stringify({
            messages: [{
                role: 'user',
                content: message
            }],
            brainId: brainId,
            userId: userId,
            stream: false,
            temperature: 0.7,
            maxTokens: 2000
        })
    });
    
    if (!response.ok) {
        throw new Error(`DIA Brain API error: ${response.status}`);
    }
    
    return response.json();
}

// Proxy setup for local development
if (process.env.PROX && !process.env.VCAP_SERVICES) {
    const dispatcher = new ProxyAgent({
        uri: new URL(process.env.PROX).toString(),
        token: `Basic ${Buffer.from(`${process.env.AGENT_USER}:${process.env.AGENT_PWD}`).toString('base64')}`
    });
    setGlobalDispatcher(dispatcher);
}

module.exports = { chat, getToken };
```

**Key Features:**
- Token caching (avoid repeated OAuth calls)
- Proxy support for corporate networks
- Error handling
- Environment-aware (only proxy locally)

---

## 🔌 API Endpoints Summary

### Frontend → Backend Communication

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/api/me` | GET | Get current user | - | `{ user, locale, authenticated }` |
| `/api/chat` | POST | Send chat message | `{ messages[], brainId, stream }` | `{ response, timestamp, tokens }` |
| `/settings/UserEnv` | GET | Load user settings | - | `{ value: [settings] }` |
| `/settings/UserEnv` | POST | Save user settings | `{ brainId, theme, customPrompt }` | `{ ...settings, ID }` |

---

## 🗄️ Database Schema

### UserEnv Table

```sql
CREATE TABLE UserEnv (
    ID TEXT PRIMARY KEY,               -- UUID
    userId TEXT NOT NULL,              -- user@bosch.com
    brainId TEXT,                      -- DIA Brain ID
    theme TEXT DEFAULT 'dark',         -- 'dark' | 'light'
    customPrompt TEXT,                 -- Custom AI prompt
    createdAt TIMESTAMP,               -- Auto
    modifiedAt TIMESTAMP,              -- Auto
    createdBy TEXT,                    -- Auto (userId)
    modifiedBy TEXT,                   -- Auto (userId)
    UNIQUE(userId)
);
```

**Indexes:**
- Primary key on `ID`
- Unique constraint on `userId`

**Row-Level Security:**
- CAP automatically filters by `userId = $user.id`
- User A cannot see/modify User B's data

---

## 🎯 Summary

### Frontend (React SPA):
- **Built with:** React + Vite
- **State:** React Hooks
- **API Client:** Fetch API
- **Styling:** CSS Modules
- **Build Output:** `dist/` folder
- **Deploy:** HTML5 App Repository

### Backend (CAP + Express):
- **Framework:** SAP CAP
- **Server:** Express.js
- **Auth:** Passport + XSUAA
- **Database:** CDS Entities (SQLite/HANA)
- **Services:** ChatService, EnvService
- **Build Output:** `gen/srv/` folder
- **Deploy:** Cloud Foundry app

### Integration Points:
1. **Frontend → Approuter** (Static file serving)
2. **Frontend → Backend** (API calls via Approuter)
3. **Backend → DIA Brain** (External AI API)
4. **Backend → XSUAA** (Authentication)
5. **Backend → Database** (Persistent storage)

---

**The architecture is designed for:**
- ✅ Separation of concerns
- ✅ Type safety (CDS definitions)
- ✅ Security by default (row-level filtering)
- ✅ Scalability (stateless, cloud-native)
- ✅ Maintainability (clear module boundaries)
