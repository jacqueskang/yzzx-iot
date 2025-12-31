import { AzureFunction, Context } from "@azure/functions";

// Example: Return mock device status. Replace with ADT query logic.
const httpTrigger: AzureFunction = async function (
  context: Context,
): Promise<void> {
  context.res = {
    // status: 200, /* Defaults to 200 */
    body: [
      { id: "light1", x: 100, y: 200, on: true },
      { id: "sensor1", x: 400, y: 300, on: false },
    ],
  };
};

export default httpTrigger;
