import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { AuthUserDto } from './dto/auth-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { WebAuthJwtPayload } from './types/jwt-payload.type';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  async login(@Body() loginDto: LoginRequestDto): Promise<LoginResponseDto> {
    // Implementation will be added in Phase 2A.4
    throw new Error('Not implemented');
  }

  @Post('logout')
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: WebAuthJwtPayload): Promise<void> {
    // Implementation will be added in Phase 2A.4
    throw new Error('Not implemented');
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: LoginResponseDto,
  })
  async refresh(): Promise<LoginResponseDto> {
    // Implementation will be added in Phase 2A.4
    throw new Error('Not implemented');
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({
    status: 200,
    description: 'Current user information',
    type: AuthUserDto,
  })
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: WebAuthJwtPayload): Promise<AuthUserDto> {
    // Implementation will be added in Phase 2A.4
    throw new Error('Not implemented');
  }
}
