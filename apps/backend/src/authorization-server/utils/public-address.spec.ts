import { isLoopbackAddress, isPublicAddress } from './public-address';

describe('isPublicAddress', () => {
  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '172.15.0.1',
    '172.32.0.1',
    '2606:4700::1111',
  ])('accepts the public address %s', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([
    ['loopback', '127.0.0.1'],
    ['loopback, any address in the block', '127.8.9.1'],
    ['unspecified', '0.0.0.0'],
    ['private 10/8', '10.1.2.3'],
    ['private 172.16/12', '172.16.0.1'],
    ['private 172.16/12, upper end', '172.31.255.255'],
    ['private 192.168/16', '192.168.1.1'],
    ['link-local, where cloud metadata lives', '169.254.169.254'],
    ['carrier-grade NAT', '100.64.0.1'],
    ['multicast', '224.0.0.1'],
    ['reserved', '240.0.0.1'],
    ['broadcast', '255.255.255.255'],
    ['IPv6 loopback', '::1'],
    ['IPv6 unspecified', '::'],
    ['IPv6 unique local', 'fd12:3456::1'],
    ['IPv6 link-local', 'fe80::1'],
    ['IPv6 multicast', 'ff02::1'],
    ['IPv4-mapped loopback', '::ffff:127.0.0.1'],
    ['IPv4-mapped loopback in hex', '::ffff:7f00:1'],
    ['IPv4-mapped private', '::ffff:10.0.0.1'],
    ['NAT64 of a private address', '64:ff9b::a00:1'],
    ['6to4 of a private address', '2002:a00:1::1'],
  ])('refuses %s (%s)', (_name, address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it('refuses anything that is not an IP address', () => {
    expect(isPublicAddress('localhost')).toBe(false);
    expect(isPublicAddress('example.com')).toBe(false);
    expect(isPublicAddress('')).toBe(false);
  });

  it('accepts a public address written as IPv4-mapped IPv6', () => {
    expect(isPublicAddress('::ffff:8.8.8.8')).toBe(true);
  });
});

describe('isLoopbackAddress', () => {
  it.each([
    '127.0.0.1',
    '127.9.9.9',
    '::1',
    '0:0:0:0:0:0:0:1',
    '::ffff:127.0.0.1',
  ])('recognises %s', (address) => {
    expect(isLoopbackAddress(address)).toBe(true);
  });

  it.each([
    '10.0.0.1',
    '169.254.169.254',
    '192.168.1.1',
    '8.8.8.8',
    'fe80::1',
    'localhost',
    '1270.0.0.1',
  ])('does not treat %s as loopback', (address) => {
    expect(isLoopbackAddress(address)).toBe(false);
  });
});
