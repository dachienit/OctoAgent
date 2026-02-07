# 🚀 OctoAgent - Complete BTP Deployment Guide

**Mục đích:** Hướng dẫn deploy OctoAgent lên SAP Business Technology Platform từ đầu đến cuối

**Prerequisites:** Đã test thành công local (xem [`LOCAL_SETUP_GUIDE.md`](file:///C:/Users/dachi/.gemini/antigravity/brain/d9bb85b8-8bd9-4ad4-a628-c1390ec9ca33/LOCAL_SETUP_GUIDE.md))

---

## 📋 Prerequisites

### 1. Cài Cloud Foundry CLI

**Download:** https://github.com/cloudfoundry/cli/releases

**Windows:** Download `cf8-cli_xxx_winx64.zip`

**Install:**
1. Extract `cf8.exe`
2. Copy vào `C:\Program Files\CloudFoundry\`
3. Add to PATH environment variable
4. Restart terminal

**Verify:**
```bash
cf --version
# Should show: cf version 8.x.x
```

### 2. Cài MBT (Multi-Target Application Build Tool)

**Option A: Via npm (dễ nhất)**
```bash
npm install -g mbt

# Verify
mbt --version
```

**Option B: Manual download**
1. Download: https://github.com/SAP/cloud-mta-build-tool/releases
2. Download `cloud-mta-build-tool_xxx_Windows_amd64.zip`
3. Extract `mbt.exe` → `C:\Tools\mbt\`
4. Add to PATH
5. Verify: `mbt --version`

**Option C: Local install (nếu không có quyền global)**
```bash
npm install --save-dev mbt

# Chạy qua npx
npx mbt build
```

### 3. BTP Account Access

Cần có:
- ✅ BTP Global Account access
- ✅ Subaccount trong EU10 region (hoặc similar)
- ✅ Cloud Foundry Org và Space
- ✅ Quota: ~2.5GB memory

---

## 🔐 Step 1: Login to Cloud Foundry

### A. Get BTP API Endpoint

**Vào BTP Cockpit:**
1. Mở: https://cockpit.btp.cloud.sap/
2. Log in với corporate credentials
3. Vào Subaccount → Cloud Foundry Environment
4. Copy **API Endpoint** (ví dụ: `https://api.cf.eu10-004.hana.ondemand.com`)

### B. Login via CF CLI

```bash
# Login
cf login

# Nhập thông tin khi được hỏi:
# API endpoint: https://api.cf.eu10-004.hana.ondemand.com
# Email: your-email@bosch.com
# Password: your-password

# Chọn Org và Space khi được hỏi
```

**Verify:**
```bash
cf target

# Output should show:
# API endpoint: https://api.cf.eu10-004.hana.ondemand.com
# org: your-org
# space: your-space
```

---

## 🏗️ Step 2: Create BTP Services (Manual)

### A. Create XSUAA Service (Authentication)

```bash
cf create-service xsuaa application octo-console-auth -c xs-security.json
```

**Verify:**
```bash
cf service octo-console-auth

# Should show: create succeeded
```

### B. Create HTML5 Application Repository

```bash
cf create-service html5-apps-repo app-host octo-console-repo-host
```

**Verify:**
```bash
cf service octo-console-repo-host
```

### C. Create Destination Service

**Create config file:** `destination-config.json`

```json
{
  "init_data": {
    "instance": {
      "existing_destinations": [],
      "destinations": []
    }
  }
}
```

**Create service:**
```bash
cf create-service destination lite octo-console-dest -c destination-config.json
```

**Verify:**
```bash
cf service octo-console-dest
```

### D. Check All Services

```bash
cf services

# Should show:
# octo-console-auth        xsuaa            application   create succeeded
# octo-console-repo-host   html5-apps-repo  app-host      create succeeded
# octo-console-dest        destination      lite          create succeeded
```

---

## 📦 Step 3: Build MTA Archive

### A. Clean Previous Builds

```bash
# Trong folder: D:\VSCode\OctoAgent\console

# Remove old builds
rm -rf gen/
rm -rf mta_archives/
rm -rf app/octo-client/dist/
```

### B. Install Production Dependencies

**⚠️ CRITICAL:** Đảm bảo package.json đã được optimize (xem [`fixes_applied.md`](file:///C:/Users/dachi/.gemini/antigravity/brain/d9bb85b8-8bd9-4ad4-a628-c1390ec9ca33/fixes_applied.md))

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Verify production deps (should be ~10 packages)
npm list --depth=0 --production
```

### C. Build MTA

```bash
# Build
mbt build

# Expected output:
# [INFO] Building module "octo-console-srv"...
# [INFO] Building module "octoclient"...
# [INFO] Building module "octo-console-approuter"...
# [INFO] Generating the MTA archive...
# [INFO] The MTA archive generated at: mta_archives/octo-console_1.0.0.mtar
```

**Build thành công khi:**
- Không có ERROR
- File `.mtar` được tạo trong `mta_archives/`
- File size: ~50-100MB

**Verify:**
```bash
dir mta_archives\

# Should show:
# octo-console_1.0.0.mtar
```

---

## 🚀 Step 4: Deploy to BTP

### A. Deploy MTA Archive

```bash
cf deploy mta_archives/octo-console_1.0.0.mtar
```

**Expected process (~5-10 minutes):**

```
Deploying multi-target app archive mta_archives/octo-console_1.0.0.mtar...

Uploading 1 files...
  mta_archives/octo-console_1.0.0.mtar
OK

Processing service "octo-console-auth"...
Binding "octo-console-srv" to "octo-console-auth"...
Binding "octo-console-approuter" to "octo-console-auth"...

Processing service "octo-console-repo-host"...
Binding "octo-console-approuter" to "octo-console-repo-host"...

Processing service "octo-console-dest"...
Creating destination "octo-backend"...

Deploying module "octo-console-srv"...
Uploading app...
Staging app...
Starting app...
App started

Deploying module "octo-console-ui-deployer"...
Uploading content to HTML5 repository...
Content uploaded

Deploying module "octo-console-approuter"...
Uploading app...
Staging app...
Starting app...
App started

Process finished.
```

### B. Monitor Deployment

**Trong terminal khác (optional):**

```bash
# Watch srv logs
cf logs octo-console-srv

# Watch approuter logs
cf logs octo-console-approuter
```

---

## ⚙️ Step 5: Configure Environment Variables

### A. Set Backend Environment Variables

```bash
# Set environment variables cho srv app
cf set-env octo-console-srv URL_TOKEN "https://api-pam.bcp.bosch.com/oauth2/token"
cf set-env octo-console-srv CLIENT_ID "your-client-id"
cf set-env octo-console-srv CLIENT_SECRET "your-client-secret"
cf set-env octo-console-srv SCOPE "your-scope"
cf set-env octo-console-srv GRANT_TYPE "client_credentials"
cf set-env octo-console-srv BRAIN_ID "your-brain-id"
cf set-env octo-console-srv DIA_HISTORY "https://ews-emea.api.bosch.com/it/application/dia-brain/v1/api/chat-histories"
cf set-env octo-console-srv DIA_CHAT_RAG "https://ews-emea.api.bosch.com/it/application/dia-brain/v1/api/chat/retrieval-augmented"
```

**⚠️ Lưu ý:** KHÔNG set PROX, AGENT_USER, AGENT_PWD trên BTP (chỉ dùng local)

### B. Restage App để apply env vars

```bash
cf restage octo-console-srv

# Wait for restage to complete (~2-3 minutes)
```

---

## 🔑 Step 6: Configure Security (Role Assignment)

### A. Access BTP Cockpit Security

1. Mở BTP Cockpit: https://cockpit.btp.cloud.sap/
2. Vào Subaccount
3. Security → Role Collections

### B. Create/Assign Role Collection

**Option 1: Assign existing role (nếu đã có)**

1. Click "OctoAgent_User" (đã được tạo tự động từ xs-security.json)
2. Click "Edit"
3. Trong "Users" section, click "Add Users"
4. Nhập email của users cần access
5. Save

**Option 2: Assign role collection cho toàn bộ IdP users**

1. Edit Role Collection "OctoAgent_User"
2. Trong "Role Collection Assignments", chọn:
   - Identity Provider: Default (or your corporate IdP)
   - Add all users from this IdP
3. Save

### C. Verify Role Assignment

1. Security → Users
2. Tìm email của bạn
3. Check "Role Collections" tab
4. Should see: "OctoAgent_User"

---

## 🌐 Step 7: Get Application URL

### A. Get Approuter URL

```bash
cf apps

# Look for octo-console-approuter
# Copy the URL in "routes" column
```

**URL format:**
```
https://<org>-<space>-octo-console-approuter.cfapps.eu10-004.hana.ondemand.com
```

**Example:**
```
https://rb-btphub-taf-d-octo-console-approuter.cfapps.eu10-004.hana.ondemand.com
```

### B. Add URL to XSUAA Redirect URIs (nếu cần)

**Nếu login redirect lỗi:**

1. Get exact approuter URL từ `cf apps`
2. Update `xs-security.json`:
   ```json
   "oauth2-configuration": {
     "redirect-uris": [
       "https://*.cfapps.eu10-004.hana.ondemand.com/**",
       "https://your-actual-approuter-url.cfapps.eu10-004.hana.ondemand.com/**"
     ]
   }
   ```
3. Update service:
   ```bash
   cf update-service octo-console-auth -c xs-security.json
   ```
4. Restage apps:
   ```bash
   cf restage octo-console-srv
   cf restage octo-console-approuter
   ```

---

## ✅ Step 8: Verify Deployment

### A. Access Application

1. **Mở browser:** Approuter URL
2. **Login:** BTP credentials (corporate SSO)
3. **Redirect:** XSUAA login page → Login → Redirect về app

**Expected:**
- ✅ UI loads (React app)
- ✅ User info hiển thị ở header (your email)
- ✅ No console errors

### B. Test Functionality

#### Test 1: User Info
- Header should show your name/email
- Not "Local User"

#### Test 2: API Call
```bash
# Get approuter URL
export APP_URL=https://your-approuter-url.cfapps.eu10-004.hana.ondemand.com

# Test /api/me (trong browser hoặc curl with cookie)
# Mở browser dev tools → Network → Reload page
# Find request to /api/me
# Response should show your real user info
```

#### Test 3: Settings
- Mở Settings panel
- Nhập Brain ID, Theme, Custom Prompt
- Click Save
- Refresh page → Settings should persist

#### Test 4: Chat
- Send message với @analyze command
- Should call DIA Brain và return response
- Check backend logs:
  ```bash
  cf logs octo-console-srv --recent
  ```

### C. Check App Status

```bash
# Check all apps
cf apps

# Should show:
# octo-console-srv          started
# octo-console-approuter    started

# Check memory usage
cf app octo-console-srv

# Check logs for errors
cf logs octo-console-srv --recent
cf logs octo-console-approuter --recent
```

---

## 🐛 Troubleshooting

### Issue 1: Deploy failed với "insufficient memory"

**Solution:**
```bash
# Increase memory quota
cf set-quota my-org-quota -m 10G

# Hoặc update mta.yaml:
# octo-console-srv: memory: 2048M → 3072M
```

### Issue 2: App crashed sau khi start

**Check logs:**
```bash
cf logs octo-console-srv --recent

# Common issues:
# - Missing env vars
# - XSUAA binding failed
# - Dependency install failed
```

**Solution:**
```bash
# Restage
cf restage octo-console-srv

# Hoặc re-deploy
cf deploy mta_archives/octo-console_1.0.0.mtar
```

### Issue 3: Login redirect lỗi "redirect_uri does not match"

**Solution:**

1. Get exact approuter URL:
   ```bash
   cf app octo-console-approuter
   ```

2. Update xs-security.json với exact URL

3. Update service:
   ```bash
   cf update-service octo-console-auth -c xs-security.json
   cf restage octo-console-approuter
   ```

### Issue 4: UI không load, blank page

**Check:**
1. Browser console → Any errors?
2. Network tab → HTML5 repo serving files?
3. Approuter logs:
   ```bash
   cf logs octo-console-approuter --recent
   ```

**Solution:**
- Re-deploy ui-deployer module
- Clear browser cache

### Issue 5: API calls return 401 Unauthorized

**Reasons:**
- XSUAA service binding failed
- JWT token invalid
- Role not assigned

**Solution:**
```bash
# Check bindings
cf env octo-console-srv

# Should see VCAP_SERVICES with xsuaa

# Rebind
cf unbind-service octo-console-srv octo-console-auth
cf bind-service octo-console-srv octo-console-auth
cf restage octo-console-srv
```

### Issue 6: DIA Brain API returns errors

**Check:**
```bash
# View env vars
cf env octo-console-srv

# Verify:
# - CLIENT_ID set?
# - CLIENT_SECRET set?
# - BRAIN_ID set?
```

**Solution:**
- Re-set environment variables
- Restage app

---

## 🔄 Update Deployment (Sau khi sửa code)

### A. Update Code

```bash
# Pull latest code
git pull origin vite_version

# Install dependencies
npm install

# Build
mbt build
```

### B. Update Deployment

**Option 1: Full re-deploy (recommended)**
```bash
cf deploy mta_archives/octo-console_1.0.0.mtar
```

**Option 2: Update individual module (faster)**
```bash
# Update backend only
cf push octo-console-srv -p gen/srv

# Update approuter only
cf push octo-console-approuter -p approuter
```

### C. Zero-Downtime Update (Blue-Green Deployment)

```bash
# Deploy với strategy
cf deploy mta_archives/octo-console_1.0.0.mtar --strategy blue-green
```

---

## 📊 Monitoring & Logs

### View Logs

```bash
# Real-time logs
cf logs octo-console-srv
cf logs octo-console-approuter

# Recent logs
cf logs octo-console-srv --recent
```

### Check Memory/CPU Usage

```bash
cf app octo-console-srv

# Output shows:
# memory: 1.5G of 2G
# cpu: 0.5%
# instances: 1/1
```

### Scale App (nếu cần)

```bash
# Increase instances
cf scale octo-console-srv -i 2

# Increase memory
cf scale octo-console-srv -m 3G
```

---

## 🔒 Security Best Practices

### 1. Protect Environment Variables

- ✅ NEVER commit credentials to Git
- ✅ Set via `cf set-env` only
- ✅ Rotate credentials regularly

### 2. Review Role Assignments

- ✅ Only assign roles to users who need access
- ✅ Use principle of least privilege
- ✅ Regular audit

### 3. Monitor Logs

```bash
# Check for suspicious activity
cf logs octo-console-srv --recent | grep "401\|403\|500"
```

### 4. Enable HTTPS Only

- ✅ Approuter enforces HTTPS automatically
- ✅ No HTTP access allowed

---

## 📋 Post-Deployment Checklist

Deploy successfully khi:

- [ ] All services created (XSUAA, HTML5 Repo, Destination)
- [ ] MTA build successful (no errors)
- [ ] Deploy completed (no failed modules)
- [ ] Environment variables set
- [ ] Apps running (cf apps shows "started")
- [ ] Role assigned to users
- [ ] Can access approuter URL
- [ ] Login successful
- [ ] UI loads correctly
- [ ] User info displays correctly
- [ ] API calls work
- [ ] Settings can be saved/loaded
- [ ] Chat functionality works
- [ ] DIA Brain integration working
- [ ] No errors in logs

---

## 🎯 Quick Command Reference

| Task | Command |
|------|---------|
| Login CF | `cf login` |
| Create service | `cf create-service <service> <plan> <name>` |
| Build MTA | `mbt build` |
| Deploy | `cf deploy mta.mtar` |
| Set env var | `cf set-env <app> <key> <value>` |
| Restage | `cf restage <app>` |
| View logs | `cf logs <app> --recent` |
| Check apps | `cf apps` |
| Check services | `cf services` |
| Scale | `cf scale <app> -m 3G -i 2` |

---

## 📞 Support

**Issues:**
- BTP access: IT support
- DIA Brain credentials: DIA Brain team
- App issues: Check logs first

**Useful Links:**
- BTP Cockpit: https://cockpit.btp.cloud.sap/
- CF CLI Docs: https://docs.cloudfoundry.org/cf-cli/
- SAP Help: https://help.sap.com/

---

**Chúc mừng! Deployment hoàn tất! 🎉**

App của bạn giờ đã chạy trên BTP với:
- ✅ Enterprise authentication (XSUAA)
- ✅ Scalable infrastructure
- ✅ Secure environment
- ✅ Professional deployment
