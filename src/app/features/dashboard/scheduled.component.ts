import { Component } from '@angular/core';

interface ScheduleItem {
  readonly name: string;
  readonly workflow: string;
  readonly environment: string;
  readonly cadence: string;
  readonly nextRun: string;
  readonly status: 'Active' | 'Paused';
}

@Component({
  selector: 'app-scheduled',
  standalone: true,
  templateUrl: './scheduled.component.html',
  styleUrl: './scheduled.component.scss',
})
export class ScheduledComponent {
  protected readonly metrics = [
    { label: 'Schedules', value: '14' },
    { label: 'Active', value: '11' },
    { label: 'Paused', value: '3' },
    { label: 'Next 24h', value: '28' },
  ];

  protected readonly schedules: readonly ScheduleItem[] = [
    {
      name: 'Checkout Staging Hourly',
      workflow: 'Checkout Smoke',
      environment: 'Staging',
      cadence: '0 * * * *',
      nextRun: '2026-04-24 17:00',
      status: 'Active',
    },
    {
      name: 'Onboarding QA Daily',
      workflow: 'User Onboarding',
      environment: 'QA',
      cadence: '0 9 * * *',
      nextRun: '2026-04-25 09:00',
      status: 'Active',
    },
    {
      name: 'Payment Retry Audit',
      workflow: 'Payment Retry',
      environment: 'Staging',
      cadence: '0 22 * * 1-5',
      nextRun: '2026-04-24 22:00',
      status: 'Paused',
    },
  ];
}
