import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { getBrowserModelContextPort } from "@intent-relay/webmcp";
import {
  Button,
  I18nProvider,
  LanguageSwitcher,
  Panel,
  parseLocale,
  useI18n,
  type Locale,
} from "@intent-relay/ui";
import { resolveOrigins } from "./config";
import { unresolvedDecisions } from "./domain/reducer";
import { createRelayStore } from "./domain/storage";
import {
  createProviderBridge,
  REQUIRED_GATHER_TOOLS,
  REQUIRED_ORBIT_TOOLS,
  type ProviderBridge,
  type ProviderInventory,
} from "./providers/providerBridge";
import { createRelayOrchestrator, type RelayOrchestrator } from "./webmcp/registerRelayTools";
import { AppHeader } from "./components/AppHeader";
import { ConnectionError } from "./components/ConnectionError";
import { UnsupportedBrowser } from "./components/UnsupportedBrowser";
import type { E2EHarness } from "./testing/createE2EPort";
import { StepNavigation } from "./components/StepNavigation";
import { ProviderFrame } from "./components/ProviderFrame";
import { ContractEditor } from "./components/ContractEditor";
import { CapabilityMap, MappingEvidence } from "./components/CapabilityMap";
import { HumanQueue } from "./components/HumanQueue";
import { RoleLabel } from "./components/RoleLabel";
import { TransferReview } from "./components/TransferReview";
import "@intent-relay/ui/styles.css";
import "./styles.css";

if (import.meta.env.PROD && import.meta.env.VITE_E2E_MODE !== undefined) {
  throw new Error("VITE_E2E_MODE must never be set for a production build");
}

const noSubscription = (): (() => void) => () => {};

function offlineInventory(origins: { gather: string; orbit: string }): ProviderInventory {
  return {
    gather: {
      origin: origins.gather,
      state: "disconnected",
      tools: [],
      missingTools: [...REQUIRED_GATHER_TOOLS],
    },
    orbit: {
      origin: origins.orbit,
      state: "disconnected",
      tools: [],
      missingTools: [...REQUIRED_ORBIT_TOOLS],
    },
  };
}

function Landing(): ReactNode {
  const { t } = useI18n();
  return (
    <main className="landing">
      <div className="landing-lang">
        <LanguageSwitcher />
      </div>
      <h1>Intent Relay</h1>
      <p className="landing-lede">{t("landing.lede")}</p>
      <ul className="landing-points">
        <li>{t("landing.point1")}</li>
        <li>{t("landing.point2")}</li>
        <li>{t("landing.point3")}</li>
        <li>{t("landing.point4")}</li>
      </ul>
      <a className="landing-cta" href="/workbench">
        {t("landing.cta")}
      </a>
      <p className="landing-sample">{t("landing.sample")}</p>
    </main>
  );
}

const STEP_HINT_KEYS = {
  demonstrate: "step.demonstrate.hint",
  verify_contract: "step.verify.hint",
  transfer: "step.transfer.hint",
  review: "step.review.hint",
} as const;

function Workbench(): ReactNode {
  const { locale, t } = useI18n();
  const store = useMemo(() => createRelayStore({ storage: window.localStorage }), []);
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const [configError, setConfigError] = useState<string | null>(null);
  const [sampleHint, setSampleHint] = useState(false);

  const origins = useMemo(() => {
    try {
      return resolveOrigins(import.meta.env);
    } catch (error) {
      setConfigError((error as Error).message);
      return null;
    }
  }, []);

  const e2eRequested = useMemo(
    () =>
      import.meta.env.MODE === "test" &&
      new URLSearchParams(window.location.search).get("e2e") === "1",
    [],
  );
  const [e2eHarness, setE2eHarness] = useState<E2EHarness | null>(null);
  useEffect(() => {
    if (import.meta.env.MODE !== "test") {
      return;
    }
    if (!e2eRequested || origins === null) {
      return;
    }
    let cancelled = false;
    void import("./testing/createE2EPort").then((module) => {
      if (!cancelled) {
        setE2eHarness(module.createE2EHarness(origins));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [e2eRequested, origins]);

  const browserPort = useMemo(
    () => (e2eRequested ? null : getBrowserModelContextPort(document)),
    [e2eRequested],
  );
  const port = e2eRequested ? (e2eHarness?.port ?? null) : browserPort;
  const bridge = useMemo<ProviderBridge | null>(() => {
    if (port === null || origins === null) {
      return null;
    }
    return createProviderBridge(port, { gather: origins.gather, orbit: origins.orbit });
  }, [port, origins]);

  useEffect(() => {
    if (bridge === null) {
      return;
    }
    const controller = new AbortController();
    bridge.start({ signal: controller.signal });
    return () => {
      controller.abort();
    };
  }, [bridge]);

  const orchestrator = useMemo<RelayOrchestrator | null>(() => {
    if (port === null || bridge === null) {
      return null;
    }
    return createRelayOrchestrator({ port, bridge, store });
  }, [port, bridge, store]);

  useEffect(() => {
    if (import.meta.env.MODE !== "test" || e2eHarness === null) {
      return;
    }
    return () => {
      e2eHarness.dispose();
    };
  }, [e2eHarness]);

  useEffect(() => {
    if (import.meta.env.MODE !== "test") {
      return;
    }
    if (e2eHarness === null || orchestrator === null) {
      return;
    }
    e2eHarness.attach(store);
    window.__INTENT_RELAY_E2E__ = {
      invokeTool: async (name, input) =>
        JSON.parse(await orchestrator.invokeTool(name, input)) as never,
      fixtures: {
        get proposedContract() {
          return e2eHarness.buildProposedContract();
        },
      },
      activeContractId: () => store.getState().activeContract?.id ?? null,
      activePreviewHash: () => store.getState().preview?.previewHash ?? null,
    };
    return () => {
      delete window.__INTENT_RELAY_E2E__;
    };
  }, [e2eHarness, orchestrator, store]);

  useEffect(() => {
    if (orchestrator === null) {
      return;
    }
    const controller = new AbortController();
    orchestrator.start({ signal: controller.signal });
    return () => {
      controller.abort();
    };
  }, [orchestrator]);

  const agentToolNames = useSyncExternalStore(
    orchestrator === null ? noSubscription : orchestrator.subscribe,
    orchestrator === null ? () => "" : () => orchestrator.registeredNames().join(", "),
  );
  const lastDemonstration = useSyncExternalStore(
    orchestrator === null ? noSubscription : orchestrator.subscribe,
    orchestrator === null ? () => null : orchestrator.getLastDemonstration,
  );

  const fallbackInventory = useMemo(
    () => offlineInventory({ gather: origins?.gather ?? "—", orbit: origins?.orbit ?? "—" }),
    [origins],
  );
  const inventory = useSyncExternalStore(
    bridge === null ? noSubscription : bridge.subscribe,
    bridge === null ? () => fallbackInventory : bridge.getInventory,
  );

  if (origins === null) {
    return (
      <main className="workbench">
        <ConnectionError title={t("fail.configTitle")} message={configError ?? undefined} />
      </main>
    );
  }

  // `lang` is presentation-only: providers read it for UI copy, never for state.
  const gatherUrl = `${origins.gather}/?demoSessionId=${state.demoSessionId}&lang=${locale}`;
  const orbitUrl = `${origins.orbit}/?demoSessionId=${state.demoSessionId}&lang=${locale}`;
  const unresolvedCount = unresolvedDecisions(state).length;
  const registeredToolNames = agentToolNames === "" ? [] : agentToolNames.split(", ");

  return (
    <main className="workbench">
      <AppHeader demoSessionId={state.demoSessionId} onReset={() => store.resetDemo()} />
      {import.meta.env.MODE === "test" && e2eHarness !== null && (
        <p className="e2e-banner" role="status">
          E2E TEST ADAPTER ACTIVE — deterministic in-page providers; not evidence of real
          cross-origin WebMCP.
        </p>
      )}
      {port === null && !e2eRequested && <UnsupportedBrowser />}
      {import.meta.env.MODE === "test" && port === null && e2eRequested && (
        <p className="panel-note" role="status">
          Loading the E2E test adapter…
        </p>
      )}
      <div className="workbench-columns">
        <ProviderFrame
          key={`gather-${state.demoSessionId}`}
          title="Gather source provider"
          roleLabel={t("relay.embeddedSource")}
          url={gatherUrl}
          status={inventory.gather}
        />

        <section className="relay-column" aria-label="Intent Relay">
          {bridge !== null &&
            inventory.gather.state !== "connected" &&
            inventory.gather.state !== "connecting" && (
              <ConnectionError
                title={t("fail.gatherTitle")}
                origin={inventory.gather.origin}
                state={inventory.gather.state}
                onRetry={() => void bridge.refresh()}
              />
            )}
          {bridge !== null &&
            inventory.orbit.state !== "connected" &&
            inventory.orbit.state !== "connecting" && (
              <ConnectionError
                title={t("fail.orbitTitle")}
                origin={inventory.orbit.origin}
                state={inventory.orbit.state}
                onRetry={() => void bridge.refresh()}
              />
            )}
          <div className="agent-tools" aria-label="Agent tools">
            <details className="agent-tools-details">
              <summary>
                <RoleLabel role="agent" />{" "}
                {registeredToolNames.length === 0
                  ? t("relay.tools.none")
                  : t("relay.tools.some", { n: registeredToolNames.length })}
              </summary>
              {registeredToolNames.length > 0 && (
                <ul className="agent-tools-list">
                  {registeredToolNames.map((name) => (
                    <li key={name}>
                      <code>{name}</code>
                    </li>
                  ))}
                </ul>
              )}
            </details>
            {lastDemonstration !== null && (
              <span className="state-text state-ok">
                ✓ {t("relay.tools.inspected", { n: lastDemonstration.trace.actions.length })}
              </span>
            )}
          </div>
          <StepNavigation
            step={state.step}
            onNavigate={(step) => store.dispatch({ type: "goToStep", step })}
          />
          <p className="step-hint">{t(STEP_HINT_KEYS[state.step])}</p>

          {state.step === "demonstrate" && (
            <Panel heading={t("demo.heading")} badge={<RoleLabel role="you" />}>
              <p className="demo-pointer">← {t("demo.useGather")}</p>
              <p className="demo-shortcut">
                <span className="panel-note">{t("demo.shortcut")}</span>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (e2eHarness !== null) {
                      e2eHarness.seedSampleDemonstration();
                    } else {
                      setSampleHint(true);
                    }
                  }}
                >
                  {t("demo.loadSample")}
                </Button>
              </p>
              {sampleHint && (
                <p className="panel-note" role="status">
                  {t("demo.hintAfterClick")}
                </p>
              )}
            </Panel>
          )}

          {state.step === "verify_contract" && (
            <ContractEditor
              contract={state.activeContract}
              onSetRuleStatus={(ruleId, humanStatus) =>
                store.dispatch({ type: "setRuleStatus", ruleId, humanStatus })
              }
              onApproveContract={() =>
                store.dispatch({
                  type: "approveContractByHuman",
                  approvedAt: new Date().toISOString(),
                })
              }
              onReviseContract={() => store.dispatch({ type: "reviseContract" })}
            />
          )}

          {state.step === "transfer" && (
            <>
              <CapabilityMap preview={state.preview} />
              <HumanQueue
                preview={state.preview}
                contract={state.activeContract}
                resolutions={state.resolutions}
                onResolve={(ruleId, alternativeId) =>
                  store.dispatch({
                    type: "resolveDecision",
                    ruleId,
                    alternativeId,
                    resolvedAt: new Date().toISOString(),
                  })
                }
              />
              {unresolvedCount > 0 && (
                <p className="panel-note blocking-note" role="status">
                  {t("queue.blockBanner", { n: unresolvedCount })}
                </p>
              )}
              <MappingEvidence preview={state.preview} contract={state.activeContract} />
            </>
          )}

          {state.step === "review" && (
            <TransferReview
              preview={state.preview}
              contract={state.activeContract}
              resolutions={state.resolutions}
              targetDraft={state.targetDraft}
            />
          )}
        </section>

        <ProviderFrame
          key={`orbit-${state.demoSessionId}`}
          title="Orbit destination provider"
          roleLabel={t("relay.embeddedTarget")}
          url={orbitUrl}
          status={inventory.orbit}
        />
      </div>
    </main>
  );
}

// Presentation-only preference; independent of demoSessionId, so Reset demo
// never changes the language. Never stored inside domain state.
const LOCALE_STORAGE_KEY = "intent-relay:relay:locale";

function readStoredLocale(): Locale {
  try {
    return parseLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return "en";
  }
}

export function App(): ReactNode {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // persistence is a convenience; the in-memory locale still applies
    }
  }, []);
  return (
    <I18nProvider locale={locale} setLocale={setLocale}>
      {window.location.pathname === "/workbench" ? <Workbench /> : <Landing />}
    </I18nProvider>
  );
}
