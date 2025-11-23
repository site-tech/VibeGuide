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
      // Match the CSS calculation: (50vh - 4vw) / 4
      return (50 * vh - 4 * vw) / 4 // typicalRowHeight in pixels
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
      const vw = window.innerWidth / 100
      return (50 * vh - 4 * vw) / 4
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
            const vw = window.innerWidth / 100
            return (50 * vh - 4 * vw) / 4
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
            const vw = window.innerWidth / 100
            return (50 * vh - 4 * vw) / 4
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
          const vw = window.innerWidth / 100
          return (50 * vh - 4 * vw) / 4
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
    }

    scrollElement.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeoutRef.current)
    }
  }, [])

  // Detect text overflow and add animation class
  useEffect(() => {
    const checkOverflow = () => {
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
    }

    // Check on mount and when categories change
    checkOverflow()
    
    // Also check on window resize
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
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

  // DVD Logo idle animation
  useEffect(() => {
    let lastMouseMove = Date.now()
    let lastManualScroll = Date.now()
    
    const resetIdleTimer = () => {
      clearTimeout(dvdIdleTimeoutRef.current)
      setShowDvdLogo(false)
      
      dvdIdleTimeoutRef.current = setTimeout(() => {
        setShowDvdLogo(true)
      }, 15000) // 15 seconds
    }

    const handleMouseMove = () => {
      lastMouseMove = Date.now()
      resetIdleTimer()
    }

    const handleKeyDown = () => {
      resetIdleTimer()
    }

    const handleClick = () => {
      resetIdleTimer()
    }

    const handleScroll = (e) => {
      // Only reset if it's a manual scroll (not auto-scroll)
      // Auto-scroll happens when isAutoScrolling is true
      if (!autoScrollRef.current.isAutoScrolling) {
        const now = Date.now()
        // Debounce scroll events - only reset if it's been more than 100ms since last manual scroll
        if (now - lastManualScroll > 100) {
          lastManualScroll = now
          resetIdleTimer()
        }
      }
    }

    // Only start timer if logo wasn't already active from previous session
    const wasActive = sessionStorage.getItem('dvdLogoActive') === 'true'
    if (!wasActive) {
      resetIdleTimer()
    }

    // Listen for user activity (not auto-scroll)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('click', handleClick)
    
    const scrollElement = scrollRef.current
    if (scrollElement) {
      scrollElement.addEventListener('wheel', handleScroll)
      scrollElement.addEventListener('touchstart', handleScroll)
    }

    return () => {
      clearTimeout(dvdIdleTimeoutRef.current)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('click', handleClick)
      if (scrollElement) {
        scrollElement.removeEventListener('wheel', handleScroll)
        scrollElement.removeEventListener('touchstart', handleScroll)
      }
    }
  }, [])

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
  
  const headerRowHeight = '4vw'
  const typicalRowHeight = 'calc((50vh - 4vw) / 4)'
  
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
        borderRight: '5px solid rgba(0, 0, 0, 0.6)',
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
              borderTop: '5px solid rgba(255, 255, 255, 0.6)',
              borderLeft: '5px solid rgba(255, 255, 255, 0.6)',
              borderBottom: '5px solid rgba(0, 0, 0, 0.6)',
              borderRight: '5px solid rgba(0, 0, 0, 0.6)',
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
                borderBottom: '5px solid rgba(0, 0, 0, 0.6)',
                borderRight: '5px solid rgba(0, 0, 0, 0.6)',
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
                borderTop: '5px solid rgba(255, 255, 255, 0.6)',
                borderLeft: '5px solid rgba(255, 255, 255, 0.6)',
                borderBottom: '5px solid rgba(0, 0, 0, 0.6)',
                borderRight: '5px solid rgba(0, 0, 0, 0.6)',
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
                borderTop: '5px solid rgba(255, 255, 255, 0.6)',
                borderLeft: '5px solid rgba(255, 255, 255, 0.6)',
                borderBottom: '5px solid rgba(0, 0, 0, 0.6)',
                borderRight: '5px solid rgba(0, 0, 0, 0.6)',
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
              {user ? 'Logout' : 'Login'}
            </span>
          </button>
        </div>
        

        

        
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
                <div style={{
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
                  overflow: 'hidden'
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
                    borderBottom: '5px solid rgba(0, 0, 0, 0.6)',
                    borderRight: '5px solid rgba(0, 0, 0, 0.6)',
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
                </div>
                
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
                          borderTop: '5px solid rgba(255, 255, 255, 0.6)',
                          borderLeft: '5px solid rgba(255, 255, 255, 0.6)',
                          borderBottom: '5px solid rgba(0, 0, 0, 0.6)',
                          borderRight: '5px solid rgba(0, 0, 0, 0.6)',
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
                          top: '5px',
                          left: '5px',
                          right: '5px',
                          bottom: '5px',
                          width: 'calc(100% - 10px)',
                          height: 'calc(100% - 10px)',
                          objectFit: 'cover',
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
                        borderTop: '5px solid rgba(255, 255, 255, 0.6)',
                        borderLeft: '5px solid rgba(255, 255, 255, 0.6)',
                        borderBottom: '5px solid rgba(0, 0, 0, 0.6)',
                        borderRight: '5px solid rgba(0, 0, 0, 0.6)',
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
      
      {/* DVD Logo Bouncing Animation */}
      {showDvdLogo && (
        <div 
          className="crt-container"
          style={{
            position: 'fixed',
            left: `${dvdPosition.x}vw`,
            top: `${dvdPosition.y}vh`,
            width: '15vw',
            height: 'auto',
            pointerEvents: 'none',
            zIndex: 10000,
            transition: 'none',
            willChange: 'transform'
          }}>
          <img 
            src={`/images/ttv-guide-logo-${dvdLogoColor}.png`}
            alt="TTV Guide Logo"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.5))'
            }}
          />
        </div>
      )}
    </div>
  )
}

export default App
