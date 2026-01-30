# FIX: Studio Access "Unauthorized" Error

**Problem**: Studio page stuck on "Loading pages..." or shows "Unauthorized" error

**Root Cause**: STUDIO_API_KEY environment variable not set correctly in Railway deployment

---

## IMMEDIATE FIX (Railway Dashboard)

### Step 1: Go to Railway Dashboard
https://railway.app/

### Step 2: Select Project
- Project: "Croutons.ai" (or "Graph Service")
- Environment: **production**
- Service: **graph-service**

### Step 3: Go to Variables Tab
Click "Variables" in the left sidebar

### Step 4: Set/Update STUDIO_API_KEY

**Add or update this variable**:

```
Name:  STUDIO_API_KEY
Value: 3eb832f366361f9a659a74c7a901bf0c7336828
```

### Step 5: Redeploy
After saving the variable, click "Deploy" or wait for auto-redeploy (~2-3 minutes)

---

## VERIFY IT WORKS

### Test 1: Check API
```bash
curl "https://graph.croutons.ai/studio/pages" \
  -H "x-studio-key: 3eb832f366361f9a659a74c7a901bf0c7336828"
```

**Expected**: JSON array `[]` or list of pages  
**Bad**: `{"ok":false,"error":"Unauthorized"}`

### Test 2: Check Studio UI
1. Go to https://graph.croutons.ai/studio
2. Enter API key: `3eb832f366361f9a659a74c7a901bf0c7336828`
3. Click "Access Studio"
4. Should show "No pages" or your pages list

---

## WHY THIS HAPPENED

**Railway CLI Issue**:
```bash
$ railway status
Service: None  # ← CLI not linked to service
```

The CLI can't manage env vars because it's not linked to the service. But git pushes still trigger deploys via GitHub integration.

**What Was Wrong**:
- Env var STUDIO_API_KEY not set (or got reset)
- Service running but rejecting all API calls
- No way to set via CLI (broken link)

**Fix**: Manually set via dashboard ✅

---

## ALTERNATE API KEY (If needed)

If you want to generate a new API key:

```bash
# Generate secure random key
openssl rand -hex 32

# Or use node
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then:
1. Set in Railway: `STUDIO_API_KEY=your-new-key`
2. Update docs/share with team
3. Clear browser localStorage: `localStorage.removeItem('studio_api_key')`

---

## SAVED PAGES - WHERE ARE THEY?

Your saved page IS in the database, but you can't see it because auth is broken.

**Once you fix the env var**:
- Refresh https://graph.croutons.ai/studio
- Enter API key
- Your saved pages will appear

**Database intact**: Pages stored in Postgres, just can't query them without auth.

---

## FUTURE: Fix Railway CLI

To prevent this issue:

```bash
cd graph-service
railway link  # Select: Croutons.ai → production → graph-service
railway status  # Should show service name, not "None"
```

But for NOW, just use the dashboard to set env vars.

---

## STATUS

**Code**: ✅ All fixes deployed (loadPages error handling, UI fixes)  
**Railway**: ⏳ Env var needs manual fix  
**Fix Time**: 2 minutes in dashboard  
**Your Pages**: ✅ Still in database, waiting for auth fix

---

**NEXT STEP**: Go to Railway dashboard and set STUDIO_API_KEY now.
