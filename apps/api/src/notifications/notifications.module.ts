import { Global, Module } from '@nestjs/common';

import { MeetingProvider } from '../meetings/meeting-provider.js';
import { OutboxService } from './outbox.service.js';

@Global()
@Module({ providers: [OutboxService, MeetingProvider], exports: [OutboxService, MeetingProvider] })
export class NotificationsModule {}
