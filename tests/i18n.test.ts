import { describe, it, expect, beforeEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { useCleanEnvironment, createTestUser } from "./helpers";
import { en } from "@/i18n/locales/en";
import { he } from "@/i18n/locales/he";
import { getDictionary } from "@/i18n";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  directionOf,
  isLocale,
  localeFromAcceptLanguage,
} from "@/i18n/config";
import { makeTranslator, translate, translatePlural } from "@/i18n/translate";
import { relativeTime, greeting, formatBytes } from "@/i18n/format";
import { renderSystemText, systemText } from "@/i18n/system-text";
import { caseText } from "@/server/i18n";
import { detectLanguage, caseLocale } from "@/server/ai/language";
import { runIntake } from "@/server/agents/intake-agent";
import { runPlanning } from "@/server/agents/planning-agent";
import { advanceCase } from "@/server/agents/orchestrator";
import { listActions, listFacts, listMessages, listTimeline, requireOwnedCase } from "@/server/services/cases";
import { listNotifications } from "@/server/services/notifications";

const HEBREW = /[֐-׿]/;
const LATIN_WORD = /\b[A-Za-z]{4,}\b/;

/** Walks a dictionary, yielding every leaf string with its dotted path. */
function* leaves(value: unknown, prefix = ""): Generator<[string, string]> {
  if (typeof value === "string") {
    yield [prefix, value];
    return;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) yield* leaves(item, `${prefix}[${index}]`);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      yield* leaves(child, prefix ? `${prefix}.${key}` : key);
    }
  }
}

describe("catalogue completeness", () => {
  it("defines every locale the product claims to support", () => {
    expect([...LOCALES]).toEqual(["en", "he"]);
    for (const locale of LOCALES) expect(getDictionary(locale)).toBeTruthy();
  });

  it("has exactly the same keys in Hebrew as in English", () => {
    const englishKeys = [...leaves(en)].map(([key]) => key).sort();
    const hebrewKeys = [...leaves(he)].map(([key]) => key).sort();

    expect(hebrewKeys).toEqual(englishKeys);
    expect(englishKeys.length).toBeGreaterThan(250);
  });

  it("leaves no entry empty in either language", () => {
    for (const [locale, dictionary] of [
      ["en", en],
      ["he", he],
    ] as const) {
      for (const [key, value] of leaves(dictionary)) {
        // Connected tools carry no separate unavailable reason, and the
        // "something else" shortcut deliberately seeds an empty composer.
        if (key.endsWith(".unavailable") || key === "composer.starters.other") continue;
        expect(value.trim(), `${locale}:${key}`).not.toBe("");
      }
    }
  });

  it("keeps every placeholder in the English string present in the Hebrew one", () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const hebrewByKey = new Map([...leaves(he)]);

    for (const [key, english] of leaves(en)) {
      const hebrew = hebrewByKey.get(key);
      expect(hebrew, key).toBeDefined();
      expect(placeholders(hebrew!), `placeholders in ${key}`).toEqual(placeholders(english));
    }
  });
});

describe("Hebrew rendering", () => {
  it("is written in Hebrew, not left as English", () => {
    const untranslated: string[] = [];

    for (const [key, value] of leaves(he)) {
      // Product and vendor names stay in Latin script by design, as does the
      // "something else" shortcut, which seeds an empty composer.
      if (
        /^(product\.name|timelineSource\.SYSTEM|auth\.emailPlaceholder|composer\.starters\.other)$/.test(key) ||
        /^settings\.(fileStorageCloud|databaseCloud)$/.test(key) ||
        /^tools\.(connectGmail|connectOutlook)\./.test(key) ||
        /^unavailable\.(gmail|outlook)$/.test(key)
      ) {
        continue;
      }
      // A pure template of placeholders and punctuation has nothing to translate.
      if (!/\p{L}/u.test(value.replace(/\{\w+\}/g, ""))) continue;
      if (key.endsWith(".unavailable") && value === "") continue;

      if (!HEBREW.test(value)) untranslated.push(`${key} = ${value}`);
    }

    expect(untranslated).toEqual([]);
  });

  it("does not leave stray English sentences inside Hebrew copy", () => {
    const suspicious: string[] = [];

    for (const [key, value] of leaves(he)) {
      if (!HEBREW.test(value)) continue;
      // Latin runs are fine for brand and product names; whole English words
      // elsewhere would mean a half-finished translation.
      const withoutKnownNames = value
        // Placeholders are filled at render time and are not copy.
        .replace(/\{\w+\}/g, "")
        .replace(/Fix My Problem/g, "")
        .replace(/\b(Cloud Storage|Firestore|Gmail|Outlook|Word|PDF|Cmd|Enter)\b/g, "");
      if (LATIN_WORD.test(withoutKnownNames)) suspicious.push(`${key} = ${value}`);
    }

    expect(suspicious).toEqual([]);
  });

  it("uses the product's own landing copy", () => {
    expect(he.landing.headlineLine1).toBe("יש לך בעיה?");
    expect(he.landing.headlineLine2).toBe("בוא נפתור אותה.");
    expect(he.landing.supporting).toBe("ספר לנו מה קרה. אתה לא צריך לדעת מה לעשות הלאה.");
    expect(he.composer.label).toBe("מה קרה?");
    expect(he.composer.submit).toBe("פתור לי את הבעיה");
  });

  it("names the quick-start categories in Hebrew", () => {
    expect(Object.values(he.quickStart)).toEqual([
      "כסף וחיובים",
      "הזמנות ומשלוחים",
      "טיסות ונסיעות",
      "שירותים ומנויים",
      "מסמכים",
      "משהו אחר",
    ]);
  });
});

describe("direction", () => {
  it("maps each language to its reading direction", () => {
    expect(directionOf("en")).toBe("ltr");
    expect(directionOf("he")).toBe("rtl");
  });

  it("recognises supported locales and rejects anything else", () => {
    expect(isLocale("he")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("chooses a language from the browser's preference", () => {
    expect(localeFromAcceptLanguage("he-IL,he;q=0.9,en;q=0.8")).toBe("he");
    expect(localeFromAcceptLanguage("en-GB,en;q=0.9")).toBe("en");
    // "iw" is the legacy code for Hebrew and still appears in the wild.
    expect(localeFromAcceptLanguage("iw,en;q=0.5")).toBe("he");
    expect(localeFromAcceptLanguage("fr-FR,fr;q=0.9,he;q=0.4")).toBe("he");
    expect(localeFromAcceptLanguage("fr-FR")).toBeNull();
    expect(localeFromAcceptLanguage(null)).toBeNull();
  });
});

describe("translation", () => {
  it("fills placeholders", () => {
    expect(translate(en, "cases.updated", { time: "2 hours ago" })).toBe("Updated 2 hours ago");
    expect(translate(he, "cases.updated", { time: "לפני שעתיים" })).toBe("עודכן לפני שעתיים");
  });

  it("returns the key rather than throwing when one is missing", () => {
    expect(translate(en, "nope.missing")).toBe("nope.missing");
  });

  it("picks the right plural form in each language", () => {
    expect(translatePlural(en, "en-GB", "evidence.confirmedBadge", 1)).toBe("Confirmed 1 detail");
    expect(translatePlural(en, "en-GB", "evidence.confirmedBadge", 4)).toBe("Confirmed 4 details");

    // Hebrew inflects, so the singular is a different word, not "1 details".
    expect(translatePlural(he, "he-IL", "evidence.confirmedBadge", 1)).toBe("אימת פרט אחד");
    expect(translatePlural(he, "he-IL", "evidence.confirmedBadge", 4)).toBe("אימת 4 פרטים");
  });

  it("resolves references to other catalogue entries", () => {
    const t = makeTranslator(he, "he-IL");
    const rendered = t.ref("system.statusChangedTitle", { status: "@status.RESOLVED" });

    expect(rendered).toContain("נפתר");
    expect(rendered).not.toContain("@");
  });

  it("formats times, greetings and sizes per language", () => {
    const now = new Date("2026-08-31T12:00:00Z");
    const twoHoursAgo = new Date("2026-08-31T10:00:00Z").toISOString();

    expect(relativeTime(twoHoursAgo, "en", now)).toMatch(/hours ago/);
    expect(relativeTime(twoHoursAgo, "he", now)).toMatch(HEBREW);

    expect(greeting(he, new Date("2026-08-31T08:00:00"))).toBe("בוקר טוב");
    expect(formatBytes(2048, "he")).toBe("2 KB");
  });
});

describe("language detection", () => {
  it("recognises Hebrew and English problem descriptions", () => {
    expect(detectLanguage("הטיסה שלי בוטלה ואף אחד לא חוזר אליי")).toBe("he");
    expect(detectLanguage("My flight was cancelled and nobody has called me back")).toBe("en");
  });

  it("is not thrown off by a borrowed Latin word inside Hebrew", () => {
    expect(detectLanguage("קיבלתי מייל מ-Amazon על החזר כספי שלא הגיע")).toBe("he");
  });

  it("is not thrown off by a Hebrew name inside English", () => {
    expect(detectLanguage("I ordered from a shop and the receipt says מ.ע. 12345 on it somewhere")).toBe("en");
  });

  it("falls back safely when there is nothing to go on", () => {
    expect(detectLanguage("12345 !!! ???")).toBe(DEFAULT_LOCALE);
    expect(caseLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(caseLocale("he")).toBe("he");
    expect(caseLocale("klingon")).toBe(DEFAULT_LOCALE);
  });
});

describe("stored system text", () => {
  it("renders a stored reference in the reader's language", () => {
    const stored = systemText("system.fileAdded", { fileName: "receipt.pdf" });

    expect(renderSystemText(makeTranslator(en, "en-GB"), stored, "fallback")).toBe("Added receipt.pdf");
    expect(renderSystemText(makeTranslator(he, "he-IL"), stored, "fallback")).toBe("נוסף receipt.pdf");
  });

  it("shows user content exactly as recorded, in any language", () => {
    const content = "They said the parcel was left with a neighbour.";
    expect(renderSystemText(makeTranslator(he, "he-IL"), undefined, content)).toBe(content);
  });

  it("renders case content in the case's own language, not the reader's", () => {
    expect(caseText("agent.goalRefund", undefined, "he")).toBe("לקבל החזר כספי");
    expect(caseText("agent.goalRefund", undefined, "en")).toBe("Get a refund");
  });
});

describe("a case written in Hebrew", () => {
  beforeEach(() => {
    useCleanEnvironment();
  });

  const problem = "הזמנתי אוזניות באינטרנט והן הגיעו שבורות. פניתי לחנות פעמיים ואף אחד לא חזר אליי.";

  it("is opened in Hebrew and answered in Hebrew", async () => {
    const user = await createTestUser();
    const result = await runIntake(user.id, problem);

    expect(result.case.contentLocale).toBe("he");
    expect(result.case.title).toMatch(HEBREW);
    expect(result.case.userGoal).toMatch(HEBREW);
    expect(result.reply).toMatch(HEBREW);

    // The questions it asks are Hebrew questions, not translated stubs.
    expect(result.case.unknowns.length).toBeGreaterThan(0);
    for (const unknown of result.case.unknowns) {
      expect(unknown.question).toMatch(HEBREW);
      expect(unknown.reason).toMatch(HEBREW);
    }
  });

  it("classifies a Hebrew problem as accurately as an English one", async () => {
    const user = await createTestUser();
    const { case: record } = await runIntake(user.id, problem);
    expect(record.primaryCategory).toBe("Shopping");

    const { case: payment } = await runIntake(user.id, "חייבו אותי בכרטיס האשראי על עסקה שלא ביצעתי.");
    expect(payment.primaryCategory).toBe("Payments");

    const { case: flight } = await runIntake(user.id, "הטיסה שלי בוטלה שעתיים לפני ההמראה ושילמתי על מלון.");
    expect(flight.primaryCategory).toBe("Travel");
  });

  it("builds its plan and its draft in Hebrew", async () => {
    const user = await createTestUser();
    const { case: record } = await runIntake(user.id, problem);

    const plan = await runPlanning(user.id, record.id);
    for (const step of plan.steps) {
      expect(step.title).toMatch(HEBREW);
      expect(step.description).toMatch(HEBREW);
    }

    const { prepareDraft } = await import("@/server/agents/action-agent");
    const draftStep = (await listActions(record.id)).find((a) => a.type === "DRAFT")!;
    const prepared = await prepareDraft(user.id, record.id, draftStep.id);

    expect(prepared.draft?.body).toMatch(HEBREW);
    expect(prepared.draft?.sharedInformation.every((item) => HEBREW.test(item))).toBe(true);
  });

  it("keeps replying in Hebrew as the conversation continues", async () => {
    const user = await createTestUser();
    const { case: record } = await runIntake(user.id, problem);

    const result = await advanceCase(user.id, record.id, {
      kind: "MESSAGE",
      message: "זה קרה ב-12 באוגוסט 2026, מספר הזמנה 77812.",
    });

    expect(result.reply).toMatch(HEBREW);
    const messages = await listMessages(record.id);
    expect(messages.at(-1)?.content).toMatch(HEBREW);
  });

  it("attaches its high-risk disclaimer in Hebrew", async () => {
    const user = await createTestUser();
    const result = await runIntake(user.id, "קיבלתי זימון לבית משפט בגלל חוב שלא שילמתי ואני מפוחד.");

    expect(result.case.riskLevel).toBe("HIGH");
    expect(result.reply).toMatch(HEBREW);
    expect(result.reply).toContain("עורכי דין");
  });
});

describe("switching the interface language", () => {
  beforeEach(() => {
    useCleanEnvironment();
  });

  it("leaves the stored case exactly as it was", async () => {
    const user = await createTestUser();
    const { case: created } = await runIntake(
      user.id,
      "הזמנתי מקרר והוא הגיע פגום. החנות לא מגיבה לפניות שלי כבר שבועיים.",
    );
    await runPlanning(user.id, created.id);

    const before = {
      record: await requireOwnedCase(user.id, created.id),
      facts: await listFacts(created.id),
      actions: await listActions(created.id),
    };

    // Switching the interface is a cookie change; it touches no stored data.
    const after = {
      record: await requireOwnedCase(user.id, created.id),
      facts: await listFacts(created.id),
      actions: await listActions(created.id),
    };

    expect(after).toEqual(before);
    expect(after.record.contentLocale).toBe("he");
    expect(after.record.title).toMatch(HEBREW);
    expect(after.facts.every((fact) => HEBREW.test(fact.statement))).toBe(true);
  });

  it("still renders the case's system entries in the reader's language", async () => {
    const user = await createTestUser();
    const { case: record } = await runIntake(user.id, "הטיסה שלי בוטלה ולא קיבלתי החזר.");

    const timeline = await listTimeline(record.id);
    const opened = timeline.find((event) => event.titleText?.key === "system.caseOpened");
    expect(opened).toBeDefined();

    // The same stored entry reads correctly either way round.
    expect(renderSystemText(makeTranslator(en, "en-GB"), opened!.titleText, opened!.title)).toBe("Case opened");
    expect(renderSystemText(makeTranslator(he, "he-IL"), opened!.titleText, opened!.title)).toBe("התיק נפתח");
  });

  it("stores notification bodies as references rather than fixed language", async () => {
    const user = await createTestUser();
    const { case: record } = await runIntake(user.id, "חייבו אותי פעמיים על אותה הזמנה.");
    expect(record.unknowns.length).toBeGreaterThan(0);

    const notifications = await listNotifications(user.id);
    const statusChange = notifications.find((n) => n.kind === "STATUS_CHANGE" && n.bodyText);
    if (statusChange) {
      expect(renderSystemText(makeTranslator(he, "he-IL"), statusChange.bodyText, statusChange.body)).toMatch(HEBREW);
    }

    // The notification title is the case title, so it keeps the case's language.
    expect(notifications[0].title).toMatch(HEBREW);
  });

  it("names the cookie the switcher writes", () => {
    expect(LOCALE_COOKIE).toBe("fmp_locale");
  });
});

describe("right-to-left layout", () => {
  const componentFiles: string[] = [];

  function collect(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) collect(full);
      else if (full.endsWith(".tsx")) componentFiles.push(full);
    }
  }
  collect(path.join(process.cwd(), "src"));

  it("uses logical properties everywhere instead of hard-coded sides", () => {
    // Physical direction utilities do not flip with `dir`, so a single one is
    // enough to break the Hebrew layout. `inset-x-*` is symmetric and fine.
    const physical =
      /(?:^|["\s])(?:-?(?:ml|mr|pl|pr)-[\w.[\]/-]+|-?(?:left|right)-[\w.[\]/-]+|text-(?:left|right)|border-[lr]-[\w[\]/-]+|rounded-[tb][lr]-[\w[\]/-]+)/;

    const offenders: string[] = [];
    for (const file of componentFiles) {
      for (const [index, line] of readFileSync(file, "utf8").split("\n").entries()) {
        const classAttr = line.match(/class(?:Name)?=["'{`]([^"'`}]*)/)?.[1];
        if (classAttr && physical.test(` ${classAttr}`)) {
          offenders.push(`${path.relative(process.cwd(), file)}:${index + 1}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("checks that every component file was actually scanned", () => {
    expect(componentFiles.length).toBeGreaterThan(25);
  });
});

describe("the language switcher endpoint", () => {
  async function post(body: unknown) {
    const { POST } = await import("@/app/api/locale/route");
    return POST(
      new Request("http://localhost/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  it("records a supported language in the cookie the app reads", async () => {
    const response = await post({ locale: "he" });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ locale: "he" });

    const cookie = response.cookies.get(LOCALE_COOKIE);
    expect(cookie?.value).toBe("he");
    // Readable by the client so the switcher can show the current choice.
    expect(cookie?.httpOnly).toBe(false);
    expect(cookie?.path).toBe("/");
    expect(cookie?.maxAge).toBeGreaterThan(60 * 60 * 24 * 300);
  });

  it("switches back to English just as readily", async () => {
    const response = await post({ locale: "en" });
    expect(response.cookies.get(LOCALE_COOKIE)?.value).toBe("en");
  });

  it("refuses a language the product does not have", async () => {
    const response = await post({ locale: "fr" });
    expect(response.status).toBe(400);
    expect(response.cookies.get(LOCALE_COOKIE)).toBeUndefined();
  });

  it("refuses a malformed request", async () => {
    const { POST } = await import("@/app/api/locale/route");
    const response = await POST(
      new Request("http://localhost/api/locale", { method: "POST", body: "not json" }),
    );
    expect(response.status).toBe(400);
  });
});

describe("nothing written into a Hebrew case leaks English", () => {
  beforeEach(() => {
    useCleanEnvironment();
  });

  const LATIN_SENTENCE = /\b[A-Za-z]{3,}\s+[A-Za-z]{3,}\s+[A-Za-z]{3,}/;

  it("keeps every field the product writes into the case in Hebrew", async () => {
    const user = await createTestUser();
    const { case: created } = await runIntake(
      user.id,
      "חייבו אותי 890 שקל על מנוי לחדר כושר שביטלתי בינואר. פניתי אליהם פעמיים ולא חזרו אליי.",
    );

    await runPlanning(user.id, created.id);
    const { prepareDraft } = await import("@/server/agents/action-agent");
    const draftStep = (await listActions(created.id)).find((a) => a.type === "DRAFT")!;
    await prepareDraft(user.id, created.id, draftStep.id);

    const record = await requireOwnedCase(user.id, created.id);
    const actions = await listActions(created.id);

    // Case content is written for the person, so an English sentence anywhere
    // in it means some code path ignored the case's language.
    const written = [
      record.title,
      record.summary,
      record.userGoal ?? "",
      record.currentNextAction ?? "",
      ...record.unknowns.flatMap((u) => [u.question, u.reason]),
      ...actions.flatMap((a) => [a.title, a.description, a.draft?.body ?? "", ...(a.draft?.sharedInformation ?? [])]),
    ];

    const leaks = written.filter((text) => LATIN_SENTENCE.test(text));
    expect(leaks).toEqual([]);
  });

  it("writes an English case entirely in English", async () => {
    const user = await createTestUser();
    const { case: created } = await runIntake(
      user.id,
      "I was charged 890 for a gym membership I cancelled in January. I contacted them twice with no reply.",
    );
    await runPlanning(user.id, created.id);

    const record = await requireOwnedCase(user.id, created.id);
    const actions = await listActions(created.id);

    expect(record.contentLocale).toBe("en");
    expect([record.title, record.userGoal ?? "", ...actions.map((a) => a.title)].some((t) => HEBREW.test(t))).toBe(
      false,
    );
  });
});
