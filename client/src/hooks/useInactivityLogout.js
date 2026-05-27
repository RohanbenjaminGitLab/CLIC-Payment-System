import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function useInactivityLogout(minutes = 2) {
  const { user, logout } = useAuth();

  const logoutTimer = useRef(null);
  const warningTimer = useRef(null);
  const activityTimeout = useRef(null);

  const audioRef = useRef(null); // 🔥 AUDIO CONTROL

  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (!user) return;

    const totalMs = (minutes || 2) * 60 * 1000;
    const warningMs = totalMs - 30 * 1000;

    // 🔊 init audio once
    if (!audioRef.current) {
      audioRef.current = new Audio('/alert.mp3');
      audioRef.current.loop = true; // 🔥 keep looping until stop
    }

    const playSound = () => {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {
          console.log('Sound blocked');
        });
      }
    };

    const stopSound = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };

    const clearTimers = () => {
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);
    };

    const startTimers = () => {
      clearTimers();

      warningTimer.current = setTimeout(() => {
        setShowWarning(true);
        playSound(); // 🔊 start sound
      }, warningMs);

      logoutTimer.current = setTimeout(() => {
        setShowWarning(false);
        stopSound(); // 🔇 stop sound
        logout();
      }, totalMs);
    };

    startTimers();

    const handleActivity = () => {
      setShowWarning(false);

      // 🔥 STOP SOUND ON ANY ACTIVITY
      stopSound();

      if (activityTimeout.current) {
        clearTimeout(activityTimeout.current);
      }

      activityTimeout.current = setTimeout(() => {
        startTimers();
      }, 300);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll'];

    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      clearTimers();
      stopSound();

      if (activityTimeout.current) {
        clearTimeout(activityTimeout.current);
      }

      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [user, logout, minutes]);

  return { showWarning, setShowWarning };
}