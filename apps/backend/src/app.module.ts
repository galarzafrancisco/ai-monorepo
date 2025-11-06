import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TaskerooModule } from './taskeroo/taskeroo.module';
import { WikirooModule } from './wikiroo/wikiroo.module';
import { AuthorizationServerModule } from './authorization-server/authorization-server.module';
import { McpRegistryModule } from './mcp-registry/mcp-registry.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_PATH || 'data/database.sqlite',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
    }),
    EventEmitterModule.forRoot(),
    TaskerooModule,
    WikirooModule,
    AuthorizationServerModule,
    McpRegistryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
