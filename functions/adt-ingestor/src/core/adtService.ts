
import { DigitalTwinsClient } from '@azure/digital-twins-core';
import { AdtOperation } from './operations.js';
import type { InvocationContext } from '@azure/functions';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export async function executeOps(
  client: DigitalTwinsClient,
  ops: AdtOperation[],
  options: { maxRetries?: number; retryBaseMs?: number },
  context: InvocationContext
) {
  const maxRetries = options?.maxRetries ?? 5;
  const baseMs = options?.retryBaseMs ?? 500;

  for (const op of ops) {
    let attempt = 0;
    while (true) {
      try {
        switch (op.type) {
          case 'EnsureModels': {
            const existing = new Set<string>();
            for await (const m of client.listModels()) existing.add(m.id);
            
            // Delete existing models to replace them with new definitions
            for (const model of op.models) {
              const modelId = model['@id'];
              if (existing.has(modelId)) {
                try {
                  await client.deleteModel(modelId);
                  context.info(`Deleted existing model: ${modelId}`);
                } catch (err: any) {
                  context.warn(`Failed to delete model ${modelId}, attempting to create anyway`, { error: String(err) });
                }
              }
            }
            
            // Create/replace models
            if (op.models.length) {
              await client.createModels(op.models as any);
              context.info(`Created/replaced ${op.models.length} models`);
            }
            break;
          }
          case 'UpsertTwin': {
            const payload = JSON.stringify({
              $metadata: { $model: op.modelId },
              ...op.properties
            });
            await client.upsertDigitalTwin(op.twinId, payload as any);
            break;
          }
          case 'UpsertRelationship': {
            await client.upsertRelationship(op.srcTwinId, op.relationshipId, {
              $relationshipId: op.relationshipId,
              $sourceId: op.srcTwinId,
              $relationshipName: op.relationshipName,
              $targetId: op.targetTwinId,
              ...op.properties
            } as any);
            break;
          }
          case 'PatchTwin': {
            await client.updateDigitalTwin(op.twinId, op.patch as any);
            break;
          }
          case 'DeleteTwin': {
            await client.deleteDigitalTwin(op.twinId);
            break;
          }
          case 'DeleteModel': {
            await client.deleteModel(op.modelId);
            break;
          }
          default: {
            context.warn(`ADT op type skipped: ${(op as any).type}`, { op });
            break;
          }
        }
        break; // op succeeded
      } catch (err: any) {
        const status = err?.statusCode || err?.code;
        const retriable = [408, 429, 500, 502, 503, 504].includes(status) || err?.name === 'RestError';
        if (retriable && attempt < maxRetries) {
          const backoff = Math.min(8000, baseMs * Math.pow(2, attempt));
          context.warn('ADT op failed, retrying', { type: op.type, attempt, status });
          await sleep(backoff);
          attempt++;
          continue;
        }
        context.error('ADT op failed permanently', { type: op.type, status, error: String(err) });
        throw err;
      }
    }
  }
}
