import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface DashboardNavItem {
  readonly label: string;
  readonly route: string;
}

@Component({
  selector: 'app-dashboard-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dashboard-shell.component.html',
  styleUrl: './dashboard-shell.component.scss',
})
export class DashboardShellComponent {
  protected readonly navItems: readonly DashboardNavItem[] = [
    { label: 'Workflows', route: '/dashboard/workflows' },
    { label: 'Executions', route: '/dashboard/executions' },
    { label: 'Scheduled', route: '/dashboard/scheduled' },
    { label: 'Reports', route: '/dashboard/reports' },
  ];
}
