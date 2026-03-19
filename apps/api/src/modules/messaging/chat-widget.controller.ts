import { Controller, Get, Header, Res, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('Chat Widget')
@Controller('chat-widget')
export class ChatWidgetController {
  private readonly logger = new Logger(ChatWidgetController.name);
  private cachedWidget: string | null = null;
  private cachedAt = 0;
  private readonly CACHE_TTL_MS = 60_000; // 1 minute in-memory cache

  @Get('booking-os-chat.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  @Header('Access-Control-Allow-Origin', '*')
  async getWidget(@Res() res: Response): Promise<void> {
    // Serve from in-memory cache if fresh
    const now = Date.now();
    if (this.cachedWidget && now - this.cachedAt < this.CACHE_TTL_MS) {
      res.send(this.cachedWidget);
      return;
    }

    const widgetPath = path.resolve(
      __dirname,
      '../../../../packages/web-chat-widget/dist/booking-os-chat.js',
    );

    if (fs.existsSync(widgetPath)) {
      try {
        const content = fs.readFileSync(widgetPath, 'utf8');
        this.cachedWidget = content;
        this.cachedAt = now;
        res.send(content);
      } catch (err) {
        this.logger.error('Failed to read widget file', err);
        res.status(500).send('// Widget read error');
      }
    } else {
      this.logger.warn(`Widget file not found at ${widgetPath}`);
      res
        .status(404)
        .send(
          '// Widget not built. Run: cd packages/web-chat-widget && npm run build',
        );
    }
  }
}
