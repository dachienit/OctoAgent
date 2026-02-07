# 🚀 OctoAgent - Local Setup Guide

**Mục đích:** Hướng dẫn chi tiết từ máy trắng đến chạy được project local để test

**Branch:** `vite_version`

---

## 📋 Prerequisites

### 1. Cài Node.js

**Download:** https://nodejs.org/

**Version:** Node.js 20.x LTS (hoặc mới hơn)

```bash
# Verify sau khi cài
node -v   # Should show v20.x.x or higher
npm -v    # Should show 10.x.x or higher
```

### 2. Cài Git

**Download:** https://git-scm.com/downloads

```bash
# Verify
git --version
```

### 3. (Optional) Cài Visual Studio Code

**Download:** https://code.visualstudio.com/

---

## 📥 Step 1: Clone Project từ Git

### A. Mở Terminal/PowerShell

```bash
# Navigate đến folder muốn clone (ví dụ D:\VSCode)
cd D:\VSCode

# Clone repository
git clone https://github.boschdevcloud.com/LHA2HC/code-refactor.git OctoAgent

# Vào folder project
cd OctoAgent\console
```

### B. Checkout branch vite_version

```bash
# Switch sang branch vite_version
git checkout vite_version

# Verify
git branch
# Should show: * vite_version
```

---

## 📦 Step 2: Install Dependencies

### A. Root Project Dependencies

```bash
# Trong folder: D:\VSCode\OctoAgent\console

# Install dependencies
npm install

# Expected output:
# added 200+ packages in 1-2 minutes
```

**⚠️ Nếu gặp lỗi proxy (máy công ty):**

```bash
# Set proxy trước khi npm install
npm config set proxy http://rb-proxy-emea.bosch.com:8080
npm config set https-proxy http://rb-proxy-emea.bosch.com:8080

# Hoặc set environment variables
set HTTP_PROXY=http://rb-proxy-emea.bosch.com:8080
set HTTPS_PROXY=http://rb-proxy-emea.bosch.com:8080

# Rồi install lại
npm install
```

### B. Frontend Dependencies

```bash
# Vào frontend folder
cd app\octo-client

# Install
npm install

# Expected output:
# added 200+ packages in 1-2 minutes

# Quay về root
cd ..\..
```

### C. Approuter Dependencies

```bash
# Vào approuter folder
cd approuter

# Install
npm install

# Expected output:
# added 1 package (@sap/approuter)

# Quay về root
cd ..
```

---

## ⚙️ Step 3: Setup Environment Variables

### A. Create .env file

**Location:** `D:\VSCode\OctoAgent\console\.env`

**Copy từ template:**

```bash
# Copy .env.example thành .env
copy .env.example .env
```

### B. Edit .env với credentials thật

**Mở file `.env` và điền:**

```bash
# DIA Brain OAuth2 Credentials
URL_TOKEN=https://api-pam.bcp.bosch.com/oauth2/token
CLIENT_ID=your-client-id-here
CLIENT_SECRET=your-client-secret-here
SCOPE=your-scope-here
GRANT_TYPE=client_credentials

# DIA Brain API Endpoints
DIA_HISTORY=https://ews-emea.api.bosch.com/it/application/dia-brain/v1/api/chat-histories
DIA_CHAT_RAG=https://ews-emea.api.bosch.com/it/application/dia-brain/v1/api/chat/retrieval-augmented

# Your Brain ID
BRAIN_ID=your-brain-id-here

# Corporate Proxy (for local development)
PROX=http://rb-proxy-emea.bosch.com:8080
AGENT_USER=your-ntid
AGENT_PWD=your-password
```

**⚠️ Lưu ý:** 
- Credentials lấy từ DIA Brain team
- KHÔNG commit file `.env` lên git (đã có trong .gitignore)

---

## 🧪 Step 4: Test Local Development

### A. Start Backend (CAP Server)

**Terminal 1:**

```bash
# Trong folder: D:\VSCode\OctoAgent\console

# Start CAP server with watch mode
npm run watch

# Expected output:
# [cds] - connect to db > sqlite { database: ':memory:' }
# [cds] - serving ChatService { path: '/api' }
# [cds] - serving EnvService { path: '/settings' }
# [cds] - server listening on { url: 'http://localhost:4004' }
```

**Backend ready tại:** http://localhost:4004

### B. Start Frontend (React Dev Server)

**Terminal 2 (mở terminal mới):**

```bash
# Trong folder: D:\VSCode\OctoAgent\console

# Start frontend dev server
npm run dev:client

# Hoặc vào folder frontend:
cd app\octo-client
npm run dev

# Expected output:
# VITE v7.x.x ready in xxx ms
# ➜ Local:   http://localhost:5173/
# ➜ Network: use --host to expose
```

**Frontend ready tại:** http://localhost:5173

### C. Mở Browser và Test

1. **Mở:** http://localhost:5173
2. **Login:** Mock authentication (auto login as localUser)
3. **Test chat:** 
   - Type message
   - Click Send
   - Should call DIA Brain API và return response

---

## ✅ Verification Checklist

### Backend Verification:

- [ ] Backend started without errors
- [ ] Can access http://localhost:4004
- [ ] Can access http://localhost:4004/api/me (return localUser info)
- [ ] Can access http://localhost:4004/settings/UserEnv (return empty array [])

### Frontend Verification:

- [ ] Frontend started without errors  
- [ ] Can access http://localhost:5173
- [ ] UI loads correctly (chat interface)
- [ ] User info shows in header (Local User / local.user@example.com)
- [ ] Can open Settings panel

### Integration Verification:

- [ ] Can send chat message
- [ ] Message appears in chat history
- [ ] AI response appears (from DIA Brain)
- [ ] Can save settings (Brain ID, Theme, Custom Prompt)
- [ ] Settings persist after refresh

---

## 🐛 Troubleshooting

### Issue 1: npm install fails với "407 Proxy Authentication Required"

**Solution:**

```bash
# Set proxy với auth
npm config set proxy http://username:password@rb-proxy-emea.bosch.com:8080
npm config set https-proxy http://username:password@rb-proxy-emea.bosch.com:8080

# Hoặc dùng .npmrc
echo "proxy=http://username:password@rb-proxy-emea.bosch.com:8080" >> .npmrc
echo "https-proxy=http://username:password@rb-proxy-emea.bosch.com:8080" >> .npmrc
```

### Issue 2: Backend start lỗi "Cannot find module '@sap/cds'"

**Solution:**

```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

### Issue 3: Frontend lỗi "Failed to resolve entry for package"

**Solution:**

```bash
cd app\octo-client
rm -rf node_modules
npm install
cd ..\..
```

### Issue 4: DIA Brain API returns 401 Unauthorized

**Reasons:**
- CLIENT_ID hoặc CLIENT_SECRET sai
- Token expired

**Solution:**
- Check credentials trong `.env`
- Verify với DIA Brain team

### Issue 5: Chat không hoạt động, console error

**Check:**

1. Browser console (F12) - xem errors
2. Backend terminal - xem request logs
3. Network tab - check API calls

**Common issues:**
- CORS error → Backend không start
- 404 error → Frontend routing sai
- Proxy error → Check PROX settings trong .env

---

## 📁 Project Structure

```
D:\VSCode\OctoAgent\console\
├── app/
│   └── octo-client/          # React Frontend
│       ├── src/
│       │   ├── App.jsx       # Main component
│       │   ├── api.js        # API calls
│       │   └── components/   # UI components
│       ├── package.json
│       └── vite.config.js
├── approuter/                # SAP Approuter (for BTP)
│   ├── xs-app.json
│   └── package.json
├── db/                       # CDS Data Models
│   └── setting.cds
├── docs/                     # AI Prompts
│   ├── analysis.md
│   ├── refactor.md
│   └── review.md
├── srv/                      # CAP Backend
│   ├── server.js             # Express + Auth
│   ├── chat-service.cds      # Service definition
│   ├── chat-service.cjs      # Service handler
│   ├── setting-service.cds
│   └── setting-service.cjs
├── src/                      # Business Logic
│   └── ask.js                # DIA Brain integration
├── .env                      # Environment variables (DO NOT COMMIT)
├── .env.example              # Template
├── .gitignore
├── .npmrc                    # npm optimization
├── mta.yaml                  # BTP deployment config
├── package.json              # Root dependencies
└── xs-security.json          # XSUAA config
```

---

## 🎯 Development Workflow

### Normal Development:

```bash
# Terminal 1: Backend
npm run watch

# Terminal 2: Frontend  
npm run dev:client

# Edit code → Auto reload
```

### Build for Production:

```bash
# Build frontend
npm run build:client

# Build CAP
npx cds build --production

# Check output
dir gen\srv\
dir app\octo-client\dist\
```

---

## 🔐 Security Notes

### Local Development:

- ✅ Mock authentication (không cần BTP login)
- ✅ req.user = { id: 'localUser' }
- ✅ XSUAA bypass

### BTP Production:

- ✅ Real XSUAA authentication
- ✅ JWT token validation
- ✅ Row-level security

---

## 📝 Tips & Best Practices

### 1. Use watch mode cho development

```bash
# Backend auto-reload khi sửa code
npm run watch

# Frontend auto-reload built-in (Vite HMR)
```

### 2. Check logs thường xuyên

- Backend terminal → API calls, errors
- Browser console → Frontend errors, network issues

### 3. Test authentication flow

- Local: Mock auth tự động
- BTP: Phải login qua XSUAA

### 4. Clear cache nếu gặp vấn đề lạ

```bash
# Clear browser cache
Ctrl + Shift + Delete

# Clear npm cache
npm cache clean --force

# Reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## ✅ Ready for BTP Deployment

Sau khi test local thành công, bạn đã sẵn sàng deploy lên BTP!

**Next:** Xem `BTP_DEPLOYMENT_GUIDE.md` để deploy lên BTP.

---

**Quick Reference:**

| Item | Command | Port |
|------|---------|------|
| Backend | `npm run watch` | 4004 |
| Frontend | `npm run dev:client` | 5173 |
| Full App | Open both terminals | 5173 (access here) |

**Chúc mừng! Local setup hoàn tất! 🎉**
