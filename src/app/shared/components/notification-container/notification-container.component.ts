import { Component, inject } from '@angular/core';
import { NotificationService } from '../../notifications/notification.service';

@Component({
  selector: 'app-notification-container',
  standalone: true,
  templateUrl: './notification-container.component.html',
  styleUrl: './notification-container.component.scss',
})
export class NotificationContainerComponent {
  readonly notificationService = inject(NotificationService);
  readonly notifications = this.notificationService.notifications;

  dismiss(id: number): void {
    this.notificationService.dismiss(id);
  }
}
