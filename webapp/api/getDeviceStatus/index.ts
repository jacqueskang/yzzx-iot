// Example: Return mock device status. Replace with ADT query logic.
/**
 * Azure Functions HTTP response for device status
 */
interface DeviceStatus {
  id: string;
  x: number;
  y: number;
  on: boolean;
}

interface HttpResponse {
  body: DeviceStatus[];
  status?: number;
}

export default async function (): Promise<HttpResponse> {
  return {
    body: [
      { id: "light1", x: 100, y: 200, on: true },
      { id: "sensor1", x: 400, y: 300, on: false },
    ],
  };
}
