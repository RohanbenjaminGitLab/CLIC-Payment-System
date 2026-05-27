import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';


const roleLabel = { admin: 'Admin', manager: 'Manager', staff: 'Staff' };

export function Navbar() {
  const { user, logout, isAdmin, isManager } = useAuth();
  const [open, setOpen] = useState(false);


  const items = [
    { to: '/dashboard', label: 'Dashboard', roles: ['admin', 'manager', 'staff'] },
    { to: '/courses', label: 'Courses', roles: ['admin', 'manager', 'staff'] },
    { to: '/batches', label: 'Batches', roles: ['admin', 'manager', 'staff'] },
    { to: '/students', label: 'Students', roles: ['admin', 'manager', 'staff'] },
    { to: '/payments', label: 'Payments', roles: ['admin', 'manager', 'staff'] },
    { to: '/batch-payments', label: 'Batch payments', roles: ['admin', 'manager', 'staff'] },
    { to: '/reports', label: 'Reports', roles: ['admin', 'manager', 'staff'] },
    { to: '/settings', label: 'Settings', roles: ['admin', 'manager', 'staff'] },
  ];
  if (isAdmin || isManager) items.push({ to: '/staff', label: 'Staff management', roles: ['admin', 'manager'] });
  if (isAdmin) items.push({ to: '/audit', label: 'Audit Logs', roles: ['admin'] });
  const visible = items.filter((i) => i.roles.includes(user?.role));

  useEffect(() => {
    (async () => {
    


    })();
  }, []);

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b border-rose-200 bg-white px-3 sm:px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-rose-400 px-2 py-1 text-xs font-semibold text-[#751c58] md:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
         
        </div>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="text-right">
            <div className="max-w-36 truncate text-sm font-medium text-slate-900 sm:max-w-none">{user?.name}</div>
            <div className="hidden text-xs text-slate-500 sm:block">
              {user?.email} · {roleLabel[user?.role] || ''}
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="rounded-lg border border-rose-400 px-2.5 py-1.5 text-xs font-medium text-[#751c58] hover:bg-rose-50 sm:px-3 sm:text-sm"
          >
            Logout
          </button>
        </div>
      </header>
      {open && (
        <div className="border-b border-rose-200 bg-white px-3 py-2 md:hidden">
          <nav className="grid gap-1">
            {visible.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-[#751c58] text-white' : 'text-slate-700 hover:bg-rose-50'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
