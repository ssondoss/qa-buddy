import { Component } from '@angular/core';

interface ExecutionItem {
  readonly id: string;
  readonly workflow: string;
  readonly environment: string;
  readonly trigger: string;
  readonly status: 'Passed' | 'Running' | 'Failed';
  readonly duration: string;
  readonly startedAt: string;
}

@Component({
  selector: 'app-executions',
  standalone: true,
  templateUrl: './executions.component.html',
  styleUrl: './executions.component.scss',
})
export class ExecutionsComponent {
  protected readonly metrics = [
    { label: 'Total', value: '128' },
    { label: 'Running', value: '6' },
    { label: 'Failed', value: '11' },
    { label: 'Avg Duration', value: '04:18' },
  ];

  protected readonly executions: readonly ExecutionItem[] = [
    {
      id: 'EX-1042',
      workflow: 'Checkout Smoke',
      environment: 'Staging',
      trigger: 'Schedule',
      status: 'Passed',
      duration: '03:54',
      startedAt: '2026-04-24 16:30',
    },
    {
      id: 'EX-1041',
      workflow: 'User Onboarding',
      environment: 'QA',
      trigger: 'Manual',
      status: 'Running',
      duration: '01:27',
      startedAt: '2026-04-24 16:24',
    },
    {
      id: 'EX-1040',
      workflow: 'Payment Retry',
      environment: 'Staging',
      trigger: 'API',
      status: 'Failed',
      duration: '05:12',
      startedAt: '2026-04-24 16:18',
    },
    {
      id: 'EX-1039',
      workflow: 'Admin Permissions',
      environment: 'QA',
      trigger: 'Manual',
      status: 'Passed',
      duration: '02:46',
      startedAt: '2026-04-24 15:58',
    },
  ];
}
