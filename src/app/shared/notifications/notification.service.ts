import { Injectable, signal } from '@angular/core';

export type NotificationKind = 'error' | 'info' | 'success';

export interface AppNotification {
  id: number;
  kind: NotificationKind;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private nextId = 1;
  private readonly notificationsSignal = signal<AppNotification[]>([]);

  readonly notifications = this.notificationsSignal.asReadonly();

  error(message: string): void {
    this.show('error', message);
  }

  show(kind: NotificationKind, message: string, durationMs = 5000): void {
    const notification: AppNotification = {
      id: this.nextId,
      kind,
      message,
    };

    this.nextId += 1;
    this.notificationsSignal.update((notifications) => [...notifications, notification]);
    setTimeout(() => this.dismiss(notification.id), durationMs);
  }

  dismiss(id: number): void {
    this.notificationsSignal.update((notifications) =>
      notifications.filter((notification) => notification.id !== id),
    );
  }
}
