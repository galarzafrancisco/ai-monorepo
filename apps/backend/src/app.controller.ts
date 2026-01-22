import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiOkResponse({
    description: 'Returns a greeting message',
    schema: {
      type: 'string',
      example: 'Hello World!',
    },
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('color-fact')
  @ApiOperation({ summary: 'Get a fun fact about your favorite color' })
  @ApiQuery({
    name: 'color',
    description: 'Your favorite color',
    required: true,
    type: String,
    example: 'blue',
  })
  @ApiOkResponse({
    description: 'Returns a fun fact about the specified color',
    schema: {
      type: 'string',
      example: 'Fun fact about blue: Blue is the most popular favorite color worldwide, with about 40% of people choosing it!',
    },
  })
  getColorFact(@Query('color') color: string): string {
    return this.appService.getColorFact(color);
  }
}
