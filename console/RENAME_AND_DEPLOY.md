# 🔄 App Renamed: octo-console → octo-agent

## ✅ Correct Naming Convention

**Apps deployed to BTP:**
- `octo-agent-srv` → Backend CAP service
- `octo-agent` → Approuter (user-facing app)

**Services:**
- `octo-agent-auth` → XSUAA authentication
- `octo-agent-dest` → Destination service
- `octo-agent-repo-host` → HTML5 repository (host)
- `octo-agent-repo-rt` → HTML5 repository (runtime)

**MTA Archive:**
- `octo-agent_1.0.0.mtar`

---

## 📋 Current State on BTP

Bạn có services với tên SAI:
```
❌ octo-console-auth
❌ octo-console-dest
❌ octo-console-repo-host
❌ octo-console-repo-rt (if created)
```

Cần:
1. Delete tất cả services cũ
2. Rebuild MTA với tên mới
3. Deploy lại

---

## 🗑️ Step 1: Clean Up Old Services (Máy Công Ty)

```bash
# Delete all octo-console services
cf delete-service octo-console-auth -f
cf delete-service octo-console-dest -f
cf delete-service octo-console-repo-host -f
cf delete-service octo-console-repo-rt -f

# Wait for deletion (60 seconds)
sleep 60

# Verify all deleted
cf services | grep octo-console
# Should show: No services found

cf services | grep octo-agent
# Should show: No services found (clean slate!)
```

---

## 🔄 Step 2: Pull Updated Code (Máy Công Ty)

```bash
cd path/to/OctoAgent/console

# Pull renamed code
git pull origin vite_version

# Verify mta.yaml ID
grep "^ID:" mta.yaml
# Should show: ID: octo-agent
```

---

## 🏗️ Step 3: Build MTA with Correct Names (Máy Công Ty)

```bash
# Clean previous builds
rm -rf mta_archives/ gen/

# Build (5-10 minutes)
mbt build

# Verify .mtar file
dir mta_archives\
# Should show: octo-agent_1.0.0.mtar  ✅ (not octo-console!)
```

---

## 🚀 Step 4: Deploy to BTP (Máy Công Ty)

```bash
# Deploy with correct names
cf deploy mta_archives/octo-agent_1.0.0.mtar

# This will create:
# - App: octo-agent-srv
# - App: octo-agent  
# - Service: octo-agent-auth
# - Service: octo-agent-dest
# - Service: octo-agent-repo-host
# - Service: octo-agent-repo-rt (auto-created)

# Deployment takes: 10-15 minutes
```

**Expected output:**
```
Creating service "octo-agent-auth"...
Creating service "octo-agent-dest"...
Creating service "octo-agent-repo-host"...
Uploading content module "octo-agent-ui-deployer"...
Application "octo-agent-srv" started...
Application "octo-agent" started...
Process finished.
```

---

## ✅ Step 5: Verify Deployment (Máy Công Ty)

```bash
# Check apps
cf apps | grep octo-agent

# Should show:
# octo-agent-srv         started  1/1
# octo-agent             started  1/1
# octo-agent-ui-deployer stopped  0/1  (OK - runs once)

# Check services
cf services | grep octo-agent

# Should show:
# octo-agent-auth        xsuaa           ... bound to: octo-agent-srv, octo-agent
# octo-agent-dest        destination     ... bound to: octo-agent-srv, octo-agent
# octo-agent-repo-host   html5-apps-repo ... bound to: (deployer)
# octo-agent-repo-rt     html5-apps-repo ... (auto-created if needed)
```

---

## 🌐 Step 6: Get Application URL (Máy Công Ty)

```bash
# Get approuter URL
cf app octo-agent

# Look for "routes:" line
# Example: https://octo-agent.cfapps.eu10-004.hana.ondemand.com
```

**User access URL:**
```
https://octo-agent.cfapps.eu10-004.hana.ondemand.com
```

---

## 🔧 Step 7: Set Environment Variables (Máy Công Ty)

```bash
# Set DIA Brain API credentials
cf set-env octo-agent-srv URL_TOKEN "https://ews-emea.api.bosch.com/it/oauth2/token"
cf set-env octo-agent-srv CLIENT_ID "your-client-id"
cf set-env octo-agent-srv CLIENT_SECRET "your-client-secret"
cf set-env octo-agent-srv GRANT_TYPE "client_credentials"
cf set-env octo-agent-srv SCOPE "openid"
cf set-env octo-agent-srv BRAIN_ID "your-brain-id"

# Restart app
cf restart octo-agent-srv
```

---

## 🔐 Step 8: Configure Security Roles (BTP Cockpit)

**Via BTP Cockpit:**
1. Navigate to: Subaccount → Security → Role Collections
2. Create: `OctoAgent_User`
3. Add Role Template:
   - App ID: `octo-agent!t123456` (check actual ID in cockpit)
   - Template: `User`
   - Role: `User`
4. Assign to users: Add user emails

---

## 📊 Naming Convention Summary

### Apps (Deployed to Cloud Foundry)

| Name | Type | Purpose | User-Facing |
|------|------|---------|-------------|
| `octo-agent` | Approuter | Entry point, authentication, routing | ✅ Yes |
| `octo-agent-srv` | CAP Service | Backend API, business logic | ❌ No |

### Services (BTP Services)

| Name | Type | Purpose |
|------|------|---------|
| `octo-agent-auth` | XSUAA | Authentication & authorization |
| `octo-agent-dest` | Destination | External API connections |
| `octo-agent-repo-host` | HTML5 Repo | UI file storage (upload) |
| `octo-agent-repo-rt` | HTML5 Repo | UI file serving (runtime) |

---

## 🎯 Why This Naming?

**User-facing app = `octo-agent`**
- Simple, clean URL
- Easy to remember
- Professional branding

**Backend service = `octo-agent-srv`**
- Clear suffix indicates internal service
- Consistent with SAP naming conventions
- Not directly accessed by users

**Services = `octo-agent-*`**
- Clear prefix for filtering
- Easy to identify in BTP cockpit
- Consistent naming pattern

---

## ✅ Success Checklist

- [ ] Old octo-console services deleted
- [ ] Code pulled from git (with renamed mta.yaml)
- [ ] MTA built successfully → `octo-agent_1.0.0.mtar`
- [ ] Deployed to BTP
- [ ] Apps running: `octo-agent`, `octo-agent-srv`
- [ ] Services created: `octo-agent-auth`, `octo-agent-dest`, `octo-agent-repo-host`
- [ ] Can access: `https://octo-agent.cfapps...`
- [ ] Login works via XSUAA
- [ ] Chat API responds
- [ ] Environment variables set
- [ ] Security roles configured

---

## 🐛 Troubleshooting

### Issue: Old service deletion stuck

```bash
# Force purge
cf purge-service-instance octo-console-auth -f
cf purge-service-instance octo-console-dest -f
cf purge-service-instance octo-console-repo-host -f
```

### Issue: Build creates wrong .mtar name

```bash
# Check mta.yaml ID
head -5 mta.yaml
# Should show: ID: octo-agent

# If wrong, pull again
git pull origin vite_version
mbt build
```

### Issue: Deployment conflict with old app

```bash
# Delete old apps manually
cf delete octo-console-srv -f -r
cf delete octo-console-approuter -f -r

# Then deploy
cf deploy mta_archives/octo-agent_1.0.0.mtar
```

---

**Deployment với tên đúng! 🚀**
