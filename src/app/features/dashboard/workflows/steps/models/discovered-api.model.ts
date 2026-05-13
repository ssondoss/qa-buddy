export interface StepDiscoveredApiView {
  id: string;
  stepId: string;
  url: string;
  method: string;
  requestBody: string | null;
  responseStatus: number | null;
  responseBody: string | null;
  discoveredAt: string;
}

export interface StepApiDiscoveryResult {
  stepId: string;
  orderIndex: number;
  action: string;
  apis: StepDiscoveredApiView[];
}
