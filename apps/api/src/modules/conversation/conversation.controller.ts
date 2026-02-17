import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConversationService } from './conversation.service';
import { BookingService } from '../booking/booking.service';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import {
  CreateBookingFromConversationDto,
  UpdateConversationStatusDto,
  AssignConversationDto,
  SnoozeConversationDto,
  UpdateTagsDto,
  AddNoteDto,
} from '../../common/dto';

@ApiTags('Conversations')
@Controller('conversations')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class ConversationController {
  constructor(
    private conversationService: ConversationService,
    private bookingService: BookingService,
  ) {}

  @Get()
  list(
    @BusinessId() businessId: string,
    @CurrentUser('sub') staffId: string,
    @Query() query: any,
    @Query('locationId') locationId?: string,
  ) {
    if (query.filter === 'mine') {
      query.assignedToId = staffId;
    }
    if (locationId) query.locationId = locationId;
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
  assign(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: AssignConversationDto,
  ) {
    return this.conversationService.assign(businessId, id, body.staffId);
  }

  @Patch(':id/status')
  updateStatus(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: UpdateConversationStatusDto,
  ) {
    return this.conversationService.updateStatus(businessId, id, body.status);
  }

  @Patch(':id/snooze')
  snooze(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: SnoozeConversationDto,
  ) {
    return this.conversationService.snooze(businessId, id, new Date(body.until));
  }

  @Patch(':id/tags')
  updateTags(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: UpdateTagsDto,
  ) {
    return this.conversationService.updateTags(businessId, id, body.tags);
  }

  @Get(':id/messages')
  messages(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.conversationService.getMessages(businessId, id);
  }

  @Get(':id/notes')
  getNotes(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.conversationService.getNotes(businessId, id);
  }

  @Post(':id/notes')
  addNote(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @CurrentUser('sub') staffId: string,
    @Body() body: AddNoteDto,
  ) {
    return this.conversationService.addNote(businessId, id, staffId, body.content);
  }

  @Delete(':id/notes/:noteId')
  deleteNote(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Param('noteId') noteId: string,
  ) {
    return this.conversationService.deleteNote(businessId, id, noteId);
  }

  @Post(':id/booking')
  createBooking(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: CreateBookingFromConversationDto,
  ) {
    return this.bookingService.create(businessId, { ...body, conversationId: id });
  }
}
