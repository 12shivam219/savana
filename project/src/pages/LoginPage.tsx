import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { Button, Input } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useToastStore } from '../stores';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn, isAuthenticated, isLoading } = useAuth();
  const { addToast } = useToastStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redirect already-authenticated users away from the login page
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/account', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        addToast({
          type: 'error',
          title: 'Sign in failed',
          message: error.message,
        });
      } else {
        addToast({
          type: 'success',
          title: 'Welcome back!',
        });
        navigate('/account');
      }
    } catch (err) {
      console.error('LoginPage: Exception in handleSubmit:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block font-display text-3xl font-bold text-primary-600 mb-4">
            SAVANA
          </Link>
          <h1 className="text-2xl font-display font-bold">Welcome back</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">
            Sign in to your account to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftElement={<Mail className="w-5 h-5" />}
            required
          />

          <Input
            type={showPassword ? 'text' : 'password'}
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftElement={<Lock className="w-5 h-5" />}
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="hover:text-neutral-700"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            }
            required
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="rounded border-neutral-300" />
              <span className="text-neutral-600">Remember me</span>
            </label>
            <Link to="/forgot-password" className="text-sm text-primary-600 hover:underline">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" variant="primary" className="w-full" isLoading={loading}>
            Sign In
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-neutral-600 dark:text-neutral-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
