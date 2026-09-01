import './site.css';
import { SiteNav, SiteFooter } from './site-chrome';

// The public marketing site sits in front of the console: it wraps every page
// under this route group with the nav and footer, on the .m scope so its styles
// never reach the console or the operator-branded trip pages.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="m">
      <SiteNav />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
