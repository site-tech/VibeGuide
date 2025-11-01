import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [channelNumber] = useState(Math.floor(Math.random() * 100) + 1)
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const [currentTime, setCurrentTime] = useState(new Date())
  const scrollRef = useRef(null)
  const scrollLockRef = useRef({ direction: null, startX: 0, startY: 0, scrollAccumulator: 0 })
  const autoScrollRef = useRef({ timeout: null, interval: null, lastInteraction: Date.now() })

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-scroll effect
  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    const getRowHeight = () => {
      const vh = window.innerHeight / 100
      const vw = window.innerWidth / 100
      return (50 * vh - 4 * vw) / 4 // typicalRowHeight in pixels
    }

    const startAutoScroll = () => {
      const rowHeight = getRowHeight()
      const targetScroll = scrollElement.scrollTop + (4 * rowHeight)
      const startScroll = scrollElement.scrollTop
      const duration = 8000 // 8 seconds to scroll 4 rows
      const startTime = Date.now()

      autoScrollRef.current.interval = setInterval(() => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        const easeProgress = progress * (2 - progress) // ease out
        
        scrollElement.scrollTop = startScroll + (targetScroll - startScroll) * easeProgress

        if (progress >= 1) {
          clearInterval(autoScrollRef.current.interval)
          // Wait 10 seconds before next scroll
          autoScrollRef.current.timeout = setTimeout(() => {
            if (Date.now() - autoScrollRef.current.lastInteraction >= 10000) {
              startAutoScroll()
            }
          }, 10000)
        }
      }, 16) // ~60fps
    }

    const resetAutoScroll = () => {
      autoScrollRef.current.lastInteraction = Date.now()
      clearTimeout(autoScrollRef.current.timeout)
      clearInterval(autoScrollRef.current.interval)
      
      // Start 10 second countdown
      autoScrollRef.current.timeout = setTimeout(() => {
        if (Date.now() - autoScrollRef.current.lastInteraction >= 10000) {
          startAutoScroll()
        }
      }, 10000)
    }

    // Initial auto-scroll setup
    resetAutoScroll()

    // Reset on user interaction
    const handleInteraction = () => {
      resetAutoScroll()
    }

    scrollElement.addEventListener('wheel', handleInteraction)
    scrollElement.addEventListener('touchstart', handleInteraction)
    scrollElement.addEventListener('mousedown', handleInteraction)

    return () => {
      clearTimeout(autoScrollRef.current.timeout)
      clearInterval(autoScrollRef.current.interval)
      scrollElement.removeEventListener('wheel', handleInteraction)
      scrollElement.removeEventListener('touchstart', handleInteraction)
      scrollElement.removeEventListener('mousedown', handleInteraction)
    }
  }, [])

  useEffect(() => {
    const scrollElement = scrollRef.current
    const headerRow = document.getElementById('header-row')
    const firstColumn = document.getElementById('first-column')
    
    if (!scrollElement) return

    // Calculate column width in pixels for snap scrolling
    const getColumnWidth = () => {
      const vw = window.innerWidth / 100
      return 18.96 * vw // typicalColumnWidth in pixels
    }

    const handleScroll = () => {
      if (headerRow) {
        headerRow.style.transform = `translateX(-${scrollElement.scrollLeft}px)`
      }
      if (firstColumn) {
        firstColumn.style.transform = `translateY(-${scrollElement.scrollTop}px)`
      }
    }

    const handleWheel = (e) => {
      const deltaX = Math.abs(e.deltaX)
      const deltaY = Math.abs(e.deltaY)
      
      if (!scrollLockRef.current.direction && (deltaX > 0 || deltaY > 0)) {
        if (deltaX > deltaY) {
          scrollLockRef.current.direction = 'horizontal'
        } else {
          scrollLockRef.current.direction = 'vertical'
        }
      }

      if (scrollLockRef.current.direction === 'horizontal') {
        e.preventDefault()
        
        // Accumulate scroll delta with reduced sensitivity (40% of original)
        scrollLockRef.current.scrollAccumulator += (e.deltaX + e.deltaY) * 0.4
        
        // Only trigger column snap when accumulated scroll exceeds threshold
        const scrollThreshold = 30 // Require more scroll input to trigger
        if (Math.abs(scrollLockRef.current.scrollAccumulator) >= scrollThreshold) {
          const columnWidth = getColumnWidth()
          const currentColumn = Math.round(scrollElement.scrollLeft / columnWidth)
          const scrollDirection = scrollLockRef.current.scrollAccumulator > 0 ? 1 : -1
          const targetColumn = Math.max(0, currentColumn + scrollDirection)
          const targetScroll = targetColumn * columnWidth
          
          scrollElement.scrollTo({
            left: targetScroll,
            behavior: 'smooth'
          })
          
          // Reset accumulator after snap
          scrollLockRef.current.scrollAccumulator = 0
        }
      } else if (scrollLockRef.current.direction === 'vertical') {
        scrollElement.scrollTop += e.deltaY + e.deltaX
        e.preventDefault()
      }
      
      // Reset direction after a short delay
      clearTimeout(scrollLockRef.current.timeout)
      scrollLockRef.current.timeout = setTimeout(() => {
        scrollLockRef.current.direction = null
        scrollLockRef.current.scrollAccumulator = 0
      }, 75)
    }

    scrollElement.addEventListener('scroll', handleScroll)
    scrollElement.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll)
      scrollElement.removeEventListener('wheel', handleWheel)
    }
  }, [])

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    })
  }

  const totalRows = 50
  const totalColumns = 50
  
  // Calculate dynamic column width
  // Available width = 100vw - (2 * 2.6vw padding) = 94.8vw
  // Column 1 width = 2/3 of typical column
  // Show 4.33 columns (4 full + 1/3 of 5th)
  // Let x = typical column width
  // (2/3)x + 4.33x = 94.8vw
  // 5x = 94.8vw
  // x = 18.96vw (typical column)
  // Column 1 = 12.64vw (2/3 of typical)
  
  const typicalColumnWidth = '18.96vw'
  const firstColumnWidth = '12.64vw'
  
  // Calculate row height
  // Available height = 50vh (bottom half)
  // Header row height based on text size with padding
  // Assuming header needs ~4vw for text + padding
  // Remaining: 50vh - 4vw for 4 rows
  // Each row = (50vh - 4vw) / 4
  
  const headerRowHeight = '4vw'
  const typicalRowHeight = 'calc((50vh - 4vw) / 4)'
  
  const cellStyle = {
    fontFamily: '"Futura Bold Condensed", "Futura", sans-serif',
    fontWeight: 'bold',
    fontStretch: 'condensed',
    fontSize: 'clamp(20px, 2vw, 60px)',
    color: 'white',
    textShadow: '4px 4px 0px rgba(0, 0, 0, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    border: '1px solid black',
    height: typicalRowHeight,
    minWidth: typicalColumnWidth
  }
  
  const headerCellStyle = {
    ...cellStyle,
    height: headerRowHeight,
    minHeight: headerRowHeight,
    color: '#E3E07D'
  }
  
  const firstColumnStyle = {
    ...cellStyle,
    minWidth: firstColumnWidth,
    color: '#E3E07D'
  }
  
  const firstColumnHeaderStyle = {
    ...headerCellStyle,
    minWidth: firstColumnWidth,
    color: 'white'
  }

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      backgroundColor: '#1B0731',
      display: 'flex',
      flexDirection: 'column',
      padding: '0 2.6vw 1.3vw 2.6vw',
      filter: 'blur(0.75px)',
      imageRendering: 'pixelated'
    }}>
      {/* Top Half - Split into 2 quadrants */}
      <div style={{
        display: 'flex',
        height: '50%',
        width: '100%'
      }}>
        {/* Top Left Quadrant */}
        <div style={{
          width: '50%',
          height: '100%'
        }} />

        {/* Top Right Quadrant with gradient and text */}
        <div style={{
          width: '50%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-evenly',
          alignItems: 'center'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '85%',
            background: 'linear-gradient(to bottom, #674D82, transparent)',
            zIndex: 0
          }} />
          <div style={{
            fontFamily: '"Futura Bold Condensed", "Futura", sans-serif',
            fontWeight: 'bold',
            fontStretch: 'condensed',
            fontSize: 'clamp(20px, 2vw, 60px)',
            color: 'white',
            textShadow: '4px 4px 0px rgba(0, 0, 0, 0.9)',
            zIndex: 1,
            whiteSpace: 'nowrap'
          }}>
            Category
          </div>
          <div style={{
            fontFamily: '"Futura Bold Condensed", "Futura", sans-serif',
            fontWeight: 'bold',
            fontStretch: 'condensed',
            fontSize: 'clamp(20px, 2vw, 60px)',
            color: '#E3E07D',
            textShadow: '4px 4px 0px rgba(0, 0, 0, 0.9)',
            zIndex: 1,
            whiteSpace: 'nowrap'
          }}>
            "StreamerName"
          </div>
          <div style={{
            fontFamily: '"Futura Bold Condensed", "Futura", sans-serif',
            fontWeight: 'bold',
            fontStretch: 'condensed',
            fontSize: 'clamp(20px, 2vw, 60px)',
            color: 'white',
            textShadow: '4px 4px 0px rgba(0, 0, 0, 0.9)',
            zIndex: 1,
            whiteSpace: 'nowrap'
          }}>
            {today}
          </div>
          <div style={{
            fontFamily: '"Futura Bold Condensed", "Futura", sans-serif',
            fontWeight: 'bold',
            fontStretch: 'condensed',
            fontSize: 'clamp(20px, 2vw, 60px)',
            color: 'white',
            textShadow: '4px 4px 0px rgba(0, 0, 0, 0.9)',
            zIndex: 1,
            whiteSpace: 'nowrap'
          }}>
            Channel {channelNumber}
          </div>
        </div>
      </div>

      {/* Bottom Half - TV Guide Grid */}
      <div style={{
        height: '50%',
        width: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Static Current Time Cell */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: firstColumnWidth,
          height: headerRowHeight,
          zIndex: 4,
          backgroundColor: '#1B0731'
        }}>
          <div style={{
            ...firstColumnHeaderStyle,
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: '#674D82',
              borderTop: '5px solid rgba(255, 255, 255, 0.6)',
              borderLeft: '5px solid rgba(255, 255, 255, 0.6)',
              borderBottom: '5px solid rgba(0, 0, 0, 0.8)',
              borderRight: '5px solid rgba(0, 0, 0, 0.8)',
              zIndex: -1
            }} />
            <span style={{ position: 'relative', zIndex: 1 }}>{formatTime(currentTime)}</span>
          </div>
        </div>
        
        {/* Frozen Header Row */}
        <div 
          id="header-row"
          style={{
            position: 'absolute',
            top: 0,
            left: firstColumnWidth,
            height: headerRowHeight,
            zIndex: 3,
            backgroundColor: '#1B0731',
            display: 'flex',
            pointerEvents: 'none'
          }}
        >
          {Array.from({ length: totalColumns - 1 }, (_, i) => (
            <div key={i} style={{
              ...headerCellStyle,
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: '#674D82',
                borderTop: '5px solid rgba(255, 255, 255, 0.6)',
                borderLeft: '5px solid rgba(255, 255, 255, 0.6)',
                borderBottom: '5px solid rgba(0, 0, 0, 0.8)',
                borderRight: '5px solid rgba(0, 0, 0, 0.8)',
                zIndex: -1
              }} />
              <span style={{ position: 'relative', zIndex: 1 }}>Time Slot {i + 1}</span>
            </div>
          ))}
        </div>
        
        {/* Frozen First Column */}
        <div 
          id="first-column"
          style={{
            position: 'absolute',
            top: headerRowHeight,
            left: 0,
            width: firstColumnWidth,
            zIndex: 3,
            backgroundColor: '#1B0731',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {Array.from({ length: totalRows - 1 }, (_, i) => (
            <div key={i} style={{
              ...firstColumnStyle, 
              height: typicalRowHeight,
              position: 'relative',
              flexDirection: 'column',
              gap: '0.2vh',
              padding: '0 0.5vw'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: '#312043',
                borderTop: '5px solid rgba(255, 255, 255, 0.6)',
                borderLeft: '5px solid rgba(255, 255, 255, 0.6)',
                borderBottom: '5px solid rgba(0, 0, 0, 0.8)',
                borderRight: '5px solid rgba(0, 0, 0, 0.8)',
                zIndex: -1
              }} />
              <span style={{ position: 'relative', zIndex: 1 }}>CH {i + 1}</span>
              <span style={{ 
                position: 'relative', 
                zIndex: 1, 
                fontSize: 'clamp(10px, 1.2vw, 30px)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                width: '100%'
              }}>CATEGORY</span>
            </div>
          ))}
        </div>
        
        {/* Scrollable Content Area with hidden scrollbars */}
        <div 
          ref={scrollRef}
          className="scrollable-grid"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflowX: 'auto',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          <div style={{
            display: 'grid',
            gridTemplateRows: `${headerRowHeight} repeat(${totalRows - 1}, ${typicalRowHeight})`,
            gridTemplateColumns: `${firstColumnWidth} repeat(${totalColumns - 1}, ${typicalColumnWidth})`,
            gap: '0'
          }}>
            {Array.from({ length: totalRows * totalColumns }, (_, index) => {
              const row = Math.floor(index / totalColumns)
              const col = index % totalColumns
              const isHeaderRow = row === 0
              const isFirstColumn = col === 0
              
              let style = { ...cellStyle, visibility: (isHeaderRow || isFirstColumn) ? 'hidden' : 'visible' }
              
              if (isHeaderRow && isFirstColumn) {
                style = { ...firstColumnHeaderStyle, visibility: 'hidden' }
              } else if (isHeaderRow) {
                style = { ...headerCellStyle, visibility: 'hidden' }
              } else if (isFirstColumn) {
                style = { ...firstColumnStyle, visibility: 'hidden' }
              }
              
              return <div key={index} style={style}></div>
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
