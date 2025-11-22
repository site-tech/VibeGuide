function ModeToggle({ isEnabled, onToggle }) {
  return (
    <button 
      className="mode-toggle"
      onClick={onToggle}
      aria-label={isEnabled ? "Disable Fun Mode" : "Enable Fun Mode"}
      style={{
        fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
        fontWeight: 600,
        fontSize: '1.1rem',
        color: isEnabled ? '#95E1D3' : '#E3E07D',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        cursor: 'pointer',
        border: '2px solid',
        borderColor: isEnabled ? '#95E1D3' : '#E3E07D',
        background: 'rgba(0, 0, 0, 0.4)',
        padding: '0.5rem 1rem',
        borderRadius: '4px',
        whiteSpace: 'nowrap',
        zIndex: 5,
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(4px)',
        textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <span style={{ 
        fontSize: '1.2rem',
        lineHeight: 1,
      }}>
        {isEnabled ? '✨' : '📺'}
      </span>
      <span>
        {isEnabled ? 'Fun Mode' : 'Standard'}
      </span>
    </button>
  )
}

export default ModeToggle
