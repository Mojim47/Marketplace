// ═══════════════════════════════════════════════════════════════════════════
// Footer Component - Global Links with RTL Support
// ═══════════════════════════════════════════════════════════════════════════

'use client';

import React from 'react';
import { cn } from '../../utils/cn';

export interface FooterLink {
  id: string;
  label: string;
  labelFa?: string;
  href: string;
  external?: boolean;
}

export interface FooterSection {
  id: string;
  title: string;
  titleFa?: string;
  links: FooterLink[];
}

export interface SocialLink {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

export interface FooterProps {
  /** Footer sections */
  sections?: FooterSection[];
  /** Social media links */
  socialLinks?: SocialLink[];
  /** Company name */
  companyName?: string;
  /** Company name in Persian */
  companyNameFa?: string;
  /** Copyright year */
  copyrightYear?: number;
  /** Logo element */
  logo?: React.ReactNode;
  /** Newsletter signup */
  newsletter?: {
    title: string;
    titleFa?: string;
    placeholder: string;
    placeholderFa?: string;
    buttonText: string;
    buttonTextFa?: string;
    onSubmit: (email: string) => void;
  };
  /** RTL mode */
  rtl?: boolean;
  /** Custom class */
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({
  sections = [],
  socialLinks = [],
  companyName = 'NextGen Marketplace',
  companyNameFa = 'مارکت‌پلیس نکست‌جن',
  copyrightYear = new Date().getFullYear(),
  logo,
  newsletter,
  rtl = false,
  className,
}) => {
  const [email, setEmail] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !newsletter) {
      return;
    }

    setIsSubmitting(true);
    try {
      await newsletter.onSubmit(email);
      setEmail('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer
      className={cn(
        'bg-[var(--color-background-paper)]',
        'border-t border-[var(--color-border-light)]',
        className
      )}
      dir={rtl ? 'rtl' : 'ltr'}
    >
      <div className="container mx-auto px-4 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-12 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Brand Section */}
            <div className="lg:col-span-4">
              {/* Logo */}
              <div className="mb-6">
                {logo || (
                  <span className="text-2xl font-bold text-[var(--color-brand-primary)]">
                    {rtl ? companyNameFa : companyName}
                  </span>
                )}
              </div>

              {/* Newsletter */}
              {newsletter && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                    {rtl && newsletter.titleFa ? newsletter.titleFa : newsletter.title}
                  </h3>
                  <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={
                        rtl && newsletter.placeholderFa
                          ? newsletter.placeholderFa
                          : newsletter.placeholder
                      }
                      className={cn(
                        'flex-1 h-11 px-4 rounded-xl',
                        'bg-[var(--color-background-sunken)]',
                        'border border-[var(--color-border-default)]',
                        'text-[var(--color-text-primary)]',
                        'placeholder:text-[var(--color-text-tertiary)]',
                        'focus:border-[var(--color-border-focus)]',
                        'focus:outline-none',
                        'transition-colors duration-normal'
                      )}
                      required
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={cn(
                        'px-5 h-11 rounded-xl',
                        'bg-[var(--color-brand-primary)]',
                        'text-white font-medium',
                        'hover:bg-[var(--color-brand-primaryHover)]',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'transition-colors duration-normal'
                      )}
                    >
                      {isSubmitting ? (
                        <LoadingSpinner className="w-5 h-5" />
                      ) : rtl && newsletter.buttonTextFa ? (
                        newsletter.buttonTextFa
                      ) : (
                        newsletter.buttonText
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* Social Links */}
              {socialLinks.length > 0 && (
                <div className="flex items-center gap-3">
                  {socialLinks.map((social) => (
                    <a
                      key={social.id}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'p-2.5 rounded-xl',
                        'text-[var(--color-text-secondary)]',
                        'hover:text-[var(--color-brand-primary)]',
                        'hover:bg-[var(--color-interactive-hover)]',
                        'transition-colors duration-fast'
                      )}
                      aria-label={social.label}
                    >
                      {social.icon}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Link Sections */}
            {sections.map((section) => (
              <div key={section.id} className="lg:col-span-2">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
                  {rtl && section.titleFa ? section.titleFa : section.title}
                </h3>
                <ul className="space-y-3">
                  {section.links.map((link) => (
                    <li key={link.id}>
                      <a
                        href={link.href}
                        target={link.external ? '_blank' : undefined}
                        rel={link.external ? 'noopener noreferrer' : undefined}
                        className={cn(
                          'text-sm text-[var(--color-text-secondary)]',
                          'hover:text-[var(--color-brand-primary)]',
                          'transition-colors duration-fast',
                          'inline-flex items-center gap-1'
                        )}
                      >
                        {rtl && link.labelFa ? link.labelFa : link.label}
                        {link.external && <ExternalLinkIcon className="w-3 h-3" />}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          className={cn(
            'py-6 border-t border-[var(--color-border-light)]',
            'flex flex-col sm:flex-row items-center justify-between gap-4'
          )}
        >
          <p className="text-sm text-[var(--color-text-tertiary)]">
            © {copyrightYear} {rtl ? companyNameFa : companyName}.{' '}
            {rtl ? 'تمامی حقوق محفوظ است.' : 'All rights reserved.'}
          </p>

          <div className="flex items-center gap-6">
            <a
              href="/terms"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-brand-primary)] transition-colors"
            >
              {rtl ? 'شرایط استفاده' : 'Terms of Service'}
            </a>
            <a
              href="/privacy"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-brand-primary)] transition-colors"
            >
              {rtl ? 'حریم خصوصی' : 'Privacy Policy'}
            </a>
            <a
              href="/cookies"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-brand-primary)] transition-colors"
            >
              {rtl ? 'کوکی‌ها' : 'Cookies'}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Icons
const ExternalLinkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
  </svg>
);

const LoadingSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={cn(className, 'animate-spin')} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

export default Footer;
