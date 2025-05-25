const charset: string = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

const fromHex = (hex: string): number[] => {
  const arr: number[] = [];
  for (let n = 0; n < hex.length; n += 2) {
    arr.push(parseInt(hex.substr(n, 2), 16));
  }
  return arr;
};

const toWords = (data: number[]): number[] => {
  let value = 0;
  let bits = 0;
  const maxV = (1 << 5) - 1;
  const result: number[] = [];

  for (let i = 0; i < data.length; ++i) {
    value = (value << 8) | data[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result.push((value >> bits) & maxV);
    }
  }

  if (bits > 0) {
    result.push((value << (5 - bits)) & maxV);
  }

  return result;
};

const polymod = (values: (number | bigint)[]): bigint => {
  let c: bigint = 1n;

  for (const d of values) {
    const c0: bigint = c >> 35n;
    c = ((c & 0x07ffffffffn) << 5n) ^ BigInt(d);

    if (c0 & 0x01n) c ^= 0x98f2bc8e61n;
    if (c0 & 0x02n) c ^= 0x79b76d99e2n;
    if (c0 & 0x04n) c ^= 0xf33e5fb3c4n;
    if (c0 & 0x08n) c ^= 0xae2eabe2a8n;
    if (c0 & 0x10n) c ^= 0x1e4f43e470n;
  }

  return c ^ 1n;
};

const encodeAddress = (prefix: string, payload: number[], version: number): string => {
  const data: number[] = [version].concat(payload);
  const address: number[] = toWords(data);

  const checksum_num: bigint = polymod([
    ...Array.from(prefix).map((c) => c.charCodeAt(0) & 0x1f),
    0,
    ...address,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ]);

  const checksum: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 8; i++) {
    checksum[7 - i] = Number((checksum_num >> (5n * BigInt(i))) & 0x1fn);
  }

  return prefix + ':' + [...address, ...checksum].map((c) => charset[c]).join('');
};

export const parsePayload = (payload: string | null): [string, string] => {
  if (payload === null) return ['', ''];

  const buffer: number[] = fromHex(payload);
  let version: number = buffer[16];
  const length: number = buffer[18];
  let script: number[] = buffer.slice(19, 19 + length);

  if (script[0] === 0xaa) {
    version = 8;
    script = script.slice(1, script.length);
  }

  if (script[0] < 0x76) {
    const address_size: number = script[0];
    const address: number[] = script.slice(1, address_size + 1);
    return [
      encodeAddress('spectre', address, version),
      String.fromCharCode(...buffer.slice(19 + length, buffer.length)),
    ];
  }

  return [payload, ''];
};
