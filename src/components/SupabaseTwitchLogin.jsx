import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const SupabaseTwitchLogin = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'twitch',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error logging in:', error.message);
      alert('Failed to login: ' + error.message);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setShowDropdown(false);
    } catch (error) {
      console.error('Error logging out:', error.message);
      alert('Failed to logout: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-[#9147ff] text-white rounded-lg">
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        <span>Loading...</span>
      </div>
    );
  }

  if (user) {
    // Get Twitch user metadata
    const twitchData = user.user_metadata;
    const displayName = twitchData?.preferred_username || twitchData?.name || user.email;
    const avatarUrl = twitchData?.avatar_url || twitchData?.picture;

    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-4 py-2 bg-[#9147ff] hover:bg-[#772ce8] text-white rounded-lg transition-colors"
        >
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-8 h-8 rounded-full border-2 border-white"
            />
          )}
          <span className="font-semibold">{displayName}</span>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {showDropdown && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute right-0 mt-2 w-64 bg-[#18181b] border border-[#9147ff] rounded-lg shadow-xl z-20 overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  {avatarUrl && (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-12 h-12 rounded-full"
                    />
                  )}
                  <div>
                    <div className="font-semibold text-white">{displayName}</div>
                    {user.email && (
                      <div className="text-sm text-gray-400">{user.email}</div>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Signed in via Twitch
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-3 text-left text-white hover:bg-[#9147ff] transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Logout
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      className="flex items-center gap-2 px-4 py-2 bg-[#9147ff] hover:bg-[#772ce8] text-white rounded-lg transition-colors font-semibold shadow-lg"
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
      </svg>
      Sign in with Twitch
    </button>
  );
};

export default SupabaseTwitchLogin;
