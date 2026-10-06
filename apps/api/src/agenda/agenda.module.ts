import { Module } from '@nestjs/common';

import { TicketsModule } from '../tickets/tickets.module.js';
import { AgendaController } from './agenda.controller.js';
import { AgendaService } from './agenda.service.js';

@Module({ imports: [TicketsModule], controllers: [AgendaController], providers: [AgendaService] })
export class AgendaModule {}
