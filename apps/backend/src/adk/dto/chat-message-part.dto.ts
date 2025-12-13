import { ApiPropertyOptional } from '@nestjs/swagger';

export class FunctionCallDto {
  @ApiPropertyOptional({
    description: 'Unique identifier for the function call',
    example: 'call_123',
  })
  id!: string;

  @ApiPropertyOptional({
    description: 'Name of the function being called',
    example: 'taskeroo.createTask',
  })
  name!: string;

  @ApiPropertyOptional({
    description: 'Arguments passed to the function',
    example: { name: 'My Task', description: 'Task description' },
  })
  args!: Record<string, unknown>;
}

export class FunctionResponseDto {
  @ApiPropertyOptional({
    description: 'Unique identifier for the function response',
    example: 'call_123',
  })
  id!: string;

  @ApiPropertyOptional({
    description: 'Name of the function that was called',
    example: 'taskeroo.createTask',
  })
  name!: string;

  @ApiPropertyOptional({
    description: 'Response from the function execution',
    example: { result: 'Task created successfully' },
  })
  response!: {
    result: string;
  };
}

export class ChatMessagePartDto {
  @ApiPropertyOptional({
    description: 'Text content of the message part',
    example: 'Hello, how can I help you?',
  })
  text?: string;

  @ApiPropertyOptional({
    description: 'Function call data if this part is a function call',
    type: FunctionCallDto,
  })
  functionCall?: FunctionCallDto;

  @ApiPropertyOptional({
    description: 'Function response data if this part is a function response',
    type: FunctionResponseDto,
  })
  functionResponse?: FunctionResponseDto;
}
