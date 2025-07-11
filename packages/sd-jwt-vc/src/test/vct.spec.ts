import { digest, generateSalt } from '@sd-jwt/crypto-nodejs';
import type { DisclosureFrame, Signer, Verifier } from '@sd-jwt/types';
import { describe, test, beforeAll, afterAll, expect } from 'vitest';
import { SDJwtVcInstance } from '..';
import type { SdJwtVcPayload } from '../sd-jwt-vc-payload';
import Crypto from 'node:crypto';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';
import { afterEach } from 'node:test';
import type { TypeMetadataFormat } from '../sd-jwt-vc-type-metadata-format';

const exampleVctm = {
  vct: 'http://example.com/example',
  name: 'ExampleCredentialType',
  description: 'An example credential type',
  schema_uri: 'http://example.com/schema/example',
  //this value could be generated on demand to make it easier when changing the values
  'schema_uri#Integrity':
    'sha256-48a61b283ded3b55e8d9a9b063327641dc4c53f76bd5daa96c23f232822167ae',
};

const restHandlers = [
  http.get('http://example.com/schema/example', () => {
    const res = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        vct: {
          type: 'string',
        },
        iss: {
          type: 'string',
        },
        nbf: {
          type: 'number',
        },
        exp: {
          type: 'number',
        },
        cnf: {
          type: 'object',
        },
        status: {
          type: 'object',
        },
        firstName: {
          type: 'string',
        },
      },
      required: ['iss', 'vct'],
    };
    return HttpResponse.json(res);
  }),
  http.get('http://example.com/example', () => {
    const res: TypeMetadataFormat = exampleVctm;
    return HttpResponse.json(res);
  }),
  http.get('http://example.com/timeout', () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(HttpResponse.json({}));
      }, 10000);
    });
  }),
];

//this value could be generated on demand to make it easier when changing the values
const vctIntegrity =
  'sha256-96bed58130a44af05ae8970aa9caa0bf0135cd15afe721ea29f553394692acef';

const server = setupServer(...restHandlers);

const iss = 'ExampleIssuer';
const vct = 'http://example.com/example';
const iat = Math.floor(Date.now() / 1000); // current time in seconds

const { privateKey, publicKey } = Crypto.generateKeyPairSync('ed25519');

const createSignerVerifier = () => {
  const signer: Signer = async (data: string) => {
    const sig = Crypto.sign(null, Buffer.from(data), privateKey);
    return Buffer.from(sig).toString('base64url');
  };
  const verifier: Verifier = async (data: string, sig: string) => {
    return Crypto.verify(
      null,
      Buffer.from(data),
      publicKey,
      Buffer.from(sig, 'base64url'),
    );
  };
  return { signer, verifier };
};

describe('App', () => {
  const { signer, verifier } = createSignerVerifier();

  const sdjwt = new SDJwtVcInstance({
    signer,
    signAlg: 'EdDSA',
    verifier,
    hasher: digest,
    hashAlg: 'sha-256',
    saltGenerator: generateSalt,
    loadTypeMetadataFormat: true,
    timeout: 1000,
  });

  const claims = {
    firstname: 'John',
  };
  const disclosureFrame = {
    _sd: ['firstname'],
  };

  beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

  afterAll(() => server.close());

  afterEach(() => server.resetHandlers());

  test('VCT Validation', async () => {
    const expectedPayload: SdJwtVcPayload = {
      iat,
      iss,
      vct,
      'vct#Integrity': vctIntegrity,
      ...claims,
    };
    const encodedSdjwt = await sdjwt.issue(
      expectedPayload,
      disclosureFrame as unknown as DisclosureFrame<SdJwtVcPayload>,
    );

    await sdjwt.verify(encodedSdjwt);
  });

  test('VCT from JWT header Validation', async () => {
    const expectedPayload: SdJwtVcPayload = {
      iat,
      iss,
      vct,
      'vct#Integrity': vctIntegrity,
      ...claims,
    };
    const header = {
      vctm: [Buffer.from(JSON.stringify(exampleVctm)).toString('base64url')],
    };
    const encodedSdjwt = await sdjwt.issue(
      expectedPayload,
      disclosureFrame as unknown as DisclosureFrame<SdJwtVcPayload>,
      { header },
    );

    await sdjwt.verify(encodedSdjwt);
  });

  test('VCT Validation with timeout', async () => {
    const vct = 'http://example.com/timeout';
    const expectedPayload: SdJwtVcPayload = {
      iat,
      iss,
      vct,
      ...claims,
    };
    const encodedSdjwt = await sdjwt.issue(
      expectedPayload,
      disclosureFrame as unknown as DisclosureFrame<SdJwtVcPayload>,
    );

    expect(sdjwt.verify(encodedSdjwt)).rejects.toThrowError(
      `Request to ${vct} timed out`,
    );
  });

  test('VCT Metadata retrieval', async () => {
    const expectedPayload: SdJwtVcPayload = {
      iat,
      iss,
      vct,
      'vct#Integrity': vctIntegrity,
      ...claims,
    };
    const encodedSdjwt = await sdjwt.issue(
      expectedPayload,
      disclosureFrame as unknown as DisclosureFrame<SdJwtVcPayload>,
    );

    const typeMetadataFormat = await sdjwt.getVct(encodedSdjwt);
    expect(typeMetadataFormat).to.deep.eq({
      description: 'An example credential type',
      name: 'ExampleCredentialType',
      schema_uri: 'http://example.com/schema/example',
      'schema_uri#Integrity':
        'sha256-48a61b283ded3b55e8d9a9b063327641dc4c53f76bd5daa96c23f232822167ae',
      vct: 'http://example.com/example',
    });
  });

  //TODO: we need tests with an embedded schema, extended and maybe also to test the errors when schema information is not available or the integrity is not valid
});
