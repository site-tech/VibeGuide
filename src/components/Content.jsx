import { useState, useEffect } from 'react'

function Content() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  // Mock data for demonstration - replace with real Twitch API calls
  const mockCategories = [
    {
      name: 'Just Chatting',
      channel: 'CH 1',
      streams: [
        { name: 'xQc', viewers: '45.2K', thumbnail: '🎤', title: 'REACTING TO REDDIT', duration: '3h 24m' },
        { name: 'HasanAbi', viewers: '32.1K', thumbnail: '💬', title: 'POLITICS & NEWS', duration: '5h 12m' },
        { name: 'Pokimane', viewers: '28.5K', thumbnail: '✨', title: 'CHILL VIBES', duration: '2h 45m' },
        { name: 'Mizkif', viewers: '24.8K', thumbnail: '🎭', title: 'IRL STREAM', duration: '4h 18m' },
        { name: 'Ludwig', viewers: '22.3K', thumbnail: '🎪', title: 'GAME SHOW', duration: '1h 56m' },
      ]
    },
    {
      name: 'League of Legends',
      channel: 'CH 2',
      streams: [
        { name: 'Faker', viewers: '52.3K', thumbnail: '⚔️', title: 'RANKED CLIMB', duration: '6h 32m' },
        { name: 'Doublelift', viewers: '38.7K', thumbnail: '🏆', title: 'CHALLENGER GAMES', duration: '4h 15m' },
        { name: 'Tyler1', viewers: '35.2K', thumbnail: '💪', title: 'DRAVEN ONLY', duration: '7h 48m' },
        { name: 'Sneaky', viewers: '29.4K', thumbnail: '🎯', title: 'ADC GAMEPLAY', duration: '3h 22m' },
        { name: 'Bjergsen', viewers: '26.1K', thumbnail: '👑', title: 'MID LANE GUIDE', duration: '2h 54m' },
      ]
    },
    {
      name: 'Valorant',
      channel: 'CH 3',
      streams: [
        { name: 'TenZ', viewers: '48.9K', thumbnail: '🔫', title: 'RANKED GRIND', duration: '5h 18m' },
        { name: 'Shroud', viewers: '42.5K', thumbnail: '🎮', title: 'CHILL RANKED', duration: '3h 42m' },
        { name: 'Tarik', viewers: '36.8K', thumbnail: '💥', title: 'WATCH PARTY', duration: '4h 28m' },
        { name: 'ShahZaM', viewers: '31.2K', thumbnail: '⚡', title: 'TEAM PRACTICE', duration: '2h 36m' },
        { name: 'Kyedae', viewers: '27.6K', thumbnail: '🌟', title: 'UNRATED FUN', duration: '3h 14m' },
      ]
    },
    {
      name: 'Minecraft',
      channel: 'CH 4',
      streams: [
        { name: 'Dream', viewers: '55.1K', thumbnail: '⛏️', title: 'SPEEDRUN ATTEMPTS', duration: '4h 52m' },
        { name: 'TommyInnit', viewers: '44.3K', thumbnail: '🧱', title: 'SMP ADVENTURES', duration: '6h 24m' },
        { name: 'Tubbo', viewers: '38.9K', thumbnail: '🐝', title: 'BUILDING STREAM', duration: '5h 38m' },
        { name: 'Ranboo', viewers: '34.7K', thumbnail: '👁️', title: 'LORE STREAM', duration: '3h 46m' },
        { name: 'Philza', viewers: '29.2K', thumbnail: '🦅', title: 'HARDCORE S5', duration: '7h 12m' },
      ]
    },
    {
      name: 'Grand Theft Auto V',
      channel: 'CH 5',
      streams: [
        { name: 'Summit1g', viewers: '41.8K', thumbnail: '🚗', title: 'NOPIXEL RP', duration: '8h 24m' },
        { name: 'xQc', viewers: '39.5K', thumbnail: '🏙️', title: 'BANK HEISTS', duration: '6h 48m' },
        { name: 'Buddha', viewers: '33.2K', thumbnail: '🎲', title: 'LANG BUDDHA', duration: '9h 16m' },
        { name: 'Sykkuno', viewers: '28.9K', thumbnail: '🎰', title: 'YUP LIFE', duration: '5h 32m' },
        { name: 'RatedEpicz', viewers: '25.4K', thumbnail: '🚓', title: 'COP PATROL', duration: '7h 54m' },
      ]
    },
    {
      name: 'Fortnite',
      channel: 'CH 6',
      streams: [
        { name: 'Ninja', viewers: '46.7K', thumbnail: '🏗️', title: 'RANKED ARENA', duration: '4h 36m' },
        { name: 'Tfue', viewers: '40.2K', thumbnail: '🎯', title: 'ZERO BUILD', duration: '5h 18m' },
        { name: 'SypherPK', viewers: '35.8K', thumbnail: '🛡️', title: 'EDUCATIONAL', duration: '6h 42m' },
        { name: 'Clix', viewers: '31.5K', thumbnail: '⚔️', title: 'BOXFIGHTS', duration: '3h 28m' },
        { name: 'Bugha', viewers: '27.9K', thumbnail: '🏆', title: 'TOURNAMENT PREP', duration: '4h 14m' },
      ]
    },
  ]

  useEffect(() => {
    setTimeout(() => {
      setCategories(mockCategories)
      setLoading(false)
    }, 1000)
  }, [])

  if (loading) {
    return (
      <section className="py-20 px-4">
        <div className="text-center">
          <div className="text-6xl mb-4">📺</div>
          <p className="text-2xl font-bold text-gray-300">Loading TV Guide...</p>
        </div>
      </section>
    )
  }

  return (
    <section className="py-4">
      <div className="space-y-0">
        {categories.map((category, idx) => (
          <div key={idx} className="category-row">
            <div className="flex">
              {/* Channel Label - Fixed Left */}
              <div className="flex-shrink-0 w-32 lg:w-40 border-r-2 border-gray-700 p-4 flex flex-col justify-center bg-gradient-to-r from-[#0f3460] to-[#16213e]">
                <div className="text-xs text-gray-400 font-bold mb-1">{category.channel}</div>
                <div className="text-sm lg:text-base font-bold text-white leading-tight">{category.name}</div>
              </div>

              {/* Timeline Slots - Horizontal Scroll */}
              <div className="flex-1 overflow-x-auto scrollbar-hide">
                <div className="flex">
                  {category.streams.map((stream, streamIdx) => (
                    <div 
                      key={streamIdx}
                      className="timeline-slot flex-shrink-0 w-64 lg:w-80 p-4 cursor-pointer"
                    >
                      <div className="flex items-start space-x-3">
                        {/* Thumbnail */}
                        <div className="flex-shrink-0 w-16 h-16 bg-black/50 rounded flex items-center justify-center text-3xl border border-gray-600">
                          {stream.thumbnail}
                        </div>
                        
                        {/* Stream Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">LIVE</span>
                            <span className="text-xs text-gray-400">{stream.duration}</span>
                          </div>
                          <h4 className="text-white font-bold text-sm mb-1 truncate">{stream.name}</h4>
                          <p className="text-gray-400 text-xs line-clamp-2 mb-1">{stream.title}</p>
                          <div className="text-[#00ff88] text-xs font-semibold">{stream.viewers} viewers</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 px-4 text-center">
        <p className="text-sm text-gray-400">
          ← Scroll horizontally to view more streams • Click any program for details
        </p>
      </div>
    </section>
  )
}

export default Content
