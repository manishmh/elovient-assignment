import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="border border-gray-300 p-4 space-y-1 text-sm">
        <div>
          <span className="text-gray-600">User ID:</span>{' '}
          <span className="font-mono">{user?.id}</span>
        </div>
        <div>
          <span className="text-gray-600">Email:</span> {user?.email}
        </div>
        {user?.createdAt && (
          <div>
            <span className="text-gray-600">Joined:</span>{' '}
            {new Date(user.createdAt).toLocaleString()}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Link
          to="/activity"
          className="block border border-gray-300 p-4 hover:bg-gray-50"
        >
          <div className="font-medium">Activity Simulator</div>
          <div className="text-sm text-gray-600">
            Send actions, test replay protection
          </div>
        </Link>
        <Link
          to="/stats"
          className="block border border-gray-300 p-4 hover:bg-gray-50"
        >
          <div className="font-medium">Stats</div>
          <div className="text-sm text-gray-600">Aggregated analytics</div>
        </Link>
        <Link
          to="/suspicious"
          className="block border border-gray-300 p-4 hover:bg-gray-50"
        >
          <div className="font-medium">Suspicious Users</div>
          <div className="text-sm text-gray-600">Flagged by detection rules</div>
        </Link>
      </div>
    </div>
  );
}
