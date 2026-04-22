import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useInactivityLogout } from '../hooks/useInactivityLogout';

export function Layout() {
  const { showWarning, setShowWarning } = useInactivityLogout(2);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex min-h-screen flex-1 flex-col">
        <Navbar />

        {/* ⚠️ Warning Popup */}
        {showWarning && (
          <div className="fixed top-5 right-5 bg-red-600 text-white p-4 rounded-lg shadow-lg z-50 animate-pulse">
            ⚠️ You will be logged out in 30 seconds due to inactivity

            <button
              onClick={() => setShowWarning(false)}
              className="ml-3 bg-white text-red-600 px-2 py-1 rounded"
            >
              OK
            </button>
          </div>
        )}

        <main className="flex-1 p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}