import { Controller, Get, Query, Sse } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Observable, interval, map, take } from 'rxjs';

export interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

@ApiTags('stream')
@Controller('stream')
export class StreamController {
  @Sse('events')
  @ApiOperation({ summary: 'Stream server-sent events' })
  @ApiResponse({ status: 200, description: 'Event stream' })
  streamEvents(@Query('count') count = 5): Observable<MessageEvent> {
    return interval(100).pipe(
      take(count),
      map((i) => ({
        data: { index: i, message: `Event ${i}`, timestamp: Date.now() },
      })),
    );
  }

  @Sse('messages')
  @ApiOperation({ summary: 'Stream text messages' })
  streamMessages(@Query('count') count = 3): Observable<MessageEvent> {
    return interval(200).pipe(
      take(count),
      map((i) => ({
        data: `Message ${i}`,
        id: String(i),
      })),
    );
  }
}
