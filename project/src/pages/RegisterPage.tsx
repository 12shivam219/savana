import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react';
import { Button, Input } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useToastStore } from '../stores';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { signUp, isAuthenticated, isLoading } = useAuth();
  const { addToast } = useToastStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redirect already-authenticated users away from register page
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/account', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signUp(email, password, fullName, phone);

      if (error) {
        addToast({
          type: 'error',
          title: 'Registration failed',
          message: error.message,
        });
      } else {
        addToast({
          type: 'success',
          title: 'Account created!',
          message: 'Please check your email to verify your account.',
        });
        navigate('/login');
      }
    } catch (err) {
      console.error('RegisterPage: Exception in handleSubmit:', err);
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
          <h1 className="text-2xl font-display font-bold">Create an account</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">
            Join SAVANA for exclusive offers and faster checkout
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="Enter your name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            leftElement={<User className="w-5 h-5" />}
            required
          />

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
            type="tel"
            label="Phone (optional)"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            leftElement={<Phone className="w-5 h-5" />}
          />

          <Input
            type={showPassword ? 'text' : 'password'}
            label="Password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftElement={<Lock className="w-5 h-5" />}
            rightElement={
              <button type="button" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            }
            helpText="At least 8 characters"
            required
          />

          <div className="flex items-start gap-2">
            <input type="checkbox" className="mt-1 rounded border-neutral-300" required />
            <span className="text-sm text-neutral-600">
              I agree to the{' '}
              <Link to="/terms" className="text-primary-600 hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-primary-600 hover:underline">Privacy Policy</Link>
            </span>
          </div>

          <Button type="submit" variant="primary" className="w-full" isLoading={loading}>
            Create Account
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-neutral-600 dark:text-neutral-400">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
