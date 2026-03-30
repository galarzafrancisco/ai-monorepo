import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiBody, ApiHeader, ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  email: string;

  @ApiProperty({ type: Number, required: false })
  age?: number;
}

export class UpdateUserDto {
  @ApiProperty({ type: String, required: false })
  name?: string;

  @ApiProperty({ type: String, required: false })
  email?: string;

  @ApiProperty({ type: Number, required: false })
  age?: number;
}

export class UserDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  email: string;

  @ApiProperty({ type: Number, required: false })
  age?: number;

  @ApiProperty({ type: String })
  createdAt: string;
}

class UserMetadataDto {
  @ApiProperty({ type: String })
  source: string;

  @ApiProperty({ type: [String] })
  tags: string[];
}

export class UserWithMetadataDto {
  @ApiProperty({ type: () => UserDto })
  user: UserDto;

  @ApiProperty({ type: () => UserMetadataDto })
  metadata: UserMetadataDto;
}

export class AuthCheckDto {
  @ApiProperty({ type: String, nullable: true })
  auth: string | null;
}

export class CustomHeaderCheckDto {
  @ApiProperty({ type: String })
  requestId: string;
}

export class SearchAdvancedDto {
  @ApiProperty({ type: Number, required: false })
  pageSize?: number;

  @ApiProperty({ type: String, required: false })
  sortOrder?: string;
}

export class OptionalHeaderCheckDto {
  @ApiProperty({ type: String, nullable: true })
  trackingId: string | null;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  private users: Map<string, UserDto> = new Map([
    [
      '1',
      {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        createdAt: new Date().toISOString(),
      },
    ],
    [
      '2',
      {
        id: '2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        createdAt: new Date().toISOString(),
      },
    ],
  ]);

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of users', type: [UserDto] })
  getUsers(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): UserDto[] {
    const allUsers = Array.from(this.users.values());
    const start = offset || 0;
    const end = limit ? start + limit : undefined;
    return allUsers.slice(start, end);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User found', type: UserDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUserById(@Param('id') id: string): UserDto {
    const user = this.users.get(id);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }

  @Get(':id/metadata')
  @ApiOperation({ summary: 'Get user with nested metadata' })
  @ApiResponse({ status: 200, type: UserWithMetadataDto })
  getUserWithMetadata(@Param('id') id: string): UserWithMetadataDto {
    const user = this.users.get(id);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return {
      user,
      metadata: {
        source: 'database',
        tags: ['active', 'verified'],
      },
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: 201, description: 'User created', type: UserDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @HttpCode(HttpStatus.CREATED)
  createUser(@Body() createUserDto: CreateUserDto): UserDto {
    if (!createUserDto.name || !createUserDto.email) {
      throw new BadRequestException('Name and email are required');
    }

    const id = String(this.users.size + 1);
    const user: UserDto = {
      id,
      ...createUserDto,
      createdAt: new Date().toISOString(),
    };
    this.users.set(id, user);
    return user;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, description: 'User updated', type: UserDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): UserDto {
    const user = this.users.get(id);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const updated = { ...user, ...updateUserDto };
    this.users.set(id, updated);
    return updated;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 204, description: 'User deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUser(@Param('id') id: string): void {
    if (!this.users.has(id)) {
      throw new BadRequestException('User not found');
    }
    this.users.delete(id);
  }

  @Get('check/auth')
  @ApiOperation({ summary: 'Check authentication headers' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Headers echoed back', type: AuthCheckDto })
  checkAuth(@Headers('authorization') auth?: string): AuthCheckDto {
    return { auth: auth || null };
  }

  @Get('check/custom-header')
  @ApiOperation({ summary: 'Test endpoint with custom header parameter' })
  @ApiHeader({ name: 'x-request-id', required: true, description: 'Custom request ID header' })
  @ApiResponse({ status: 200, description: 'Custom header echoed back', type: CustomHeaderCheckDto })
  checkCustomHeader(@Headers('x-request-id') requestId: string): CustomHeaderCheckDto {
    return { requestId };
  }

  @Get('search/advanced')
  @ApiOperation({ summary: 'Test endpoint with query parameters that have special characters' })
  @ApiQuery({ name: 'page-size', required: false, type: Number })
  @ApiQuery({ name: 'sort-order', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Query params echoed back', type: SearchAdvancedDto })
  searchAdvanced(
    @Query('page-size') pageSize?: number,
    @Query('sort-order') sortOrder?: string,
  ): SearchAdvancedDto {
    return { pageSize, sortOrder };
  }

  @Get('check/optional-header')
  @ApiOperation({ summary: 'Test endpoint with optional header parameter' })
  @ApiHeader({ name: 'x-tracking-id', required: false, description: 'Optional tracking ID header' })
  @ApiResponse({ status: 200, description: 'Optional header echoed back', type: OptionalHeaderCheckDto })
  checkOptionalHeader(@Headers('x-tracking-id') trackingId?: string): OptionalHeaderCheckDto {
    return { trackingId: trackingId || null };
  }
}
