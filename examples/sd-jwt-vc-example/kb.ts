import { SDJwtVcInstance } from '@sd-jwt/sd-jwt-vc';
import type { DisclosureFrame } from '@sd-jwt/types';
import { createSignerVerifier, digest, ES256, generateSalt } from './utils';

(async () => {
  const { signer, verifier } = await createSignerVerifier();

  // Create SDJwt instance for use
  const sdjwt = new SDJwtVcInstance({
    signer,
    signAlg: ES256.alg,
    verifier,
    hasher: digest,
    saltGenerator: generateSalt,
    kbSigner: signer,
    kbSignAlg: ES256.alg,
    kbVerifier: verifier,
  });
  const claims = {
    firstname: 'John',
    lastname: 'Doe',
    ssn: '123-45-6789',
    id: '1234',
  };
  const disclosureFrame: DisclosureFrame<typeof claims> = {
    _sd: ['firstname', 'id'],
  };

  const kbPayload = {
    iat: Math.floor(Date.now() / 1000),
    aud: 'https://example.com',
    nonce: '1234',
    custom: 'data',
  };

  const encodedSdjwt = await sdjwt.issue(
    {
      iss: 'Issuer',
      iat: Math.floor(Date.now() / 1000),
      vct: 'ExampleCredentials',
      ...claims,
    },
    disclosureFrame,
  );
  console.log('encodedSdjwt:', encodedSdjwt);
  const sdjwttoken = await sdjwt.decode(encodedSdjwt);
  console.log(sdjwttoken);

  const presentedSdJwt = await sdjwt.present<typeof claims>(
    encodedSdjwt,
    { id: true },
    {
      kb: {
        payload: kbPayload,
      },
    },
  );

  const verified = await sdjwt.verify(presentedSdJwt, {
    requiredClaimKeys: ['firstname', 'id'],
    keyBindingNonce: '1234',
  });
  console.log(verified);
})();
