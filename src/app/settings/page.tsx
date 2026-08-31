import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { capabilities, config } from "@/lib/config";
import { getAIProvider } from "@/server/ai";
import { listTools } from "@/server/tools";
import { listActionProviders } from "@/server/services/action-providers";
import { unreadCount } from "@/server/services/notifications";
import { AppShell } from "@/components/nav/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getI18n } from "@/i18n/server";
import { formatNumber } from "@/i18n/format";

export const dynamic = "force-dynamic";

/**
 * Settings doubles as the transparency screen: exactly what is connected, what
 * is not, and what that means for what the product can do.
 */
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/settings");

  const [{ t, locale }, unread] = await Promise.all([getI18n(), unreadCount(user.id)]);
  const provider = getAIProvider();
  const tools = listTools();
  const connected = tools.filter((tool) => tool.available);
  const missing = tools.filter((tool) => !tool.available);
  const actionProviders = listActionProviders();

  return (
    <AppShell user={user} unread={unread}>
      <h1 className="display text-[28px] text-ink">{t("settings.title")}</h1>

      <div className="mt-6 space-y-5">
        <Card>
          <CardHeader title={t("settings.accountTitle")} />
          <CardBody className="space-y-2 text-[14px]">
            <Row label={t("settings.accountEmail")} value={user.email} literal />
            {user.displayName && <Row label={t("settings.accountName")} value={user.displayName} />}
            <p className="pt-2 text-[13px] leading-relaxed text-ink-mute">{t("settings.accountPrivacy")}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("settings.languageTitle")} action={<LanguageSwitcher />} />
          <CardBody>
            <p className="text-[13px] leading-relaxed text-ink-mute">{t("settings.languageBody")}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("settings.connectedTitle")} description={t("settings.connectedBody")} />
          <CardBody className="space-y-3">
            <Row
              label={t("settings.understanding")}
              value={provider.quality.modelBacked ? t("settings.understandingOn") : t("settings.understandingOff")}
              tone={provider.quality.modelBacked ? "ok" : "warn"}
            />
            <Row
              label={t("settings.webResearch")}
              value={capabilities.webResearch ? t("common.on") : t("common.notConnected")}
              tone={capabilities.webResearch ? "ok" : "neutral"}
            />
            <Row
              label={t("settings.fileStorage")}
              value={capabilities.cloudStorage ? t("settings.fileStorageCloud") : t("settings.fileStorageLocal")}
              tone={capabilities.cloudStorage ? "ok" : "neutral"}
            />
            <Row
              label={t("settings.database")}
              value={capabilities.firestore ? t("settings.databaseCloud") : t("settings.databaseLocal")}
              tone={capabilities.firestore ? "ok" : "neutral"}
            />
            <Row
              label={t("settings.sending")}
              value={actionProviders.length > 0 ? actionProviders.join(", ") : t("common.notConnected")}
              tone={actionProviders.length > 0 ? "ok" : "neutral"}
            />
            {!provider.quality.modelBacked && provider.quality.limitationKey && (
              <p className="pt-1 text-[13px] leading-relaxed text-ink-mute">{t(provider.quality.limitationKey)}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t("settings.capabilitiesTitle")}
            description={t("settings.capabilitiesBody", {
              connected: formatNumber(connected.length, locale),
              missing: formatNumber(missing.length, locale),
            })}
          />
          <CardBody>
            <ul className="space-y-2.5">
              {[...connected, ...missing].map((tool) => (
                <li key={tool.name} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    {/* A capability name is a Latin identifier. Isolating it lets
                        it read left-to-right while still sitting at the start of
                        the row in either direction. */}
                    <p className="text-[14px] font-medium text-ink bidi-isolate">{humanise(tool.name)}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-mute">
                      {tool.available || !tool.unavailableKey
                        ? t(tool.descriptionKey)
                        : t.ref(tool.unavailableKey, tool.unavailableParams)}
                    </p>
                  </div>
                  <Badge tone={tool.available ? "ok" : "neutral"} className="shrink-0">
                    {tool.available ? t("common.on") : t("common.notConnected")}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("settings.limitsTitle")} description={t("settings.limitsBody")} />
          <CardBody className="space-y-2 text-[14px]">
            <Row
              label={t("settings.maxFileSize")}
              value={`${formatNumber(Math.round(config.maxUploadBytes / (1024 * 1024)), locale)} MB`}
            />
            <Row label={t("settings.stepsPerRun")} value={formatNumber(config.maxAgentIterations, locale)} />
            <Row label={t("settings.toolCallsPerRun")} value={formatNumber(config.maxToolCalls, locale)} />
            <p className="pt-2 text-[13px] leading-relaxed text-ink-mute">{t("settings.limitsNote")}</p>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}

function Row({
  label,
  value,
  tone,
  literal = false,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "neutral";
  /** Addresses and identifiers read left to right in any interface language. */
  literal?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[13.5px] text-ink-mute">{label}</span>
      {tone ? (
        <Badge tone={tone}>{value}</Badge>
      ) : (
        <span
          dir={literal ? "ltr" : "auto"}
          className={`text-[13.5px] font-medium text-ink ${literal ? "bidi-isolate" : ""}`}
        >
          {value}
        </span>
      )}
    </div>
  );
}

function humanise(name: string): string {
  return name.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}
