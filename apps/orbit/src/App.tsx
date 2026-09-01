import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { getBrowserModelContextPort } from "@intent-relay/webmcp";
import { I18nProvider, parseLocale, useI18n, type Locale } from "@intent-relay/ui";
import { resolveOrigins } from "./config";
import { createOrbitStore } from "./domain/commands";
import { parseDemoSessionId } from "./domain/storage";
import { CapabilityPanel } from "./components/CapabilityPanel";
import { EventDraft } from "./components/EventDraft";
import { registerOrbitTools } from "./webmcp/registerOrbitTools";
import "./styles.css";

type WebMCPStatus =
  | { kind: "connecting" }
  | { kind: "registered"; toolNames: string[]; relayOrigin: string }
  | { kind: "unavailable" }
  | { kind: "config_error"; message: string }
  | { kind: "registration_error"; message: string };

const ORBIT_TOOL_NAMES = ["describe_event_capabilities", "prepare_event_draft", "read_event_draft"];

function ConsoleStatus({
  status,
  demoSessionId,
}: {
  status: WebMCPStatus;
  demoSessionId: string;
}): ReactNode {
  const { t } = useI18n();
  return (
    <section className="card card-status" aria-labelledby="console-status-heading">
      <h2 id="console-status-heading">{t("orbit.status.heading")}</h2>
      <dl className="status-rows">
        <div>
          <dt>{t("gather.status.session")}</dt>
          <dd>
            <code>{demoSessionId}</code> · {t("common.sample")}
          </dd>
        </div>
        <div>
          <dt>{t("orbit.status.local")}</dt>
          <dd>{t("orbit.status.localValue")}</dd>
        </div>
        <div>
          <dt>WebMCP</dt>
          <dd>
            {status.kind === "registered" && (
              <>
                ✓ {status.toolNames.length} → <code>{status.relayOrigin}</code>
                <span className="status-tools">{status.toolNames.join(", ")}</span>
              </>
            )}
            {status.kind === "unavailable" && t("gather.status.unavailable")}
            {status.kind === "config_error" && `✕ Origin configuration error: ${status.message}`}
            {status.kind === "registration_error" &&
              `✕ Tool registration failed — no Orbit tools are exposed: ${status.message}`}
            {status.kind === "connecting" && t("common.connecting")}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function SessionError({ message }: { message: string }): ReactNode {
  const { t } = useI18n();
  return (
    <main className="console">
      <header className="console-header">
        <h1>Orbit Events</h1>
        <p className="strapline">
          {t("orbit.tagline")} · {t("common.sample")}
        </p>
      </header>
      <section className="card card-error" role="alert">
        <h2>{t("orbit.sessionError.title")}</h2>
        <p>{message}</p>
      </section>
    </main>
  );
}

function OrbitApp({ demoSessionId }: { demoSessionId: string }): ReactNode {
  const { t } = useI18n();
  const store = useMemo(
    () => createOrbitStore({ demoSessionId, storage: window.localStorage }),
    [demoSessionId],
  );
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const [status, setStatus] = useState<WebMCPStatus>({ kind: "connecting" });

  useEffect(() => {
    const port = getBrowserModelContextPort(document);
    if (port === null) {
      setStatus({ kind: "unavailable" });
      return;
    }
    let relayOrigin: string;
    try {
      relayOrigin = resolveOrigins(import.meta.env).relay;
    } catch (error) {
      setStatus({ kind: "config_error", message: (error as Error).message });
      return;
    }
    const controller = new AbortController();
    registerOrbitTools(port, relayOrigin, store, { signal: controller.signal }).then(
      () => {
        if (!controller.signal.aborted) {
          setStatus({ kind: "registered", toolNames: ORBIT_TOOL_NAMES, relayOrigin });
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setStatus({
            kind: "registration_error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );
    return () => {
      controller.abort();
    };
  }, [store]);

  return (
    <main className="console">
      <header className="console-header">
        <h1>Orbit Events</h1>
        <p className="strapline">
          {t("orbit.tagline")} · {t("common.sample")}
        </p>
      </header>
      <EventDraft
        state={state}
        onPublish={() => store.dispatchOrbitCommand({ type: "publishEvent" }, "human")}
      />
      <div className="console-columns">
        <CapabilityPanel />
        <ConsoleStatus status={status} demoSessionId={demoSessionId} />
      </div>
    </main>
  );
}

export function App(): ReactNode {
  // The embedding Workbench passes `lang` for presentation only; it never
  // affects capabilities, drafts, or the publication boundary.
  const locale: Locale = useMemo(
    () => parseLocale(new URLSearchParams(window.location.search).get("lang")),
    [],
  );
  const session = useMemo(() => {
    try {
      return { ok: true as const, id: parseDemoSessionId(window.location.search) };
    } catch (error) {
      return { ok: false as const, message: (error as Error).message };
    }
  }, []);

  return (
    <I18nProvider locale={locale}>
      {session.ok ? (
        <OrbitApp demoSessionId={session.id} />
      ) : (
        <SessionError message={session.message} />
      )}
    </I18nProvider>
  );
}
