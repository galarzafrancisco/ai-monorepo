import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ActorType } from '../../../identity-provider/enums';
import { WorkspaceRole } from '../../../workspaces/enums';

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

export class InviteWorkspaceMemberResponseDto {
  @ApiProperty({ type: WorkspaceMemberResponseDto })
  member!: WorkspaceMemberResponseDto;

  @ApiProperty({
    description:
      'Whether an invited account was created for the email. They set a password through account setup before they can sign in.',
  })
  accountCreated!: boolean;
}
