import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-[#751c58] text-white shadow' : 'text-slate-600 hover:bg-rose-50'
  }`;

export function Sidebar() {
  const { user, isAdmin, isManager } = useAuth();

  const items = [];
  items.push({ to: '/dashboard', label: 'Dashboard', roles: ['admin', 'manager', 'staff'] });
  items.push({ to: '/courses', label: 'Courses', roles: ['admin', 'manager', 'staff'] });
  items.push({ to: '/batches', label: 'Batches', roles: ['admin', 'manager', 'staff'] });
  items.push({ to: '/students', label: 'Students', roles: ['admin', 'manager', 'staff'] });
  items.push({ to: '/payments', label: 'Payments', roles: ['admin', 'manager', 'staff'] });
  items.push({ to: '/batch-payments', label: 'Batch payments', roles: ['admin', 'manager', 'staff'] });
  items.push({ to: '/reports', label: 'Reports', roles: ['admin', 'manager', 'staff'] });
  if (isAdmin || isManager) {
    items.push({ to: '/staff', label: 'Staff management', roles: ['admin', 'manager'] });
  }
  if (isAdmin) items.push({ to: '/audit', label: 'Audit Logs', roles: ['admin'] });
  items.push({ to: '/settings', label: 'Settings', roles: ['admin', 'manager', 'staff'] });

  const visible = items.filter((i) => i.roles.includes(user?.role));

  return (
    <aside className="hidden w-64 shrink-0 border-r border-rose-200 bg-white md:block">
     <div className="flex h-16 items-center border-b border-rose-100 px-4 gap-2">
  
 <div className="flex h-16 items-center border-b border-rose-100 px-4 gap-3">
  <img
    src="/logo.png"
    alt="CLIC Campus Logo"
    className="h-16 w-16 object-contain"
  />

  <div className="text-lg font-semibold text-[#751c58]">
    CLIC Campus
  </div>
</div>

</div>
      <nav className="space-y-1 p-3">
        {visible.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass} end={item.to === '/dashboard'}>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
