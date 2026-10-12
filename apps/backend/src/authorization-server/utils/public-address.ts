import { BlockList, isIP } from 'net';

/**
 * Addresses a server-side fetch of a caller-supplied URL must never reach:
 * loopback, private networks, link-local (cloud metadata lives there),
 * carrier-grade NAT, multicast, and the documentation / reserved ranges.
 */
const nonPublicAddresses = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  nonPublicAddresses.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96], // NAT64, reaches IPv4 addresses
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001:db8::', 32],
  ['2002::', 16], // 6to4, embeds an IPv4 address
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  nonPublicAddresses.addSubnet(network, prefix, 'ipv6');
}

const loopbackV6 = new BlockList();
loopbackV6.addAddress('::1', 'ipv6');

const IPV4_MAPPED_PREFIX = /^::ffff:/i;

/**
 * True when `address` is an IP literal on the public internet.
 * Anything that is not an IP literal is not a public address.
 */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    return !nonPublicAddresses.check(address, 'ipv4');
  }
  if (family !== 6) {
    return false;
  }
  if (IPV4_MAPPED_PREFIX.test(address)) {
    const mapped = address.replace(IPV4_MAPPED_PREFIX, '');
    // ::ffff:7f00:1 is the same address as ::ffff:127.0.0.1
    return isIP(mapped) === 4 ? isPublicAddress(mapped) : false;
  }
  return !nonPublicAddresses.check(address, 'ipv6');
}

/** True when `address` is an IP literal for this machine itself (127.0.0.0/8 or ::1) */
export function isLoopbackAddress(address: string): boolean {
  const unmapped = address.replace(IPV4_MAPPED_PREFIX, '');
  if (isIP(unmapped) === 4) {
    return unmapped.startsWith('127.');
  }
  return isIP(address) === 6 && loopbackV6.check(address, 'ipv6');
}
