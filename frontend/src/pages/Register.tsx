import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm bg-white border border-gray-300 p-6">
        <h1 className="text-xl font-semibold mb-5">Register</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-400 px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-400 px-2 py-1.5"
            />
            <div className="text-xs text-gray-500 mt-1">Min 8 characters.</div>
          </div>
          {error && (
            <div className="text-sm text-red-700 border border-red-300 bg-red-50 px-2 py-1">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full border border-black bg-black text-white py-1.5 disabled:opacity-50"
          >
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
          <div className="text-sm text-gray-600 pt-1">
            Already have an account?{' '}
            <Link className="underline" to="/login">
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
