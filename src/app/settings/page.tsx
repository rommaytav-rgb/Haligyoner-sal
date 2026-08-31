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

export const dynamic = "force-dynamic";

/**
 * Settings doubles as the transparency screen: exactly what is connected, what
 * is not, and what that means for what the product can do (sections 23, 59).
 */
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/settings");

  const unread = await unreadCount(user.id);
  const provider = getAIProvider();
  const tools = listTools();
  const connected = tools.filter((t) => t.available);
  const missing = tools.filter((t) => !t.available);
  const actionProviders = listActionProviders();

  return (
    <AppShell user={user} unread={unread}>
      <h1 className="display text-[28px] text-ink">Settings</h1>

      <div className="mt-6 space-y-5">
        <Card>
          <CardHeader title="Your account" />
          <CardBody className="space-y-2 text-[14px]">
            <Row label="Email" value={user.email} />
            {user.displayName && <Row label="Name" value={user.displayName} />}
            <p className="pt-2 text-[13px] leading-relaxed text-ink-mute">
              Your cases, files and conversations are private to this account. We only ask for information when a case
              actually needs it.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="What's connected"
            description="What this deployment can actually do right now."
          />
          <CardBody className="space-y-3">
            <Row
              label="Understanding"
              value={
                provider.quality.modelBacked
                  ? "Connected"
                  : "Rule-based only"
              }
              tone={provider.quality.modelBacked ? "ok" : "warn"}
            />
            <Row
              label="Web research"
              value={capabilities.webResearch ? "Connected" : "Not connected"}
              tone={capabilities.webResearch ? "ok" : "neutral"}
            />
            <Row
              label="File storage"
              value={capabilities.cloudStorage ? "Cloud Storage" : "Local (development)"}
              tone={capabilities.cloudStorage ? "ok" : "neutral"}
            />
            <Row
              label="Database"
              value={capabilities.firestore ? "Firestore" : "Local (development)"}
              tone={capabilities.firestore ? "ok" : "neutral"}
            />
            <Row
              label="Sending on your behalf"
              value={actionProviders.length > 0 ? actionProviders.join(", ") : "Not connected"}
              tone={actionProviders.length > 0 ? "ok" : "neutral"}
            />
            {!provider.quality.modelBacked && provider.quality.limitationNote && (
              <p className="pt-1 text-[13px] leading-relaxed text-ink-mute">{provider.quality.limitationNote}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Capabilities"
            description={`${connected.length} connected, ${missing.length} not yet available.`}
          />
          <CardBody>
            <ul className="space-y-2.5">
              {[...connected, ...missing].map((tool) => (
                <li key={tool.name} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-ink">{humanise(tool.name)}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-mute">
                      {tool.available ? tool.description : tool.unavailableReason ?? tool.description}
                    </p>
                  </div>
                  <Badge tone={tool.available ? "ok" : "neutral"} className="shrink-0">
                    {tool.available ? "On" : "Not connected"}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Limits" description="Guardrails that apply to every case." />
          <CardBody className="space-y-2 text-[14px]">
            <Row label="Maximum file size" value={`${Math.round(config.maxUploadBytes / (1024 * 1024))} MB`} />
            <Row label="Steps per run" value={String(config.maxAgentIterations)} />
            <Row label="Tool calls per run" value={String(config.maxToolCalls)} />
            <p className="pt-2 text-[13px] leading-relaxed text-ink-mute">
              Nothing is ever sent on your behalf without you approving exactly what it says.
            </p>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "neutral" }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[13.5px] text-ink-mute">{label}</span>
      {tone ? (
        <Badge tone={tone}>{value}</Badge>
      ) : (
        <span className="text-[13.5px] font-medium text-ink">{value}</span>
      )}
    </div>
  );
}

function humanise(name: string): string {
  return name.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}
