import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ActorType } from '../../../identity-provider/enums';
import { LocatableRowKind, WorkspaceRole } from '../../../workspaces/enums';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const WORKSPACE_NAME_MAX = 100;
export const WORKSPACE_SLUG_MAX = 50;

export class CreateWorkspaceRequestDto {
  @ApiProperty({ example: 'Acme', maxLength: WORKSPACE_NAME_MAX })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(WORKSPACE_NAME_MAX)
  name!: string;

  @ApiProperty({
    example: 'acme',
    description: 'Unique across the installation: lowercase letters, digits and hyphens.',
    maxLength: WORKSPACE_SLUG_MAX,
  })
  @IsString()
  @MaxLength(WORKSPACE_SLUG_MAX)
  @Matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
    message: 'slug must be lowercase letters, digits and hyphens',
  })
  slug!: string;
}

export class WorkspaceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: WorkspaceRole, enumName: 'WorkspaceRole', description: "The caller's role in it" })
  role!: WorkspaceRole;

  @ApiProperty({ description: 'Whether the token the request was made with is for this workspace' })
  current!: boolean;
}

export class InviteWorkspaceMemberRequestDto {
  @ApiProperty({
    example: 'someone@company.dev',
    format: 'email',
    description:
      'A person with an account is added; anyone else gets an invited account, set up through account setup.',
  })
  @Transform(trim)
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: WorkspaceRole, enumName: 'WorkspaceRole' })
  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}

export class UpdateWorkspaceMemberRequestDto {
  @ApiProperty({ enum: WorkspaceRole, enumName: 'WorkspaceRole' })
  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole;
}

export class WorkspaceMemberResponseDto {
  @ApiProperty({ format: 'uuid' })
  actorId!: string;

  @ApiProperty({ enum: ActorType, enumName: 'WorkspaceMemberActorType' })
  type!: ActorType;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ enum: WorkspaceRole, enumName: 'WorkspaceRole' })
  role!: WorkspaceRole;

  @ApiProperty({ type: String, format: 'date-time' })
  joinedAt!: string;
}

export class WorkspaceInvitationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'The invited email address' })
  email!: string;

  @ApiProperty({ enum: WorkspaceRole, enumName: 'WorkspaceRole' })
  role!: WorkspaceRole;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class InviteWorkspaceMemberResponseDto {
  @ApiProperty({ type: WorkspaceInvitationResponseDto })
  invitation!: WorkspaceInvitationResponseDto;

  @ApiProperty({
    description:
      'One-time code that accepts the invitation. Shown once: give it, or the link, to the person by a channel you trust.',
  })
  inviteCode!: string;

  @ApiProperty({ description: 'Link that opens the invitation with the code filled in. Shown once.' })
  inviteUrl!: string;
}

export class InvitationCodeRequestDto {
  @ApiProperty({ description: 'The one-time invitation code' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  code!: string;
}

export class InvitationPreviewResponseDto {
  @ApiProperty()
  workspaceName!: string;

  @ApiProperty()
  workspaceSlug!: string;

  @ApiProperty({ description: 'The invited email address' })
  email!: string;

  @ApiProperty({ enum: WorkspaceRole, enumName: 'WorkspaceRole' })
  role!: WorkspaceRole;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: string;
}

export class AcceptInvitationNewAccountRequestDto extends InvitationCodeRequestDto {
  @ApiProperty({ description: 'Display name', example: 'Jane User' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName!: string;

  @ApiProperty({ description: 'Username (slug)', example: 'jane' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  slug!: string;

  @ApiProperty({ description: 'Password for the new account', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}

export class AcceptInvitationResponseDto {
  @ApiProperty({ format: 'uuid' })
  workspaceId!: string;

  @ApiProperty()
  workspaceSlug!: string;

  @ApiProperty()
  workspaceName!: string;

  @ApiProperty({ enum: WorkspaceRole, enumName: 'WorkspaceRole' })
  role!: WorkspaceRole;
}

export class LocateRowQueryDto {
  @ApiProperty({ enum: LocatableRowKind, enumName: 'LocatableRowKind' })
  @IsEnum(LocatableRowKind)
  kind!: LocatableRowKind;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;
}
