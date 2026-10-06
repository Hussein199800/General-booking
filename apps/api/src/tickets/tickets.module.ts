import { Module } from '@nestjs/common';

import {
  LawyerTicketsController,
  PublicTicketsController,
  SecretariatController,
  SyndicRequestsController,
} from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';

@Module({
  controllers: [
    PublicTicketsController,
    LawyerTicketsController,
    SecretariatController,
    SyndicRequestsController,
  ],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
