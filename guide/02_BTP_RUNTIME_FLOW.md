# 🚀 Quy Trình Runtime Của OctoAgent Trên SAP BTP

## 📋 Tổng Quan

Document này mô tả chi tiết **quy trình runtime** của OctoAgent sau khi đã deploy lên SAP BTP - tức là ứng dụng đang chạy và user đang sử dụng.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         USER BROWSER                         │
│  https://your-approuter.cfapps.eu10-004.hana.ondemand.com  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ 1. HTTP Request
                               ↓
┌──────────────────────────────────────────────────────────────┐
│                    SAP BTP - Cloud Foundry                    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           APPROUTER (octo-console-approuter)         │    │
│  │  - Authentication Gateway (XSUAA)                    │    │
│  │  - Reverse Proxy                                     │    │
│  │  - Route Management                                  │    │
│  └────┬──────────────────────────────────────────┬──────┘    │
│       │                                          │            │
│       │ 2a. Static Files                  2b. API Calls      │
│       ↓                                          ↓            │
│  ┌─────────────────┐                   ┌────────────────┐    │
│  │ HTML5 App Repo  │                   │  Backend CAP   │    │
│  │   (Frontend)    │                   │ (octo-srv)     │    │
│  │                 │                   │                │    │
│  │ - React UI      │                   │ - Express.js   │    │
│  │ - Static Assets │                   │ - Passport Auth│    │
│  │                 │                   │ - CDS Services │    │
│  └─────────────────┘                   └────────┬───────┘    │
│                                                 │            │
│                                           3. External APIs   │
│                                                 ↓            │
│                                    ┌─────────────────────┐  │
│                                    │  DIA Brain API      │  │
│                                    │  (AI Services)      │  │
│                                    └─────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              BTP SERVICES                              │  │
│  │  - XSUAA (Authentication & Authorization)             │  │
│  │  - Destination Service (External connections)         │  │
│  │  - HTML5 Application Repository                       │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 Complete Request Flow (Step by Step)

### Scenario 1: User Truy Cập Ứng Dụng Lần Đầu

#### Step 1: Initial Request
```
User → Browser → https://your-approuter.cfapps.eu10-004.hana.ondemand.com
```

**What Happens:**
1. Browser sends GET request to Approuter URL
2. Request hits Cloud Foundry router
3. CF router forwards to `octo-console-approuter` app

#### Step 2: Authentication Check
```
Approuter → Check: User authenticated?
```

**If NOT authenticated:**
```mermaid
sequenceDiagram
    participant User
    participant Approuter
    participant XSUAA
    
    User->>Approuter: GET /
    Approuter->>Approuter: Check session cookie
    Approuter->>Approuter: No valid session
    Approuter->>XSUAA: Redirect to login
    XSUAA->>User: Show login page
    User->>XSUAA: Enter credentials
    XSUAA->>XSUAA: Validate credentials
    XSUAA->>Approuter: Redirect with auth code
    Approuter->>XSUAA: Exchange code for JWT token
    XSUAA->>Approuter: Return JWT + refresh token
    Approuter->>User: Set session cookie, redirect to /
```

**Details:**
1. **Approuter checks** for session cookie (JWT token)
2. **No cookie found** → Redirect to XSUAA login page
3. **User enters** corporate credentials (SSO)
4. **XSUAA validates** against corporate IdP
5. **OAuth2 flow:**
   - XSUAA returns **authorization code**
   - Approuter exchanges code for **JWT token**
   - JWT contains: user info, scopes, exp time
6. **Approuter sets** session cookie with JWT
7. **Redirect back** to original URL (`/`)

**JWT Token Structure:**
```json
{
  "sub": "user@bosch.com",
  "given_name": "John",
  "family_name": "Doe",
  "email": "user@bosch.com",
  "scope": ["octo-console.User"],
  "exp": 1707234567,
  "iss": "https://your-subdomain.authentication.eu10.hana.ondemand.com",
  "zid": "your-zone-id",
  "grant_type": "authorization_code"
}
```

#### Step 3: Serve UI (First Time)
```
Approuter → xs-app.json → Route match → HTML5 App Repo
```

**xs-app.json routing:**
```json
{
  "routes": [
    {
      "source": "^/(.*)$",
      "target": "$1",
      "service": "html5-apps-repo-rt",
      "authenticationType": "xsuaa"
    }
  ]
}
```

**Flow:**
```mermaid
sequenceDiagram
    participant Browser
    participant Approuter
    participant HTML5Repo
    
    Browser->>Approuter: GET / (with JWT cookie)
    Approuter->>Approuter: Validate JWT
    Approuter->>HTML5Repo: GET index.html
    HTML5Repo->>HTML5Repo: Read from repository
    HTML5Repo->>Approuter: Return index.html
    Approuter->>Browser: 200 OK + HTML
    Browser->>Approuter: GET /assets/index-abc123.js
    Approuter->>HTML5Repo: GET /assets/index-abc123.js
    HTML5Repo->>Approuter: Return JS bundle
    Approuter->>Browser: 200 OK + JavaScript
```

**What HTML5 Repository Contains:**
```
octo-console-ui/
├── index.html              ← Entry point
├── assets/
│   ├── index-abc123.js    ← React app bundle
│   ├── index-xyz789.css   ← Styles
│   └── logo.svg           ← Static assets
└── manifest.json          ← App metadata
```

**Browser Renders:**
1. Parse HTML
2. Download JS/CSS from `assets/`
3. Execute React application
4. Render UI (chat interface, settings, etc.)

---

### Scenario 2: User Gửi Chat Message

#### Step 1: User Input
```
User types: "Analyze this code: @analyze"
User clicks: Send button
```

**React Frontend:**
```javascript
// src/api.js
export async function sendMessage(message) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Cookie with JWT automatically included
    },
    credentials: 'include', // Include cookies
    body: JSON.stringify({
      message: message,
      context: 'analyze'
    })
  });
  return response.json();
}
```

#### Step 2: Request to Backend
```
Browser → POST /api/chat → Approuter
```

**Approuter Routing:**
```json
{
  "source": "^/api/(.*)$",
  "target": "/api/$1",
  "destination": "srv-api",
  "authenticationType": "xsuaa"
}
```

**What Happens:**
```mermaid
sequenceDiagram
    participant Browser
    participant Approuter
    participant Backend
    
    Browser->>Approuter: POST /api/chat (JWT cookie)
    Approuter->>Approuter: Validate JWT token
    Approuter->>Approuter: Check JWT.scope contains "User"
    Approuter->>Approuter: Add Authorization: Bearer <JWT>
    Approuter->>Backend: POST /api/chat + JWT header
    Note over Backend: Backend receives request
```

**Approuter adds header:**
```http
POST /api/chat HTTP/1.1
Host: octo-console-srv.cfapps.eu10-004.hana.ondemand.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{"message": "Analyze this code", "context": "analyze"}
```

#### Step 3: Backend Processing
```
Backend (octo-console-srv) receives request
```

**Express.js Flow:**
```javascript
// srv/server.js

// 1. Passport validation
app.use(passport.authenticate('JWT', { session: false }));
// Validates JWT signature with XSUAA public key

// 2. User normalization
app.use((req, res, next) => {
    if (req.authInfo) {
        req.user = {
            id: req.authInfo.getLogonName(), // "user@bosch.com"
            locale: req.authInfo.getLocale() || 'en'
        };
    }
    next();
});

// 3. Route handling
app.post('/api/chat', async (req, res) => {
    // req.user = { id: 'user@bosch.com', locale: 'en' }
    const { message, context } = req.body;
    
    // Call CAP service
    const result = await cds.run(
        SELECT.from('ChatService.chat')
            .where({ userId: req.user.id })
    );
    
    // Process message...
});
```

**JWT Validation Process:**
```mermaid
sequenceDiagram
    participant Backend
    participant Passport
    participant XSUAA
    
    Backend->>Passport: Incoming request with JWT
    Passport->>Passport: Extract JWT from header
    Passport->>XSUAA: GET /token_keys (cache)
    XSUAA->>Passport: Return public keys
    Passport->>Passport: Verify JWT signature
    Passport->>Passport: Check expiration
    Passport->>Backend: req.authInfo populated
    Backend->>Backend: Create req.user object
```

#### Step 4: Call DIA Brain API
```
Backend → DIA Brain API → AI Processing
```

**Flow:**
```javascript
// src/ask.js

// 1. Get OAuth token for DIA Brain
async function getToken() {
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
    return data.access_token; // JWT token for DIA Brain
}

// 2. Call chat API
async function chat(message, brainId, userId) {
    const token = await getToken();
    
    const response = await fetch(process.env.DIA_CHAT_RAG, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'x-correlation-id': `octo-${Date.now()}`
        },
        body: JSON.stringify({
            messages: [{
                role: 'user',
                content: message
            }],
            brainId: brainId,
            userId: userId,
            stream: false
        })
    });
    
    return response.json();
}
```

**DIA Brain API Call:**
```mermaid
sequenceDiagram
    participant Backend
    participant TokenAPI
    participant DIABrain
    
    Backend->>TokenAPI: POST /oauth2/token
    Note over TokenAPI: Client credentials grant
    TokenAPI->>Backend: { access_token: "..." }
    Backend->>DIABrain: POST /chat/retrieval-augmented
    Note over DIABrain: Authorization: Bearer <token>
    DIABrain->>DIABrain: Process with AI model
    DIABrain->>DIABrain: RAG (Retrieval Augmented Generation)
    DIABrain->>Backend: AI response
```

**Request to DIA Brain:**
```http
POST /it/application/dia-brain/v1/api/chat/retrieval-augmented HTTP/1.1
Host: ews-emea.api.bosch.com
Authorization: Bearer <DIA_TOKEN>
Content-Type: application/json
X-Correlation-ID: octo-1707234567890

{
  "messages": [
    {
      "role": "user",
      "content": "Analyze this code: @analyze"
    }
  ],
  "brainId": "your-brain-id",
  "userId": "user@bosch.com",
  "stream": false,
  "temperature": 0.7,
  "maxTokens": 2000
}
```

**DIA Brain Response:**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1707234567,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Based on the code analysis...\n\n**Issues Found:**\n1. ..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 500,
    "total_tokens": 650
  }
}
```

#### Step 5: Return Response
```
Backend → Approuter → Browser
```

**Backend response:**
```javascript
// srv/chat-service.cjs
res.json({
    response: aiResponse.choices[0].message.content,
    timestamp: new Date().toISOString(),
    userId: req.user.id,
    tokens: aiResponse.usage.total_tokens
});
```

**Flow:**
```mermaid
sequenceDiagram
    participant DIABrain
    participant Backend
    participant Approuter
    participant Browser
    
    DIABrain->>Backend: AI response
    Backend->>Backend: Format response
    Backend->>Approuter: 200 OK + JSON
    Approuter->>Browser: 200 OK + JSON
    Browser->>Browser: Update UI with response
```

**Browser receives:**
```json
{
  "response": "Based on the code analysis...",
  "timestamp": "2026-02-07T10:00:00.000Z",
  "userId": "user@bosch.com",
  "tokens": 650
}
```

**React UI updates:**
```javascript
// src/App.jsx
const handleSendMessage = async () => {
    const response = await sendMessage(inputMessage);
    
    // Add to chat history
    setMessages([...messages, {
        role: 'user',
        content: inputMessage
    }, {
        role: 'assistant',
        content: response.response
    }]);
    
    // Clear input
    setInputMessage('');
};
```

---

### Scenario 3: User Save Settings

#### Step 1: User Changes Settings
```
User opens Settings panel
User enters: Brain ID, Theme, Custom Prompt
User clicks: Save
```

**Frontend API call:**
```javascript
// src/api.js
export async function saveSettings(settings) {
    const response = await fetch('/settings/UserEnv', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
            brainId: settings.brainId,
            theme: settings.theme,
            customPrompt: settings.customPrompt
        })
    });
    return response.json();
}
```

#### Step 2: Route to Backend
```
POST /settings/UserEnv → Approuter → Backend
```

**Approuter routing:**
```json
{
  "source": "^/settings/(.*)$",
  "target": "/settings/$1",
  "destination": "srv-api",
  "authenticationType": "xsuaa"
}
```

#### Step 3: CAP Service with Row-Level Security
```
Backend → CAP CDS Service → SQLite
```

**CDS Service Definition:**
```cds
// srv/setting-service.cds
service EnvService @(requires: 'authenticated-user') {
    entity UserEnv as projection on db.UserEnv
        where userId = $user.id;
}
```

**What Happens:**
```mermaid
sequenceDiagram
    participant Backend
    participant CAP
    participant CDS
    participant SQLite
    
    Backend->>CAP: POST /settings/UserEnv
    CAP->>CAP: req.user.id = "user@bosch.com"
    CAP->>CDS: Apply row-level security
    CDS->>CDS: WHERE userId = "user@bosch.com"
    CDS->>SQLite: INSERT INTO UserEnv
    Note over SQLite: userId: "user@bosch.com"<br/>brainId: "..."<br/>theme: "dark"<br/>customPrompt: "..."
    SQLite->>CDS: Success
    CDS->>CAP: Data saved
    CAP->>Backend: 201 Created
```

**Generated SQL:**
```sql
INSERT INTO UserEnv (
    userId,
    brainId,
    theme,
    customPrompt,
    createdAt,
    modifiedAt
) VALUES (
    'user@bosch.com',  -- From req.user.id
    'your-brain-id',
    'dark',
    'You are a code analyst...',
    '2026-02-07 10:00:00',
    '2026-02-07 10:00:00'
)
ON CONFLICT(userId) DO UPDATE SET
    brainId = excluded.brainId,
    theme = excluded.theme,
    customPrompt = excluded.customPrompt,
    modifiedAt = excluded.modifiedAt;
```

**Row-Level Security ensures:**
- User A chỉ đọc/ghi settings của User A
- User B không thể đọc settings của User A
- Automatic filtering by `$user.id`

#### Step 4: Return Success
```
Backend → Approuter → Browser → UI Update
```

---

## 🔐 Security Layer Deep Dive

### 1. XSUAA Service Binding

**How Backend Gets XSUAA Config:**
```javascript
// srv/server.js
const xsenv = require('@sap/xsenv');

// Read from VCAP_SERVICES environment variable
const services = xsenv.getServices({
    uaa: { tag: 'xsuaa' }
});

// services.uaa contains:
{
    clientid: 'sb-octo-console!...',
    clientsecret: '...',
    url: 'https://yoursubdomain.authentication.eu10.hana.ondemand.com',
    identityzone: 'yoursubdomain',
    verificationkey: '-----BEGIN PUBLIC KEY-----...',
    ...
}
```

**VCAP_SERVICES (Auto-injected by BTP):**
```json
{
  "xsuaa": [{
    "name": "octo-console-auth",
    "instance_name": "octo-console-auth",
    "credentials": {
      "clientid": "sb-octo-console!t12345",
      "clientsecret": "your-secret-here",
      "url": "https://subdomain.authentication.eu10.hana.ondemand.com",
      "xsappname": "octo-console!t12345",
      "verificationkey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgk...\n-----END PUBLIC KEY-----"
    }
  }]
}
```

### 2. JWT Validation Flow

```mermaid
graph TD
    A[Request with JWT] --> B{Valid Signature?}
    B -->|No| C[401 Unauthorized]
    B -->|Yes| D{Not Expired?}
    D -->|No| C
    D -->|Yes| E{Has Required Scope?}
    E -->|No| F[403 Forbidden]
    E -->|Yes| G[Allow Request]
```

**Passport JWT Strategy:**
```javascript
// srv/server.js
const JWTStrategy = require('@sap/xssec').JWTStrategy;

passport.use(new JWTStrategy(services.uaa));

app.use(passport.authenticate('JWT', { session: false }));
```

**What Gets Validated:**
1. **Signature**: Using XSUAA public key
2. **Issuer**: Must be from XSUAA
3. **Audience**: Must match app name
4. **Expiration**: `exp` claim < current time
5. **Scope**: Must contain required scopes

### 3. Row-Level Security

**Database Schema:**
```sql
CREATE TABLE UserEnv (
    ID VARCHAR(36) PRIMARY KEY,
    userId VARCHAR(255) NOT NULL,  -- Email from JWT
    brainId VARCHAR(255),
    theme VARCHAR(50),
    customPrompt TEXT,
    createdAt TIMESTAMP,
    modifiedAt TIMESTAMP,
    UNIQUE(userId)
);
```

**CDS ensures:**
```javascript
// Automatic injection of WHERE clause
// User query:
SELECT * FROM UserEnv

// CDS executes:
SELECT * FROM UserEnv WHERE userId = 'user@bosch.com'

// User cannot bypass this!
```

---

## 📊 Performance & Scalability

### 1. Caching Strategies

**Token Caching:**
```javascript
// Token cache in memory
let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
    const now = Date.now();
    
    if (cachedToken && now < tokenExpiry) {
        return cachedToken; // Reuse cached token
    }
    
    // Fetch new token
    const response = await fetch(tokenAPI);
    const data = await response.json();
    
    cachedToken = data.access_token;
    tokenExpiry = now + (data.expires_in - 60) * 1000; // 60s buffer
    
    return cachedToken;
}
```

**Static Files (HTML5 Repo):**
- Browser cache headers automatically set
- CDN-like serving from repository
- No backend involvement after first load

### 2. Horizontal Scaling

**Cloud Foundry Auto-Scaling:**
```bash
# Scale instances
cf scale octo-console-srv -i 3

# Now 3 instances running:
# - Instance 0: Handles 33% traffic
# - Instance 1: Handles 33% traffic
# - Instance 2: Handles 34% traffic
```

**Load Balancing:**
```
User Request → CF Router → Round-Robin → Instance 0, 1, or 2
```

**Session Affinity:**
- JWT in cookie → Stateless
- No session state in backend
- Any instance can handle any request

### 3. Database Connection Pooling

```javascript
// CAP automatically manages pool
const cds = require('@sap/cds');

// Connection pool size: 10 (default)
// Reuse connections across requests
// Auto-reconnect on failure
```

---

## 🔄 State Management

### Frontend State:
```javascript
// React Context
const [messages, setMessages] = useState([]);      // Chat history
const [settings, setSettings] = useState({});      // User settings
const [user, setUser] = useState(null);            // User info

// Persisted in:
// - Browser localStorage (settings)
// - Backend database (via API calls)
```

### Backend Session:
```
❌ NO server-side sessions
✅ Stateless JWT-based auth
✅ Each request independent
✅ Can scale horizontally
```

### Database Persistence:
```sql
UserEnv table → Stores per-user settings
ChatHistory table → (Future) Store chat conversations
```

---

## 🎯 Summary

### Key Takeaways:

1. **Approuter = Gateway**
   - All requests go through Approuter
   - Handles authentication (XSUAA)
   - Routes to appropriate service

2. **Frontend = Static Served by HTML5 Repo**
   - React SPA
   - Served from HTML5 Application Repository
   - No server-side rendering

3. **Backend = CAP + Express**
   - JWT validation via Passport
   - Row-level security via CDS
   - External API integration (DIA Brain)

4. **Security = Multi-Layer**
   - XSUAA authentication
   - JWT token validation
   - Scope-based authorization
   - Row-level data filtering

5. **Scalability = Cloud-Native**
   - Stateless architecture
   - Horizontal scaling ready
   - Connection pooling
   - Token caching

---

**The complete flow is designed for:**
- ✅ Enterprise security
- ✅ Scalability
- ✅ Performance
- ✅ Maintainability
