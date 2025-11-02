import { useState, useEffect, useRef } from 'react'
import './App.css'
import { getTopCategories, getStreamsByCategory } from './lib/api'
import { supabase } from './lib/supabase'

function App() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const [currentTime, setCurrentTime] = useState(new Date())
  const [categories, setCategories] = useState([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [categoryStreams, setCategoryStreams] = useState({}) // Map of categoryId -> streams array
  const [isLoadingStreams, setIsLoadingStreams] = useState(false)
  const [featuredStream, setFeaturedStream] = useState(null) // Random stream to feature
  const [isAutoRotating, setIsAutoRotating] = useState(true) // Auto-rotate streams every 90 seconds
  const [user, setUser] = useState(null) // Twitch user data
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const scrollRef = useRef(null)
  const scrollLockRef = useRef({ direction: null, startX: 0, startY: 0, scrollAccumulator: 0 })
  const autoScrollRef = useRef({ timeout: null, interval: null, lastInteraction: Date.now(), isAutoScrolling: false })
  const streamRotationRef = useRef(null) // Timer for auto-rotating streams
  const rssScrollRef = useRef(null)
  
  // Check if we should show top blank rows (after reload)
  const [showTopBlanks] = useState(() => {
    return sessionStorage.getItem('showTopBlanks') === 'true'
  })

  // Check for existing Supabase session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          display_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
          login: session.user.user_metadata?.preferred_username || session.user.user_metadata?.user_name,
          profile_image_url: session.user.user_metadata?.avatar_url
        })
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          display_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
          login: session.user.user_metadata?.preferred_username || session.user.user_metadata?.user_name,
          profile_image_url: session.user.user_metadata?.avatar_url
        })
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Handle login button click
  const handleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'twitch',
        options: {
          redirectTo: window.location.origin
        }
      })
      
      if (error) throw error
    } catch (error) {
      console.error('Login error:', error)
      alert('Failed to start login. Please try again.')
    }
  }

  // Handle logout
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }
  
  // Restore RSS animation position from sessionStorage
  const [rssAnimationDelay] = useState(() => {
    const savedTime = sessionStorage.getItem('rssAnimationTime')
    if (savedTime) {
      const elapsed = parseFloat(savedTime)
      // Return negative delay to start animation from saved position
      // Use modulo to wrap around the 60s animation cycle
      const normalizedTime = elapsed % 60
      return -normalizedTime
    }
    return 0
  })
  
  // Generate layout structure for all rows once on mount (without text content)
  const [rowLayouts] = useState(() => {
    // EDITABLE PARAMETERS
    const SHOW_WIDTH_OPTIONS = [1, 1.5, 2] // Available widths for show blocks (in cells)
    const MAX_GRID_POSITION = 45 // Maximum position to stop generating blocks
    const SIMILAR_LAYOUT_INTERVAL = 4 // Every Nth row will copy previous row's layout
    const PROBABILITY_WIDTH_1_VS_2 = 0.5 // When choosing between 1 or 2 cells (0.0 = always 1, 1.0 = always 2)
    
    const allRows = []
    
    // Create blank row (single block spanning full width)
    const createBlankRow = () => [{
      id: 0,
      width: 45, // Full width to match MAX_GRID_POSITION
      position: 0,
      isBlank: true
    }]
    
    // Generate blocks that align to 3-cell boundaries
    const generateRowBlocks = (rowIndex) => {
      const blocks = []
      let currentPosition = 0
      const maxPosition = MAX_GRID_POSITION
      let blockId = 0
      
      // Width options that work with 3-cell alignment: max 2 cells
      const widthOptions = SHOW_WIDTH_OPTIONS
      
      while (currentPosition < maxPosition) {
        // Pick a width that keeps us aligned to 3-cell boundaries
        const remainingToNext3 = 3 - (currentPosition % 3)
        let width
        
        if (remainingToNext3 === 3) {
          // At a 3-cell boundary, can use any available width
          width = widthOptions[Math.floor(Math.random() * widthOptions.length)]
        } else if (remainingToNext3 === 2) {
          // 1 cell into boundary, use 1 or 2 based on probability
          width = Math.random() > PROBABILITY_WIDTH_1_VS_2 ? 1 : 2
        } else {
          // 2 cells into boundary, must use 1
          width = 1
        }
        
        // Don't overflow
        if (currentPosition + width > maxPosition) {
          width = maxPosition - currentPosition
        }
        
        blocks.push({
          id: blockId++,
          width: width,
          position: currentPosition,
          streamIndex: blockId - 1 // Index to map to stream data
        })
        
        currentPosition += width
      }
      
      return blocks
    }
    
    // Add 4 blank rows at the top (only if showTopBlanks is true)
    const showTopBlanks = sessionStorage.getItem('showTopBlanks') === 'true'
    if (showTopBlanks) {
      for (let i = 0; i < 4; i++) {
        allRows.push(createBlankRow())
      }
    }
    
    // Generate blocks for each row (50 channel rows)
    for (let row = 0; row < 50; row++) {
      let blocks
      
      // Every Nth row, make 2 consecutive rows have similar layout
      if (row % SIMILAR_LAYOUT_INTERVAL === 0 && row > 0) {
        // Copy previous row's layout
        const prevBlocks = allRows[allRows.length - 1]
        if (!prevBlocks[0]?.isBlank) {
          blocks = prevBlocks.map((block, idx) => ({
            ...block,
            id: idx,
            streamIndex: idx
          }))
        } else {
          blocks = generateRowBlocks(row)
        }
      } else {
        blocks = generateRowBlocks(row)
      }
      
      allRows.push(blocks)
    }
    
    // Add 4 blank rows at the bottom
    for (let i = 0; i < 4; i++) {
      allRows.push(createBlankRow())
    }
    
    return allRows
  })

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoadingCategories(true)
        const data = await getTopCategories(50)
        setCategories(data)
      } catch (error) {
        console.error('Failed to load categories:', error)
        // Keep empty array on error
      } finally {
        setIsLoadingCategories(false)
      }
    }
    
    fetchCategories()
  }, [])

  // Fetch streams for each category after categories are loaded
  useEffect(() => {
    if (categories.length === 0) return
    // Prevent multiple fetches
    if (Object.keys(categoryStreams).length > 0) return

    const fetchAllStreams = async () => {
      setIsLoadingStreams(true)
      
      const streamsMap = {}
      
      // Fetch streams for all categories in parallel
      const streamPromises = categories.map(async (category) => {
        const streams = await getStreamsByCategory(category.id, 20)
        return { categoryId: category.id, streams }
      })
      
      const results = await Promise.all(streamPromises)
      
      // Build the streams map
      results.forEach(({ categoryId, streams }) => {
        streamsMap[categoryId] = streams
      })
      
      // Pick a random stream to feature BEFORE setting state
      let selectedStream = null
      const allStreams = []
      categories.forEach((category, categoryIndex) => {
        const streams = streamsMap[category.id] || []
        streams.forEach(stream => {
          allStreams.push({
            ...stream,
            categoryName: category.name,
            categoryRank: categoryIndex + 1 // 1-indexed rank
          })
        })
      })
      
      if (allStreams.length > 0) {
        const randomIndex = Math.floor(Math.random() * allStreams.length)
        selectedStream = allStreams[randomIndex]
      }
      
      // Batch state updates to prevent multiple renders
      setCategoryStreams(streamsMap)
      if (selectedStream) {
        setFeaturedStream(selectedStream)
      }
      setIsLoadingStreams(false)
    }
    
    fetchAllStreams()
  }, [categories, categoryStreams])

  // Auto-rotate featured stream every 90 seconds
  useEffect(() => {
    if (!isAutoRotating || Object.keys(categoryStreams).length === 0) {
      return
    }

    const rotateStream = () => {
      // Build array of all streams
      const allStreams = []
      categories.forEach((category, categoryIndex) => {
        const streams = categoryStreams[category.id] || []
        streams.forEach(stream => {
          allStreams.push({
            ...stream,
            categoryName: category.name,
            categoryRank: categoryIndex + 1
          })
        })
      })

      if (allStreams.length > 0) {
        // Pick a random stream different from current one
        let newStream
        if (allStreams.length === 1) {
          newStream = allStreams[0]
        } else {
          do {
            const randomIndex = Math.floor(Math.random() * allStreams.length)
            newStream = allStreams[randomIndex]
          } while (featuredStream && newStream.user_login === featuredStream.user_login && allStreams.length > 1)
        }
        
        setFeaturedStream(newStream)
      }
    }

    // Start rotation timer
    streamRotationRef.current = setInterval(rotateStream, 90000) // 90 seconds

    return () => {
      if (streamRotationRef.current) {
        clearInterval(streamRotationRef.current)
      }
    }
  }, [isAutoRotating, categoryStreams, categories, featuredStream])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])
  
  // Track RSS animation time and save before reload
  useEffect(() => {
    const rssElement = rssScrollRef.current
    if (!rssElement) return
    
    const startTime = Date.now()
    const initialOffset = Math.abs(rssAnimationDelay)
    
    // Save animation time periodically and before unload/reload
    const saveAnimationTime = () => {
      const elapsedSeconds = (Date.now() - startTime) / 1000
      const totalTime = initialOffset + elapsedSeconds
      sessionStorage.setItem('rssAnimationTime', totalTime.toString())
    }
    
    const interval = setInterval(saveAnimationTime, 500) // Save more frequently
    
    const handleBeforeUnload = () => {
      saveAnimationTime()
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      saveAnimationTime() // Save one last time on unmount
    }
  }, [rssAnimationDelay])
  
  // Set initial scroll position to skip top blank rows on first load
  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement || showTopBlanks) return
    
    // Scroll past the top 4 blank rows on initial load
    const getRowHeight = () => {
      const vh = window.innerHeight / 100
      const vw = window.innerWidth / 100
      return (50 * vh - 4 * vw) / 4
    }
    
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      const rowHeight = getRowHeight()
      scrollElement.scrollTop = 0 // Start at CH 1
    }, 50)
  }, [showTopBlanks])

  // Auto-scroll effect
  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    const getRowHeight = () => {
      const vh = window.innerHeight / 100
      const vw = window.innerWidth / 100
      // Match the CSS calculation: (50vh - 4vw - 6px) / 4
      return (50 * vh - 4 * vw - 6) / 4 // typicalRowHeight in pixels
    }

    const startAutoScroll = () => {
      // Mark that auto-scroll is running
      autoScrollRef.current.isAutoScrolling = true
      
      const rowHeight = getRowHeight()
      const currentScroll = scrollElement.scrollTop
      
      // Calculate current row position
      const currentRow = currentScroll / rowHeight
      
      // Round to nearest 4-row boundary to avoid floating point issues
      // If we're within 0.5 rows of a boundary, snap to it for calculation purposes
      const roundedRow = Math.round(currentRow * 2) / 2 // Round to nearest 0.5
      
      // Find which 4-row section we're in
      const currentSection = Math.floor(roundedRow / 4)
      const currentBoundary = currentSection * 4
      
      // Target is the next 4-row boundary
      const targetBoundary = currentBoundary + 4
      const targetScroll = targetBoundary * rowHeight
      
      // Start from current position (no snap)
      const startScroll = currentScroll
      
      console.log('Auto-scroll calculation:', { 
        currentScroll, 
        rowHeight,
        currentRow: currentRow.toFixed(4),
        roundedRow: roundedRow.toFixed(2),
        currentSection,
        currentBoundary, 
        targetBoundary,
        targetScroll 
      })
      
      // Calculate total rows (4 blank at top if shown + 50 channels + 4 blank at bottom)
      const totalRows = showTopBlanks ? 58 : 54
      const bottomBlankStart = rowHeight * (showTopBlanks ? 54 : 50)
      
      // Check if target scroll would go into or past the bottom blank rows
      let actualTargetScroll = targetScroll
      
      if (targetScroll >= bottomBlankStart && currentScroll < bottomBlankStart) {
        // We're about to enter the blank rows, only scroll to the start of blanks
        actualTargetScroll = bottomBlankStart
      } else if (currentScroll >= bottomBlankStart) {
        // Already in blank rows, continue scrolling 4 rows
        actualTargetScroll = targetScroll
      }
      
      // Calculate actual distance to scroll
      const scrollDistance = actualTargetScroll - startScroll
      const rowsToScroll = scrollDistance / rowHeight
      
      console.log('Scroll distance calculation:', {
        startScroll,
        actualTargetScroll,
        scrollDistance,
        rowsToScroll: rowsToScroll.toFixed(2)
      })
      
      // If scroll distance is too small, something is wrong - don't scroll
      if (scrollDistance < 1) {
        console.error('Scroll distance too small, aborting auto-scroll')
        autoScrollRef.current.isAutoScrolling = false
        return
      }
      
      // Adjust duration based on distance: 2 seconds per row
      // This keeps the speed consistent whether scrolling 3.5 rows or 4 rows
      const duration = Math.max(rowsToScroll * 2000, 1000) // Minimum 1 second
      const startTime = Date.now()

      autoScrollRef.current.interval = setInterval(() => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        const easeProgress = progress * (2 - progress) // ease out
        
        scrollElement.scrollTop = startScroll + scrollDistance * easeProgress

        if (progress >= 1) {
          clearInterval(autoScrollRef.current.interval)
          
          // Mark that auto-scroll is done
          autoScrollRef.current.isAutoScrolling = false
          
          // Check if we're in the bottom blank rows
          const finalScroll = scrollElement.scrollTop
          const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight
          
          console.log('Scroll check:', { 
            finalScroll, 
            bottomBlankStart, 
            maxScroll,
            showTopBlanks, 
            rowsToScroll: rowsToScroll.toFixed(2) 
          })
          
          // Check if we've reached the bottom blank rows OR we're near the end
          const reachedBottom = finalScroll >= bottomBlankStart - 100 || finalScroll >= maxScroll - 100
          
          if (reachedBottom) {
            // We're in the blank area, wait 5 seconds then reload
            console.log('Reached bottom, waiting 5 seconds before reload...')
            autoScrollRef.current.lastInteraction = Date.now()
            
            autoScrollRef.current.timeout = setTimeout(() => {
              console.log('Triggering reload with top blanks')
              sessionStorage.setItem('showTopBlanks', 'true')
              window.location.reload()
            }, 5000) // 5 seconds (half time)
            return
          }
          
          // Wait 10 seconds before next scroll
          // Update lastInteraction to current time so we know when this scroll completed
          const scrollCompletedTime = Date.now()
          autoScrollRef.current.lastInteraction = scrollCompletedTime
          
          console.log('Auto-scroll completed, waiting 10 seconds...')
          
          autoScrollRef.current.timeout = setTimeout(() => {
            const timeSinceLastInteraction = Date.now() - autoScrollRef.current.lastInteraction
            console.log('Checking if should continue auto-scroll:', { 
              timeSinceLastInteraction, 
              shouldContinue: timeSinceLastInteraction >= 9900 // Allow 100ms tolerance
            })
            
            // Check if user hasn't interacted in the last 10 seconds (with small tolerance)
            if (timeSinceLastInteraction >= 9900) {
              console.log('Continuing auto-scroll...')
              startAutoScroll()
            } else {
              console.log('User interacted, not continuing auto-scroll')
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

    // Check if we just reloaded from the bottom (showTopBlanks flag is set)
    const justReloaded = showTopBlanks
    
    if (justReloaded) {
      // Clear the reload flag
      sessionStorage.removeItem('showTopBlanks')
      // Start auto-scroll after 5 seconds (half time) for smooth loop
      console.log('Just reloaded, waiting 5 seconds before first scroll...')
      autoScrollRef.current.lastInteraction = Date.now()
      autoScrollRef.current.timeout = setTimeout(() => {
        console.log('Starting first auto-scroll after reload...')
        startAutoScroll()
      }, 5000) // 5 second delay (half time) before first scroll after reload
    } else {
      // Initial auto-scroll setup for normal page load
      resetAutoScroll()
    }

    // Reset on user interaction
    const handleInteraction = () => {
      console.log('User interaction detected')
      // Clear the reload flag on user interaction
      sessionStorage.removeItem('showTopBlanks')
      resetAutoScroll()
    }
    
    // Handle manual scroll - only reset if not auto-scrolling
    const handleScroll = () => {
      if (!autoScrollRef.current.isAutoScrolling) {
        console.log('Manual scroll detected, resetting auto-scroll timer')
        handleInteraction()
      }
    }

    scrollElement.addEventListener('wheel', handleInteraction)
    scrollElement.addEventListener('touchstart', handleInteraction)
    scrollElement.addEventListener('mousedown', handleInteraction)
    scrollElement.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      clearTimeout(autoScrollRef.current.timeout)
      clearInterval(autoScrollRef.current.interval)
      scrollElement.removeEventListener('wheel', handleInteraction)
      scrollElement.removeEventListener('touchstart', handleInteraction)
      scrollElement.removeEventListener('mousedown', handleInteraction)
      scrollElement.removeEventListener('scroll', handleScroll)
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
      // Header row stays static, don't transform it
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
        const newScrollTop = scrollElement.scrollTop + e.deltaY + e.deltaX
        
        // Prevent scrolling up into top blank rows if they shouldn't be visible
        if (!showTopBlanks) {
          const getRowHeight = () => {
            const vh = window.innerHeight / 100
            const vw = window.innerWidth / 100
            return (50 * vh - 4 * vw) / 4
          }
          const minScroll = 0
          scrollElement.scrollTop = Math.max(minScroll, newScrollTop)
        } else {
          scrollElement.scrollTop = newScrollTop
        }
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
    const timeString = date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true 
    })
    // Convert am/pm to uppercase AM/PM and add extra spaces
    return timeString.replace(/\s?(am|pm)/gi, (match) => '    ' + match.trim().toUpperCase())
  }



  const totalRows = showTopBlanks ? 58 : 54 // 4 top blanks (if shown) + 50 channels + 4 bottom blanks
  const totalColumns = 50
  const channelRowOffset = showTopBlanks ? 4 : 0 // Offset for channel numbering
  
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
  // Header row: 4vw (includes its borders)
  // Content area: 50vh - 4vw
  // We need 4 rows to fit, with the last row's bottom border (5px) fully visible
  // So: 4 rows + 6px for bottom border clearance = 50vh - 4vw
  // Each row: (50vh - 4vw - 6px) / 4
  
  const headerRowHeight = '4vw'
  const typicalRowHeight = 'calc((50vh - 4vw - 6px) / 4)'
  
  const cellStyle = {
    fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
    fontWeight: 700,
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
    minWidth: typicalColumnWidth,
    boxSizing: 'border-box'
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
    color: '#E3E07D',
    boxSizing: 'border-box'
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
      filter: 'blur(0.04vw)',
      imageRendering: 'pixelated'
    }}>
      {/* Top Half - Split into 2 quadrants */}
      <div style={{
        display: 'flex',
        height: '50%',
        width: '100%'
      }}>
        {/* Top Left Quadrant - Twitch Stream Embed */}
        <div style={{
          width: '50%',
          height: '100%',
          position: 'relative',
          backgroundColor: '#000'
        }}>
          {featuredStream ? (
            <iframe
              key={featuredStream.user_login}
              src={`https://player.twitch.tv/?channel=${featuredStream.user_login}&parent=${window.location.hostname}&muted=true&autoplay=true`}
              height="100%"
              width="100%"
              allowFullScreen={true}
              allow="autoplay; fullscreen"
              style={{
                border: 'none',
                display: 'block'
              }}
              title={`${featuredStream.user_name} Twitch Stream`}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontFamily: '"Futura Bold Condensed", "Futura", sans-serif',
              fontSize: 'clamp(20px, 2vw, 60px)'
            }}>
              {isLoadingStreams ? 'Loading Stream...' : 'No Stream Available'}
            </div>
          )}
        </div>

        {/* Top Right Quadrant with gradient and stream details */}
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
            fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
            fontWeight: 700,
            fontStretch: 'condensed',
            fontSize: 'clamp(20px, 2vw, 60px)',
            color: 'white',
            textShadow: '4px 4px 0px rgba(0, 0, 0, 0.9)',
            zIndex: 1,
            whiteSpace: 'nowrap'
          }}>
            {featuredStream ? featuredStream.categoryName : 'Category'}
          </div>
          <div style={{
            fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
            fontWeight: 700,
            fontStretch: 'condensed',
            fontSize: 'clamp(20px, 2vw, 60px)',
            color: '#E3E07D',
            textShadow: '4px 4px 0px rgba(0, 0, 0, 0.9)',
            zIndex: 1,
            whiteSpace: 'nowrap'
          }}>
            {featuredStream ? featuredStream.user_name : 'StreamerName'}
          </div>
          <div style={{
            fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
            fontWeight: 700,
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
            fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
            fontWeight: 700,
            fontStretch: 'condensed',
            fontSize: 'clamp(20px, 2vw, 60px)',
            color: 'white',
            textShadow: '4px 4px 0px rgba(0, 0, 0, 0.9)',
            zIndex: 1,
            whiteSpace: 'nowrap'
          }}>
            {featuredStream ? `Channel ${featuredStream.categoryRank}` : 'Channel'}
          </div>
        </div>
      </div>

      {/* Bottom Half - TV Guide Grid */}
      <div style={{
        height: '50vh',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        borderRight: '5px solid rgba(0, 0, 0, 0.8)',
        boxSizing: 'border-box'
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
            right: 0,
            height: headerRowHeight,
            zIndex: 3,
            backgroundColor: '#1B0731',
            display: 'flex',
            pointerEvents: 'none'
          }}
        >
          {/* Ad Banner Button - spans 2 cells */}
          <button 
            onClick={() => window.open('https://kiroween.devpost.com/?ref_feature=challenge&ref_medium=your-open-hackathons&ref_content=Submissions+open', '_blank')}
            style={{
              ...headerCellStyle,
              position: 'relative',
              cursor: 'pointer',
              pointerEvents: 'auto',
              border: 'none',
              background: 'none',
              width: `calc(${typicalColumnWidth} * 2)`,
              minWidth: `calc(${typicalColumnWidth} * 2)`,
              overflow: 'hidden',
              padding: 0
            }}
          >
            <div 
              style={{
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
              }} 
            />
            <img 
              src="/images/ad-banner.png"
              alt="Advertisement"
              style={{
                position: 'relative',
                zIndex: 1,
                width: '92%',
                height: '75%',
                objectFit: 'contain',
                pointerEvents: 'none'
              }}
              onError={(e) => {
                // Fallback to text if image fails to load
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'block'
              }}
            />
            <span style={{ 
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1,
              display: 'none'
            }}>ADD HERE</span>
          </button>
          {/* RSS Feed button - spans 2 cells with scrolling text */}
          <button style={{
            ...headerCellStyle,
            position: 'relative',
            cursor: 'pointer',
            pointerEvents: 'auto',
            border: 'none',
            background: 'none',
            width: `calc(${typicalColumnWidth} * 2)`,
            minWidth: `calc(${typicalColumnWidth} * 2)`,
            overflow: 'hidden',
            padding: '0'
          }}>
            <div 
              className="filter-button-bg"
              style={{
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
                zIndex: -1,
                transition: 'background-color 0.2s ease'
              }} 
            />
            <div style={{
              position: 'absolute',
              top: '5px',
              left: '15px',
              right: '15px',
              bottom: '5px',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              overflow: 'hidden'
            }}>
              <span 
                ref={rssScrollRef}
                className="rss-scroll" 
                style={{ 
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                  animation: 'scroll-left 60s linear infinite',
                  animationDelay: `${rssAnimationDelay}s`
                }}
              >
                RSS HERE: Breaking news from around the world today /// RSS HERE: Latest updates on technology and innovation /// RSS HERE: Sports highlights and scores /// RSS HERE: Weather forecast for the week ahead /// RSS HERE: Entertainment news and celebrity updates /// RSS HERE: Breaking news from around the world today /// RSS HERE: Latest updates on technology and innovation /// RSS HERE: Sports highlights and scores /// RSS HERE
              </span>
            </div>
          </button>
          {/* Login Button */}
          <button 
            className="login-button" 
            onClick={user ? handleLogout : handleLogin}
            disabled={isAuthenticating}
            style={{
              fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
              fontWeight: 700,
              fontStretch: 'condensed',
              fontSize: 'clamp(16px, 1.6vw, 48px)',
              color: 'white',
              textShadow: '4px 4px 0px rgba(0, 0, 0, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: headerRowHeight,
              minHeight: headerRowHeight,
              flex: 1,
              position: 'relative',
              cursor: isAuthenticating ? 'wait' : 'pointer',
              pointerEvents: 'auto',
              border: 'none',
              background: 'none',
              marginRight: '-5px',
              opacity: isAuthenticating ? 0.7 : 1
            }}
          >
            <div 
              className="login-button-bg"
              style={{
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
                zIndex: -1,
                transition: 'background-color 0.2s ease'
              }} 
            />
            <span style={{ 
              position: 'relative', 
              zIndex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              padding: '0 10px'
            }}>
              {isAuthenticating ? 'Loading...' : user ? 'Logout' : 'Login'}
            </span>
          </button>
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
          {Array.from({ length: totalRows }, (_, i) => {
            // Determine if this is a blank row
            const isTopBlank = showTopBlanks && i < 4
            const isBottomBlank = i >= (showTopBlanks ? 54 : 50)
            const isBlank = isTopBlank || isBottomBlank
            const channelNum = isBlank ? '' : (i - channelRowOffset + 1)
            
            // Get category name for this channel
            const categoryIndex = i - channelRowOffset
            const categoryName = !isBlank && categories[categoryIndex] 
              ? categories[categoryIndex].name 
              : 'CATEGORY'
            
            return (
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
                  boxSizing: 'border-box',
                  zIndex: -1
                }} />
                {!isBlank && (
                  <>
                    <span style={{ position: 'relative', zIndex: 1 }}>CH {channelNum}</span>
                    <span style={{ 
                      position: 'relative', 
                      zIndex: 1, 
                      fontSize: 'clamp(10px, 1.2vw, 30px)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      width: '100%',
                      textAlign: 'center'
                    }}>
                      {isLoadingCategories ? 'Loading...' : categoryName}
                    </span>
                  </>
                )}
              </div>
            )
          })}
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
          {/* Content blocks for all rows */}
          {rowLayouts.map((blocks, rowIndex) => {
            const isBlankRow = blocks[0]?.isBlank
            
            // Determine which ad image to show for blank rows
            // Top 4 blank rows (if shown): rows 0-3 -> ads 1-4
            // Bottom 4 blank rows: last 4 rows -> ads 1-4 (matching top for seamless loop)
            let adImageNumber = null
            if (isBlankRow) {
              if (showTopBlanks && rowIndex < 4) {
                // Top blank rows
                adImageNumber = rowIndex + 1
              } else if (rowIndex >= (showTopBlanks ? 54 : 50)) {
                // Bottom blank rows - map to same ads as top
                const bottomRowOffset = rowIndex - (showTopBlanks ? 54 : 50)
                adImageNumber = bottomRowOffset + 1
              }
            }
            
            // Get the category for this row (accounting for top blank rows)
            const categoryIndex = showTopBlanks ? rowIndex - 4 : rowIndex
            const category = categories[categoryIndex]
            const streams = category ? categoryStreams[category.id] : []
            
            return (
              <div key={rowIndex} style={{
                position: 'absolute',
                top: `calc(${headerRowHeight} + ${typicalRowHeight} * ${rowIndex})`,
                left: firstColumnWidth,
                height: typicalRowHeight,
                display: 'flex',
                gap: '0',
                border: isBlankRow ? 'none' : undefined
              }}>
                {blocks.map((block) => {
                // For blank blocks, calculate width to span all visible columns
                const blockWidth = block.isBlank 
                  ? `calc(${typicalColumnWidth} * 15)` // Span 15 columns (enough to cover visible area)
                  : `calc(${typicalColumnWidth} * ${block.width})`
                
                // Render blank blocks as buttons with 3D borders and hover effect
                if (block.isBlank) {
                  return (
                    <button 
                      key={block.id}
                      className="show-button"
                      style={{
                        height: typicalRowHeight,
                        width: blockWidth,
                        minWidth: blockWidth,
                        boxSizing: 'border-box',
                        position: 'relative',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        overflow: 'hidden'
                      }}
                    >
                      <div 
                        className="show-button-bg"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          backgroundColor: '#423352',
                          borderTop: '5px solid rgba(255, 255, 255, 0.6)',
                          borderLeft: '5px solid rgba(255, 255, 255, 0.6)',
                          borderBottom: '5px solid rgba(0, 0, 0, 0.8)',
                          borderRight: '5px solid rgba(0, 0, 0, 0.8)',
                          boxSizing: 'border-box',
                          zIndex: -1,
                          transition: 'background-color 0.2s ease'
                        }} 
                      />
                      {adImageNumber && (
                        <img 
                          src={`/images/ad-row-${adImageNumber}.png`}
                          alt={`Advertisement ${adImageNumber}`}
                          style={{
                            position: 'relative',
                            zIndex: 1,
                            width: '95%',
                            height: '80%',
                            objectFit: 'contain',
                            pointerEvents: 'none'
                          }}
                        />
                      )}
                    </button>
                  )
                }
                
                // Get the stream for this block
                const stream = streams && streams[block.streamIndex]
                
                // Handle stream click
                const handleStreamClick = () => {
                  if (stream && category) {
                    // Disable auto-rotation when user manually selects a stream
                    setIsAutoRotating(false)
                    
                    setFeaturedStream({
                      ...stream,
                      categoryName: category.name,
                      categoryRank: categoryIndex + 1
                    })
                  }
                }
                
                // Regular show blocks as buttons
                return (
                  <button 
                    key={block.id} 
                    className="show-button"
                    onClick={handleStreamClick}
                    disabled={!stream}
                    style={{
                      fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
                      fontWeight: 700,
                      fontStretch: 'condensed',
                      fontSize: 'clamp(20px, 2vw, 60px)',
                      color: 'white',
                      textShadow: '4px 4px 0px rgba(0, 0, 0, 0.9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      whiteSpace: 'nowrap',
                      border: '1px solid black',
                      height: typicalRowHeight,
                      width: blockWidth,
                      minWidth: blockWidth,
                      boxSizing: 'border-box',
                      position: 'relative',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      padding: '0 0.5vw 0 1vw',
                      cursor: stream ? 'pointer' : 'default',
                      background: 'none',
                      opacity: stream ? 1 : 0.6
                    }}
                  >
                    <div 
                      className="show-button-bg"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        backgroundColor: '#423352',
                        borderTop: '5px solid rgba(255, 255, 255, 0.6)',
                        borderLeft: '5px solid rgba(255, 255, 255, 0.6)',
                        borderBottom: '5px solid rgba(0, 0, 0, 0.8)',
                        borderRight: '5px solid rgba(0, 0, 0, 0.8)',
                        boxSizing: 'border-box',
                        zIndex: -1,
                        transition: 'background-color 0.2s ease'
                      }} 
                    />
                    <span style={{ position: 'relative', zIndex: 1 }}>
                      {isLoadingStreams 
                        ? 'Loading...' 
                        : streams && streams[block.streamIndex] 
                          ? streams[block.streamIndex].user_name 
                          : 'No Stream'}
                    </span>
                  </button>
                )
                })}
              </div>
            )
          })}


        </div>
      </div>
    </div>
  )
}

export default App
