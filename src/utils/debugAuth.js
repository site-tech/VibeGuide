// Debug helper for OAuth issues

export const debugOAuth = () => {
  console.group('🔍 OAuth Debug Info');
  
  // Current URL info
  console.log('Current Origin:', window.location.origin);
  console.log('Current Pathname:', window.location.pathname);
  console.log('Full URL:', window.location.href);
  
  // Redirect URI being used
  const redirectUri = `${window.location.origin}${window.location.pathname}`;
  console.log('Redirect URI:', redirectUri);
  
  // Check for OAuth params
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const error = urlParams.get('error');
  const errorDesc = urlParams.get('error_description');
  
  if (error) {
    console.error('❌ OAuth Error:', error);
    console.error('Description:', errorDesc);
    
    if (error === 'redirect_mismatch') {
      console.error('');
      console.error('🔧 FIX: Add this URL to Twitch Developer Console:');
      console.error(redirectUri);
      console.error('');
      console.error('Steps:');
      console.error('1. Go to https://dev.twitch.tv/console/apps');
      console.error('2. Click "Manage" on your app');
      console.error('3. Add the URL above to "OAuth Redirect URLs"');
      console.error('4. Click "Add" then "Save"');
    }
  }
  
  if (code) {
    console.log('✅ Authorization Code:', code.substring(0, 10) + '...');
  }
  
  if (state) {
    console.log('✅ State:', state);
    const savedState = sessionStorage.getItem('oauth_state');
    if (savedState === state) {
      console.log('✅ State matches!');
    } else {
      console.error('❌ State mismatch!');
      console.error('Expected:', savedState);
      console.error('Received:', state);
    }
  }
  
  // Check stored tokens
  const accessToken = localStorage.getItem('twitch_access_token');
  const user = localStorage.getItem('twitch_user');
  
  if (accessToken) {
    console.log('✅ Access Token:', accessToken.substring(0, 10) + '...');
  } else {
    console.log('❌ No access token stored');
  }
  
  if (user) {
    console.log('✅ User:', JSON.parse(user).display_name);
  } else {
    console.log('❌ No user stored');
  }
  
  console.groupEnd();
};

// Auto-run on page load
if (typeof window !== 'undefined') {
  window.debugOAuth = debugOAuth;
  
  // Auto-run if there are OAuth params
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('code') || urlParams.get('error')) {
    debugOAuth();
  }
}
