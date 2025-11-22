import { useEffect, useState, useRef, useCallback } from "react";
import DVDBounce from "./DVDBounce";

const AFK_TIMEOUT = 60_000; // 60 seconds in milliseconds
const DEBOUNCE_DELAY = 100; // 100ms debounce
const CHECK_INTERVAL = 1000; // Check every second

const FunModeOverlay = ({ isEnabled, children }) => {
  const [isAFK, setIsAFK] = useState(false);
  const lastActivityTimeRef = useRef(Date.now());
  const debounceTimerRef = useRef(null);
  const checkIntervalRef = useRef(null);

  // Debounced activity handler
  const handleActivity = useCallback(() => {
    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      lastActivityTimeRef.current = Date.now();

      // Reset AFK state if currently AFK
      if (isAFK) {
        setIsAFK(false);
      }
    }, DEBOUNCE_DELAY);
  }, [isAFK]);

  useEffect(() => {
    // Activity event listeners
    const passiveEvents = ["mousemove", "touchstart", "wheel"];
    const activeEvents = ["mousedown", "keydown"];

    passiveEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    activeEvents.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // Timer to check AFK status every second
    checkIntervalRef.current = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityTimeRef.current;

      if (timeSinceLastActivity >= AFK_TIMEOUT && !isAFK) {
        setIsAFK(true);
      }
    }, CHECK_INTERVAL);

    // Cleanup on unmount
    return () => {
      passiveEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity, { passive: true });
      });

      activeEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });

      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [handleActivity, isAFK]);

  return (
    <>
      {children}
      {isEnabled && isAFK && <DVDBounce />}
    </>
  );
};

export default FunModeOverlay;
