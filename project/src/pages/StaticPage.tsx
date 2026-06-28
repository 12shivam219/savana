import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { supabase } from '../lib/supabase';
import { Spinner } from '../components/ui';

interface PageProps {
  slug?: string;
}

interface Page {
  id: string;
  title: string;
  content: string;
  meta_title?: string;
}

export default function StaticPage({ slug: propSlug }: PageProps) {
  const params = useParams<{ slug: string }>();
  const slug = propSlug || params.slug;
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      loadPage(slug);
    }
  }, [slug]);

  async function loadPage(pageSlug: string) {
    try {
      const { data, error } = await supabase
        .from('pages')
        .select('*')
        .eq('slug', pageSlug)
        .eq('is_published', true)
        .single();

      if (error) throw error;
      setPage(data);
    } catch (error) {
      console.error('Error loading page:', error);
      setPage(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container-app py-16 flex justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="container-app py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
        <p className="text-neutral-500">The page you're looking for doesn't exist.</p>
      </div>
    );
  }

  return (
    <div className="container-app py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-display font-bold mb-8">{page.title}</h1>
        <div
          className="prose prose-neutral dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.content) }}
        />
      </div>
    </div>
  );
}
