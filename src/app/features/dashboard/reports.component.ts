import { Component } from '@angular/core';

interface ReportItem {
  readonly name: string;
  readonly period: string;
  readonly owner: string;
  readonly generatedAt: string;
  readonly format: 'PDF' | 'CSV' | 'Link';
}

@Component({
  selector: 'app-reports',
  standalone: true,
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  protected readonly metrics = [
    { label: 'Pass Rate', value: '91%' },
    { label: 'Coverage', value: '74%' },
    { label: 'Open Failures', value: '9' },
    { label: 'Exports', value: '32' },
  ];

  protected readonly reports: readonly ReportItem[] = [
    {
      name: 'Weekly Regression',
      period: 'Apr 18 - Apr 24',
      owner: 'QA Lead',
      generatedAt: '2026-04-24 15:10',
      format: 'PDF',
    },
    {
      name: 'Execution Audit',
      period: 'Apr 24',
      owner: 'SDET',
      generatedAt: '2026-04-24 14:40',
      format: 'CSV',
    },
    {
      name: 'Environment Health',
      period: 'Apr 24',
      owner: 'Platform',
      generatedAt: '2026-04-24 12:00',
      format: 'Link',
    },
  ];
}
