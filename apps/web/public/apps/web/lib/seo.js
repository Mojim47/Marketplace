const DEFAULT_DESCRIPTION = 'مارکت‌پلیس هوشمند ایران — فروش امن، تجربهٔ AR، توصیهٔ هوشمند.';
export function generateMetadata({ title, description = DEFAULT_DESCRIPTION }) {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      locale: 'fa_IR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}
//# sourceMappingURL=seo.js.map
