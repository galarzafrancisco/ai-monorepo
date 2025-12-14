import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { IdentityProviderService } from './identity-provider.service';
import { LoginDto } from './dto/login.dto';
import { SessionResponseDto } from './dto/session-response.dto';
import { isProduction } from '../config/env.config';

const SESSION_COOKIE_NAME = 'mcp_portal_session';
const COOKIE_MAX_AGE = 60 * 60 * 1000; // 1 hour

@ApiTags('Identity Provider')
@Controller()
export class IdentityProviderController {
  constructor(
    private readonly identityProviderService: IdentityProviderService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiOkResponse({ description: 'Login successful' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ ok: boolean }> {
    const user = await this.identityProviderService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    response.cookie(SESSION_COOKIE_NAME, user.id, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
    });

    return { ok: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and clear session' })
  @ApiOkResponse({ description: 'Logout successful' })
  async logout(
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ ok: boolean }> {
    response.clearCookie(SESSION_COOKIE_NAME);
    return { ok: true };
  }

  @Get('session')
  @ApiOperation({ summary: 'Get current session information' })
  @ApiOkResponse({ type: SessionResponseDto })
  async getSession(
    @Req() request: Request,
  ): Promise<SessionResponseDto> {
    const userId = request.cookies[SESSION_COOKIE_NAME];

    if (!userId) {
      throw new UnauthorizedException('Not logged in');
    }

    const user = await this.identityProviderService.getUserById(userId);

    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    };
  }
}
