import { useEffect, useRef, useState } from 'react';

const COLORS = ['#674D82', '#E3E07D', '#FF6B9D', '#4ECDC4', '#95E1D3', '#F38181'];
const SPEED = 100; // pixels per second
const LOGO_WIDTH = 120;

const DVDBounce = () => {
  const [color, setColor] = useState(COLORS[0]);
  const [logoSrc, setLogoSrc] = useState(null);
  const [logoError, setLogoError] = useState(false);
  const positionRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef({ x: 1, y: 1 });
  const lastFrameTimeRef = useRef(Date.now());
  const animationFrameRef = useRef(null);
  const logoRef = useRef(null);

  useEffect(() => {
    // Initialize random starting position and velocity direction
    const initX = Math.random() * (window.innerWidth - LOGO_WIDTH);
    const initY = Math.random() * (window.innerHeight - LOGO_WIDTH);
    positionRef.current = { x: initX, y: initY };
    
    // Random initial direction (normalized)
    const angle = Math.random() * Math.PI * 2;
    velocityRef.current = {
      x: Math.cos(angle),
      y: Math.sin(angle)
    };

    // Check for existing logo in /public/images/ directory
    // Priority: custom logo > vite.svg > text fallback
    const checkLogo = async () => {
      // List of potential logo files to check in /public/images/
      const potentialLogos = [
        '/images/logo.png',
        '/images/logo.svg',
        '/images/app-logo.png',
        '/images/app-logo.svg',
      ];

      // Try each potential logo
      for (const logoPath of potentialLogos) {
        try {
          const response = await fetch(logoPath, { method: 'HEAD' });
          if (response.ok) {
            setLogoSrc(logoPath);
            return;
          }
        } catch (error) {
          // Continue to next logo
        }
      }

      // Fallback to vite.svg
      try {
        const response = await fetch('/vite.svg', { method: 'HEAD' });
        if (response.ok) {
          setLogoSrc('/vite.svg');
          return;
        }
      } catch (error) {
        // If vite.svg also fails, logoError will be triggered by img onError
      }

      // If no logo found, set a fallback that will trigger error handler
      setLogoSrc('/vite.svg');
    };
    checkLogo();

    const animate = () => {
      const now = Date.now();
      const deltaTime = (now - lastFrameTimeRef.current) / 1000; // Convert to seconds
      lastFrameTimeRef.current = now;

      const logo = logoRef.current;
      if (!logo) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const logoHeight = logo.offsetHeight || LOGO_WIDTH;
      const logoWidth = logo.offsetWidth || LOGO_WIDTH;

      // Calculate new position
      const deltaX = velocityRef.current.x * SPEED * deltaTime;
      const deltaY = velocityRef.current.y * SPEED * deltaTime;
      
      let newX = positionRef.current.x + deltaX;
      let newY = positionRef.current.y + deltaY;

      // Boundary detection and direction reversal
      let xReversed = false;
      let yReversed = false;

      // Check horizontal boundaries
      if (newX <= 0) {
        newX = 0;
        velocityRef.current.x = Math.abs(velocityRef.current.x);
        xReversed = true;
      } else if (newX + logoWidth >= window.innerWidth) {
        newX = window.innerWidth - logoWidth;
        velocityRef.current.x = -Math.abs(velocityRef.current.x);
        xReversed = true;
      }

      // Check vertical boundaries
      if (newY <= 0) {
        newY = 0;
        velocityRef.current.y = Math.abs(velocityRef.current.y);
        yReversed = true;
      } else if (newY + logoHeight >= window.innerHeight) {
        newY = window.innerHeight - logoHeight;
        velocityRef.current.y = -Math.abs(velocityRef.current.y);
        yReversed = true;
      }

      // Change color when hitting any wall
      if (xReversed || yReversed) {
        const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
        setColor(randomColor);
      }

      // Update position
      positionRef.current = { x: newX, y: newY };

      // Apply transform for GPU acceleration
      logo.style.transform = `translate(${newX}px, ${newY}px)`;

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup on unmount
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleLogoError = () => {
    setLogoError(true);
  };

  return (
    <>
      {/* Dark overlay shade */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          zIndex: 9998,
          pointerEvents: 'none',
        }}
      />
      
      {/* Bouncing logo */}
      <div
        ref={logoRef}
        className="dvd-bounce"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: `${LOGO_WIDTH}px`,
          height: 'auto',
          zIndex: 9999,
          pointerEvents: 'none',
          willChange: 'transform',
        }}
      >
      {logoError ? (
        <div
          style={{
            width: `${LOGO_WIDTH}px`,
            height: `${LOGO_WIDTH}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            fontWeight: 'bold',
            fontFamily: 'Barlow Condensed, sans-serif',
            color: color,
            textShadow: '3px 3px 6px rgba(0,0,0,0.7)',
            letterSpacing: '4px',
            transition: 'color 0.3s ease',
          }}
        >
          VIBE
        </div>
      ) : (
        logoSrc && (
          <div style={{ position: 'relative', width: '100%', height: 'auto' }}>
            <img
              src={logoSrc}
              alt="Bouncing logo"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                filter: `drop-shadow(2px 2px 4px rgba(0,0,0,0.5))`,
              }}
              onError={handleLogoError}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: color,
                mixBlendMode: 'multiply',
                opacity: 0.75,
                pointerEvents: 'none',
                transition: 'background-color 0.3s ease',
              }}
            />
          </div>
        )
      )}
      </div>
    </>
  );
};

export default DVDBounce;
