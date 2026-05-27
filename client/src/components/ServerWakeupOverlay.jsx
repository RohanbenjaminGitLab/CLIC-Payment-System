import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function ServerWakeupOverlay() {
  const [isWaking, setIsWaking] = useState(false);

  useEffect(() => {
    const onWakeNeeded = () => setIsWaking(true);
    const onReady = () => setIsWaking(false);

    window.addEventListener('server-wake-needed', onWakeNeeded);
    window.addEventListener('server-ready', onReady);

    return () => {
      window.removeEventListener('server-wake-needed', onWakeNeeded);
      window.removeEventListener('server-ready', onReady);
    };
  }, []);

  return (
    <AnimatePresence>
      {isWaking && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-4 w-full max-w-md rounded-2xl border border-white/20 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-6 flex justify-center">
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 animate-ping rounded-full bg-blue-400/30"></div>
                <div className="relative flex h-full w-full items-center justify-center rounded-full bg-blue-500 shadow-lg">
                  <svg
                    className="h-8 w-8 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <h3 className="mb-2 text-xl font-bold text-white">Waking up the server...</h3>
            <p className="mb-6 text-slate-300">
              Our free hosting tier is warming up. This usually takes about 30 seconds. Thank you
              for your patience!
            </p>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                className="h-full w-1/2 bg-gradient-to-r from-transparent via-blue-400 to-transparent"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
