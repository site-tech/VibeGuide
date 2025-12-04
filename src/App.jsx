import { useState, useEffect, useRef } from 'react'
import './App.css'
import { getTopCategories, getStreamsByCategory, getUserFollows } from './lib/api'
import { supabase } from './lib/supabase'
import TwitchPlayer from './components/TwitchPlayer'

function App() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const [currentTime, setCurrentTime] = useState(new Date())
  const [categories, setCategories] = useState([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [categoryStreams, setCategoryStreams] = useState({})
  const [isLoadingStreams, setIsLoadingStreams] = useState(false)
  const [featuredStream, setFeaturedStream] = useState(null)
  const [isAutoRotating, setIsAutoRotating] = useState(true)
  const [user, setUser] = useState(null)
  const [followedChannels, setFollowedChannels] = useState(new Set())
  const scrollRef = useRef(null)
  const scrollLockRef = useRef({ direction: null, startX: 0, startY: 0, scrollAccumulator: 0 })
  const autoScrollRef = useRef({ timeout: null, interval: null, lastInteraction: Date.now(), isAutoScrolling: false })
  const streamRotationRef = useRef(null)
  const isInitialStreamSet = useRef(false)
  const rssScrollRef = useRef(null)
  
  // DVD Logo bouncing state - restore from sessionStorage if it was active
  const [showDvdLogo, setShowDvdLogo] = useState(() => {
    return sessionStorage.getItem('dvdLogoActive') === 'true'
  })
  const [dvdPosition, setDvdPosition] = useState(() => {
    const saved = sessionStorage.getItem('dvdPosition')
    return saved ? JSON.parse(saved) : { x: 5, y: 5 }
  })
  const [dvdVelocity, setDvdVelocity] = useState(() => {
    const saved = sessionStorage.getItem('dvdVelocity')
    return saved ? JSON.parse(saved) : { x: 0.1875, y: 0.125 }
  })
  const [dvdLogoColor, setDvdLogoColor] = useState(() => {
    const saved = sessionStorage.getItem('dvdLogoColor')
    return saved || 'color' // 'color' or 'white'
  })
  const dvdIdleTimeoutRef = useRef(null)
  const dvdAnimationRef = useRef(null)
  const lastBounceRef = useRef({ x: false, y: false })
  
  // Keyboard navigation state
  const [focusedCell, setFocusedCell] = useState(null) // { rowIndex, blockIndex }
  const gridMapRef = useRef([]) // Navigable grid structure
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef(null)
  const [overflowingCategories, setOverflowingCategories] = useState(new Set())
  
  // Settings menu state
  const [showSettings, setShowSettings] = useState(false)
  const [settingsCrtEnabled, setSettingsCrtEnabled] = useState(false)
  const [settingsLogoBouncerCount, setSettingsLogoBouncerCount] = useState(0)
  
  // Logo bouncer state - array of bouncing logos
  const [bouncingLogos, setBouncingLogos] = useState([])
  const bouncingLogosRef = useRef([])
  const logoAnimationFrameRef = useRef(null)
  
  // Logo images pool (cycles through in order)
  const logoImages = [
    '/images/bouncer-ttv-guide.png',
    '/images/bouncer-ttv-guide-white.png',
    '/images/bouncer-kiro.png',
    '/images/bouncer-vibe-guide.png',
    '/images/bouncer-vibe-guide-white.png',
    '/images/bouncer-twitch.png'
  ]
  
  // Check if we should show top blank rows (after reload)
  const [showTopBlanks] = useState(() => {
    return sessionStorage.getItem('showTopBlanks') === 'true'
  })

  // Fetch user follows data
  const fetchUserFollows = async () => {
    try {
      const follows = await getUserFollows()
      const followedSet = new Set(follows.map(follow => follow.broadcaster_login))
      setFollowedChannels(followedSet)
    } catch (error) {
      console.error('Failed to fetch follows:', error)
      // Keep existing followed channels on error for graceful degradation
    }
  }

  // Check for existing Supabase session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const userData = {
          id: session.user.id,
          email: session.user.email,
          display_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
          login: session.user.user_metadata?.preferred_username || session.user.user_metadata?.user_name,
          profile_image_url: session.user.user_metadata?.avatar_url,
          twitch_user_id: session.user.user_metadata?.provider_id || session.user.user_metadata?.sub
        }
        setUser(userData)
        // Fetch follows when user is authenticated
        fetchUserFollows()
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const userData = {
          id: session.user.id,
          email: session.user.email,
          display_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
          login: session.user.user_metadata?.preferred_username || session.user.user_metadata?.user_name,
          profile_image_url: session.user.user_metadata?.avatar_url,
          twitch_user_id: session.user.user_metadata?.provider_id || session.user.user_metadata?.sub
        }

        setUser(userData)
        // Fetch follows when user logs in
        fetchUserFollows()
      } else {
        setUser(null)
        setFollowedChannels(new Set())
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Handle login button click
  const handleLogin = async () => {
    try {
      const { error, data } = await supabase.auth.signInWithOAuth({
        provider: 'twitch',
        options: {
          redirectTo: window.location.origin,
          scopes: 'user:read:follows'
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
  
  // Generate layout structure dynamically based on stream name lengths
  const generateDynamicLayout = (categoryStreams, categories, includeTopBlanks) => {
    // EDITABLE PARAMETERS
    const MAX_GRID_POSITION = 45
    const SIMILAR_LAYOUT_INTERVAL = 4
    
    const allRows = []
    
    // Create blank row - MUST have isBlank flag
    const createBlankRow = () => [{
      id: 0,
      width: 45,
      position: 0,
      isBlank: true,
      streamIndex: -1 // Invalid index to prevent rendering as stream cell
    }]
    
    // Generate blocks based on stream name lengths
    const generateRowBlocks = (rowIndex, streams) => {
      const blocks = []
      let currentPosition = 0
      let blockId = 0
      
      if (!streams || streams.length === 0) {
        // Fallback to random widths if no streams
        while (currentPosition < MAX_GRID_POSITION) {
          const width = Math.random() > 0.5 ? 1 : 2
          const finalWidth = Math.min(width, MAX_GRID_POSITION - currentPosition)
          blocks.push({
            id: blockId++,
            width: finalWidth,
            position: currentPosition,
            streamIndex: blockId - 1
          })
          currentPosition += finalWidth
        }
        return blocks
      }
      
      // Assign widths based on name length
      streams.forEach((stream, idx) => {
        if (currentPosition >= MAX_GRID_POSITION) return
        
        const nameLength = stream?.user_name?.length || 10
        let width
        
        // Longer names get wider cells
        if (nameLength > 12) {
          width = 2 // Wide cell for long names
        } else if (nameLength > 8) {
          width = 1.5 // Medium cell
        } else {
          width = 1 // Narrow cell for short names
        }
        
        // Align to 3-cell boundaries
        const remainingToNext3 = 3 - (currentPosition % 3)
        if (remainingToNext3 === 1 && width > 1) {
          width = 1 // Force 1 to stay aligned
        }
        
        // Don't overflow
        if (currentPosition + width > MAX_GRID_POSITION) {
          width = MAX_GRID_POSITION - currentPosition
        }
        
        blocks.push({
          id: blockId++,
          width: width,
          position: currentPosition,
          streamIndex: idx
        })
        
        currentPosition += width
      })
      
      // Fill remaining space if streams didn't fill the row
      // Use modulo to cycle through available streams
      while (currentPosition < MAX_GRID_POSITION) {
        const width = Math.min(2, MAX_GRID_POSITION - currentPosition)
        const validStreamIndex = streams.length > 0 ? (blockId % streams.length) : 0
        blocks.push({
          id: blockId++,
          width: width,
          position: currentPosition,
          streamIndex: validStreamIndex // Cycle through available streams
        })
        currentPosition += width
      }
      
      return blocks
    }
    
    if (includeTopBlanks) {
      for (let i = 0; i < 4; i++) {
        allRows.push(createBlankRow())
      }
    }
    
    // Generate blocks for each category row (50 categories total)
    // These will be at indices 4-53 if showTopBlanks, or 0-49 if not
    for (let row = 0; row < 50; row++) {
      const categoryIndex = row // Maps to category 0-49
      const category = categories[categoryIndex]
      const streams = category ? categoryStreams[category.id] : []
      
      let blocks
      if (row % SIMILAR_LAYOUT_INTERVAL === 0 && row > 0) {
        const prevBlocks = allRows[allRows.length - 1]
        if (!prevBlocks[0]?.isBlank) {
          blocks = prevBlocks.map((block, idx) => ({
            ...block,
            id: idx,
            streamIndex: idx
          }))
        } else {
          blocks = generateRowBlocks(row, streams)
        }
      } else {
        blocks = generateRowBlocks(row, streams)
      }
      
      allRows.push(blocks)
    }
    
    for (let i = 0; i < 4; i++) {
      allRows.push(createBlankRow())
    }
    
    return allRows
  }
  
  // Generate layout structure for all rows once on mount (without text content)
  const [rowLayouts, setRowLayouts] = useState(() => {
    // EDITABLE PARAMETERS
    const SHOW_WIDTH_OPTIONS = [1, 1.5, 2] // Available widths for show blocks (in cells)
    const MAX_GRID_POSITION = 45 // Maximum position to stop generating blocks
    const SIMILAR_LAYOUT_INTERVAL = 4 // Every Nth row will copy previous row's layout
    const PROBABILITY_WIDTH_1_VS_2 = 0.5 // When choosing between 1 or 2 cells (0.0 = always 1, 1.0 = always 2)
    
    const allRows = []
    
    // Create blank row (single block spanning full width) - MUST have isBlank flag
    const createBlankRow = () => [{
      id: 0,
      width: 45, // Full width to match MAX_GRID_POSITION
      position: 0,
      isBlank: true,
      streamIndex: -1 // Invalid index to prevent rendering as stream cell
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
      // Filter out mature content streams
      let selectedStream = null
      const allStreams = []
      categories.forEach((category, categoryIndex) => {
        const streams = streamsMap[category.id] || []
        streams.forEach(stream => {
          // Only include non-mature streams
          if (!stream.is_mature) {
            allStreams.push({
              ...stream,
              categoryName: category.name,
              categoryRank: categoryIndex + 1 // 1-indexed rank
            })
          }
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
        isInitialStreamSet.current = true // Mark that initial stream is set
      }
      
      // Regenerate layout based on stream name lengths
      const newLayout = generateDynamicLayout(streamsMap, categories, showTopBlanks)
      setRowLayouts(newLayout)
      
      setIsLoadingStreams(false)
    }
    
    fetchAllStreams()
  }, [categories, categoryStreams])

  // Auto-rotate featured stream every 90 seconds
  useEffect(() => {
    if (!isAutoRotating || Object.keys(categoryStreams).length === 0 || !isInitialStreamSet.current) {
      return
    }

    const rotateStream = () => {
      // Build array of all non-mature streams
      const allStreams = []
      categories.forEach((category, categoryIndex) => {
        const streams = categoryStreams[category.id] || []
        streams.forEach(stream => {
          // Only include non-mature streams
          if (!stream.is_mature) {
            allStreams.push({
              ...stream,
              categoryName: category.name,
              categoryRank: categoryIndex + 1
            })
          }
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
  
  // Regenerate layout when showTopBlanks changes (on page reload)
  useEffect(() => {
    if (categories.length > 0 && Object.keys(categoryStreams).length > 0) {
      const newLayout = generateDynamicLayout(categoryStreams, categories, showTopBlanks)
      setRowLayouts(newLayout)
    }
  }, [showTopBlanks, categories, categoryStreams]) // Regenerate when any dependency changes
  
  // Set initial scroll position to skip top blank rows on first load
  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement || showTopBlanks) return
    
    // Scroll past the top 4 blank rows on initial load
    const getRowHeight = () => {
      const vh = window.innerHeight / 100
      return (50 * vh) / 5
    }
    
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      scrollElement.scrollTop = 0 // Start at CH 1
    }, 50)
  }, [showTopBlanks])

  // Auto-scroll effect
  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    const getRowHeight = () => {
      const vh = window.innerHeight / 100
      // Match the CSS calculation: 50vh / 5
      // Borders are included via box-sizing: border-box
      return (50 * vh) / 5 // typicalRowHeight in pixels
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
      

      
      // If scroll distance is too small, something is wrong - don't scroll
      if (scrollDistance < 1) {
        autoScrollRef.current.isAutoScrolling = false
        return
      }
      
      // Store target scroll for speed-up feature
      autoScrollRef.current.targetScroll = actualTargetScroll
      
      // Adjust duration based on distance: 2 seconds per row
      // This keeps the speed consistent whether scrolling 3.5 rows or 4 rows
      const duration = Math.max(rowsToScroll * 2000, 1000) // Minimum 1 second
      const startTime = performance.now()

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        const easeProgress = progress * (2 - progress) // ease out
        
        scrollElement.scrollTop = startScroll + scrollDistance * easeProgress

        if (progress >= 1) {
          cancelAnimationFrame(autoScrollRef.current.interval)
          
          // Snap to exact target to prevent drift
          scrollElement.scrollTop = actualTargetScroll
          
          // Mark that auto-scroll is done
          autoScrollRef.current.isAutoScrolling = false
          
          // Check if we're in the bottom blank rows
          const finalScroll = scrollElement.scrollTop
          const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight
          

          
          // Check if we've reached the bottom blank rows OR we're near the end
          const reachedBottom = finalScroll >= bottomBlankStart - 100 || finalScroll >= maxScroll - 100
          
          if (reachedBottom) {
            // We're in the blank area, wait 5 seconds then reload
            autoScrollRef.current.lastInteraction = Date.now()
            
            autoScrollRef.current.timeout = setTimeout(() => {
              // DVD logo state is already being saved continuously if active
              sessionStorage.setItem('showTopBlanks', 'true')
              window.location.reload()
            }, 5000) // 5 seconds (half time)
            return
          }
          
          // Wait 10 seconds before next scroll
          // Update lastInteraction to current time so we know when this scroll completed
          const scrollCompletedTime = Date.now()
          autoScrollRef.current.lastInteraction = scrollCompletedTime
          
          autoScrollRef.current.timeout = setTimeout(() => {
            const timeSinceLastInteraction = Date.now() - autoScrollRef.current.lastInteraction
            
            // Check if user hasn't interacted in the last 10 seconds (with small tolerance)
            if (timeSinceLastInteraction >= 9900) {
              startAutoScroll()
            }
          }, 10000)
        } else {
          autoScrollRef.current.interval = requestAnimationFrame(animate)
        }
      }
      
      autoScrollRef.current.interval = requestAnimationFrame(animate)
    }

    const resetAutoScroll = () => {
      autoScrollRef.current.lastInteraction = Date.now()
      clearTimeout(autoScrollRef.current.timeout)
      if (autoScrollRef.current.interval) {
        cancelAnimationFrame(autoScrollRef.current.interval)
      }
      
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
      autoScrollRef.current.lastInteraction = Date.now()
      autoScrollRef.current.timeout = setTimeout(() => {
        startAutoScroll()
      }, 5000) // 5 second delay (half time) before first scroll after reload
    } else {
      // Initial auto-scroll setup for normal page load
      resetAutoScroll()
    }

    // Reset on user interaction
    const handleInteraction = () => {
      // Clear the reload flag on user interaction
      sessionStorage.removeItem('showTopBlanks')
      resetAutoScroll()
    }
    
    // Handle manual scroll - only reset if not auto-scrolling
    const handleScroll = () => {
      if (!autoScrollRef.current.isAutoScrolling) {
        handleInteraction()
      }
    }

    scrollElement.addEventListener('wheel', handleInteraction)
    scrollElement.addEventListener('touchstart', handleInteraction)
    scrollElement.addEventListener('mousedown', handleInteraction)
    scrollElement.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      clearTimeout(autoScrollRef.current.timeout)
      if (autoScrollRef.current.interval) {
        cancelAnimationFrame(autoScrollRef.current.interval)
      }
      scrollElement.removeEventListener('wheel', handleInteraction)
      scrollElement.removeEventListener('touchstart', handleInteraction)
      scrollElement.removeEventListener('mousedown', handleInteraction)
      scrollElement.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    const scrollElement = scrollRef.current
    const headerRow = document.getElementById('header-row')
    
    if (!scrollElement) return

    // Calculate column width in pixels for snap scrolling
    const getColumnWidth = () => {
      const vw = window.innerWidth / 100
      return 18.96 * vw // typicalColumnWidth in pixels
    }

    // Calculate row height in pixels for snap scrolling
    const getRowHeight = () => {
      const vh = window.innerHeight / 100
      return (50 * vh) / 5
    }

    const handleWheel = (e) => {
      e.preventDefault()
      
      // If currently scrolling, ignore all wheel events including momentum
      if (scrollLockRef.current.isScrolling) {
        return
      }
      
      const deltaX = Math.abs(e.deltaX)
      const deltaY = Math.abs(e.deltaY)
      
      // Determine direction on first wheel event of gesture
      if (!scrollLockRef.current.direction && (deltaX > 0 || deltaY > 0)) {
        if (deltaX > deltaY) {
          scrollLockRef.current.direction = 'horizontal'
        } else {
          scrollLockRef.current.direction = 'vertical'
        }
      }

      if (scrollLockRef.current.direction === 'horizontal') {
        // Accumulate scroll delta
        scrollLockRef.current.scrollAccumulator += e.deltaX + e.deltaY
        
        // Trigger 4-column scroll when threshold is reached
        const scrollThreshold = 50 // Same as vertical for consistent responsiveness
        if (Math.abs(scrollLockRef.current.scrollAccumulator) >= scrollThreshold) {
          const columnWidth = getColumnWidth()
          const currentColumn = Math.round(scrollElement.scrollLeft / columnWidth)
          const scrollDirection = scrollLockRef.current.scrollAccumulator > 0 ? 1 : -1
          
          // Always scroll 4 columns
          const targetColumn = Math.max(0, currentColumn + (scrollDirection * 4))
          const targetScroll = targetColumn * columnWidth
          
          scrollElement.scrollTo({
            left: targetScroll,
            behavior: 'smooth'
          })
          
          // Immediately block ALL further wheel events until cooldown expires
          scrollLockRef.current.isScrolling = true
          scrollLockRef.current.scrollAccumulator = 0
          scrollLockRef.current.direction = null
          
          // Unblock after cooldown - this blocks ALL momentum
          setTimeout(() => {
            scrollLockRef.current.isScrolling = false
          }, 1200)
        }
      } else if (scrollLockRef.current.direction === 'vertical') {
        // Accumulate vertical scroll delta
        scrollLockRef.current.scrollAccumulator += e.deltaY + e.deltaX
        
        // Trigger 4-row scroll when threshold is reached
        const scrollThreshold = 50 // Threshold to trigger snap
        if (Math.abs(scrollLockRef.current.scrollAccumulator) >= scrollThreshold) {
          const rowHeight = getRowHeight()
          const currentRow = Math.round(scrollElement.scrollTop / rowHeight)
          const scrollDirection = scrollLockRef.current.scrollAccumulator > 0 ? 1 : -1
          
          // Always scroll 4 rows
          let targetRow = currentRow + (scrollDirection * 4)
          
          // Prevent scrolling up into top blank rows if they shouldn't be visible
          const minRow = showTopBlanks ? 0 : 0
          const maxRow = (showTopBlanks ? 58 : 54) - 1
          targetRow = Math.max(minRow, Math.min(maxRow, targetRow))
          
          const targetScroll = targetRow * rowHeight
          
          scrollElement.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
          })
          
          // Immediately block ALL further wheel events until cooldown expires
          scrollLockRef.current.isScrolling = true
          scrollLockRef.current.scrollAccumulator = 0
          scrollLockRef.current.direction = null
          
          // Unblock after cooldown - this blocks ALL momentum
          setTimeout(() => {
            scrollLockRef.current.isScrolling = false
          }, 1200)
        }
      }
    }

    let touchStartTime = 0
    
    const handleTouchStart = (e) => {
      scrollLockRef.current.startX = e.touches[0].clientX
      scrollLockRef.current.startY = e.touches[0].clientY
      touchStartTime = Date.now()
      scrollLockRef.current.direction = null
    }

    const handleTouchMove = (e) => {
      if (!scrollLockRef.current.startX || !scrollLockRef.current.startY) return

      const currentX = e.touches[0].clientX
      const currentY = e.touches[0].clientY
      const deltaX = Math.abs(currentX - scrollLockRef.current.startX)
      const deltaY = Math.abs(currentY - scrollLockRef.current.startY)

      // Determine direction on first significant movement
      if (!scrollLockRef.current.direction && (deltaX > 10 || deltaY > 10)) {
        if (deltaX > deltaY) {
          scrollLockRef.current.direction = 'horizontal'
        } else {
          scrollLockRef.current.direction = 'vertical'
        }
      }

      // Prevent all scrolling - we handle it in touchend
      if (scrollLockRef.current.direction) {
        e.preventDefault()
      }
    }

    const handleTouchEnd = (e) => {
      if (!scrollLockRef.current.startX || !scrollLockRef.current.startY) return

      if (scrollLockRef.current.direction === 'horizontal') {
        const endX = e.changedTouches[0].clientX
        const deltaX = endX - scrollLockRef.current.startX
        const deltaTime = Date.now() - touchStartTime
        const absDeltaX = Math.abs(deltaX)

        e.preventDefault()
        const columnWidth = getColumnWidth()
        const currentColumn = Math.round(scrollElement.scrollLeft / columnWidth)
        
        // Always scroll 4 columns
        const direction = deltaX > 0 ? -1 : 1 // Swipe right = scroll left
        const targetColumn = Math.max(0, currentColumn + (direction * 4))
        
        scrollElement.scrollTo({
          left: targetColumn * columnWidth,
          behavior: 'smooth'
        })
      } else if (scrollLockRef.current.direction === 'vertical') {
        const endY = e.changedTouches[0].clientY
        const deltaY = endY - scrollLockRef.current.startY

        e.preventDefault()
        const rowHeight = getRowHeight()
        const currentRow = Math.round(scrollElement.scrollTop / rowHeight)
        
        // Always scroll 4 rows
        const direction = deltaY > 0 ? -1 : 1 // Swipe down = scroll up
        let targetRow = currentRow + (direction * 4)
        
        // Prevent scrolling up into top blank rows if they shouldn't be visible
        const minRow = showTopBlanks ? 0 : 0
        const maxRow = (showTopBlanks ? 58 : 54) - 1
        targetRow = Math.max(minRow, Math.min(maxRow, targetRow))
        
        scrollElement.scrollTo({
          top: targetRow * rowHeight,
          behavior: 'smooth'
        })
      }

      // Reset
      setTimeout(() => {
        scrollLockRef.current.direction = null
        scrollLockRef.current.startX = 0
        scrollLockRef.current.startY = 0
      }, 100)
    }

    scrollElement.addEventListener('wheel', handleWheel, { passive: false })
    scrollElement.addEventListener('touchstart', handleTouchStart, { passive: false })
    scrollElement.addEventListener('touchmove', handleTouchMove, { passive: false })
    scrollElement.addEventListener('touchend', handleTouchEnd, { passive: false })

    return () => {
      scrollElement.removeEventListener('wheel', handleWheel)
      scrollElement.removeEventListener('touchstart', handleTouchStart)
      scrollElement.removeEventListener('touchmove', handleTouchMove)
      scrollElement.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  // Build navigable grid map when data is loaded
  useEffect(() => {
    if (categories.length === 0 || Object.keys(categoryStreams).length === 0) {
      gridMapRef.current = []
      return
    }

    const map = []
    
    rowLayouts.forEach((blocks, rowIndex) => {
      // Skip blank rows
      if (blocks[0]?.isBlank) return
      
      // Map each block in the row
      const rowData = blocks.map((block, blockIndex) => {
        const categoryIndex = showTopBlanks ? rowIndex - 4 : rowIndex
        const category = categories[categoryIndex]
        const streams = category ? categoryStreams[category.id] : []
        const stream = streams && streams[block.streamIndex]
        
        return {
          actualRowIndex: rowIndex, // The actual row index in rowLayouts
          blockIndex,
          position: block.position,
          width: block.width,
          streamIndex: block.streamIndex,
          categoryIndex,
          hasStream: !!stream,
          stream,
          category
        }
      })
      
      map.push(rowData)
    })
    
    gridMapRef.current = map
  }, [categories, categoryStreams, rowLayouts, showTopBlanks])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if arrow keys or WASD
      const isArrowKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(e.key)
      const isEnter = e.key === 'Enter'
      const isEscape = e.key === 'Escape'
      
      if (!isArrowKey && !isEnter && !isEscape) return
      
      // Escape exits focus mode
      if (isEscape) {
        setFocusedCell(null)
        return
      }
      
      // Enter activates focused cell
      if (isEnter && focusedCell) {
        e.preventDefault()
        const row = gridMapRef.current[focusedCell.rowIndex]
        if (!row) return
        const cell = row[focusedCell.blockIndex]
        if (!cell || !cell.hasStream) return
        
        // Activate stream
        setIsAutoRotating(false)
        setFeaturedStream({
          ...cell.stream,
          categoryName: cell.category.name,
          categoryRank: cell.categoryIndex + 1
        })
        return
      }
      
      // Arrow keys for navigation
      if (isArrowKey) {
        e.preventDefault()
        
        // If auto-scroll is happening, speed it up to complete immediately
        if (autoScrollRef.current.isAutoScrolling) {
          const scrollElement = scrollRef.current
          if (scrollElement && autoScrollRef.current.targetScroll !== undefined) {
            // Cancel the current animation
            if (autoScrollRef.current.interval) {
              cancelAnimationFrame(autoScrollRef.current.interval)
            }
            
            // Jump to target with fast animation
            scrollElement.scrollTo({
              top: autoScrollRef.current.targetScroll,
              behavior: 'smooth'
            })
            
            // Mark auto-scroll as done
            autoScrollRef.current.isAutoScrolling = false
            
            // Small delay to let the fast scroll complete before allowing keyboard nav
            setTimeout(() => {
              // Trigger the keyboard navigation after speed-up completes
              // Re-dispatch the event or just return to let it process normally
            }, 300)
            return
          }
        }
        
        // Shift + Arrow = large scroll (4 units)
        if (e.shiftKey) {
          const scrollElement = scrollRef.current
          if (!scrollElement) return
          
          const getRowHeight = () => {
            const vh = window.innerHeight / 100
            return (50 * vh) / 5
          }
          
          const getColumnWidth = () => {
            const vw = window.innerWidth / 100
            return 18.96 * vw
          }
          
          if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            const rowHeight = getRowHeight()
            const currentRow = Math.round(scrollElement.scrollTop / rowHeight)
            const targetRow = Math.max(0, currentRow - 4)
            scrollElement.scrollTo({ top: targetRow * rowHeight, behavior: 'smooth' })
          } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            const rowHeight = getRowHeight()
            const currentRow = Math.round(scrollElement.scrollTop / rowHeight)
            const maxRow = (showTopBlanks ? 58 : 54) - 1
            const targetRow = Math.min(maxRow, currentRow + 4)
            scrollElement.scrollTo({ top: targetRow * rowHeight, behavior: 'smooth' })
          } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            const columnWidth = getColumnWidth()
            const currentColumn = Math.round(scrollElement.scrollLeft / columnWidth)
            const targetColumn = Math.max(0, currentColumn - 4)
            scrollElement.scrollTo({ left: targetColumn * columnWidth, behavior: 'smooth' })
          } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            const columnWidth = getColumnWidth()
            const currentColumn = Math.round(scrollElement.scrollLeft / columnWidth)
            const targetColumn = currentColumn + 4
            scrollElement.scrollTo({ left: targetColumn * columnWidth, behavior: 'smooth' })
          }
          return
        }
        
        // Check if focused cell is visible, if not reset to top-left visible cell
        const scrollEl = scrollRef.current
        if (focusedCell && scrollEl) {
          const getRowHeight = () => {
            const vh = window.innerHeight / 100
            return (50 * vh) / 5
          }
          
          const rowHeight = getRowHeight()
          const viewportTop = scrollEl.scrollTop
          const viewportBottom = viewportTop + scrollEl.clientHeight
          
          const focusedRowTop = focusedCell.rowIndex * rowHeight
          const focusedRowBottom = focusedRowTop + rowHeight
          
          // Check if focused cell is outside viewport
          const isOutsideViewport = focusedRowBottom < viewportTop || focusedRowTop > viewportBottom
          
          if (isOutsideViewport) {
            // Reset to top-left visible cell
            const topVisibleRow = Math.floor(viewportTop / rowHeight)
            
            // Find the grid map row that corresponds to this actual row
            let targetGridRow = null
            for (let i = 0; i < gridMapRef.current.length; i++) {
              const row = gridMapRef.current[i]
              if (row[0].actualRowIndex === topVisibleRow) {
                targetGridRow = row
                break
              }
            }
            
            if (targetGridRow && targetGridRow.length > 0) {
              setFocusedCell({
                rowIndex: targetGridRow[0].actualRowIndex,
                blockIndex: 0
              })
              return
            }
          }
        }
        
        // Initialize focus if not set
        if (!focusedCell) {
          // Start at first cell of first row in grid map
          if (gridMapRef.current.length > 0 && gridMapRef.current[0].length > 0) {
            const firstCell = gridMapRef.current[0][0]
            setFocusedCell({ 
              rowIndex: firstCell.actualRowIndex, 
              blockIndex: 0 
            })
          }
          return
        }
        
        // Find current cell in grid map
        let gridRowIndex = -1
        let currentRow = null
        let currentCell = null
        
        for (let i = 0; i < gridMapRef.current.length; i++) {
          const row = gridMapRef.current[i]
          if (row[0].actualRowIndex === focusedCell.rowIndex) {
            gridRowIndex = i
            currentRow = row
            currentCell = row[focusedCell.blockIndex]
            break
          }
        }
        
        if (!currentRow || !currentCell) return
        
        let newGridRowIndex = gridRowIndex
        let newBlockIndex = focusedCell.blockIndex
        
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          // Move left - stay in current row
          if (newBlockIndex > 0) {
            newBlockIndex--
          }
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          // Move right - stay in current row
          if (newBlockIndex < currentRow.length - 1) {
            newBlockIndex++
          }
        } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          // Move up - find cell in previous row that overlaps current position
          if (newGridRowIndex > 0) {
            newGridRowIndex--
            const targetRow = gridMapRef.current[newGridRowIndex]
            const currentLeftEdge = currentCell.position
            
            // Find cell that contains the left edge of current cell
            let foundCell = targetRow.find(cell => 
              currentLeftEdge >= cell.position && currentLeftEdge < cell.position + cell.width
            )
            
            if (!foundCell) {
              // Find cell with closest left edge (prefer leftmost when equidistant)
              foundCell = targetRow.reduce((closest, cell) => {
                const cellDist = Math.abs(cell.position - currentLeftEdge)
                const closestDist = Math.abs(closest.position - currentLeftEdge)
                // If distances are equal, prefer the leftmost cell
                if (cellDist === closestDist) {
                  return cell.position < closest.position ? cell : closest
                }
                return cellDist < closestDist ? cell : closest
              })
            }
            
            newBlockIndex = targetRow.indexOf(foundCell)
          }
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          // Move down - find cell in next row that overlaps current position
          if (newGridRowIndex < gridMapRef.current.length - 1) {
            newGridRowIndex++
            const targetRow = gridMapRef.current[newGridRowIndex]
            const currentLeftEdge = currentCell.position
            
            // Find cell that contains the left edge of current cell
            let foundCell = targetRow.find(cell => 
              currentLeftEdge >= cell.position && currentLeftEdge < cell.position + cell.width
            )
            
            if (!foundCell) {
              // Find cell with closest left edge (prefer leftmost when equidistant)
              foundCell = targetRow.reduce((closest, cell) => {
                const cellDist = Math.abs(cell.position - currentLeftEdge)
                const closestDist = Math.abs(closest.position - currentLeftEdge)
                // If distances are equal, prefer the leftmost cell
                if (cellDist === closestDist) {
                  return cell.position < closest.position ? cell : closest
                }
                return cellDist < closestDist ? cell : closest
              })
            }
            
            newBlockIndex = targetRow.indexOf(foundCell)
          }
        }
        
        // Get the actual row index from the new grid position
        const newRowData = gridMapRef.current[newGridRowIndex]
        const newActualRowIndex = newRowData[0].actualRowIndex
        const newCell = newRowData[newBlockIndex]
        
        setFocusedCell({ rowIndex: newActualRowIndex, blockIndex: newBlockIndex })
        
        // Check if new cell is visible, if not scroll to it
        const scrollElement = scrollRef.current
        if (!scrollElement) return
        
        const getRowHeight = () => {
          const vh = window.innerHeight / 100
          return (50 * vh) / 5
        }
        
        const getColumnWidth = () => {
          const vw = window.innerWidth / 100
          return 18.96 * vw
        }
        
        // Check vertical visibility
        const rowHeight = getRowHeight()
        const cellTop = newActualRowIndex * rowHeight
        const cellBottom = cellTop + rowHeight
        const viewportTop = scrollElement.scrollTop
        const viewportBottom = viewportTop + scrollElement.clientHeight
        
        if (cellTop < viewportTop) {
          // Scroll up to show cell
          const targetRow = Math.floor(newActualRowIndex / 4) * 4
          scrollElement.scrollTo({ top: targetRow * rowHeight, behavior: 'smooth' })
        } else if (cellBottom > viewportBottom) {
          // Scroll down to show cell
          const targetRow = Math.ceil((newActualRowIndex + 1 - 4) / 4) * 4
          scrollElement.scrollTo({ top: targetRow * rowHeight, behavior: 'smooth' })
        }
        
        // Check horizontal visibility
        const columnWidth = getColumnWidth()
        const firstColumnWidth = 12.64 * (window.innerWidth / 100)
        const cellLeft = firstColumnWidth + (newCell.position * columnWidth)
        const cellRight = cellLeft + (newCell.width * columnWidth)
        const viewportLeft = scrollElement.scrollLeft + firstColumnWidth
        const viewportRight = viewportLeft + scrollElement.clientWidth - firstColumnWidth
        
        if (cellLeft < viewportLeft) {
          // Scroll left to show cell
          const targetColumn = Math.floor(newCell.position / 4) * 4
          scrollElement.scrollTo({ left: targetColumn * columnWidth, behavior: 'smooth' })
        } else if (cellRight > viewportRight) {
          // Scroll right to show cell
          const targetColumn = Math.ceil((newCell.position + newCell.width - 4) / 4) * 4
          scrollElement.scrollTo({ left: targetColumn * columnWidth, behavior: 'smooth' })
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusedCell, categories, categoryStreams, showTopBlanks, rowLayouts])

  // Clear focus on mouse click
  useEffect(() => {
    const handleClick = () => {
      setFocusedCell(null)
    }
    
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  // Detect scrolling to pause category text animation
  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    const handleScroll = () => {
      setIsScrolling(true)
      clearTimeout(scrollTimeoutRef.current)
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false)
      }, 150)
      
      // Sync right edge overlay with scroll
      const rightEdgeOverlay = document.getElementById('right-edge-overlay')
      const rightEdgeOverlayBg = document.getElementById('right-edge-overlay-bg')
      const scrollTop = scrollElement.scrollTop
      
      if (rightEdgeOverlay) {
        rightEdgeOverlay.style.transform = `translate3d(0, ${-scrollTop}px, 0)`
        rightEdgeOverlay.style.webkitTransform = `translate3d(0, ${-scrollTop}px, 0)`
      }
      
      if (rightEdgeOverlayBg) {
        rightEdgeOverlayBg.style.transform = `translate3d(0, ${-scrollTop}px, 0)`
        rightEdgeOverlayBg.style.webkitTransform = `translate3d(0, ${-scrollTop}px, 0)`
      }
    }

    scrollElement.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeoutRef.current)
    }
  }, [])

  // Detect text overflow and add animation class
  useEffect(() => {
    let resizeTimeout
    let checkTimeout
    
    const checkOverflow = () => {
      // Small delay to let DOM update after resize
      clearTimeout(checkTimeout)
      checkTimeout = setTimeout(() => {
        const newOverflowing = new Set()
        const containers = document.querySelectorAll('.category-text-container')
        
        containers.forEach((container, index) => {
          const textElement = container.querySelector('.category-scroll-text')
          if (textElement) {
            // Get the category name from the title attribute
            const categoryName = textElement.getAttribute('title')
            
            // Add 10px padding buffer to ensure we catch text that's close to overflowing
            const isOverflowing = textElement.scrollWidth > (container.clientWidth + 10)
            
            if (isOverflowing) {
              textElement.classList.add('overflow')
              if (categoryName) {
                newOverflowing.add(categoryName)
              }
            } else {
              textElement.classList.remove('overflow')
            }
          }
        })
        
        setOverflowingCategories(newOverflowing)
      }, 50)
    }

    // Debounced resize handler
    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        // Wait for any active animations to complete before checking
        const animatingElements = document.querySelectorAll('.category-scroll-text.overflow.visible')
        
        if (animatingElements.length > 0) {
          // Listen for animation end on any animating element
          const handleAnimationEnd = () => {
            checkOverflow()
            animatingElements.forEach(el => {
              el.removeEventListener('animationiteration', handleAnimationEnd)
            })
          }
          
          // Check on next animation iteration (when it loops)
          animatingElements.forEach(el => {
            el.addEventListener('animationiteration', handleAnimationEnd, { once: true })
          })
          
          // Also set a fallback timeout in case no animations are running
          setTimeout(checkOverflow, 200)
        } else {
          // No animations running, check immediately
          checkOverflow()
        }
      }, 150)
    }

    // Check on mount and when categories change
    checkOverflow()
    
    // Add debounced resize listener
    window.addEventListener('resize', handleResize)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimeout)
      clearTimeout(checkTimeout)
    }
  }, [categories, isLoadingCategories])

  // Use Intersection Observer to restart animation when cells come into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const textElement = entry.target
          if (entry.isIntersecting) {
            // Element is visible - restart animation by removing and re-adding class
            textElement.classList.remove('visible')
            // Force reflow
            void textElement.offsetWidth
            textElement.classList.add('visible')
          } else {
            // Element is not visible - remove class
            textElement.classList.remove('visible')
          }
        })
      },
      {
        root: scrollRef.current,
        threshold: 0.1
      }
    )

    // Observe all category text elements
    const observeElements = () => {
      const textElements = document.querySelectorAll('.category-scroll-text.overflow')
      textElements.forEach((el) => observer.observe(el))
    }

    observeElements()

    // Re-observe when categories change
    const timeoutId = setTimeout(observeElements, 100)

    return () => {
      observer.disconnect()
      clearTimeout(timeoutId)
    }
  }, [categories, overflowingCategories])

  // Clear DVD logo state when user interacts (not automatically)
  useEffect(() => {
    const clearDvdState = () => {
      if (!showDvdLogo) {
        sessionStorage.removeItem('dvdLogoActive')
        sessionStorage.removeItem('dvdPosition')
        sessionStorage.removeItem('dvdVelocity')
        sessionStorage.removeItem('dvdLogoColor')
      }
    }

    // Clear state when logo is hidden due to user interaction
    if (!showDvdLogo && sessionStorage.getItem('dvdLogoActive') === 'true') {
      clearDvdState()
    }
  }, [showDvdLogo])

  // Save DVD logo state continuously when active
  useEffect(() => {
    if (!showDvdLogo) return

    const saveDvdState = () => {
      sessionStorage.setItem('dvdLogoActive', 'true')
      sessionStorage.setItem('dvdPosition', JSON.stringify(dvdPosition))
      sessionStorage.setItem('dvdVelocity', JSON.stringify(dvdVelocity))
      sessionStorage.setItem('dvdLogoColor', dvdLogoColor)
    }

    // Save immediately when state changes
    saveDvdState()

    // Also save periodically
    const saveInterval = setInterval(saveDvdState, 100)

    // Save before page unload
    const handleBeforeUnload = () => {
      saveDvdState()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearInterval(saveInterval)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [showDvdLogo, dvdPosition, dvdVelocity, dvdLogoColor])

  // DVD Logo idle animation - DISABLED (replaced by Logo Bouncer)
  // useEffect(() => {
  //   ... idle animation code disabled
  // }, [])

  // DVD Logo bouncing animation
  useEffect(() => {
    if (!showDvdLogo) {
      if (dvdAnimationRef.current) {
        cancelAnimationFrame(dvdAnimationRef.current)
      }
      return
    }

    const logoWidthVw = 15 // percentage of viewport width
    // Use fixed aspect ratio for logo height - assuming roughly 1:1 aspect ratio
    const logoHeightVw = 15 // Same as width for square logo
    // Convert to vh for vertical bounds
    const logoHeightVh = (logoHeightVw * window.innerWidth) / window.innerHeight

    const animate = () => {
      setDvdPosition(prev => {
        let newX = prev.x + dvdVelocity.x
        let newY = prev.y + dvdVelocity.y
        let newVelX = dvdVelocity.x
        let newVelY = dvdVelocity.y
        let bouncedX = false
        let bouncedY = false

        // Check horizontal bounds (in vw)
        if (newX <= 0) {
          newVelX = Math.abs(newVelX)
          newX = 0
          bouncedX = true
        } else if (newX >= 100 - logoWidthVw) {
          newVelX = -Math.abs(newVelX)
          newX = 100 - logoWidthVw
          bouncedX = true
        }

        // Check vertical bounds (in vh) - use tighter bounds
        if (newY <= 0) {
          newVelY = Math.abs(newVelY)
          newY = 0
          bouncedY = true
        } else if (newY >= 100 - logoHeightVh) {
          newVelY = -Math.abs(newVelY)
          newY = 100 - logoHeightVh
          bouncedY = true
        }

        // Update velocity if changed
        if (newVelX !== dvdVelocity.x || newVelY !== dvdVelocity.y) {
          setDvdVelocity({ x: newVelX, y: newVelY })
        }

        // Change color on bounce (only if it's a new bounce)
        if ((bouncedX && !lastBounceRef.current.x) || (bouncedY && !lastBounceRef.current.y)) {
          setDvdLogoColor(current => current === 'color' ? 'white' : 'color')
        }

        // Update bounce tracking
        lastBounceRef.current = { x: bouncedX, y: bouncedY }

        return { x: newX, y: newY }
      })

      dvdAnimationRef.current = requestAnimationFrame(animate)
    }

    dvdAnimationRef.current = requestAnimationFrame(animate)

    return () => {
      if (dvdAnimationRef.current) {
        cancelAnimationFrame(dvdAnimationRef.current)
      }
    }
  }, [showDvdLogo, dvdVelocity])

  // Logo Bouncer - Handle count changes
  useEffect(() => {
    const currentCount = bouncingLogos.length
    const targetCount = Math.min(settingsLogoBouncerCount, 20) // Max 20
    
    if (targetCount > currentCount) {
      // Add new logos
      const newLogos = []
      for (let i = currentCount; i < targetCount; i++) {
        // Random direction for velocity (matching DVD logo speed)
        const vxDirection = Math.random() < 0.5 ? -1 : 1
        const vyDirection = Math.random() < 0.5 ? -1 : 1
        
        newLogos.push({
          id: Date.now() + i,
          x: Math.random() * 85 + 5, // Random position 5-90%
          y: Math.random() * 85 + 5,
          vx: 0.1875 * vxDirection, // Same speed as DVD logo
          vy: 0.125 * vyDirection,
          currentImageIndex: Math.floor(Math.random() * logoImages.length) // Random starting image
        })
      }
      setBouncingLogos(prev => [...prev, ...newLogos])
    } else if (targetCount < currentCount) {
      // Remove logos
      setBouncingLogos(prev => prev.slice(0, targetCount))
    }
  }, [settingsLogoBouncerCount])

  // Logo Bouncer - Animation loop
  useEffect(() => {
    if (bouncingLogos.length === 0) {
      if (logoAnimationFrameRef.current) {
        cancelAnimationFrame(logoAnimationFrameRef.current)
      }
      return
    }

    bouncingLogosRef.current = bouncingLogos

    const logoWidthVw = 15 // Same size as DVD logo
    const logoHeightVw = 15
    const logoHeightVh = (logoHeightVw * window.innerWidth) / window.innerHeight

    const animate = () => {
      setBouncingLogos(prevLogos => {
        return prevLogos.map(logo => {
          let newX = logo.x + logo.vx
          let newY = logo.y + logo.vy
          let newVx = logo.vx
          let newVy = logo.vy
          let newImageIndex = logo.currentImageIndex

          // Check horizontal bounds (in vw) - same as DVD logo
          if (newX <= 0) {
            newVx = Math.abs(newVx)
            newX = 0
            newImageIndex = (logo.currentImageIndex + 1) % logoImages.length
          } else if (newX >= 100 - logoWidthVw) {
            newVx = -Math.abs(newVx)
            newX = 100 - logoWidthVw
            newImageIndex = (logo.currentImageIndex + 1) % logoImages.length
          }

          // Check vertical bounds (in vh) - same as DVD logo
          if (newY <= 0) {
            newVy = Math.abs(newVy)
            newY = 0
            newImageIndex = (logo.currentImageIndex + 1) % logoImages.length
          } else if (newY >= 100 - logoHeightVh) {
            newVy = -Math.abs(newVy)
            newY = 100 - logoHeightVh
            newImageIndex = (logo.currentImageIndex + 1) % logoImages.length
          }

          return {
            ...logo,
            x: newX,
            y: newY,
            vx: newVx,
            vy: newVy,
            currentImageIndex: newImageIndex
          }
        })
      })

      logoAnimationFrameRef.current = requestAnimationFrame(animate)
    }

    logoAnimationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (logoAnimationFrameRef.current) {
        cancelAnimationFrame(logoAnimationFrameRef.current)
      }
    }
  }, [bouncingLogos.length])

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
  // We need exactly 4 rows to fit perfectly in the visible area
  // Each row: (50vh - 4vw) / 4
  
  // All rows including header should be equal height
  // Visible area = 50vh, divided by 5 rows (1 header + 4 content rows)
  const headerRowHeight = 'calc(50vh / 5)'
  const typicalRowHeight = 'calc(50vh / 5)'
  // Dynamic border width based on row height (proportional sizing)
  const borderWidth = 'calc((50vh / 5) * 0.10)' // 10% of row height for visible bevel
  // Miter offset for clip-path (same as border width, expressed as percentage of row height)
  const miterOffset = '10%' // 10% of element height for the angled cut
  
  // Font sizing based on container heights
  // Header row (4vw): 1 line of text with padding = 70% of height for text, reduced by 20%
  const headerFontSize = 'calc(4vw * 0.7 * 0.8)'
  
  // Regular cells: 2 lines of text with padding = 40% of height per line
  const cellFontSize = 'calc(((50vh - 4vw) / 4) * 0.4)'
  
  // Top quadrant text (50vh / 5 lines = 10vh per line with spacing) - reduced by 30%
  const quadrantFontSize = 'calc((50vh / 6) * 0.7)'
  
  const cellStyle = {
    fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
    fontWeight: 700,
    fontStretch: 'condensed',
    fontSize: cellFontSize,
    lineHeight: '1',
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
    fontSize: headerFontSize,
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
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      backgroundColor: '#1B0731',
      padding: '0 2.6vw 1.3vw 2.6vw',
      boxSizing: 'border-box'
    }}>
      {/* Top Half - Two Quadrants */}
      <div style={{
        display: 'flex',
        height: '50%',
        width: '100%',
        gap: 0
      }}>
        {/* Top Left Quadrant - Video Player (NO CRT effects) */}
        <div style={{
          width: '50%',
          height: '100%',
          backgroundColor: '#000',
          position: 'relative',
          zIndex: 100
        }}>
          <TwitchPlayer 
            channel={featuredStream?.user_login}
          />
        </div>

        {/* Top Right Quadrant - Stream Info (WITH CRT effects) */}
        <div className="crt-container barrel-distortion" style={{
          width: '50%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-evenly',
          alignItems: 'center',
          filter: 'blur(calc(0.025vw + 0.025vh))',
          imageRendering: 'pixelated'
        }}>
          {/* TTV Guide Logo */}
          <img 
            src="/images/ttv-guide-logo.png"
            alt="TTV Guide Logo"
            onClick={() => setShowSettings(!showSettings)}
            style={{
              position: 'absolute',
              bottom: '0.5vw',
              right: '0.5vw',
              width: `calc(${typicalColumnWidth} * 0.4)`,
              height: 'auto',
              objectFit: 'contain',
              zIndex: 10,
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
          />
          
          {/* Settings Menu */}
          {showSettings && (
            <div style={{
              position: 'absolute',
              top: '1vw',
              right: '1vw',
              left: '1vw',
              height: 'calc(100% - 2vw)',
              backgroundColor: '#674D82',
              borderRadius: '2vw',
              border: `${borderWidth} solid rgba(255, 255, 255, 0.6)`,
              boxShadow: '0 0 2vw rgba(0, 0, 0, 0.8)',
              zIndex: 100,
              padding: '2vw',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: '2vw',
              overflow: 'hidden'
            }}>
              {/* X Close Button - Top Right */}
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  position: 'absolute',
                  top: '1vw',
                  right: '1vw',
                  width: '2.8vw',
                  height: '2.8vw',
                  fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
                  fontWeight: 700,
                  fontSize: 'calc(1.68vw + 1.68vh)',
                  lineHeight: 1,
                  color: 'white',
                  textShadow: '2px 2px 0px rgba(0, 0, 0, 0.9)',
                  backgroundColor: '#423352',
                  border: '2px solid rgba(255, 255, 255, 0.6)',
                  borderRadius: '0.5vw',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
              >
                ×
              </button>
              
              <div style={{
                fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
                fontWeight: 700,
                fontSize: headerFontSize,
                color: 'white',
                textShadow: '4px 4px 0px rgba(0, 0, 0, 0.9)',
                marginBottom: '1vw'
              }}>
                Settings
              </div>
              
              {/* Extra CRT Checkbox */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1vw',
                fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
                fontWeight: 700,
                fontSize: 'calc(1.68vw + 1.68vh)',
                color: 'white',
                textShadow: '2px 2px 0px rgba(0, 0, 0, 0.9)',
                cursor: 'pointer'
              }}>
                <input 
                  type="checkbox"
                  checked={settingsCrtEnabled}
                  onChange={(e) => setSettingsCrtEnabled(e.target.checked)}
                  style={{
                    width: '1.68vw',
                    height: '1.68vw',
                    cursor: 'pointer'
                  }}
                />
                Extra CRT
              </label>
              
              {/* Logo Bouncer Number Input */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1vw',
                fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
                fontWeight: 700,
                fontSize: 'calc(1.68vw + 1.68vh)',
                color: 'white',
                textShadow: '2px 2px 0px rgba(0, 0, 0, 0.9)'
              }}>
                <span>Logo Bouncer</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5vw' }}>
                  <button
                    onClick={() => setSettingsLogoBouncerCount(Math.max(0, settingsLogoBouncerCount - 1))}
                    style={{
                      width: '2.24vw',
                      height: '2.24vw',
                      fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
                      fontWeight: 700,
                      fontSize: 'calc(1.68vw + 1.68vh)',
                      lineHeight: 1,
                      color: 'white',
                      textShadow: '2px 2px 0px rgba(0, 0, 0, 0.9)',
                      backgroundColor: '#423352',
                      border: '2px solid rgba(255, 255, 255, 0.6)',
                      borderRadius: '0.5vw',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0
                    }}
                  >
                    −
                  </button>
                  <div style={{
                    width: '3.36vw',
                    height: '2.24vw',
                    backgroundColor: '#423352',
                    border: '2px solid rgba(255, 255, 255, 0.6)',
                    borderRadius: '0.5vw',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'calc(1.68vw + 1.68vh)',
                    lineHeight: 1,
                    color: 'white',
                    textShadow: '2px 2px 0px rgba(0, 0, 0, 0.9)'
                  }}>
                    {settingsLogoBouncerCount}
                  </div>
                  <button
                    onClick={() => setSettingsLogoBouncerCount(Math.min(20, settingsLogoBouncerCount + 1))}
                    style={{
                      width: '2.24vw',
                      height: '2.24vw',
                      fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
                      fontWeight: 700,
                      fontSize: 'calc(1.68vw + 1.68vh)',
                      lineHeight: 1,
                      color: 'white',
                      textShadow: '2px 2px 0px rgba(0, 0, 0, 0.9)',
                      backgroundColor: '#423352',
                      border: '2px solid rgba(255, 255, 255, 0.6)',
                      borderRadius: '0.5vw',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}
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
            fontSize: quadrantFontSize,
            color: 'white',
            textShadow: '4px 4px 0px rgba(0, 0, 0, 0.9)',
            zIndex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '90%',
            padding: '0 2vw'
          }}>
            {featuredStream ? featuredStream.categoryName : 'Category'}
          </div>
          <div style={{
            fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
            fontWeight: 700,
            fontStretch: 'condensed',
            fontSize: quadrantFontSize,
            color: '#E3E07D',
            textShadow: '4px 4px 0px rgba(0, 0, 0, 0.9)',
            zIndex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '90%',
            padding: '0 2vw'
          }}>
            {featuredStream ? featuredStream.user_name : 'StreamerName'}
          </div>
          <div style={{
            fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
            fontWeight: 700,
            fontStretch: 'condensed',
            fontSize: quadrantFontSize,
            color: 'white',
            textShadow: '4px 4px 0px rgba(0, 0, 0, 0.9)',
            zIndex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '90%',
            padding: '0 2vw'
          }}>
            {today}
          </div>
          <div style={{
            fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
            fontWeight: 700,
            fontStretch: 'condensed',
            fontSize: quadrantFontSize,
            color: 'white',
            textShadow: '4px 4px 0px rgba(0, 0, 0, 0.9)',
            zIndex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '90%',
            padding: '0 2vw'
          }}>
            {featuredStream ? `Channel ${featuredStream.categoryRank}` : 'Channel'}
          </div>
        </div>
      </div>

      {/* Bottom Half - TV Guide Grid (WITH CRT effects) */}
      <div className="crt-container barrel-distortion" style={{
        height: '50%',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        filter: 'blur(calc(0.025vw + 0.025vh))',
        imageRendering: 'pixelated'
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
              borderTop: `${borderWidth} solid rgba(255, 255, 255, 0.6)`,
              borderLeft: `${borderWidth} solid rgba(255, 255, 255, 0.6)`,
              borderBottom: `${borderWidth} solid rgba(0, 0, 0, 0.6)`,
              borderRight: `${borderWidth} solid rgba(0, 0, 0, 0.6)`,
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
            zIndex: 20,
            backgroundColor: '#1B0731',
            display: 'flex',
            pointerEvents: 'none'
          }}
        >
          {/* Ad Banner Button - spans 2 cells */}
          <button 
            onClick={() => window.open('https://devpost.com/software/vibeguide', '_blank')}
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
                borderTop: `${borderWidth} solid rgba(255, 255, 255, 0.6)`,
                borderLeft: `${borderWidth} solid rgba(255, 255, 255, 0.6)`,
                borderBottom: `${borderWidth} solid rgba(0, 0, 0, 0.6)`,
                borderRight: `${borderWidth} solid rgba(0, 0, 0, 0.6)`,
                zIndex: -1,
                transition: 'background-color 0.2s ease'
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
                borderTop: `${borderWidth} solid rgba(255, 255, 255, 0.6)`,
                borderLeft: `${borderWidth} solid rgba(255, 255, 255, 0.6)`,
                borderBottom: `${borderWidth} solid rgba(0, 0, 0, 0.6)`,
                borderRight: `${borderWidth} solid rgba(0, 0, 0, 0.6)`,
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
                Happy Kiroween! Catch a vibe with TTV Guide!  ///  Login to see your followers, click to preview a stream and get the full experience on Twitch!  ///  Stay idle for the old-school TTV Guide experience!  ///  Leave a like on our Kiroween Devpost submission!  ///  Happy Kiroween! Catch a vibe with TTV Guide!  ///  Login to see your followers, click to preview a stream and get the full experience on Twitch!  ///  Stay idle for the old-school TTV Guide experience!  ///  Leave a like on our Kiroween Devpost submission!  ///  
              </span>
            </div>
          </button>
          {/* Login Button */}
          <button 
            className="login-button" 
            onClick={user ? handleLogout : handleLogin}
            style={{
              fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
              fontWeight: 700,
              fontStretch: 'condensed',
              fontSize: headerFontSize,
              color: 'white',
              textShadow: '4px 4px 0px rgba(0, 0, 0, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: headerRowHeight,
              minHeight: headerRowHeight,
              flex: 1,
              position: 'relative',
              cursor: 'pointer',
              pointerEvents: 'auto',
              border: 'none',
              background: 'none',
              marginRight: '-5px'
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
                borderTop: `${borderWidth} solid rgba(255, 255, 255, 0.6)`,
                borderLeft: `${borderWidth} solid rgba(255, 255, 255, 0.6)`,
                borderBottom: `${borderWidth} solid rgba(0, 0, 0, 0.6)`,
                borderRight: `${borderWidth} solid rgba(0, 0, 0, 0.6)`,
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
              padding: '0 15px 0 10px'
            }}>
              {user ? 'Logout' : 'Login'}
            </span>
          </button>
        </div>
        
        {/* Static Header Row Right Edge - Purple Background */}
        <div style={{
          position: 'absolute',
          top: 0,
          right: '-1px',
          width: borderWidth,
          height: headerRowHeight,
          backgroundColor: '#674D82',
          clipPath: `polygon(0 ${miterOffset}, 100% 0, 100% 100%, 0 100%)`,
          zIndex: 9998,
          pointerEvents: 'none'
        }} />
        
        {/* Static Header Row Right Edge - Dark Shadow */}
        <div style={{
          position: 'absolute',
          top: 0,
          right: '-1px',
          width: borderWidth,
          height: headerRowHeight,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          clipPath: `polygon(0 ${miterOffset}, 100% 0, 100% 100%, 0 100%)`,
          zIndex: 9999,
          pointerEvents: 'none'
        }} />
        
        {/* COMMENTED OUT - Old external scrolling elements - now inside grid rows */}
        {/* <div 
          id="right-edge-overlay-bg"
          style={{
            position: 'absolute',
            top: 0,
            right: '-1px',
            width: '6px',
            height: '100%',
            zIndex: 3,
            pointerEvents: 'none',
            willChange: 'transform',
            clipPath: `inset(${headerRowHeight} 0 0 0)`
          }}
        >
          {Array.from({ length: 60 }).map((_, rowIndex) => (
            <div 
              key={`right-edge-bg-${rowIndex}`}
              style={{
                position: 'absolute',
                top: `calc(${headerRowHeight} + ${typicalRowHeight} * ${rowIndex})`,
                left: 0,
                width: '100%',
                height: typicalRowHeight,
                backgroundColor: '#423352',
                clipPath: `polygon(0 ${miterOffset}, 100% 0, 100% 100%, 0 100%)`,
                boxSizing: 'border-box'
              }}
            />
          ))}
        </div>
        
        <div 
          id="right-edge-overlay"
          style={{
            position: 'absolute',
            top: 0,
            right: '-1px',
            width: '6px',
            height: '100%',
            zIndex: 4,
            pointerEvents: 'none',
            willChange: 'transform',
            clipPath: `inset(${headerRowHeight} 0 0 0)`
          }}
        >
          {Array.from({ length: 60 }).map((_, rowIndex) => (
            <div 
              key={`right-edge-${rowIndex}`}
              style={{
                position: 'absolute',
                top: `calc(${headerRowHeight} + ${typicalRowHeight} * ${rowIndex})`,
                left: 0,
                width: '100%',
                height: typicalRowHeight,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                clipPath: `polygon(0 ${miterOffset}, 100% 0, 100% 100%, 0 100%)`,
                boxSizing: 'border-box'
              }}
            />
          ))}
        </div> */}
        
        {/* Scrollable Content Area with hidden scrollbars */}
        <div 
          ref={scrollRef}
          className={`scrollable-grid ${isScrolling ? 'scrolling' : ''}`}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflowX: 'auto',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            touchAction: 'pan-y'
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
            
            // Determine if this is a blank row for first column
            const isTopBlank = showTopBlanks && rowIndex < 4
            const isBottomBlank = rowIndex >= (showTopBlanks ? 54 : 50)
            const isBlank = isTopBlank || isBottomBlank
            const channelNum = isBlank ? '' : (rowIndex - channelRowOffset + 1)
            
            // Get category name for this channel
            const categoryName = !isBlank && categories[categoryIndex] 
              ? categories[categoryIndex].name 
              : 'CATEGORY'
            
            return (
              <div key={rowIndex} style={{
                position: 'absolute',
                top: `calc(${headerRowHeight} + ${typicalRowHeight} * ${rowIndex})`,
                left: 0,
                height: typicalRowHeight,
                display: 'flex',
                gap: '0',
                border: isBlankRow ? 'none' : undefined
              }}>
                {/* First Column - Sticky */}
                <a 
                  href={!isBlank && category ? `https://www.twitch.tv/directory/category/${encodeURIComponent(category.name.toLowerCase().replace(/\s+/g, '-'))}` : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...firstColumnStyle, 
                    height: typicalRowHeight,
                    width: firstColumnWidth,
                    minWidth: firstColumnWidth,
                    maxWidth: firstColumnWidth,
                    position: 'sticky',
                    left: 0,
                    flexDirection: 'column',
                    gap: '0.2vh',
                    padding: '0 0.5vw',
                    backgroundColor: '#1B0731',
                    zIndex: 3,
                    overflow: 'hidden',
                    textDecoration: 'none',
                    cursor: !isBlank && category ? 'pointer' : 'default',
                    pointerEvents: !isBlank && category ? 'auto' : 'none'
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#312043',
                    borderTop: `${borderWidth} solid rgba(255, 255, 255, 0.6)`,
                    borderLeft: `${borderWidth} solid rgba(255, 255, 255, 0.6)`,
                    borderBottom: `${borderWidth} solid rgba(0, 0, 0, 0.6)`,
                    borderRight: `${borderWidth} solid rgba(0, 0, 0, 0.6)`,
                    boxSizing: 'border-box',
                    zIndex: -1
                  }} />
                  {!isBlank && (
                    <>
                      <span style={{ position: 'relative', zIndex: 1 }}>CH {channelNum}</span>
                      <div 
                        className="category-text-container"
                        style={{ 
                          position: 'relative', 
                          zIndex: 1, 
                          fontSize: 'calc(((50vh - 4vw) / 4) * 0.25)',
                          width: '100%',
                          overflow: 'hidden',
                          display: 'flex',
                          justifyContent: overflowingCategories.has(categoryName) ? 'flex-start' : 'center'
                        }}
                      >
                        <span 
                          className="category-scroll-text"
                          style={{ 
                            whiteSpace: 'nowrap',
                            display: 'inline-block',
                            textAlign: 'center',
                            paddingLeft: overflowingCategories.has(categoryName) ? '10px' : '0'
                          }}
                          title={categoryName}
                          data-category={categoryName}
                        >
                          {isLoadingCategories 
                            ? 'Loading...' 
                            : overflowingCategories.has(categoryName)
                              ? `${categoryName}  ///  ${categoryName}  ///  ${categoryName}  ///  ${categoryName}  ///  `
                              : categoryName
                          }
                        </span>
                      </div>
                    </>
                  )}
                </a>
                
                {blocks.map((block, blockIndex) => {
                // For blank blocks, calculate width to span all visible columns
                const blockWidth = block.isBlank 
                  ? `calc(${typicalColumnWidth} * 15)` // Span 15 columns (enough to cover visible area)
                  : `calc(${typicalColumnWidth} * ${block.width})`
                
                // Render blank blocks with sticky ad
                if (block.isBlank) {
                  return (
                    <button 
                      key={block.id}
                      className="show-button blank-row-ad"
                      style={{
                        height: typicalRowHeight,
                        width: blockWidth,
                        minWidth: blockWidth,
                        boxSizing: 'border-box',
                        position: 'sticky',
                        left: firstColumnWidth,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        overflow: 'hidden',
                        pointerEvents: 'auto',
                        zIndex: 2
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
                          borderTop: `${borderWidth} solid rgba(255, 255, 255, 0.6)`,
                          borderLeft: `${borderWidth} solid rgba(255, 255, 255, 0.6)`,
                          borderBottom: `${borderWidth} solid rgba(0, 0, 0, 0.6)`,
                          borderRight: `${borderWidth} solid rgba(0, 0, 0, 0.6)`,
                          boxSizing: 'border-box',
                          zIndex: -1,
                          transition: 'background-color 0.2s ease'
                        }} 
                      />
                      <img 
                        src={`/images/ad-row-${adImageNumber}.png`}
                        alt={`Advertisement ${adImageNumber}`}
                        style={{
                          position: 'absolute',
                          top: borderWidth,
                          left: borderWidth,
                          right: borderWidth,
                          bottom: borderWidth,
                          width: `calc(100% - ${borderWidth} * 2)`,
                          height: `calc(100% - ${borderWidth} * 2)`,
                          objectFit: 'contain',
                          objectPosition: 'left center',
                          pointerEvents: 'none',
                          zIndex: 1
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
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
                
                // Check if this cell is focused
                const isFocused = focusedCell && 
                  focusedCell.rowIndex === rowIndex && 
                  focusedCell.blockIndex === blockIndex
                
                // Regular show blocks as buttons
                return (
                  <button 
                    key={block.id} 
                    className={`show-button ${isFocused ? 'show-button-focused' : ''}`}
                    onClick={handleStreamClick}
                    disabled={!stream}
                    style={{
                      fontFamily: "'Barlow Condensed', 'Futura', 'Futura Bold Condensed', sans-serif",
                      fontWeight: 700,
                      fontStretch: 'condensed',
                      fontSize: cellFontSize,
                      lineHeight: '1',
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
                        borderTop: `${borderWidth} solid rgba(255, 255, 255, 0.6)`,
                        borderLeft: `${borderWidth} solid rgba(255, 255, 255, 0.6)`,
                        borderBottom: `${borderWidth} solid rgba(0, 0, 0, 0.6)`,
                        borderRight: `${borderWidth} solid rgba(0, 0, 0, 0.6)`,
                        boxSizing: 'border-box',
                        zIndex: -1,
                        transition: 'background-color 0.2s ease'
                      }} 
                    />
                    <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.5vw' }}>
                      {isLoadingStreams 
                        ? 'Loading...' 
                        : streams && streams[block.streamIndex] 
                          ? (
                            <>
                              {streams[block.streamIndex].user_name}
                              {user && followedChannels.has(streams[block.streamIndex].user_login) && (
                                <span 
                                  style={{ 
                                    color: '#674D82',
                                    fontSize: 'clamp(18px, 1.8vw, 54px)',
                                    textShadow: '4px 4px 0px rgba(0, 0, 0, 0.9)',
                                    lineHeight: 1,
                                    marginLeft: '0.3vw',
                                    display: 'inline-block',
                                    verticalAlign: 'middle'
                                  }}
                                  aria-label="Followed channel"
                                >
                                  ♥
                                </span>
                              )}
                            </>
                          )
                          : 'No Stream'}
                    </span>
                  </button>
                )
                })}
                
                {/* Right Edge Elements for this row - Sticky to viewport */}
                <div style={{
                  position: 'sticky',
                  top: 0,
                  right: '-1px',
                  width: borderWidth,
                  height: '100%',
                  pointerEvents: 'none',
                  marginLeft: 'auto',
                  zIndex: 10
                }}>
                  {/* Purple Background */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#423352',
                    clipPath: `polygon(0 ${miterOffset}, 100% 0, 100% 100%, 0 100%)`
                  }} />
                  {/* Dark Shadow */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    clipPath: `polygon(0 ${miterOffset}, 100% 0, 100% 100%, 0 100%)`
                  }} />
                </div>
              </div>
            )
          })}


        </div>
      </div>
      
      {/* Scanlines Overlay - Behind video player */}
      <div className="scanlines" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10001,
        background: 'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.15) 0px, rgba(0, 0, 0, 0.15) 1px, transparent 1px, transparent 2px)',
        animation: 'scanline-flicker 0.1s infinite'
      }} />
      
      {/* VHS Tracking Lines */}
      <div className="vhs-tracking" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10001,
        background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255, 255, 255, 0.03) 2px, rgba(255, 255, 255, 0.03) 3px, transparent 3px, transparent 8px)',
        animation: 'vhs-tracking 8s linear infinite'
      }} />
      
      {/* VHS Horizontal Displacement Glitch */}
      <div className="vhs-displacement" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10001,
        background: 'linear-gradient(to bottom, transparent 0%, transparent 30%, rgba(0, 0, 0, 0.02) 30%, rgba(0, 0, 0, 0.02) 32%, transparent 32%, transparent 100%)',
        animation: 'vhs-horizontal-shake 4s infinite'
      }} />
      
      {/* VHS Vertical Jitter */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10001,
        animation: 'vhs-vertical-jitter 0.3s infinite'
      }} />
      
      {/* VHS Reduced Color Saturation */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10001,
        filter: 'saturate(0.85) contrast(1.05)',
        mixBlendMode: 'normal'
      }} />
      
      {/* VHS RGB Chromatic Aberration */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10001,
        background: 'transparent',
        animation: 'vhs-chromatic-aberration 5s infinite'
      }} />
      
      {/* VHS Color Noise in Dark Areas */}
      <div className="vhs-noise" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10001,
        opacity: 0.08,
        mixBlendMode: 'overlay',
        animation: 'vhs-noise 0.2s infinite'
      }} />
      
      {/* VHS Tape Roll - Only when Extra CRT is enabled */}
      {settingsCrtEnabled && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '300%',
          pointerEvents: 'none',
          zIndex: 10001,
          background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 49%, rgba(0, 0, 0, 0.3) 49%, rgba(0, 0, 0, 0.3) 51%, transparent 51%, transparent 100%)',
          backgroundSize: '100% 33.33%',
          animation: 'vhs-tape-roll 20s infinite',
          opacity: 0.6
        }} />
      )}
      
      {/* Phosphor Persistence - Ghosting/trailing effect - Only when Extra CRT is enabled */}
      {settingsCrtEnabled && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10000,
          background: 'linear-gradient(to bottom, rgba(0, 255, 100, 0.03) 0%, rgba(0, 255, 100, 0.02) 50%, rgba(0, 255, 100, 0.01) 100%)',
          mixBlendMode: 'screen',
          animation: 'phosphor-fade 2s ease-in-out infinite alternate'
        }} />
      )}
      
      {/* 11. Magnetic Interference - Wavy distortion bands - Only when Extra CRT is enabled */}
      {settingsCrtEnabled && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10001,
          background: 'repeating-linear-gradient(0deg, transparent 0px, rgba(255, 0, 255, 0.05) 50px, transparent 100px)',
          animation: 'magnetic-interference 8s linear infinite',
          mixBlendMode: 'overlay'
        }} />
      )}
      
      {/* 12. Vignette Darkening - Darker corners like old CRT - Only when Extra CRT is enabled */}
      {settingsCrtEnabled && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10001,
          background: 'radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(0, 0, 0, 0.3) 70%, rgba(0, 0, 0, 0.6) 100%)',
          boxShadow: 'inset 0 0 150px rgba(0, 0, 0, 0.8)'
        }} />
      )}
      
      {/* 13. RGB Convergence Issues - Misaligned color channels at edges - Only when Extra CRT is enabled */}
      {settingsCrtEnabled && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10001,
          background: 'linear-gradient(90deg, rgba(255, 0, 0, 0.1) 0%, transparent 10%, transparent 90%, rgba(0, 0, 255, 0.1) 100%)',
          mixBlendMode: 'screen'
        }} />
      )}
      
      {/* 18. Analog Signal Noise - More pronounced static in dark areas - Only when Extra CRT is enabled */}
      {settingsCrtEnabled && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10001,
          background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.15\'/%3E%3C/svg%3E")',
          opacity: 0.3,
          mixBlendMode: 'overlay',
          animation: 'analog-noise 0.1s infinite'
        }} />
      )}
      
      {/* 19. Chroma Noise - Color speckles in shadows - Only when Extra CRT is enabled */}
      {settingsCrtEnabled && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10001,
          background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'chroma\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'2.5\' numOctaves=\'3\' /%3E%3CfeColorMatrix type=\'hueRotate\' values=\'180\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23chroma)\' opacity=\'0.08\'/%3E%3C/svg%3E")',
          opacity: 0.2,
          mixBlendMode: 'color',
          animation: 'chroma-noise 0.15s infinite'
        }} />
      )}
      
      {/* Luma Noise - brightness flickering */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10001,
        background: 'rgba(255, 255, 255, 0.02)',
        animation: 'luma-flicker 0.08s infinite'
      }} />
      
      {/* Occasional Static Bursts */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10001,
        background: 'repeating-linear-gradient(0deg, transparent 0px, rgba(255, 255, 255, 0.03) 1px, transparent 2px)',
        animation: 'static-burst 12s infinite'
      }} />
      
      {/* DVD Logo Bouncing Animation - DISABLED (replaced by Logo Bouncer) */}
      {/* {showDvdLogo && (
        <div>...</div>
      )} */}
      
      {/* Logo Bouncers */}
      {bouncingLogos.map(logo => (
        <div 
          key={logo.id}
          className="crt-container"
          style={{
            position: 'fixed',
            left: `${logo.x}vw`,
            top: `${logo.y}vh`,
            width: '15vw',
            height: 'auto',
            pointerEvents: 'none',
            zIndex: 10000,
            transition: 'none',
            willChange: 'transform'
          }}>
          <img 
            src={logoImages[logo.currentImageIndex]}
            alt="Bouncing Logo"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.5))'
            }}
          />
        </div>
      ))}
    </div>
  )
}

export default App
