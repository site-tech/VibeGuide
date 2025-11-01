import { useState, useEffect } from 'react';
import { getTwitchAuthURL, exchangeTwitchCode, validateTwitchToken } from '../utils/twitchApi';

const TwitchAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const REDIRECT_URI = `${window.location.origin}/auth/twitch/callback`;

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('twitch_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state) {
      handleCallback(code, state);
    }
  }, []);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      // Generate random state for CSRF protection
      const state = crypto.randomUUID();
      sessionStorage.setItem('oauth_state', state);

      // Get authorization URL
      const authUrl = await getTwitchAuthURL(REDIRECT_URI, state);

      // Redirect to Twitch
      window.location.href = authUrl;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleCallback = async (code, state) => {
    try {
      setLoading(true);
      setError(null);

      // Verify state
      const savedState = sessionStorage.getItem('oauth_state');
      if (state !== savedState) {
        throw new Error('Invalid state parameter - possible CSRF attack');
      }

      // Exchange code for token
      const data = await exchangeTwitchCode(code, REDIRECT_URI, state);

      // Store tokens and user info
      localStorage.setItem('twitch_access_token', data.access_token);
      localStorage.setItem('twitch_refresh_token', data.refresh_token);
      localStorage.setItem('twitch_user', JSON.stringify(data.user));

      setUser(data.user);

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      sessionStorage.removeItem('oauth_state');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('twitch_access_token');
    localStorage.removeItem('twitch_refresh_token');
    localStorage.removeItem('twitch_user');
    setUser(null);
  };

  const validateToken = async () => {
    try {
      const token = localStorage.getItem('twitch_access_token');
      if (!token) {
        throw new Error('No token found');
      }

      const data = await validateTwitchToken(token);
      alert(`Token is valid! Expires in ${data.expires_in} seconds`);
    } catch (err) {
      setError(err.message);
      handleLogout();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Twitch Authentication</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {user ? (
        <div>
          <div className="mb-4 p-4 bg-purple-50 rounded">
            <div className="flex items-center gap-4 mb-3">
              <img
                src={user.profile_image_url}
                alt={user.display_name}
                className="w-16 h-16 rounded-full"
              />
              <div>
                <h3 className="text-xl font-semibold">{user.display_name}</h3>
                <p className="text-gray-600">@{user.login}</p>
              </div>
            </div>
            {user.email && (
              <p className="text-sm text-gray-600">Email: {user.email}</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={validateToken}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Validate Token
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
            >
              Logout
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleLogin}
          className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
          </svg>
          Sign in with Twitch
        </button>
      )}
    </div>
  );
};

export default TwitchAuth;
