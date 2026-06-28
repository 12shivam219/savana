import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Lock, ArrowLeft } from 'lucide-react';
import { Button, Input } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useToastStore } from '../stores';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { updatePassword, signOut, isAuthenticated, isLoading } = useAuth();
  const { addToast } = useToastStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      addToast({
        type: 'error',
        title: 'Invalid or expired session',
        message: 'Please request a new password reset link.',
      });
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, addToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      addToast({
        type: 'error',
        title: 'Passwords do not match',
        message: 'Please ensure both passwords are identical.',
      });
      return;
    }

    if (password.length < 6) {
      addToast({
        type: 'error',
        title: 'Password too short',
        message: 'Password must be at least 6 characters long.',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await updatePassword(password);

      if (error) {
        addToast({
          type: 'error',
          title: 'Failed to reset password',
          message: error.message,
        });
      } else {
        addToast({
          type: 'success',
          title: 'Password reset successful',
          message: 'Your password has been updated. Please sign in with your new password.',
        });
        // Sign out to clear the recovery session and force user to log in
        await signOut();
        navigate('/login', { replace: true });
      }
    } catch (err) {
      console.error('ResetPasswordPage: Exception in handleSubmit:', err);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block font-display text-3xl font-bold text-primary-600 mb-4">
            SAVANA
          </Link>
          <h1 className="text-2xl font-display font-bold">Create New Password</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">
            Please enter your new password below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type={showPassword ? 'text' : 'password'}
            label="New Password"
            placeholder="Minimum 6 characters"
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

          <Input
            type={showConfirmPassword ? 'text' : 'password'}
            label="Confirm New Password"
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            leftElement={<Lock className="w-5 h-5" />}
            rightElement={
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="hover:text-neutral-700"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            }
            required
          />

          <Button type="submit" variant="primary" className="w-full" isLoading={loading}>
            Reset Password
          </Button>

          <div className="text-center mt-6">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400">
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
