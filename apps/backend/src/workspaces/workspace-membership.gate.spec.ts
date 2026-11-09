import type { AuthContext } from '../auth/guards/context/auth-context.types';
import { WorkspaceMembershipGate } from './workspace-membership.gate';
import { WorkspacesService } from './workspaces.service';

const WS = '11111111-1111-4111-8111-111111111111';
const ACTOR = '22222222-2222-4222-8222-222222222222';
const auth = { workspaceId: WS, subject: ACTOR, claims: { actor_id: ACTOR } } as unknown as AuthContext;

describe('WorkspaceMembershipGate', () => {
  it('answers from the database on every check, so no earlier answer outlives a removal', async () => {
    let member = true;
    let releaseSlowRead!: () => void;
    const isMember = jest
      .fn()
      // A lookup that started before the removal and resolves after it.
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => { releaseSlowRead = () => resolve(true); }))
      .mockImplementation(async () => member);
    const gate = new WorkspaceMembershipGate({ isMember } as unknown as WorkspacesService);

    const inFlight = gate.isMember(auth);
    member = false; // the removal commits while that lookup is still running
    releaseSlowRead();
    await expect(inFlight).resolves.toBe(true); // that one request was already being served
    await expect(gate.isMember(auth)).resolves.toBe(false); // the next one is refused
    await expect(gate.isMember(auth)).resolves.toBe(false);
    expect(isMember).toHaveBeenCalledTimes(3);
  });

  it('treats an actor or workspace that is not a UUID as no member, without a query', async () => {
    const isMember = jest.fn();
    const gate = new WorkspaceMembershipGate({ isMember } as unknown as WorkspacesService);
    await expect(gate.isMember({ ...auth, subject: 'worker', claims: {} } as unknown as AuthContext)).resolves.toBe(false);
    expect(isMember).not.toHaveBeenCalled();
  });
});
