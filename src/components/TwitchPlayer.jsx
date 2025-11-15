import { useState, useEffect } from 'react'

function TwitchPlayer({ channel }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Small delay to ensure DOM is ready - exactly like the test
    const timer = setTimeout(() => {
      setMounted(true)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  if (!channel) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        color: 'white',
        fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
        fontWeight: 700,
        fontSize: '2rem'
      }}>
        No Stream Available
      </div>
    )
  }

  return (
    <>
      {mounted && (
        <iframe
          src={`https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&muted=true&autoplay=true`}
          height="100%"
          width="100%"
          allowFullScreen={true}
          allow="autoplay; fullscreen"
          style={{
            border: 'none',
            display: 'block',
          }}
          title="Twitch Stream"
        />
      )}
    </>
  )
}

export default TwitchPlayer
