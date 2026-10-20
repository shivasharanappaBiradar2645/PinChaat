import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Portal & Analytics',
  description: 'Manage reviews, moderate place suggestions, and view foodie cravings analytics.',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
