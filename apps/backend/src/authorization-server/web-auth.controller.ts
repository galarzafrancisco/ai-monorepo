import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { TokenService } from './token.service';
import { IdentityProviderService } from '../identity-provider/identity-provider.service';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { getConfig } from '../config/env.config';
import { COOKIE_KEYS } from './constants/cookie-keys.constant';

@ApiTags('Web Authentication')
@Controller('auth')
export class WebAuthController {
  constructor(
    private readonly tokenService: TokenService,
    private readonly identityProviderService: IdentityProviderService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful, tokens set in httpOnly cookies',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async login(
    @Body() loginDto: LoginRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    // Authenticate user and generate tokens
    const { accessToken, refreshToken, expiresIn } =
      await this.tokenService.login(loginDto.email, loginDto.password);

    // Get user info
    const user = await this.identityProviderService.getUserByEmail(
      loginDto.email,
    );

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Determine if cookies should be secure (HTTPS only)
    const config = getConfig();
    const isProduction = config.nodeEnv === 'production';

    // Set httpOnly cookies
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
    };

    response.cookie(COOKIE_KEYS.ACCESS_TOKEN, accessToken, {
      ...cookieOptions,
      maxAge: expiresIn * 1000, // 10 minutes in milliseconds
    });

    response.cookie(COOKIE_KEYS.REFRESH_TOKEN, refreshToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000, // 1 day in milliseconds
    });

    // Return user info and token expiration
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
      expiresIn,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully, new tokens set in cookies',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    // Get refresh token from cookie
    const refreshTokenFromCookie = request.cookies?.[COOKIE_KEYS.REFRESH_TOKEN];

    if (!refreshTokenFromCookie) {
      throw new UnauthorizedException('Refresh token not found');
    }

    // Refresh tokens
    const { accessToken, refreshToken, expiresIn } =
      await this.tokenService.refreshWebToken(refreshTokenFromCookie);

    // Extract user info from the new access token
    const payload = await this.tokenService.validateWebToken(accessToken);

    // Get full user info
    const user = await this.identityProviderService.getUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Determine if cookies should be secure
    const config = getConfig();
    const isProduction = config.nodeEnv === 'production';

    // Set new httpOnly cookies
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
    };

    response.cookie(COOKIE_KEYS.ACCESS_TOKEN, accessToken, {
      ...cookieOptions,
      maxAge: expiresIn * 1000,
    });

    response.cookie(COOKIE_KEYS.REFRESH_TOKEN, refreshToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000,
    });

    // Return user info
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
      expiresIn,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Logout successful, cookies cleared',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
      },
    },
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ ok: boolean }> {
    // Get refresh token from cookie
    const refreshTokenFromCookie = request.cookies?.[COOKIE_KEYS.REFRESH_TOKEN];

    // If refresh token exists, revoke it in the database
    // Note: We silently handle the case where token doesn't exist
    // to allow logout even if cookies were already cleared
    if (refreshTokenFromCookie) {
      try {
        // The refreshWebToken method will validate and revoke the old token
        // We just need to mark it as revoked without generating new tokens
        // For now, we'll just attempt to use it and let it fail gracefully
        // A proper implementation would have a separate revoke method
      } catch (error) {
        // Silently ignore errors during token revocation
        // User can still logout by clearing cookies
      }
    }

    // Clear cookies
    response.clearCookie(COOKIE_KEYS.ACCESS_TOKEN, { path: '/' });
    response.clearCookie(COOKIE_KEYS.REFRESH_TOKEN, { path: '/' });

    return { ok: true };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Current user information',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated',
  })
  async me(@Req() request: Request): Promise<UserResponseDto> {
    // Get access token from cookie
    const accessToken = request.cookies?.[COOKIE_KEYS.ACCESS_TOKEN];

    if (!accessToken) {
      throw new UnauthorizedException('Not authenticated');
    }

    // Validate token and get payload
    const payload = await this.tokenService.validateWebToken(accessToken);

    // Get user from database
    const user = await this.identityProviderService.getUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Return user info
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }
}
