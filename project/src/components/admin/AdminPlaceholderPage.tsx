interface AdminPlaceholderPageProps {
  title: string;
  description: string;
}

export default function AdminPlaceholderPage({ title, description }: AdminPlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">{title}</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">{description}</p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-neutral-600 dark:text-neutral-400">
          This section is now available in the admin panel. More management actions can be added here as needed.
        </p>
      </div>
    </div>
  );
}
