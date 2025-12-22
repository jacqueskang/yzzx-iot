export type EnsureModelsOp = { type: 'EnsureModels'; models: any[] };
export type UpsertTwinOp = { type: 'UpsertTwin'; twinId: string; modelId: string; properties: Record<string, unknown> };
export type UpsertRelationshipOp = { type: 'UpsertRelationship'; srcTwinId: string; relationshipId: string; relationshipName: string; targetTwinId: string; properties?: Record<string, unknown> };
export type PatchTwinOp = { type: 'PatchTwin'; twinId: string; patch: Array<{ op: 'add' | 'replace' | 'remove'; path: string; value?: unknown }> };

export type AdtOperation = EnsureModelsOp | UpsertTwinOp | UpsertRelationshipOp | PatchTwinOp;
