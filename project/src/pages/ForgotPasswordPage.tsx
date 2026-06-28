import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { Button, Input } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useToastStore } from '../stores';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const { addToast } = useToastStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await resetPassword(email);

      if (error) {
        addToast({
          type: 'error',
          title: 'Error requesting reset',
          message: error.message,
        });
      } else {
        addToast({
          type: 'success',
          title: 'Reset email sent',
          message: 'Please check your inbox for instructions to reset your password.',
        });
        setSubmitted(true);
      }
    } catch (err) {
      console.error('ForgotPasswordPage: Exception in handleSubmit:', err);
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
          <h1 className="text-2xl font-display font-bold">Reset Password</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-2">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {submitted ? (
          <div className="bg-success-50 dark:bg-success-950 border border-success-200 dark:border-success-800 rounded-xl p-6 text-center">
            <h2 className="text-lg font-semibold text-success-800 dark:text-success-200 mb-2">Check your email</h2>
            <p className="text-sm text-success-600 dark:text-success-400 mb-6">
              We have sent a password reset link to <strong className="font-medium text-success-700 dark:text-success-300">{email}</strong>.
            </p>
            <Link to="/login">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              label="Email Address"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftElement={<Mail className="w-5 h-5" />}
              required
            />

            <Button type="submit" variant="primary" className="w-full" isLoading={loading}>
              Send Reset Link
            </Button>

            <div className="text-center mt-6">
              <Link to="/login" className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400">
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
