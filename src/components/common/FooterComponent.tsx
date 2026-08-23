import React from 'react';
const staffEntryPath = '/auth';
const FooterComponent = () => (
  <footer className="border-t border-border bg-background/90 backdrop-blur dark:border-white/10 dark:bg-slate-950/90">
        <div className="mx-auto grid max-w-7xl gap-6 px-2 py-2 sm:px-6 md:grid-cols-[auto,1fr,auto] md:items-center">
          <a href="/" className="mx-auto md:mx-0">
            <div className="flex items-center justify-center md:justify-start">
              <img src="/images/autoadvant-logo.png" alt="AutoAdvant logo" className="h-11 w-auto" />
            </div>
          </a>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-x-5">
            <a href="/service-booking" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Book A Service</a>
            <a href="/dealer-onboarding" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Entity Onboarding</a>
            <a href={staffEntryPath} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Staff Login</a>
            <a href="/privacy-policy" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="/terms-and-conditions" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Terms & Conditions</a>
            <a href="/sitemap" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">Sitemap</a>
          </div>

          <p className="text-center text-xs text-muted-foreground md:text-right">© {new Date().getFullYear()} AutoAdvant</p>
        </div>
      </footer>
);

export default FooterComponent;