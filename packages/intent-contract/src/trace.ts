export interface SemanticAction {
  id: string;
  timestamp: string;
  actor: "human";
  command: string;
  semanticKey: string;
  before: unknown;
  after: unknown;
}

export interface SemanticTrace {
  id: string;
  eventRevision: number;
  completed: boolean;
  actions: SemanticAction[];
}

export function traceActionIds(trace: SemanticTrace): Set<string> {
  return new Set(trace.actions.map((action) => action.id));
}
