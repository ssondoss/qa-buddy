export interface DiscoveredApiPageView {
  id: string;
  url: string;
  method: string;
  requestBody: string | null;
  responseStatus: number | null;
  responseBody: string | null;
  discoveredAt: string;
  stepId: string;
  stepOrderIndex: number;
  stepAction: string;
  versionId: string;
  versionNumber: number;
  versionAlias: string | null;
  workflowId: string;
  workflowName: string;
}
