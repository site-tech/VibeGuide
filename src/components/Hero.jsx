import { useState } from 'react'

function Hero() {
  const [selectedChannel] = useState({
    name: 'xQc',
    category: 'Just Chatting',
    viewers: '45.2K',
    title: 'REACTING TO REDDIT | !stake',
    thumbnail: '🎤'
  })

  return (
    <section className="px-4 py-6 border-b-2 border-gray-700">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Channel Preview - Left Side */}
          <div className="lg:col-span-1">
            <div className="channel-preview rounded-lg p-4 border-2 border-[#4a5568]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Now Playing</span>
                <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">● LIVE</span>
              </div>
              
              <div className="bg-black/50 rounded aspect-video flex items-center justify-center mb-3 border border-gray-600">
                <div className="text-6xl">{selectedChannel.thumbnail}</div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">{selectedChannel.name}</h3>
                <p className="text-sm text-gray-300 line-clamp-2">{selectedChannel.title}</p>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#00d4ff] font-semibold">{selectedChannel.category}</span>
                  <span className="text-gray-400">{selectedChannel.viewers} viewers</span>
                </div>
              </div>
            </div>
          </div>

          {/* Info Panel - Right Side */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-[#16213e] to-[#0f3460] rounded-lg p-6 border-2 border-[#4a5568] h-full">
              <h2 className="text-2xl font-bold text-[#00d4ff] mb-4">Welcome to the TV Guide</h2>
              <div className="space-y-3 text-gray-300">
                <p className="flex items-start">
                  <span className="text-[#00ff88] mr-2">▶</span>
                  <span>Browse live streams organized by category</span>
                </p>
                <p className="flex items-start">
                  <span className="text-[#00ff88] mr-2">▶</span>
                  <span>Scroll horizontally to see the top 5 streams in each category</span>
                </p>
                <p className="flex items-start">
                  <span className="text-[#00ff88] mr-2">▶</span>
                  <span>Click any stream to view details</span>
                </p>
                <div className="mt-6 pt-4 border-t border-gray-600">
                  <p className="text-sm text-gray-400">
                    Use the timeline below to discover what's streaming right now
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero
