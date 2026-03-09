import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPosts } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog — Booking OS',
  description:
    'Insights on clinic management, AI automation, appointment scheduling, and growing your service business.',
  alternates: {
    canonical: 'https://businesscommandcentre.com/blog',
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  'Industry Insights': 'bg-blue-50 text-blue-700',
  'Product Education': 'bg-sage-50 text-sage-700',
  'Customer Success': 'bg-amber-50 text-amber-700',
  'Thought Leadership': 'bg-lavender-50 text-lavender-700',
  Technical: 'bg-slate-100 text-slate-700',
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <section className="pt-28 pb-20">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-sage-600">Blog</p>
          <h1 className="mt-3 font-serif text-4xl font-bold text-slate-900 sm:text-5xl">
            Insights & Resources
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-500">
            Expert advice on running a smarter service business with AI, automation, and modern
            tools.
          </p>
        </div>

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-soft transition-shadow duration-300 hover:shadow-soft-lg"
            >
              <span
                className={`inline-block self-start rounded-full px-3 py-1 text-xs font-medium ${
                  CATEGORY_COLORS[post.category] || 'bg-slate-100 text-slate-600'
                }`}
              >
                {post.category}
              </span>
              <h2 className="mt-4 font-serif text-lg font-semibold text-slate-900 group-hover:text-sage-700 transition-colors">
                {post.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">
                {post.description}
              </p>
              <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
                <time dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
                <span>&middot;</span>
                <span>{post.readTime}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
