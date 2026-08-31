import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { getI18n } from "@/i18n/server";
import { Wordmark } from "@/components/Wordmark";
import { AuthForm } from "@/components/AuthForm";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  const { next } = await searchParams;
  if (user) redirect(next && next.startsWith("/") ? next : "/home");

  const { t } = await getI18n();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <Link href="/" aria-label={t("nav.homeAria")}>
          <Wordmark name={t("product.name")} />
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-20 sm:px-8">
        <AuthForm next={next} />
      </main>
    </div>
  );
}
