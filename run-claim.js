const axios = require('axios');

const { worldchain } = require('viem/chains');
const { http, createPublicClient, createWalletClient } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

const CHAIN_ID = 480;
const USER_PRIZE_VAULT_ADDRESS = '0x4c7E1f64A4b121D2F10D6FbcA0DB143787BF64bB';
const WORLD_TOKEN_ADDRESS = '0x2cFc85d8E48F8EAB294be644d9E25C3030863003';
const MERKL_DISTRIBUTOR_CONTRACT_ADDRESS = '0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae';

// The ABI for the claim function
const CLAIM_ABI = [
  { inputs: [], name: 'InvalidDispute', type: 'error' },
  { inputs: [], name: 'InvalidLengths', type: 'error' },
  { inputs: [], name: 'InvalidProof', type: 'error' },
  { inputs: [], name: 'InvalidUninitializedRoot', type: 'error' },
  { inputs: [], name: 'NoDispute', type: 'error' },
  { inputs: [], name: 'NotGovernor', type: 'error' },
  { inputs: [], name: 'NotTrusted', type: 'error' },
  { inputs: [], name: 'NotWhitelisted', type: 'error' },
  { inputs: [], name: 'UnresolvedDispute', type: 'error' },
  { inputs: [], name: 'ZeroAddress', type: 'error' },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      { indexed: true, internalType: 'address', name: 'token', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'Claimed',
    type: 'event',
  },
  {
    inputs: [
      { internalType: 'address[]', name: 'users', type: 'address[]' },
      { internalType: 'address[]', name: 'tokens', type: 'address[]' },
      { internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' },
      { internalType: 'bytes32[][]', name: 'proofs', type: 'bytes32[][]' },
    ],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

async function sendTransaction(claimData) {
  const privateKey = process.env.CUSTOM_RELAYER_PRIVATE_KEY;
  const rpcUrl = process.env.JSON_RPC_URL;

  if (!privateKey || !rpcUrl) {
    console.error('Missing CUSTOM_RELAYER_PRIVATE_KEY or JSON_RPC_URL environment variables.');
    process.exit(1);
  }

  // Merkl Distributor Proxy Contract
  const users = [USER_PRIZE_VAULT_ADDRESS];
  const tokens = [WORLD_TOKEN_ADDRESS];
  const amounts = [claimData.accumulated];
  const proofs = [claimData.proof];

  try {
    const account = privateKeyToAccount(`0x${privateKey}`);
    const publicClient = createPublicClient({
      chain: worldchain,
      transport: http(rpcUrl),
    });
    const walletClient = createWalletClient({
      chain: worldchain,
      transport: http(rpcUrl),
      account,
    });

    const { request } = await publicClient.simulateContract({
      address: MERKL_DISTRIBUTOR_CONTRACT_ADDRESS,
      abi: CLAIM_ABI,
      functionName: 'claim',
      args: [users, tokens, amounts, proofs],
      account,
    });

    const hash = await walletClient.writeContract(request);
    console.log('Transaction hash:', hash);

    const transactionReceipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('Transaction receipt:', transactionReceipt);
  } catch (err) {
    console.error('Contract transaction failed:', err);
    process.exit(1);
  }
}

async function run() {
  const response = await axios.get(
    `https://api.merkl.xyz/v3/rewards?chainIds=${CHAIN_ID}&user=${USER_PRIZE_VAULT_ADDRESS}`,
  );
  const claimData = response.data[CHAIN_ID].tokenData[WORLD_TOKEN_ADDRESS];
  const somethingToClaim = claimData.unclaimed !== '0';

  if (somethingToClaim) {
    console.log('Sending claim tx!');
    await sendTransaction(claimData);
  } else {
    console.log('Nothing to claim ...');
  }
}

run().catch(console.error);
