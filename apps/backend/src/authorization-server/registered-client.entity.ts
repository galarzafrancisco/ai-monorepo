import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
} from 'typeorm';
import { GrantType, TokenEndpointAuthMethod } from './enums';

@Entity({ name: 'registered_clients' })
export class RegisteredClientEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true, name: 'client_id' })
  clientId!: string;

  @Column({ type: 'text', name: 'client_secret', nullable: true })
  clientSecret!: string | null;

  @Column({ type: 'text', name: 'client_name' })
  clientName!: string;

  @Column('simple-array', { name: 'redirect_uris' })
  redirectUris!: string[];

  @Column('simple-array', { name: 'grant_types' })
  grantTypes!: GrantType[];

  @Column({
    type: 'text',
    name: 'token_endpoint_auth_method',
    enum: TokenEndpointAuthMethod,
  })
  tokenEndpointAuthMethod!: TokenEndpointAuthMethod;

  @Column('simple-array', { nullable: true })
  scopes!: string[] | null;

  @Column('simple-array', { nullable: true })
  contacts!: string[] | null;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
