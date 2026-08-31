import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { getI18n } from "@/i18n/server";
import { ProblemComposer } from "@/components/landing/ProblemComposer";
import { Wordmark } from "@/components/Wordmark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/**
 * The first screen. Everything else on this page is subordinate to one thing:
 * a person describing what happened, in their own words, without deciding
 * anything first.
 */
export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/home");

  const { t } = await getI18n();

  const steps = [
    { title: t("landing.step1Title"), body: t("landing.step1Body") },
    { title: t("landing.step2Title"), body: t("landing.step2Body") },
    { title: t("landing.step3Title"), body: t("landing.step3Body") },
  ];

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <Wordmark name={t("product.name")} />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link
            href="/sign-in"
            className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-paper-sunk hover:text-ink"
          >
            {t("common.signIn")}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-24 pt-10 sm:px-8 sm:pt-20">
        <div className="animate-fade-up">
          <h1 className="display text-[34px] text-ink sm:text-[52px]">
            {t("landing.headlineLine1")}
            <br />
            {t("landing.headlineLine2")}
          </h1>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-ink-mute sm:mt-5 sm:text-[17px]">
            {t("landing.supporting")}
          </p>
        </div>

        <div className="mt-8 animate-fade-up sm:mt-10" style={{ animationDelay: "60ms" }}>
          <ProblemComposer authed={false} />
        </div>

        <section className="mt-16 border-t border-line pt-10 sm:mt-20">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
            {t("landing.howItWorks")}
          </h2>
          <ol className="mt-5 grid gap-5 sm:grid-cols-3 sm:gap-6">
            {steps.map((item, index) => (
              <li key={item.title}>
                <span dir="ltr" className="block text-[13px] font-semibold tabular-nums text-ink-faint">
                  0{index + 1}
                </span>
                <h3 className="mt-1.5 text-[15px] font-semibold text-ink">{item.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-mute">{item.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <p className="mt-12 text-[13px] leading-relaxed text-ink-faint">{t("landing.disclaimer")}</p>
      </main>
    </div>
  );
}
