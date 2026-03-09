import MarketingNav from '@/components/marketing-nav';
import MarketingFooter from '@/components/marketing-footer';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FCFCFD] text-slate-800">
      <MarketingNav />
      {children}
      <MarketingFooter />
    </div>
  );
}
