import { Controller, Get, Patch, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConversationService } from './conversation.service';
import { BookingService } from '../booking/booking.service';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';

@Controller('conversations')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class ConversationController {
  constructor(
    private conversationService: ConversationService,
    private bookingService: BookingService,
  ) {}

  @Get()
  list(@BusinessId() businessId: string, @CurrentUser('sub') staffId: string, @Query() query: any) {
    if (query.filter === 'mine') {
      query.assignedToId = staffId;
    }
    return this.conversationService.findAll(businessId, query);
  }

  @Get('counts')
  counts(@BusinessId() businessId: string, @CurrentUser('sub') staffId: string) {
    return this.conversationService.getFilterCounts(businessId, staffId);
  }

  @Get(':id')
  detail(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.conversationService.findById(businessId, id);
  }

  @Patch(':id/assign')
  assign(@BusinessId() businessId: string, @Param('id') id: string, @Body() body: { staffId: string | null }) {
    return this.conversationService.assign(businessId, id, body.staffId);
  }

  @Patch(':id/status')
  updateStatus(@BusinessId() businessId: string, @Param('id') id: string, @Body() body: { status: string }) {
    return this.conversationService.updateStatus(businessId, id, body.status);
  }

  @Patch(':id/snooze')
  snooze(@BusinessId() businessId: string, @Param('id') id: string, @Body() body: { until: string }) {
    return this.conversationService.snooze(businessId, id, new Date(body.until));
  }

  @Patch(':id/tags')
  updateTags(@BusinessId() businessId: string, @Param('id') id: string, @Body() body: { tags: string[] }) {
    return this.conversationService.updateTags(businessId, id, body.tags);
  }

  @Get(':id/messages')
  messages(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.conversationService.getMessages(businessId, id);
  }

  @Get(':id/notes')
  getNotes(@Param('id') id: string) {
    return this.conversationService.getNotes(id);
  }

  @Post(':id/notes')
  addNote(@Param('id') id: string, @CurrentUser('sub') staffId: string, @Body() body: { content: string }) {
    return this.conversationService.addNote(id, staffId, body.content);
  }

  @Delete(':id/notes/:noteId')
  deleteNote(@Param('noteId') noteId: string) {
    return this.conversationService.deleteNote(noteId);
  }

  @Post(':id/booking')
  createBooking(@BusinessId() businessId: string, @Param('id') id: string, @Body() body: any) {
    return this.bookingService.create(businessId, { ...body, conversationId: id });
  }
}
