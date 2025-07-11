import {
  sha256 as nobleSha256,
  sha384 as nobleSha384,
  sha512 as nobleSha512,
} from '@noble/hashes/sha2.js';
import { SDJWTException } from '@sd-jwt/utils';

export const sha256 = (text: string | ArrayBuffer): Uint8Array => {
  const uint8Array =
    typeof text === 'string' ? toUTF8Array(text) : new Uint8Array(text);
  const hashBytes = nobleSha256(uint8Array);
  return hashBytes;
};

export const sha384 = (text: string | ArrayBuffer): Uint8Array => {
  const uint8Array =
    typeof text === 'string' ? toUTF8Array(text) : new Uint8Array(text);
  const hashBytes = nobleSha384(uint8Array);
  return hashBytes;
};

export const sha512 = (text: string | ArrayBuffer): Uint8Array => {
  const uint8Array =
    typeof text === 'string' ? toUTF8Array(text) : new Uint8Array(text);
  const hashBytes = nobleSha512(uint8Array);
  return hashBytes;
};

type HasherAlgorithm = 'sha256' | 'sha384' | 'sha512' | (string & {});

export const hasher = (
  data: string | ArrayBuffer,
  algorithm: HasherAlgorithm = 'sha256',
) => {
  const msg =
    typeof data === 'string' ? toUTF8Array(data) : new Uint8Array(data);

  const alg = toCryptoAlg(algorithm);

  switch (alg) {
    case 'sha256':
      return sha256(msg);
    case 'sha384':
      return sha384(msg);
    case 'sha512':
      return sha512(msg);
    default:
      throw new SDJWTException(`Unsupported algorithm: ${algorithm}`);
  }
};

const toCryptoAlg = (hashAlg: HasherAlgorithm): string =>
  // To cover sha-256, sha256, SHA-256, SHA256
  hashAlg
    .replace('-', '')
    .toLowerCase();

function toUTF8Array(str: string) {
  const utf8: Array<number> = [];
  for (let i = 0; i < str.length; i++) {
    let charcode = str.charCodeAt(i);
    if (charcode < 0x80) utf8.push(charcode);
    else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(
        0xe0 | (charcode >> 12),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f),
      );
    }
    // surrogate pair
    else {
      i++;
      // UTF-16 encodes 0x10000-0x10FFFF by
      // subtracting 0x10000 and splitting the
      // 20 bits of 0x0-0xFFFFF into two halves
      charcode =
        0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      utf8.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f),
      );
    }
  }
  return new Uint8Array(utf8);
}
