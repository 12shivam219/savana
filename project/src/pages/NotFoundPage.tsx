import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-8xl font-display font-bold text-primary-600 dark:text-primary-400 mb-4">
          404
        </div>
        <h1 className="text-3xl font-display font-bold mb-2">Page Not Found</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mb-8 max-w-md">
          Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/">
            <Button variant="primary" leftIcon={<Home className="w-4 h-4" />}>
              Go Home
            </Button>
          </Link>
          <Button variant="outline" onClick={() => window.history.back()} leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
