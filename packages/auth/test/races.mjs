import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exactResource } from '@taico/auth';
import {
  authorizeClient,
  createTestServer,
  NOTES,
  race,
  raceControl,
  tokenRequest,
} from './helpers.mjs';

/*
 * A thief and the legitimate client present the same single-use credential at
 * the same moment. One of them wins the rotation. Whatever it was given, or
 * was about to be given, must not be usable: not the refresh token, and not
 * the access token either.
 *
 * Each race runs in both orders, because they are caught in different places:
 * - revocation first: the winner is still issuing when the loser revokes.
 *   The server must refuse to hand its tokens out.
 * - response first: the winner already holds its tokens when the loser
 *   revokes. The verifier must refuse them.
 */
const ORDERS = ['revocation', 'response'];

/** `setup()` returns `{ stores, users?, email? }` for one test */
export function defineRaceTests(label, setup) {
  const serverWith = async (wrap) => {
    const { stores, ...rest } = await setup();
    const control = wrap(stores);
    const created = await createTestServer({ ...rest, stores: { ...stores, ...control.stores } });
    return { ...created, stores, control: control.control };
  };
  const racingRefreshTokens = (stores) => {
    const control = raceControl(stores.refreshTokens, { read: 'find', write: 'consume' });
    return { control, stores: { refreshTokens: control.store } };
  };
  const racingCodes = (stores) => {
    const control = raceControl(stores.grants, { read: 'findByCodeHash', write: 'redeemCode' });
    return { control, stores: { grants: control.store } };
  };

  const assertGrantTokensDead = async (server, flow, tokens) => {
    const notes = server.resourceServer({ audience: exactResource(NOTES.resourceUrl) });
    await assert.rejects(
      notes.authenticateToken(tokens.access_token, NOTES.resourceUrl),
      /revoked/i,
      'the access token must be refused',
    );
    assert.deepEqual(await server.introspect({ token: tokens.access_token }), { active: false });
    await assert.rejects(
      server.token({
        grant_type: 'refresh_token',
        client_id: flow.client.clientId,
        refresh_token: tokens.refresh_token,
      }),
      'the refresh token must be refused',
    );
  };

  for (const first of ORDERS) {
    test(`${label}: racing on a refresh token leaves no usable token (${first} first)`, async () => {
      const { server, stores, user, control } = await serverWith(racingRefreshTokens);
      const flow = await authorizeClient(server, user);
      const original = await server.token(tokenRequest(flow));

      const winners = await race({
        control,
        first,
        present: () =>
          server.token({
            grant_type: 'refresh_token',
            client_id: flow.client.clientId,
            refresh_token: original.refresh_token,
          }),
      });

      assert.equal(winners.length, first === 'revocation' ? 0 : 1);
      assert.equal((await stores.grants.findById(flow.grantId)).status, 'revoked');
      for (const tokens of [original, ...winners]) {
        await assertGrantTokensDead(server, flow, tokens);
      }
    });

    test(`${label}: racing on an authorization code leaves no usable token (${first} first)`, async () => {
      const { server, stores, user, control } = await serverWith(racingCodes);
      const flow = await authorizeClient(server, user);

      const winners = await race({
        control,
        first,
        present: () => server.token(tokenRequest(flow)),
      });

      assert.equal(winners.length, first === 'revocation' ? 0 : 1);
      assert.equal((await stores.grants.findById(flow.grantId)).status, 'revoked');
      for (const tokens of winners) {
        await assertGrantTokensDead(server, flow, tokens);
      }
    });

    test(`${label}: racing on a session refresh token ends every session (${first} first)`, async () => {
      const { server, user, control } = await serverWith(racingRefreshTokens);
      const login = () => server.login({ email: user.email, password: 'correct horse' });
      const session = await login();
      const otherDevice = await login();
      assert.equal(await server.resolveSession(otherDevice.accessToken), user.id);

      const winners = await race({
        control,
        first,
        present: () => server.refreshSession(session.refreshToken),
      });

      assert.equal(winners.length, first === 'revocation' ? 0 : 1);
      for (const tokens of [session, otherDevice, ...winners]) {
        await assert.rejects(
          server.resolveSession(tokens.accessToken),
          /revoked/i,
          'the session access token must be refused',
        );
        await assert.rejects(server.refreshSession(tokens.refreshToken), /revoked/);
      }
      // Logging in again starts a session the revocation does not reach
      assert.equal(await server.resolveSession((await login()).accessToken), user.id);
    });
  }
}
