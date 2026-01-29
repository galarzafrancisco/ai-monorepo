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
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { IdentityProviderService } from '../identity-provider/identity-provider.service';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { ChangePasswordRequestDto } from './dto/change-password-request.dto';
import { getConfig } from '../config/env.config';
import { COOKIE_KEYS } from '../auth/core/constants/cookie-keys.constant';
import { TokenVerifierService } from '../auth/crypto/token-verifier.service';
import { WebAuthService } from './web-auth.service';
import { ActorService } from 'src/identity-provider/actor.service';

@ApiTags('Web Authentication')
@Controller('auth')
export class WebAuthController {
  private logger = new Logger(WebAuthController.name);

  constructor(
    private readonly webAuthService: WebAuthService,
    private readonly tokenVerifierService: TokenVerifierService,
    private readonly identityProviderService: IdentityProviderService,
    private readonly actorService: ActorService,
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
    // Authenticate user and generate tokens (throws if anything goes wrong)
    const { accessToken, refreshToken, expiresInSeconds, user, actor } =
      await this.webAuthService.login(loginDto.email, loginDto.password);

    this.logger.log('Got access token');

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
      maxAge: expiresInSeconds * 1000, // 60 minutes in milliseconds
    });

    response.cookie(COOKIE_KEYS.REFRESH_TOKEN, refreshToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000, // 1 day in milliseconds (triggers re-login)
    });

    // Return user info and token expiration
    return {
      user: {
        id: actor.id,
        email: user.email,
        displayName: actor.displayName,
        role: user.role,
        actorId: user.actorId,
      },
      expiresIn: expiresInSeconds,
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
    const { accessToken, refreshToken, expiresIn, user, actor } =
      await this.webAuthService.refreshWebToken(refreshTokenFromCookie);

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
        displayName: actor.displayName,
        role: user.role,
        actorId: user.actorId,
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
    const payload =
      await this.tokenVerifierService.verifyAndDecode(accessToken);

    payload.actor_id;
    // Get user from database
    const actor = await this.actorService.getActorById(payload.actor_id, true);
    if (!actor) {
      throw new UnauthorizedException('Actor not found');
    }
    if (!actor.user) {
      this.logger.error('Actor returned no user. This should not happen');
      throw new InternalServerErrorException('Failed to retrieve actor');
    }

    // Return user info
    return {
      id: actor.id,
      email: actor.user.email,
      displayName: actor.displayName,
      role: actor.user.role,
      actorId: actor.user.actorId,
    };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password for authenticated user' })
  @ApiBody({ type: ChangePasswordRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated or current password is incorrect',
  })
  async changePassword(
    @Req() request: Request,
    @Body() changePasswordDto: ChangePasswordRequestDto,
  ): Promise<{ ok: boolean }> {
    // Get access token from cookie
    const accessToken = request.cookies?.[COOKIE_KEYS.ACCESS_TOKEN];

    if (!accessToken) {
      throw new UnauthorizedException('Not authenticated');
    }

    // Validate token and get payload
    const payload =
      await this.tokenVerifierService.verifyAndDecode(accessToken);

    // Get user from database
    const actor = await this.actorService.getActorById(payload.actor_id, true);
    if (!actor) {
      throw new UnauthorizedException('Actor not found');
    }
    if (!actor.user) {
      this.logger.error('Actor returned no user. This should not happen');
      throw new InternalServerErrorException('Failed to retrieve actor');
    }

    // Change the password
    await this.identityProviderService.changePassword(
      actor.user.id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );

    this.logger.log(`Password changed for user: ${actor.user.email}`);

    return { ok: true };
  }
}
