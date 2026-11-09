import { Module } from '@nestjs/common';
import { WorkspacesModule } from 'src/workspaces/workspaces.module';
import { EntitlementsService } from './entitlements.service';

/**
 * Workspace entitlements: who may work in which workspace, with which role,
 * and which scopes their tokens may carry. See `EntitlementsService`.
 */
@Module({
  imports: [WorkspacesModule],
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
