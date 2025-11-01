#!/bin/bash

echo "🚀 Supabase + Twitch OAuth Setup"
echo "================================="
echo ""

# Check if Supabase is running
if ! npx supabase status > /dev/null 2>&1; then
    echo "❌ Supabase is not running"
    echo "Starting Supabase..."
    npx supabase start
    echo ""
fi

# Get Supabase status
echo "📊 Supabase Status:"
npx supabase status | grep -E "(API URL|anon key)"
echo ""

# Get anon key
ANON_KEY=$(npx supabase status 2>/dev/null | grep -i "anon key\|publishable key" | awk '{print $NF}')

if [ -z "$ANON_KEY" ]; then
    echo "❌ Could not get Supabase anon key"
    echo "Run: npx supabase status"
    exit 1
fi

echo "✅ Supabase is running!"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
fi

# Check for Twitch credentials
if ! grep -q "TWITCH_CLIENT_ID=" .env || grep -q "TWITCH_CLIENT_ID=your_client_id" .env; then
    echo ""
    echo "⚠️  Twitch credentials not configured!"
    echo ""
    echo "Please add your Twitch credentials to .env:"
    echo "  TWITCH_CLIENT_ID=your_client_id"
    echo "  TWITCH_CLIENT_SECRET=your_client_secret"
    echo ""
    echo "Get them from: https://dev.twitch.tv/console/apps"
    echo ""
fi

# Update .env with Supabase credentials
echo "📝 Updating .env with Supabase credentials..."

# Add or update SUPABASE_URL
if grep -q "SUPABASE_URL=" .env; then
    sed -i.bak "s|SUPABASE_URL=.*|SUPABASE_URL=http://127.0.0.1:54321|" .env
else
    echo "SUPABASE_URL=http://127.0.0.1:54321" >> .env
fi

# Add or update SUPABASE_ANON_KEY
if grep -q "SUPABASE_ANON_KEY=" .env; then
    sed -i.bak "s|SUPABASE_ANON_KEY=.*|SUPABASE_ANON_KEY=$ANON_KEY|" .env
else
    echo "SUPABASE_ANON_KEY=$ANON_KEY" >> .env
fi

# Add or update VITE_SUPABASE_URL
if grep -q "VITE_SUPABASE_URL=" .env; then
    sed -i.bak "s|VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=http://127.0.0.1:54321|" .env
else
    echo "VITE_SUPABASE_URL=http://127.0.0.1:54321" >> .env
fi

# Add or update VITE_SUPABASE_ANON_KEY
if grep -q "VITE_SUPABASE_ANON_KEY=" .env; then
    sed -i.bak "s|VITE_SUPABASE_ANON_KEY=.*|VITE_SUPABASE_ANON_KEY=$ANON_KEY|" .env
else
    echo "VITE_SUPABASE_ANON_KEY=$ANON_KEY" >> .env
fi

# Clean up backup file
rm -f .env.bak

echo "✅ .env updated!"
echo ""

# Install Supabase client if needed
if ! npm list @supabase/supabase-js > /dev/null 2>&1; then
    echo "📦 Installing @supabase/supabase-js..."
    npm install @supabase/supabase-js
    echo ""
fi

echo "✅ Setup complete!"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Update Twitch Developer Console:"
echo "   - Go to: https://dev.twitch.tv/console/apps"
echo "   - Add OAuth Redirect URL: http://127.0.0.1:54321/auth/v1/callback"
echo "   - Save changes"
echo ""
echo "2. Add your Twitch credentials to .env:"
echo "   TWITCH_CLIENT_ID=your_client_id"
echo "   TWITCH_CLIENT_SECRET=your_client_secret"
echo ""
echo "3. Restart Supabase:"
echo "   npx supabase stop"
echo "   npx supabase start"
echo ""
echo "4. Start your frontend:"
echo "   npm run dev"
echo ""
echo "5. Test at: http://localhost:5173"
echo ""
echo "📖 Full guide: docs/SUPABASE_TWITCH_SETUP.md"
