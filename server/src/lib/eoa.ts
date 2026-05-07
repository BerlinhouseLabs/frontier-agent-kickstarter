import type { Hex, TypedData, TypedDataDefinition } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';

export type AgentSignInChallenge = TypedDataDefinition<TypedData, string>;

export class AgentEoa {
  private readonly account: PrivateKeyAccount;

  constructor(privateKey: Hex) {
    this.account = privateKeyToAccount(privateKey);
  }

  getAccount(): PrivateKeyAccount {
    return this.account;
  }

  getAddress(): Hex {
    return this.account.address;
  }

  async signEip712Challenge(challenge: AgentSignInChallenge): Promise<Hex> {
    return this.account.signTypedData(challenge);
  }
}

export function agentEoaFromEnv(): AgentEoa {
  const privateKey = process.env.AGENT_EOA_PRIVATE_KEY;
  if (!privateKey?.startsWith('0x')) {
    throw new Error('AGENT_EOA_PRIVATE_KEY must be a 0x-prefixed hex private key');
  }
  return new AgentEoa(privateKey as Hex);
}
