import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-2 py-1 ${isActive ? 'border-b-2 border-black' : 'text-gray-600 hover:text-black'}`;

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="border-b border-gray-300">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-6">
          <div className="font-semibold">Activity Tracker</div>
          <nav className="flex items-center gap-2 flex-1">
            <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
            <NavLink to="/activity" className={linkClass}>Activity</NavLink>
            <NavLink to="/stats" className={linkClass}>Stats</NavLink>
            <NavLink to="/suspicious" className={linkClass}>Suspicious</NavLink>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600">{user?.email}</span>
            <button
              onClick={() => void logout()}
              className="border border-gray-400 px-2 py-1 hover:bg-gray-100"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
