import type { Metadata } from 'next';
import BookingLayoutClient from './booking-layout-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${API_URL}/public/${slug}`, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error('Not found');
    const business = await res.json();
    return {
      title: `Book with ${business.name}`,
      description: `Book an appointment with ${business.name}. Easy online scheduling.`,
      openGraph: {
        title: `Book with ${business.name}`,
        description: `Book an appointment with ${business.name}. Easy online scheduling.`,
        type: 'website',
      },
    };
  } catch {
    return {
      title: 'Book an Appointment',
      description: 'Easy online appointment scheduling.',
    };
  }
}

export default function BookingPortalLayout({ children }: { children: React.ReactNode }) {
  return <BookingLayoutClient>{children}</BookingLayoutClient>;
}
