import Link from 'next/link';

export default function MarketingFooter() {
  return (
    <footer className="border-t border-slate-100 bg-white py-12">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col items-center justify-between gap-8 sm:flex-row sm:items-start">
          {/* Logo + tagline */}
          <div>
            <Link href="/" className="font-serif text-lg font-bold text-slate-900">
              Booking OS
            </Link>
            <p className="mt-1 text-sm text-slate-400">
              The operating system for service businesses.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-12 text-sm">
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Product
              </span>
              <Link href="/#features" className="text-slate-500 hover:text-slate-700">
                Features
              </Link>
              <Link href="/pricing" className="text-slate-500 hover:text-slate-700">
                Pricing
              </Link>
              <Link href="/blog" className="text-slate-500 hover:text-slate-700">
                Blog
              </Link>
              <Link href="/faq" className="text-slate-500 hover:text-slate-700">
                FAQ
              </Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Account
              </span>
              <Link href="/login" className="text-slate-500 hover:text-slate-700">
                Login
              </Link>
              <Link href="/signup" className="text-slate-500 hover:text-slate-700">
                Sign Up
              </Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Legal
              </span>
              <span className="cursor-default text-slate-400">Privacy Policy</span>
              <span className="cursor-default text-slate-400">Terms of Service</span>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-100 pt-6 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} Booking OS. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
