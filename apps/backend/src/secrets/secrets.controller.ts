import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { CurrentUser } from '../auth/guards/decorators/current-user.decorator';
import type { UserContext } from '../auth/guards/context/auth-context.types';
import { SecretsService } from './secrets.service';
import { CreateSecretDto } from './dto/http/create-secret.dto';
import { UpdateSecretDto } from './dto/http/update-secret.dto';
import { SecretResponseDto, SecretValueResponseDto } from './dto/http/secret-response.dto';
import { SecretParamsDto } from './dto/http/secret-params.dto';
import { SecretResult, SecretValueResult } from './dto/service/secrets.service.types';
import { SecretsScopes } from './secrets.scopes';

@ApiTags('Secrets')
@ApiCookieAuth('JWT-Cookie')
@Controller('secrets')
@UseGuards(AccessTokenGuard, ScopesGuard)
export class SecretsController {
  constructor(private readonly secretsService: SecretsService) {}

  @Post()
  @RequireScopes(SecretsScopes.WRITE.id)
  @ApiOperation({ summary: 'Create a new secret' })
  @ApiCreatedResponse({ type: SecretResponseDto, description: 'Secret created successfully' })
  async createSecret(
    @Body() dto: CreateSecretDto,
    @CurrentUser() user: UserContext,
  ): Promise<SecretResponseDto> {
    const result = await this.secretsService.createSecret({
      name: dto.name,
      description: dto.description,
      value: dto.value,
      createdByActorId: user.actorId,
    });
    return this.mapToResponse(result);
  }

  @Get()
  @RequireScopes(SecretsScopes.READ.id)
  @ApiOperation({ summary: 'List all secrets - values not included' })
  @ApiOkResponse({ type: [SecretResponseDto], description: 'List of secrets (no values)' })
  async listSecrets(): Promise<SecretResponseDto[]> {
    const results = await this.secretsService.listSecrets();
    return results.map((r) => this.mapToResponse(r));
  }

  @Get(':id')
  @RequireScopes(SecretsScopes.READ.id)
  @ApiOperation({ summary: 'Get secret metadata by ID - value not included' })
  @ApiOkResponse({ type: SecretResponseDto, description: 'Secret metadata' })
  @ApiNotFoundResponse({ description: 'Secret not found' })
  async getSecret(@Param() params: SecretParamsDto): Promise<SecretResponseDto> {
    const result = await this.secretsService.getSecretById(params.id);
    return this.mapToResponse(result);
  }

  @Get(':id/value')
  @RequireScopes(SecretsScopes.WRITE.id)
  @ApiOperation({ summary: 'Get decrypted secret value' })
  @ApiOkResponse({ type: SecretValueResponseDto, description: 'Decrypted secret value' })
  @ApiNotFoundResponse({ description: 'Secret not found' })
  async getSecretValue(@Param() params: SecretParamsDto): Promise<SecretValueResponseDto> {
    const result = await this.secretsService.getSecretValue(params.id);
    return this.mapToValueResponse(result);
  }

  @Patch(':id')
  @RequireScopes(SecretsScopes.WRITE.id)
  @ApiOperation({ summary: 'Update a secret' })
  @ApiOkResponse({ type: SecretResponseDto, description: 'Secret updated successfully' })
  @ApiNotFoundResponse({ description: 'Secret not found' })
  async updateSecret(
    @Param() params: SecretParamsDto,
    @Body() dto: UpdateSecretDto,
  ): Promise<SecretResponseDto> {
    const result = await this.secretsService.updateSecret(params.id, {
      name: dto.name,
      description: dto.description,
      value: dto.value,
    });
    return this.mapToResponse(result);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireScopes(SecretsScopes.DELETE.id)
  @ApiOperation({ summary: 'Delete a secret' })
  @ApiNoContentResponse({ description: 'Secret deleted successfully' })
  @ApiNotFoundResponse({ description: 'Secret not found' })
  async deleteSecret(@Param() params: SecretParamsDto): Promise<void> {
    await this.secretsService.deleteSecret(params.id);
  }

  private mapToResponse(result: SecretResult): SecretResponseDto {
    return {
      id: result.id,
      name: result.name,
      description: result.description,
      createdByActorId: result.createdByActorId,
      createdBy: result.createdBy,
      rowVersion: result.rowVersion,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  private mapToValueResponse(result: SecretValueResult): SecretValueResponseDto {
    return {
      id: result.id,
      name: result.name,
      value: result.value,
    };
  }
}
