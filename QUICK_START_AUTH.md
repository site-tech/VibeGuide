# Quick Start: Twitch Authentication

## 🚀 Get Auth Working in 5 Minutes

### Step 1: Start Supabase
```bash
npx supabase start
```

### Step 2: Get Your Keys
```bash
npx supabase status
```
Copy the `API URL` and `anon key`

### Step 3: Update .env
```bash
# Add these to your .env file
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your_anon_key_from_step_2
```

### Step 4: Configure Twitch in Supabase
1. Open Supabase Studio: http://127.0.0.1:54323
2. Go to: Authentication → Providers
3. Find "Twitch" and click to enable
4. Add your Twitch credentials:
   - Client ID: (from Twitch Developer Console)
   - Client Secret: (from Twitch Developer Console)
5. Save

### Step 5: Update Twitch Developer Console
1. Go to: https://dev.twitch.tv/console/apps
2. Click your app
3. Add OAuth Redirect URL:
   ```
   http://127.0.0.1:54321/auth/v1/callback
   ```
4. Save

### Step 6: Start Frontend
```bash
npm run dev
```

### Step 7: Test
1. Open http://localhost:5173
2. Click "Login" button
3. Authorize on Twitch
4. You should see your username in the button!

## ✅ Verification Checklist

- [ ] Supabase is running (`npx supabase status`)
- [ ] `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Twitch provider enabled in Supabase Studio
- [ ] Twitch redirect URL includes Supabase callback
- [ ] Frontend is running on port 5173
- [ ] No console errors in browser

## 🐛 Troubleshooting

**"Failed to start login"**
- Check Supabase is running
- Verify `.env` variables are set
- Restart frontend after changing `.env`

**"redirect_uri_mismatch"**
- Check Twitch Developer Console has correct redirect URL
- Must be: `http://127.0.0.1:54321/auth/v1/callback`

**Username not showing**
- Check browser console for errors
- Verify Twitch provider is enabled in Supabase
- Try logging out and back in

**Session not persisting**
- Clear browser localStorage
- Check Supabase client is initialized correctly
- Verify anon key is correct

## 📚 More Info

- Full setup: `TWITCH_AUTH_IMPLEMENTATION.md`
- Implementation details: `IMPLEMENTATION_SUMMARY.md`
- Supabase docs: https://supabase.com/docs/guides/auth/social-login/auth-twitch
