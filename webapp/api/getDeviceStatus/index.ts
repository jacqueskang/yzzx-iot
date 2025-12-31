import { Context } from "@azure/functions"; // Remove this line if Context is not exported from @azure/functions

// If using Azure Functions v3+ with TypeScript, Context is usually available globally.
// Otherwise, you can define the Context type inline or import from 'azure-functions-ts-essentials' if installed.
// For now, let's define a minimal Context type for compatibility:
type Context = {
  res?: {
    status?: number;
    body?: any;
  };
};
// Example: Return mock device status. Replace with ADT query logic.
/**
 * @param context {Context} Azure Functions context
 */
export default async function (context: Context): Promise<void> {
  context.res = {
    // status: 200, /* Defaults to 200 */
    body: [
      { id: "light1", x: 100, y: 200, on: true },
      { id: "sensor1", x: 400, y: 300, on: false },
    ],
  };
}
