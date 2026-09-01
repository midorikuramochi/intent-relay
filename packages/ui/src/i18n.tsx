import { createContext, useContext, type ReactNode } from "react";

export type Locale = "en" | "ja";

export function parseLocale(value: string | null | undefined): Locale {
  return value === "ja" ? "ja" : "en";
}

/**
 * Presentation-only localization. Nothing in here may ever feed WebMCP tool
 * names, schemas, semantic keys, contract data, capability manifests, mapping
 * results, hashes, or provider payloads — those stay locale-independent.
 */
const en = {
  // common
  "common.sample": "Sample data",
  "common.you": "You",
  "common.agent": "Agent",
  "common.webmcp": "WebMCP",
  "common.technicalDetails": "Technical details",
  "common.connected": "● Connected",
  "common.connecting": "◌ Connecting",
  "common.incomplete": "◑ Incomplete",
  "common.disconnected": "✕ Disconnected",

  // landing
  "landing.lede":
    "Demonstrate a workflow once in one WebMCP-enabled website, review the inferred intent as a structured contract, and carry it to a different provider with different capabilities. Intent Relay does not replay clicks — it translates goals, constraints, preferences, and approval boundaries, and it asks you whenever the destination cannot preserve them.",
  "landing.point1":
    "An agent coordinates the workflow through WebMCP; this Workbench is the shared work surface.",
  "landing.point2": "Every proposed rule cites the source actions that justify it.",
  "landing.point3": "Unsupported intent stays visible — nothing disappears silently.",
  "landing.point4": "Publishing always remains a human action inside Orbit.",
  "landing.cta": "Open the Workbench",
  "landing.sample": "All data in this prototype is labeled sample data.",

  // relay header / model
  "relay.tagline": "Your workflow should belong to you — not the website.",
  "relay.model":
    "You demonstrate and decide · the agent translates and prepares · websites expose WebMCP capabilities.",
  "relay.publicationBadge": "Human approval required for publication",
  "relay.session": "Session",
  "relay.reset": "Reset demo",
  "relay.embeddedSource": "Embedded source provider",
  "relay.embeddedTarget": "Embedded destination provider",
  "relay.tools.none": "WebMCP · waiting for the demonstration",
  "relay.tools.some": "WebMCP · {n} agent tool(s) available",
  "relay.tools.inspected": "Source trace inspected ({n} actions)",
  "provider.tools": "{n} tool(s)",
  "provider.missing": "missing: {names}",

  // steps
  "step.demonstrate": "1 · Demonstrate",
  "step.verify": "2 · Verify Contract",
  "step.transfer": "3 · Transfer",
  "step.review": "4 · Review",
  "step.demonstrate.hint":
    "Set up the event the way you normally would. Gather records semantic actions — not clicks.",
  "step.verify.hint":
    "Review what Intent Relay inferred from your demonstration. You decide what becomes reusable intent.",
  "step.transfer.hint":
    "Intent Relay compares your approved intent with Orbit's capabilities. It will not guess when they differ.",
  "step.review.hint":
    "Review what was preserved, adapted, omitted, and decided by you. Only you can publish.",

  // demonstrate step panel
  "demo.heading": "Demonstrate in Gather",
  "demo.loadSample": "Load sample demonstration",
  "demo.useGather":
    "Use the Gather panel on the left to demonstrate your workflow. Gather records semantic actions as you work.",
  "demo.shortcut": "Demo shortcut:",
  "demo.hintAfterClick":
    "Use “Replay sample demonstration” inside the Gather panel, then “Mark demonstration complete”. Gather owns the source state; Relay never edits it behind the scenes.",

  // contract editor
  "contract.panelTitle": "Intent Contract",
  "contract.heading": "Intent Contract · revision {n}",
  "contract.badge.draft": "◐ Draft — awaiting your approval",
  "contract.badge.approved": "✓ Approved {ts}",
  "contract.source": "Source: {provider} trace {trace} captured {ts}.",
  "contract.youDecide": "You decide which observed choices become reusable intent.",
  "contract.col.rule": "Rule",
  "contract.col.value": "Value",
  "contract.col.provenance": "Provenance",
  "contract.col.status": "Your review",
  "contract.col.actions": "Actions",
  "contract.status.proposed": "? Proposed",
  "contract.status.approved": "✓ Approved",
  "contract.status.excluded": "⊘ Excluded",
  "contract.approveRule": "Approve rule",
  "contract.excludeRule": "Exclude",
  "contract.approve": "Approve contract",
  "contract.revise": "Revise contract",
  "contract.locked": "Locked",
  "contract.proposedRemaining": "{n} rule(s) still proposed — approve or exclude each rule first.",
  "contract.immutable":
    "An approved contract is immutable during a transfer. Revising creates draft revision {n}.",
  "contract.empty.title": "No proposed contract yet",
  "contract.empty.body":
    "Complete the demonstration in Gather, then ask the agent to inspect it and save a version 0.1 Intent Contract draft. Every rule must cite source action IDs.",

  // capability map
  "map.heading": "Capability map",
  "map.summary": "How your approved intent lands on Orbit ({version}):",
  "map.status.direct": "Preserved",
  "map.status.transformed": "Adapted",
  "map.status.unsupported": "Not transferable",
  "map.status.needs_decision": "Needs your decision",
  "map.unsupportedNote":
    "Orbit does not support this intent, so Intent Relay will not silently transfer it.",
  "map.col.rule": "Rule",
  "map.col.status": "Status",
  "map.col.outcome": "Outcome on Orbit",
  "map.empty.title": "No compatibility preview yet",
  "map.empty.body":
    "After you approve the contract, ask the agent to inspect Orbit compatibility. Every approved rule receives exactly one explicit status — nothing disappears silently.",
  "map.preview":
    "Preview {hash} for contract revision {n}, computed from Orbit's declared capabilities.",
  "map.evidence": "Mapping evidence",
  "map.showPreserved": "Show the {n} preserved (direct) mappings",

  // human queue
  "queue.panel": "Human Queue",
  "queue.heading": "Your decision is needed",
  "queue.sub": "Orbit represents this differently. Intent Relay will not guess for you.",
  "queue.decided": "✓ All decisions recorded",
  "queue.unresolvedBadge": "⚑ {n} unresolved",
  "queue.blocking":
    "{n} decision(s) must be resolved before the agent can prepare the Orbit draft. The agent never chooses for you.",
  "queue.record": "Record decision",
  "queue.blockBanner": "⚑ {n} unresolved decision(s) block draft preparation.",
  "queue.decidedChip": "✓ Decided",
  "queue.requiredChip": "⚑ Decision required",
  "queue.empty.title": "No decisions waiting",
  "queue.empty.body": "Semantic gaps that need your judgment will appear here.",

  // transfer review
  "review.panel": "Transfer review",
  "review.ready": "Your intent is ready in Orbit",
  "review.counts":
    "{direct} preserved · {transformed} adapted · {unsupported} omitted · {decided} decided by you",
  "review.finalStep": "Final step",
  "review.finalBody": "Review the prepared draft in Orbit and publish it yourself.",
  "review.quote": "Intent Relay can prepare. Only you can publish.",
  "review.waiting": "Waiting for human publication",
  "review.notTransferred": "Not transferred (unsupported by Orbit)",
  "review.excludedByYou": "Excluded by you during contract review",
  "review.yourDecisions": "Your recorded decisions",
  "review.decisionRecorded": "{label} (recorded {ts})",
  "review.empty.title": "No prepared Orbit draft yet",
  "review.empty.body":
    "After every decision is resolved, ask the agent to prepare the Orbit draft with the current preview hash. The review will report exactly what was preserved, transformed, excluded, and decided.",
  "review.meta": "Orbit draft {draft} · revision {n} · publication: {publication}.",
  "review.humanOnly":
    "Publishing happens only through the Publish button inside Orbit — never through a tool.",

  // failure states
  "fail.webmcp.title": "WebMCP unavailable",
  "fail.webmcp.badge": "✕ document.modelContext missing",
  "fail.webmcp.body":
    "This browser does not expose the WebMCP Imperative API, so agent actions are disabled. The sample provider states below remain readable for inspection, and no tool call is mocked or substituted.",
  "fail.webmcp.hint":
    "To run the live demo, use a WebMCP-capable Chrome (WebMCP testing flag or origin trial). Everything a human can review on this page stays visible without it.",
  "fail.connection.badge": "✕ Not connected",
  "fail.connection.pre": "Provider origin",
  "fail.connection.post":
    "is {state}. Cross-provider steps stay unavailable until its WebMCP tools are discovered again.",
  "fail.retry": "Retry discovery",
  "fail.gatherTitle": "Gather source provider not connected",
  "fail.orbitTitle": "Orbit destination provider not connected",
  "fail.configTitle": "Origin configuration error",

  // gather
  "gather.tagline": "Fictional source event provider",
  "gather.form.heading": "Event setup",
  "gather.replay": "Replay sample demonstration",
  "gather.complete": "Mark demonstration complete",
  "gather.completed": "Demonstration complete",
  "gather.field.title": "Event title",
  "gather.field.schedule": "Schedule",
  "gather.field.starts": "Starts",
  "gather.field.ends": "Ends",
  "gather.field.timezone": "Timezone",
  "gather.field.capacity": "Maximum attendees",
  "gather.field.admission": "Admission",
  "gather.field.free": "Free admission",
  "gather.field.paid": "Paid tickets",
  "gather.field.reminder": "Reminder (hours before start)",
  "gather.field.note": "Accessibility note for attendees",
  "gather.field.overflow": "When registration is full",
  "gather.field.overflow.placeholder": "Choose overflow handling",
  "gather.field.overflow.waitlist": "Enable the native waitlist",
  "gather.field.overflow.close": "Close registration",
  "gather.field.dietary": "Dietary restrictions question",
  "gather.field.dietary.placeholder": "Choose whether to ask",
  "gather.field.dietary.optional": "Ask as an optional question",
  "gather.field.dietary.required": "Ask as a required question",
  "gather.field.publication": "Publication requires my review (approval boundary)",
  "gather.trace.heading": "Semantic trace",
  "gather.trace.complete": "✓ Complete",
  "gather.trace.recording": "● Recording",
  "gather.trace.note":
    "Gather records what changed and what it meant — never pointer coordinates or CSS selectors.",
  "gather.trace.empty": "No semantic actions yet. Configure the event to record some.",
  "gather.status.heading": "Provider status",
  "gather.status.session": "Demo session",
  "gather.status.save": "Save state",
  "gather.status.saved": "✓ Saved to this browser (session-scoped)",
  "gather.status.tools": "✓ {n} tools exposed to {origin}: {names}",
  "gather.status.unavailable":
    "✕ Unavailable — this browser does not provide document.modelContext",
  "gather.sessionError.title": "Demo session required",

  // orbit
  "orbit.tagline": "Fictional destination event provider",
  "orbit.draft.heading": "Listing draft",
  "orbit.chip.waiting": "◷ Awaiting publication",
  "orbit.chip.published": "✓ Published",
  "orbit.chip.none": "— No draft yet",
  "orbit.empty":
    "No listing draft yet. Intent Relay prepares a draft here after you review the compatibility mapping — Orbit never receives unreviewed intent.",
  "orbit.field.name": "Listing name",
  "orbit.field.when": "When",
  "orbit.field.seats": "Seat limit",
  "orbit.field.seatsValue": "{n} seats",
  "orbit.field.admission": "Admission",
  "orbit.field.free": "Free entry",
  "orbit.field.paid": "Paid tickets",
  "orbit.field.reminder": "Attendee reminder",
  "orbit.field.reminderValue": "{n} day(s) before start",
  "orbit.field.reminderNone": "Not scheduled",
  "orbit.field.venueNote": "Venue access note",
  "orbit.field.venueNoteNone": "None recorded",
  "orbit.field.overflow": "When seats run out",
  "orbit.field.overflowNone": "Not configured",
  "orbit.publish": "Publish event",
  "orbit.published": "Event published",
  "orbit.publishNote":
    "Publishing is a human-only control on this page. No WebMCP tool can trigger it.",
  "orbit.capabilities.heading": "Declared capabilities",
  "orbit.capabilities.note":
    "Orbit exposes exactly this manifest through describe_event_capabilities. Mapping decisions are driven by these declarations, never guessed.",
  "orbit.capabilities.accepts": "Accepts",
  "orbit.capabilities.constraints": "Constraints",
  "orbit.capabilities.unsupported": "Not supported",
  "orbit.capabilities.humanOnly": "Human-only actions",
  "orbit.status.heading": "Console status",
  "orbit.status.local": "Local save",
  "orbit.status.localValue": "✓ Stored in this browser under the session namespace",
  "orbit.sessionError.title": "Demo session required",
} as const;

export type MessageKey = keyof typeof en;

const ja: Record<MessageKey, string> = {
  "common.sample": "サンプルデータ",
  "common.you": "あなた",
  "common.agent": "エージェント",
  "common.webmcp": "WebMCP",
  "common.technicalDetails": "技術情報",
  "common.connected": "● 接続済み",
  "common.connecting": "◌ 接続しています",
  "common.incomplete": "◑ 不完全",
  "common.disconnected": "✕ 未接続",

  "landing.lede":
    "WebMCP 対応サイトでワークフローを一度実演し、推定された意図を構造化された契約として確認し、能力の異なる別のプロバイダへ持ち運びます。Intent Relay はクリックを再生しません — 目標・制約・好み・承認境界を翻訳し、移行先で保てないときは必ずあなたに尋ねます。",
  "landing.point1":
    "エージェントは WebMCP を通じてワークフローを調整し、この Workbench が共有の作業面になります。",
  "landing.point2": "提案されるすべてのルールは、根拠となる実演アクションを引用します。",
  "landing.point3": "非対応の意図も見えたまま — 黙って消えるものはありません。",
  "landing.point4": "公開は常に Orbit 内での人間の操作です。",
  "landing.cta": "Workbench を開く",
  "landing.sample": "このプロトタイプのデータはすべてサンプルデータと明示されています。",
  "relay.tagline": "ワークフローはあなたのもの — ウェブサイトのものではありません。",
  "relay.model":
    "あなたが実演し、決定する · エージェントが翻訳し、準備する · ウェブサイトは WebMCP で能力を公開する。",
  "relay.publicationBadge": "公開には人間の承認が必要です",
  "relay.session": "セッション",
  "relay.reset": "デモをリセット",
  "relay.embeddedSource": "埋め込み: 移行元プロバイダ",
  "relay.embeddedTarget": "埋め込み: 移行先プロバイダ",
  "relay.tools.none": "WebMCP · 実演の完了を待っています",
  "relay.tools.some": "WebMCP · エージェント用ツール {n} 件",
  "relay.tools.inspected": "実演トレースを取得済み({n} アクション)",
  "provider.tools": "ツール {n} 件",
  "provider.missing": "不足: {names}",

  "step.demonstrate": "1 · 実演",
  "step.verify": "2 · 契約を確認",
  "step.transfer": "3 · 移行",
  "step.review": "4 · 最終確認",
  "step.demonstrate.hint":
    "いつも通りにイベントを設定してください。Gather はクリックではなく意味のある操作を記録します。",
  "step.verify.hint":
    "Intent Relay が実演から推定した内容を確認します。何を再利用可能な意図にするかは、あなたが決めます。",
  "step.transfer.hint":
    "Intent Relay は承認済みの意図を Orbit の能力と照合します。違いがあるとき、勝手に推測することはありません。",
  "step.review.hint":
    "何がそのまま移行され、何が変換され、何が省かれ、何をあなたが決めたのかを確認します。公開できるのはあなただけです。",

  "demo.heading": "Gather で実演する",
  "demo.loadSample": "サンプル実演を読み込む",
  "demo.useGather":
    "左の Gather パネルでいつも通りに操作してください。Gather は操作の意味をそのまま記録します。",
  "demo.shortcut": "デモ用ショートカット:",
  "demo.hintAfterClick":
    "左の Gather パネル内で「サンプル実演を再現」を押し、続けて「実演を完了にする」を押してください。移行元の状態は Gather が所有し、Relay が裏で書き換えることはありません。",

  "contract.panelTitle": "インテント契約",
  "contract.heading": "インテント契約 · 改訂 {n}",
  "contract.badge.draft": "◐ 下書き — あなたの承認待ち",
  "contract.badge.approved": "✓ 承認済み {ts}",
  "contract.source": "取得元: {provider} トレース {trace}({ts} 取得)。",
  "contract.youDecide": "どの操作を再利用可能な意図にするかは、あなたが決めます。",
  "contract.col.rule": "ルール",
  "contract.col.value": "値",
  "contract.col.provenance": "根拠",
  "contract.col.status": "あなたの確認",
  "contract.col.actions": "操作",
  "contract.status.proposed": "? 未確認",
  "contract.status.approved": "✓ 承認済み",
  "contract.status.excluded": "⊘ 除外",
  "contract.approveRule": "承認",
  "contract.excludeRule": "除外",
  "contract.approve": "契約を承認",
  "contract.revise": "契約を改訂",
  "contract.locked": "確定済み",
  "contract.proposedRemaining":
    "未確認のルールが {n} 件あります — 各ルールを承認または除外してください。",
  "contract.immutable":
    "承認済みの契約は移行中は変更できません。改訂すると下書き改訂 {n} が作成されます。",
  "contract.empty.title": "提案された契約はまだありません",
  "contract.empty.body":
    "Gather で実演を完了し、エージェントに実演の取得と version 0.1 インテント契約の下書き保存を依頼してください。すべてのルールは実演アクション ID を根拠として引用します。",

  "map.heading": "対応マップ",
  "map.summary": "承認済みの意図が Orbit({version})でどう扱われるか:",
  "map.status.direct": "そのまま移行",
  "map.status.transformed": "変換して移行",
  "map.status.unsupported": "移行不可",
  "map.status.needs_decision": "あなたの判断が必要",
  "map.unsupportedNote":
    "Orbit がこの意図に対応していないため、Intent Relay は黙って移行しません。",
  "map.col.rule": "ルール",
  "map.col.status": "状態",
  "map.col.outcome": "Orbit での扱い",
  "map.empty.title": "互換性プレビューはまだありません",
  "map.empty.body":
    "契約を承認したら、エージェントに Orbit との互換性検査を依頼してください。承認済みの各ルールに必ず 1 つの明示的な状態が付きます — 黙って消えるものはありません。",
  "map.preview": "プレビュー {hash}(契約改訂 {n})。Orbit が宣言した能力から算出。",
  "map.evidence": "マッピングの根拠",
  "map.showPreserved": "そのまま移行される {n} 件(direct)を表示",

  "queue.panel": "あなたの判断キュー",
  "queue.heading": "あなたの判断が必要です",
  "queue.sub": "Orbit では表現が異なります。Intent Relay が代わりに選ぶことはありません。",
  "queue.decided": "✓ すべての判断を記録済み",
  "queue.unresolvedBadge": "⚑ 未解決 {n} 件",
  "queue.blocking":
    "エージェントが Orbit の下書きを準備する前に、{n} 件の判断が必要です。エージェントが代わりに選ぶことはありません。",
  "queue.record": "この選択を記録",
  "queue.blockBanner": "⚑ 未解決の判断が {n} 件あり、下書きの準備を妨げています。",
  "queue.decidedChip": "✓ 決定済み",
  "queue.requiredChip": "⚑ 判断待ち",
  "queue.empty.title": "判断待ちの項目はありません",
  "queue.empty.body": "あなたの判断が必要な意味上のギャップは、ここに表示されます。",

  "review.panel": "移行レビュー",
  "review.ready": "あなたの意図が Orbit に準備できました",
  "review.counts":
    "そのまま {direct} · 変換 {transformed} · 省略 {unsupported} · あなたが決定 {decided}",
  "review.finalStep": "最後のステップ",
  "review.finalBody": "Orbit で準備済みの下書きを確認し、あなた自身で公開してください。",
  "review.quote": "Intent Relay は準備まで。公開できるのはあなただけです。",
  "review.waiting": "人間による公開待ち",
  "review.notTransferred": "移行されなかった項目(Orbit 非対応)",
  "review.excludedByYou": "契約確認であなたが除外した項目",
  "review.yourDecisions": "あなたが記録した判断",
  "review.decisionRecorded": "{label}({ts} 記録)",
  "review.empty.title": "準備済みの Orbit 下書きはまだありません",
  "review.empty.body":
    "すべての判断を解決したら、エージェントに現在のプレビューハッシュで Orbit 下書きの準備を依頼してください。何が移行・変換・除外・決定されたかを正確に報告します。",
  "review.meta": "Orbit 下書き {draft} · 改訂 {n} · 公開状態: {publication}。",
  "review.humanOnly":
    "公開は Orbit 内の公開ボタンからのみ行えます — ツールからは決して行えません。",

  "fail.webmcp.title": "WebMCP を利用できません",
  "fail.webmcp.badge": "✕ document.modelContext がありません",
  "fail.webmcp.body":
    "このブラウザは WebMCP Imperative API を公開していないため、エージェント操作は無効です。下のサンプルプロバイダの状態は閲覧でき、ツール呼び出しの偽装や代替は行いません。",
  "fail.webmcp.hint":
    "ライブデモには WebMCP 対応の Chrome(テストフラグまたはオリジントライアル)を使用してください。人間が確認できる内容は、対応ブラウザがなくてもすべて表示されます。",
  "fail.connection.badge": "✕ 未接続",
  "fail.connection.pre": "プロバイダのオリジン",
  "fail.connection.post":
    "は {state} です。WebMCP ツールが再発見されるまで、プロバイダをまたぐ操作は利用できません。",
  "fail.retry": "再検出する",
  "fail.gatherTitle": "移行元プロバイダ Gather が未接続です",
  "fail.orbitTitle": "移行先プロバイダ Orbit が未接続です",
  "fail.configTitle": "オリジン設定エラー",

  "gather.tagline": "架空の移行元イベントプロバイダ",
  "gather.form.heading": "イベント設定",
  "gather.replay": "サンプル実演を再現",
  "gather.complete": "実演を完了にする",
  "gather.completed": "実演は完了しています",
  "gather.field.title": "イベント名",
  "gather.field.schedule": "日程",
  "gather.field.starts": "開始",
  "gather.field.ends": "終了",
  "gather.field.timezone": "タイムゾーン",
  "gather.field.capacity": "定員",
  "gather.field.admission": "入場",
  "gather.field.free": "無料",
  "gather.field.paid": "有料チケット",
  "gather.field.reminder": "リマインダー(開始何時間前)",
  "gather.field.note": "参加者向けアクセシビリティ案内",
  "gather.field.overflow": "満員になったとき",
  "gather.field.overflow.placeholder": "満員時の扱いを選択",
  "gather.field.overflow.waitlist": "キャンセル待ちリストを有効にする",
  "gather.field.overflow.close": "受付を締め切る",
  "gather.field.dietary": "食事制限の質問",
  "gather.field.dietary.placeholder": "質問するかどうかを選択",
  "gather.field.dietary.optional": "任意の質問として尋ねる",
  "gather.field.dietary.required": "必須の質問として尋ねる",
  "gather.field.publication": "公開には自分の確認を必須にする(承認境界)",
  "gather.trace.heading": "セマンティックトレース",
  "gather.trace.complete": "✓ 完了",
  "gather.trace.recording": "● 記録中",
  "gather.trace.note":
    "Gather は「何が・どういう意味で」変わったかを記録します — 座標や CSS セレクタは記録しません。",
  "gather.trace.empty": "まだ操作は記録されていません。イベントを設定すると記録されます。",
  "gather.status.heading": "プロバイダの状態",
  "gather.status.session": "デモセッション",
  "gather.status.save": "保存状態",
  "gather.status.saved": "✓ このブラウザに保存済み(セッション別)",
  "gather.status.tools": "✓ {n} 件のツールを {origin} に公開: {names}",
  "gather.status.unavailable": "✕ 利用不可 — このブラウザには document.modelContext がありません",
  "gather.sessionError.title": "デモセッションが必要です",

  "orbit.tagline": "架空の移行先イベントプロバイダ",
  "orbit.draft.heading": "掲載の下書き",
  "orbit.chip.waiting": "◷ 公開待ち",
  "orbit.chip.published": "✓ 公開済み",
  "orbit.chip.none": "— 下書きはまだありません",
  "orbit.empty":
    "掲載の下書きはまだありません。互換性マッピングをあなたが確認した後に、Intent Relay がここに下書きを準備します — 未確認の意図が Orbit に届くことはありません。",
  "orbit.field.name": "掲載名",
  "orbit.field.when": "日時",
  "orbit.field.seats": "定員",
  "orbit.field.seatsValue": "{n} 席",
  "orbit.field.admission": "入場",
  "orbit.field.free": "入場無料",
  "orbit.field.paid": "有料チケット",
  "orbit.field.reminder": "参加者リマインダー",
  "orbit.field.reminderValue": "開始 {n} 日前",
  "orbit.field.reminderNone": "未設定",
  "orbit.field.venueNote": "会場アクセス情報",
  "orbit.field.venueNoteNone": "記録なし",
  "orbit.field.overflow": "満席時の扱い",
  "orbit.field.overflowNone": "未設定",
  "orbit.publish": "イベントを公開",
  "orbit.published": "公開済み",
  "orbit.publishNote":
    "公開はこのページ上の人間専用の操作です。WebMCP ツールから公開することはできません。",
  "orbit.capabilities.heading": "宣言された能力",
  "orbit.capabilities.note":
    "Orbit はこのマニフェストを describe_event_capabilities でそのまま公開します。マッピングは推測ではなく、この宣言に基づきます。",
  "orbit.capabilities.accepts": "受け付ける値",
  "orbit.capabilities.constraints": "制約",
  "orbit.capabilities.unsupported": "非対応",
  "orbit.capabilities.humanOnly": "人間専用の操作",
  "orbit.status.heading": "コンソールの状態",
  "orbit.status.local": "ローカル保存",
  "orbit.status.localValue": "✓ このブラウザにセッション別で保存",
  "orbit.sessionError.title": "デモセッションが必要です",
};

const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, ja };

export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  let text: string = MESSAGES[locale][key];
  for (const [name, value] of Object.entries(params ?? {})) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

/** Human-facing labels for semantic keys. Raw keys are still shown as code. */
const SEMANTIC_KEY_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    "event.title": "Event title",
    "event.schedule": "Schedule",
    "registration.capacity.maximum": "Capacity limit",
    "ticketing.mode": "Ticketing",
    "notifications.reminder.offset": "Reminder timing",
    "accessibility.attendee_note": "Accessibility note",
    "accessibility.venue_note": "Venue access note",
    "registration.overflow.mode": "Overflow handling",
    "registration.custom_question.dietary_restrictions": "Dietary question",
    "event.publish": "Publication approval",
  },
  ja: {
    "event.title": "イベント名",
    "event.schedule": "日程",
    "registration.capacity.maximum": "定員",
    "ticketing.mode": "チケット種別",
    "notifications.reminder.offset": "リマインダー時期",
    "accessibility.attendee_note": "アクセシビリティ案内",
    "accessibility.venue_note": "会場アクセス情報",
    "registration.overflow.mode": "満員時の扱い",
    "registration.custom_question.dietary_restrictions": "食事制限の質問",
    "event.publish": "公開の承認",
  },
};

export function semanticKeyLabel(locale: Locale, key: string): string {
  return SEMANTIC_KEY_LABELS[locale][key] ?? key;
}

/** Human-facing labels for raw enum-ish values. Raw values stay visible as code. */
const VALUE_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    free: "Free admission",
    paid: "Paid tickets",
    native_waitlist: "Native waitlist",
    close_registration: "Close registration",
    external_form: "External overflow form",
    optional: "Optional question",
    required: "Required question",
    human_confirmation_required: "Requires your confirmation",
  },
  ja: {
    free: "無料",
    paid: "有料チケット",
    native_waitlist: "キャンセル待ちリスト",
    close_registration: "受付を締め切る",
    external_form: "外部の追加登録フォーム",
    optional: "任意の質問",
    required: "必須の質問",
    human_confirmation_required: "あなたの確認が必要",
  },
};

export function valueLabel(locale: Locale, value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  return VALUE_LABELS[locale][value] ?? null;
}

export interface ScheduleValue {
  start: string;
  end: string;
  timezone: string;
}

/** Locale-aware, presentation-only. Canonical ISO values are never altered. */
export function formatEventSchedule(locale: Locale, schedule: ScheduleValue): string {
  const start = new Date(schedule.start);
  const end = new Date(schedule.end);
  const timeZone = schedule.timezone;
  const zoneIn = (formatLocale: string): string | undefined =>
    new Intl.DateTimeFormat(formatLocale, { timeZone, timeZoneName: "short" })
      .formatToParts(start)
      .find((part) => part.type === "timeZoneName")?.value;
  // Prefer a real abbreviation (e.g. "JST") over a "GMT+9"-style offset when
  // any common locale's CLDR data provides one. Display-only.
  const candidates = [zoneIn("en-US"), zoneIn("ja-JP")].filter(
    (value): value is string => value !== undefined,
  );
  const zone = candidates.find((value) => !value.startsWith("GMT")) ?? candidates[0] ?? timeZone;
  if (locale === "ja") {
    const date = new Intl.DateTimeFormat("ja-JP", {
      timeZone,
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(start);
    const time = new Intl.DateTimeFormat("ja-JP", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${date} ${time.format(start)}〜${time.format(end)} ${zone}`;
  }
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(start);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} · ${time.formatRange(start, end)} ${zone}`;
}

export function formatTimestamp(locale: Locale, iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue>({ locale: "en", setLocale: () => undefined });

export function I18nProvider({
  locale,
  setLocale,
  children,
}: {
  locale: Locale;
  setLocale?: (locale: Locale) => void;
  children: ReactNode;
}): ReactNode {
  return (
    <I18nContext.Provider value={{ locale, setLocale: setLocale ?? (() => undefined) }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
} {
  const { locale, setLocale } = useContext(I18nContext);
  return { locale, setLocale, t: (key, params) => translate(locale, key, params) };
}

export function LanguageSwitcher(): ReactNode {
  const { locale, setLocale } = useI18n();
  return (
    <div className="ir-lang" role="group" aria-label="Language">
      <button
        type="button"
        className={locale === "en" ? "ir-lang-option ir-lang-active" : "ir-lang-option"}
        aria-pressed={locale === "en"}
        onClick={() => setLocale("en")}
      >
        EN
      </button>
      <span aria-hidden="true">|</span>
      <button
        type="button"
        className={locale === "ja" ? "ir-lang-option ir-lang-active" : "ir-lang-option"}
        aria-pressed={locale === "ja"}
        onClick={() => setLocale("ja")}
      >
        日本語
      </button>
    </div>
  );
}
