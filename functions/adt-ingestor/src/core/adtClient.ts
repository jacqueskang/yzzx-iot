import { DefaultAzureCredential, ChainedTokenCredential, ManagedIdentityCredential, AzureCliCredential } from '@azure/identity';
import { DigitalTwinsClient } from '@azure/digital-twins-core';

let client: DigitalTwinsClient | null = null;

export function getAdtClient(adtUrl: string): DigitalTwinsClient {
  if (client) return client;
  const credential = new ChainedTokenCredential(
    new ManagedIdentityCredential(),
    new DefaultAzureCredential(),
    new AzureCliCredential()
  );
  client = new DigitalTwinsClient(adtUrl, credential);
  return client;
}
