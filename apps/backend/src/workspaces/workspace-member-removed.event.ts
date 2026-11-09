/** A person was removed from a workspace. Their access ends now, not when their token expires. */
export class WorkspaceMemberRemovedEvent {
  static readonly INTERNAL = 'workspace.member.removed';

  constructor(
    readonly workspaceId: string,
    readonly actorId: string,
  ) {}
}
