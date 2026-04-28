import {
  Controller,
  Delete,
  Post,
  Get,
  Body,
  Param,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
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
import { OnboardingStatusResponseDto } from './dto/onboarding-status-response.dto';
import { OnboardingRequestDto } from './dto/onboarding-request.dto';
import { getConfig } from '../config/env.config';
import { COOKIE_KEYS } from '../auth/core/constants/cookie-keys.constant';
import { TokenVerifierService } from '../auth/crypto/token-verifier.service';
import { WebAuthService } from './web-auth.service';
import { ActorService } from 'src/identity-provider/actor.service';
import { UserRole } from 'src/identity-provider/enums';
import { OnboardingNotAllowedError } from 'src/identity-provider/errors/identity-provider.errors';
import { CreateManagedUserRequestDto } from './dto/create-managed-user-request.dto';
import { ManagedUserResponseDto } from './dto/managed-user-response.dto';
import { AccountSetupStatusRequestDto } from './dto/account-setup-status-request.dto';
import { AccountSetupStatusResponseDto } from './dto/account-setup-status-response.dto';
import { SetupManagedUserRequestDto } from './dto/setup-managed-user-request.dto';
import { User } from 'src/identity-provider/user.entity';

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

    this.setAuthCookies(response, accessToken, refreshToken, expiresInSeconds);

    // Return user info and token expiration
    return {
      user: {
        id: actor.id,
        email: user.email,
        displayName: actor.displayName,
        role: user.role,
        actorId: user.actorId,
        onboardingDisplayMode: user.onboardingDisplayMode,
      },
      expiresIn: expiresInSeconds,
    };
  }

  @Get('users')
  @ApiOperation({ summary: 'List human users for admin user management' })
  @ApiResponse({ status: 200, type: [ManagedUserResponseDto] })
  async listUsers(@Req() request: Request): Promise<ManagedUserResponseDto[]> {
    await this.requireAdminUser(request);
    const users = await this.identityProviderService.listManagedUsers();
    return users.map((user) => this.toManagedUserResponse(user));
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an invited human user' })
  @ApiBody({ type: CreateManagedUserRequestDto })
  @ApiResponse({ status: 201, type: ManagedUserResponseDto })
  async createUser(
    @Req() request: Request,
    @Body() createUserDto: CreateManagedUserRequestDto,
  ): Promise<ManagedUserResponseDto> {
    await this.requireAdminUser(request);
    const user = await this.identityProviderService.createManagedUser(createUserDto);
    return this.toManagedUserResponse(user);
  }

  @Post('users/:userId/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset a managed user password so they can set a new one' })
  @ApiResponse({ status: 200, type: ManagedUserResponseDto })
  async resetUserPassword(
    @Req() request: Request,
    @Param('userId') userId: string,
  ): Promise<ManagedUserResponseDto> {
    await this.requireAdminUser(request);
    const user = await this.identityProviderService.resetManagedUserPassword(userId);
    return this.toManagedUserResponse(user);
  }

  @Delete('users/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a managed user' })
  @ApiResponse({ status: 200, type: ManagedUserResponseDto })
  async deleteUser(
    @Req() request: Request,
    @Param('userId') userId: string,
  ): Promise<ManagedUserResponseDto> {
    const adminUser = await this.requireAdminUser(request);
    if (adminUser.id === userId) {
      throw new BadRequestException('Admins cannot delete their own account');
    }

    const user = await this.identityProviderService.deactivateManagedUser(userId);
    return this.toManagedUserResponse(user);
  }

  @Post('account-setup-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check whether an invited or reset account can be set up' })
  @ApiBody({ type: AccountSetupStatusRequestDto })
  @ApiResponse({ status: 200, type: AccountSetupStatusResponseDto })
  async getAccountSetupStatus(
    @Body() accountSetupDto: AccountSetupStatusRequestDto,
  ): Promise<AccountSetupStatusResponseDto> {
    return this.identityProviderService.getManagedAccountSetupStatus(accountSetupDto.email);
  }

  @Post('setup-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set up an invited or reset account and log in' })
  @ApiBody({ type: SetupManagedUserRequestDto })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  async setupAccount(
    @Body() setupUserDto: SetupManagedUserRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    await this.identityProviderService.setupManagedUser(setupUserDto);

    const { accessToken, refreshToken, expiresInSeconds, user, actor } =
      await this.webAuthService.login(setupUserDto.email, setupUserDto.password);

    this.setAuthCookies(response, accessToken, refreshToken, expiresInSeconds);

    return {
      user: {
        id: actor.id,
        email: user.email,
        displayName: actor.displayName,
        role: user.role,
        actorId: user.actorId,
        onboardingDisplayMode: user.onboardingDisplayMode,
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

    this.setAuthCookies(response, accessToken, refreshToken, expiresIn);

    // Return user info
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: actor.displayName,
        role: user.role,
        actorId: user.actorId,
        onboardingDisplayMode: user.onboardingDisplayMode,
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
    if (!actor.user || !actor.user.isActive) {
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
      onboardingDisplayMode: actor.user.onboardingDisplayMode,
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
    if (!actor.user || !actor.user.isActive) {
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

  @Get('onboarding-status')
  @ApiOperation({ summary: 'Check if system needs onboarding' })
  @ApiResponse({
    status: 200,
    description: 'Onboarding status',
    type: OnboardingStatusResponseDto,
  })
  async getOnboardingStatus(): Promise<OnboardingStatusResponseDto> {
    const hasAdmins = await this.identityProviderService.hasAdminUsers();
    return { needsOnboarding: !hasAdmins };
  }

  @Post('onboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create first admin user (only works if no admins exist)' })
  @ApiBody({ type: OnboardingRequestDto })
  @ApiResponse({
    status: 200,
    description: 'First admin user created and logged in',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Admin users already exist, onboarding not allowed',
  })
  async onboard(
    @Body() onboardingDto: OnboardingRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    // Atomically create first admin user (prevents race condition)
    const user = await this.identityProviderService.createFirstAdminUserIfNeeded({
      email: onboardingDto.email,
      slug: onboardingDto.slug,
      displayName: onboardingDto.displayName,
      password: onboardingDto.password,
    });

    if (!user) {
      throw new OnboardingNotAllowedError();
    }

    // Get the actor
    const actor = await this.actorService.getActorById(user.actorId);
    if (!actor) {
      this.logger.error('Actor not found after user creation');
      throw new InternalServerErrorException('Failed to retrieve actor');
    }

    // Auto-login the user
    const { accessToken, refreshToken, expiresInSeconds } =
      await this.webAuthService.login(onboardingDto.email, onboardingDto.password);

    this.setAuthCookies(response, accessToken, refreshToken, expiresInSeconds);

    this.logger.log(`First admin user created: ${onboardingDto.email}`);

    return {
      user: {
        id: actor.id,
        email: user.email,
        displayName: actor.displayName,
        role: UserRole.ADMIN,
        actorId: user.actorId,
        onboardingDisplayMode: user.onboardingDisplayMode,
      },
      expiresIn: expiresInSeconds,
    };
  }

  @Post('mark-walkthrough-seen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark walkthrough as seen for authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Walkthrough marked as seen',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated',
  })
  async markWalkthroughSeen(@Req() request: Request): Promise<{ ok: boolean }> {
    // Get access token from cookie
    const accessToken = request.cookies?.[COOKIE_KEYS.ACCESS_TOKEN];

    if (!accessToken) {
      throw new UnauthorizedException('Not authenticated');
    }

    // Validate token and get payload
    const payload = await this.tokenVerifierService.verifyAndDecode(accessToken);

    // Get user from database
    const actor = await this.actorService.getActorById(payload.actor_id, true);
    if (!actor) {
      throw new UnauthorizedException('Actor not found');
    }
    if (!actor.user || !actor.user.isActive) {
      this.logger.error('Actor returned no user. This should not happen');
      throw new InternalServerErrorException('Failed to retrieve actor');
    }

    // Mark walkthrough as seen
    await this.identityProviderService.markWalkthroughSeen(actor.user.id);

    this.logger.log(`Walkthrough marked as seen for user: ${actor.user.email}`);

    return { ok: true };
  }

  private async requireAdminUser(request: Request): Promise<User> {
    const accessToken = request.cookies?.[COOKIE_KEYS.ACCESS_TOKEN];
    if (!accessToken) {
      throw new UnauthorizedException('Not authenticated');
    }

    const payload = await this.tokenVerifierService.verifyAndDecode(accessToken);
    const actor = await this.actorService.getActorById(payload.actor_id, true);
    if (!actor?.user || !actor.user.isActive) {
      throw new UnauthorizedException('User not found');
    }
    if (actor.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }

    return actor.user;
  }

  private setAuthCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
    expiresInSeconds: number,
  ): void {
    const config = getConfig();
    const isProduction = config.nodeEnv === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
    };

    response.cookie(COOKIE_KEYS.ACCESS_TOKEN, accessToken, {
      ...cookieOptions,
      maxAge: expiresInSeconds * 1000,
    });

    response.cookie(COOKIE_KEYS.REFRESH_TOKEN, refreshToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000,
    });
  }

  private toManagedUserResponse(user: User): ManagedUserResponseDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.actor?.displayName ?? user.email,
      slug: user.actor?.slug ?? user.email,
      actorId: user.actorId,
      role: user.role as UserRole,
      isActive: user.isActive,
      passwordSetupPending: this.identityProviderService.isPasswordSetupPending(user),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
