import { Module } from "@nestjs/common";
import { AgentsModule } from "src/agents/agents.module";
import { AppInitRunner } from "./app-init.runner";
import { McpRegistryModule } from "src/mcp-registry/mcp-registry.module";
import { IdentityProviderModule } from "src/identity-provider/identity-provider.module";

@Module({
  imports: [
    AgentsModule,
    McpRegistryModule,
    IdentityProviderModule,
  ],
  providers: [
    AppInitRunner
  ],
  exports: [
    AppInitRunner,
  ],
})
export class AppInitModule {}