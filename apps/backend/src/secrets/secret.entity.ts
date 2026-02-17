import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { ActorEntity } from '../identity-provider/actor.entity';

@Entity({ name: 'secrets' })
export class SecretEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', name: 'encrypted_value' })
  encryptedValue!: string;

  @Column({ type: 'uuid', nullable: false, name: 'created_by_actor_id' })
  createdByActorId!: string;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'created_by_actor_id' })
  createdByActor?: ActorEntity;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;

  get createdBy(): string | null {
    return this.createdByActor?.slug ?? null;
  }
}
