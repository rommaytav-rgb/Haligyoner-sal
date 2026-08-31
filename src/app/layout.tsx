import type { Metadata, Viewport } from 'next';
import { getContext } from '@/lib/server/context';
import { dir, htmlLang, translate } from '@/lib/i18n';
import './globals.css';

export const metadata: Metadata = {
  title: 'מייעל הקניות האישי | Personal Shopping Optimizer',
  description:
    'ספרו לנו מה אתם קונים. אנחנו נלמד את הסל שלכם, נעקוב אחרי המחירים ונמצא את הדרך המשתלמת ביותר לקנות.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#10715a',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The document direction follows the reader's locale, so the whole tree is RTL
  // for Hebrew without any per-component direction handling.
  const { locale } = await getContext();
  return (
    <html lang={htmlLang(locale)} dir={dir(locale)}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only">
          {translate(locale, 'common.appName')}
        </a>
        {children}
      </body>
    </html>
  );
}
