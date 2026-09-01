import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { getBrowserModelContextPort } from "@intent-relay/webmcp";
import { I18nProvider, parseLocale, useI18n, type Locale } from "@intent-relay/ui";
import { resolveOrigins } from "./config";
import { createGatherStore } from "./domain/commands";
import { parseDemoSessionId } from "./domain/storage";
import { EventForm } from "./components/EventForm";
import { TracePanel } from "./components/TracePanel";
import { registerGatherTools } from "./webmcp/registerGatherTools";
import "./styles.css";

type WebMCPStatus =
  | { kind: "connecting" }
  | { kind: "registered"; toolNames: string[]; relayOrigin: string }
  | { kind: "unavailable" }
  | { kind: "config_error"; message: string }
  | { kind: "registration_error"; message: string };

function ProviderStatus({
  status,
  demoSessionId,
}: {
  status: WebMCPStatus;
  demoSessionId: string;
}): ReactNode {
  const { t } = useI18n();
  return (
    <section className="panel panel-status" aria-labelledby="status-heading">
      <h2 id="status-heading">{t("gather.status.heading")}</h2>
      <dl className="status-list">
        <div>
          <dt>{t("gather.status.session")}</dt>
          <dd>
            <code>{demoSessionId}</code>
          </dd>
        </div>
        <div>
          <dt>{t("gather.status.save")}</dt>
          <dd>{t("gather.status.saved")}</dd>
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
            {status.kind === "config_error" && `✕ ${status.message}`}
            {status.kind === "registration_error" &&
              `✕ Tool registration failed — no Gather tools are exposed: ${status.message}`}
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
    <main className="app">
      <header className="app-header">
        <h1>Gather</h1>
        <p className="tagline">
          {t("gather.tagline")} · {t("common.sample")}
        </p>
      </header>
      <section className="panel panel-error" role="alert">
        <h2>{t("gather.sessionError.title")}</h2>
        <p>{message}</p>
      </section>
    </main>
  );
}

function GatherApp({ demoSessionId }: { demoSessionId: string }): ReactNode {
  const { t } = useI18n();
  const store = useMemo(
    () => createGatherStore({ demoSessionId, storage: window.localStorage }),
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
    registerGatherTools(port, relayOrigin, store.getState, {
      signal: controller.signal,
    }).then(
      () => {
        if (!controller.signal.aborted) {
          setStatus({
            kind: "registered",
            toolNames: ["read_event_state", "read_setup_trace"],
            relayOrigin,
          });
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
    <main className="app">
      <header className="app-header">
        <h1>Gather</h1>
        <p className="tagline">
          {t("gather.tagline")} · {t("common.sample")}
        </p>
      </header>
      <div className="columns">
        <EventForm
          event={state.event}
          completed={state.trace.completed}
          dispatch={(command) => store.dispatchGatherCommand(command, "human")}
          onComplete={() => store.dispatchGatherCommand({ type: "completeDemonstration" }, "human")}
        />
        <div className="column">
          <TracePanel trace={state.trace} />
          <ProviderStatus status={status} demoSessionId={demoSessionId} />
        </div>
      </div>
    </main>
  );
}

export function App(): ReactNode {
  // The embedding Workbench passes `lang` for presentation only; it never
  // affects tool registration, semantic traces, or stored provider state.
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
        <GatherApp demoSessionId={session.id} />
      ) : (
        <SessionError message={session.message} />
      )}
    </I18nProvider>
  );
}
