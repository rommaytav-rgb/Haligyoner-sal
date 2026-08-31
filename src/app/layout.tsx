import type { Metadata, Viewport } from "next";
import { getI18n } from "@/i18n/server";
import { I18nProvider } from "@/i18n/client";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t("product.name"),
    description: t("product.tagline"),
    applicationName: t("product.name"),
  };
}

export const viewport: Viewport = {
  themeColor: "#fbfaf8",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, direction, dictionary } = await getI18n();

  return (
    // lang and dir drive both assistive technology and every logical CSS
    // property in the interface, so RTL is a real layout direction rather than
    // a set of mirrored overrides.
    <html lang={locale} dir={direction}>
      <body className="min-h-dvh antialiased">
        <I18nProvider locale={locale} dictionary={dictionary}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
