# Twitch OAuth Implementation (Supabase)

## Overview
The frontend uses Supabase's built-in Twitch OAuth integration to allow users to sign in with their Twitch account. When authenticated, the user's Twitch username is displayed in the Login button.

## Implementation Details

### Frontend Changes

#### 1. Supabase Client (`src/lib/supabase.js`)
Configured Supabase client with environment variables:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

#### 2. App Component (`src/App.jsx`)
Added authentication state and logic using Supabase Auth:

**State:**
- `user` - Stores authenticated Twitch user data from Supabase session
- `isAuthenticating` - Loading state during OAuth flow

**Effects:**
- Check for existing Supabase session on mount
- Listen for auth state changes (login/logout)
- Automatically updates user state when session changes

**Functions:**
- `handleLogin()` - Initiates OAuth flow using `supabase.auth.signInWithOAuth()`
- `handleLogout()` - Signs out using `supabase.auth.signOut()`

**UI Updates:**
- Login button shows username when authenticated
- Click to login when not authenticated
- Click to logout when authenticated
- Shows "Loading..." during authentication

## OAuth Flow (Supabase)

1. **User clicks Login button**
   - Frontend calls `supabase.auth.signInWithOAuth({ provider: 'twitch' })`
   - Supabase generates authorization URL with proper state/PKCE
   - User is redirected to Twitch

2. **User authorizes on Twitch**
   - Twitch redirects to Supabase callback URL
   - Supabase handles token exchange automatically

3. **Supabase redirects back to app**
   - Supabase sets session cookie/token
   - Frontend's `onAuthStateChange` listener fires
   - User data is extracted from session

4. **Frontend updates UI**
   - User state is updated with Twitch profile data
   - Username displayed in Login button
   - Session persists across page refreshes

## Data Storage

**Managed by Supabase:**
- Session tokens stored securely by Supabase client
- Refresh tokens handled automatically
- User metadata from Twitch (display_name, login, avatar_url, etc.)

**No manual localStorage needed** - Supabase handles all token management

## Backend Configuration

The backend must have Supabase configured with Twitch as an OAuth provider:

1. **Supabase Dashboard:**
   - Enable Twitch provider in Authentication > Providers
   - Add Twitch Client ID and Secret
   - Configure redirect URL

2. **Twitch Developer Console:**
   - Add OAuth Redirect URL: `https://[your-project].supabase.co/auth/v1/callback`
   - For local: `http://127.0.0.1:54321/auth/v1/callback`

## Security Features

1. **PKCE Flow** - Supabase uses PKCE for enhanced security
2. **Secure Token Storage** - Tokens managed by Supabase client
3. **Automatic Refresh** - Tokens refreshed automatically before expiry
4. **Session Management** - Built-in session handling

## Setup

1. **Run setup script:**
   ```bash
   ./setup-supabase-twitch.sh
   ```

2. **Configure Twitch OAuth in Supabase:**
   - Go to Supabase Dashboard > Authentication > Providers
   - Enable Twitch
   - Add your Twitch Client ID and Secret

3. **Update Twitch Developer Console:**
   - Add redirect URL: `http://127.0.0.1:54321/auth/v1/callback`

4. **Start services:**
   ```bash
   npx supabase start
   npm run dev
   ```

## Testing

1. Ensure Supabase is running: `npx supabase status`
2. Start frontend: `npm run dev`
3. Click Login button
4. Authorize on Twitch
5. Should redirect back and show your username

## Advantages of Supabase OAuth

- ✅ No custom backend OAuth code needed
- ✅ Automatic token refresh
- ✅ Secure token storage
- ✅ PKCE flow for enhanced security
- ✅ Built-in session management
- ✅ Easy to add more OAuth providers

## Troubleshooting

**"OAuth callback with invalid state"**
- This error is expected when using Supabase OAuth (not custom backend)
- Supabase handles the callback, not your custom backend
- Make sure Twitch redirect URL points to Supabase, not your app

**User not persisting after refresh**
- Check that Supabase client is properly initialized
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set

**Login button not working**
- Check browser console for errors
- Verify Supabase is running: `npx supabase status`
- Ensure Twitch provider is enabled in Supabase Dashboard
