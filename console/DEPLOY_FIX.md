# 🔧 BTP Deployment Fix - Step by Step

## ❌ Errors Found

### Error 1: XSUAA AppId Conflict
```
Cannot change AppId with update. 
Old AppId: octo-agent!t550689 
New AppId: octo-agent-Robert_Bosch_GmbH_rb-btphub-taf-d-BT222D00!t550689
```

### Error 2: HTML5 Repo Upload Failed  
```
validation error: Could not find applications in the request
```

---

## ✅ Fixes Applied

### Fix 1: Removed Dynamic xsappname Suffix
```diff
- config:
-   xsappname: octo-agent-${org}-${space}
-   tenant-mode: dedicated
```

**Now uses xs-security.json directly without override**

### Fix 2: Added manifest.json Generation
```diff
+ after-commands:
+   - echo '{"sap.app":{...}}' > dist/manifest.json
```

---

## 📋 Deployment Commands (Máy Công Ty)

### Step 1: Delete Existing XSUAA Service

```bash
# Delete service with wrong AppId
cf delete-service octo-console-auth -f

# Wait for deletion (30-60 seconds)
cf service octo-console-auth
# Should show: Service instance not found
```

### Step 2: Pull Updated Code

```bash
cd path/to/OctoAgent/console

git pull origin vite_version
```

### Step 3: Clean & Rebuild

```bash
# Clean previous builds
rm -rf mta_archives/ gen/

# Rebuild with fixes
mbt build

# Verify .mtar created
dir mta_archives\
# Should show: octo-console_1.0.0.mtar
```

### Step 4: Deploy

```bash
# Deploy (will auto-create XSUAA with correct AppId)
cf deploy mta_archives/octo-console_1.0.0.mtar

# Deployment takes: 10-15 minutes
```

**Expected output:**
```
Creating service "octo-console-auth"...
Uploading content module "octo-console-ui-deployer"...  ✅ Should work now!
Application "octo-console-srv" started...
Application "octo-console-approuter" started...
Process finished.
```

### Step 5: Verify Deployment

```bash
# Check apps
cf apps | grep octo-console

# Expected:
# octo-console-srv         started  1/1
# octo-console-approuter   started  1/1

# Check XSUAA service
cf service octo-console-auth

# Should show:
# bound apps: octo-console-srv, octo-console-approuter
# last operation: create succeeded
```

### Step 6: Get Application URL

```bash
cf app octo-console-approuter

# Get URL from "routes:" line
# Example: https://octo-console-approuter.cfapps.eu10-004.hana.ondemand.com
```

### Step 7: Set Environment Variables

```bash
# Set DIA Brain API credentials
cf set-env octo-console-srv URL_TOKEN "https://ews-emea.api.bosch.com/it/oauth2/token"
cf set-env octo-console-srv CLIENT_ID "your-client-id"
cf set-env octo-console-srv CLIENT_SECRET "your-client-secret"
cf set-env octo-console-srv GRANT_TYPE "client_credentials"
cf set-env octo-console-srv SCOPE "openid"
cf set-env octo-console-srv BRAIN_ID "your-brain-id"

# Restart app
cf restart octo-console-srv
```

---

## 🎯 What Changed?

### mta.yaml Changes:

**1. XSUAA Configuration (lines 99-102)**
```yaml
# OLD - Creates dynamic AppId (causes conflict)
config:
  xsappname: octo-agent-${org}-${space}
  tenant-mode: dedicated

# NEW - Uses xs-security.json directly
# (No config override - simpler & works!)
```

**2. UI Build (lines 59-67)**
```yaml
# OLD - No manifest.json
commands:
  - npm install
  - npm run build

# NEW - Generates manifest.json
commands:
  - npm install
  - npm run build
after-commands:
  - echo '{"sap.app":{"id":"octoconsoleui",...}}' > dist/manifest.json
```

---

## 🐛 Troubleshooting

### Issue: XSUAA deletion stuck

```bash
# If stuck > 5 minutes, force purge
cf purge-service-instance octo-console-auth -f

# Then recreate
# (deploy will auto-create)
```

### Issue: Build still fails

```bash
# Check Node version
node --version  # Should be 20.x

# Clean everything
rm -rf node_modules package-lock.json
rm -rf mta_archives gen
npm install
mbt build
```

### Issue: Deployment fails again

```bash
# Check deployment logs
cf dmol -i <operation-id>

# Retry deployment
cf deploy -i <operation-id> -a retry
```

---

## ✅ Success Checklist

- [ ] XSUAA service deleted
- [ ] Code pulled from git
- [ ] MTA built successfully
- [ ] Deployment completed
- [ ] Apps started (1/1 instances)
- [ ] XSUAA service created with correct AppId
- [ ] UI deployed to HTML5 repo
- [ ] Can access approuter URL
- [ ] Login works
- [ ] Chat API responds

---

## 🚀 Expected AppId After Fix

**Before (WRONG):**
```
octo-agent-Robert_Bosch_GmbH_rb-btphub-taf-d-BT222D00!t550689
```

**After (CORRECT):**
```
octo-agent!t123456
```

Simple, clean, no dynamic suffix! ✅

---

**Ready to deploy! Follow the steps above on company machine. 🎯**
