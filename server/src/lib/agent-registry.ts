import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  type Address,
  type Hash,
  type PrivateKeyAccount,
  type PublicClient,
  type WalletClient,
} from 'viem';

import type { FrontierId } from './state.js';

export type BudgetSpec = {
  currency: 'FND';
  maxPerPeriod: string;
  periodDays: number;
};

export type Subscription = {
  scopes: string[];
  budget: BudgetSpec;
  usedThisPeriod: bigint;
};

const agentRegistryAbi = [
  {
    type: 'function',
    name: 'listSubscribers',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string[]' }],
  },
  {
    type: 'function',
    name: 'getSubscription',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'string' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'scopes', type: 'string[]' },
          { name: 'maxPerPeriod', type: 'uint256' },
          { name: 'periodDays', type: 'uint32' },
          { name: 'usedThisPeriod', type: 'uint256' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'canSpend',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'string' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'spend',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'user', type: 'string' },
      { name: 'amount', type: 'uint256' },
      { name: 'purpose', type: 'string' },
    ],
    outputs: [],
  },
] as const;

export class AgentRegistry {
  private readonly contractAddress: Address;
  private readonly agentEoa: PrivateKeyAccount;
  private readonly publicClient: PublicClient;
  private readonly walletClient: WalletClient;

  constructor(opts: { contractAddress: Address; rpcUrl: string; agentEoa: PrivateKeyAccount }) {
    this.contractAddress = opts.contractAddress;
    this.agentEoa = opts.agentEoa;
    this.publicClient = createPublicClient({ transport: http(opts.rpcUrl) });
    this.walletClient = createWalletClient({ account: opts.agentEoa, transport: http(opts.rpcUrl) });
  }

  async listSubscribers(): Promise<FrontierId[]> {
    this.assertDeployed();
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: agentRegistryAbi,
      functionName: 'listSubscribers',
    }) as Promise<FrontierId[]>;
  }

  async getSubscription(user: FrontierId): Promise<Subscription | null> {
    this.assertDeployed();
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: agentRegistryAbi,
      functionName: 'getSubscription',
      args: [user],
    });

    if (!result) return null;
    return {
      scopes: [...result.scopes],
      budget: {
        currency: 'FND',
        maxPerPeriod: result.maxPerPeriod.toString(),
        periodDays: result.periodDays,
      },
      usedThisPeriod: result.usedThisPeriod,
    };
  }

  async canSpend(user: FrontierId, amount: bigint): Promise<boolean> {
    this.assertDeployed();
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: agentRegistryAbi,
      functionName: 'canSpend',
      args: [user, amount],
    }) as Promise<boolean>;
  }

  async spend(user: FrontierId, amount: bigint, purpose: string): Promise<{ txHash: Hash }> {
    this.assertDeployed();
    const txHash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: agentRegistryAbi,
      functionName: 'spend',
      args: [user, amount, purpose],
      chain: null,
      account: this.agentEoa,
    });
    return { txHash };
  }

  // TODO: Replace this placeholder once Felix's AgentRegistry contract is live in sandbox.
  private assertDeployed(): void {
    throw new Error('AgentRegistry not yet deployed in sandbox');
  }
}

export function fndAmount(value: string): bigint {
  return parseUnits(value, 18);
}
