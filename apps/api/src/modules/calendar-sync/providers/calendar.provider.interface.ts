export interface CalendarEvent {
  summary: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
}

export interface CalendarProvider {
  getAuthUrl(redirectUri: string, state: string): string;
  exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }>;
  refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt: Date;
  }>;
  createEvent(accessToken: string, calendarId: string, event: CalendarEvent): Promise<string>;
  updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: CalendarEvent,
  ): Promise<void>;
  deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void>;
}
