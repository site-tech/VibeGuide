import { useState, useEffect } from 'react'

function Header() {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true 
    })
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <header className="bg-gradient-to-r from-[#0f3460] to-[#16213e] border-b-4 border-[#00d4ff] shadow-lg">
      <div className="px-4 py-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-[#00d4ff] tracking-wider" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
              📺 TWITCH TV GUIDE
            </h1>
            <p className="text-sm text-gray-400 mt-1">Interactive Program Guide</p>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold text-[#00ff88] tabular-nums" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
              {formatTime(currentTime)}
            </div>
            <div className="text-sm text-gray-300 mt-1">
              {formatDate(currentTime)}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
