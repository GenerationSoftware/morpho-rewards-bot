const axios = require('axios');
const { createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { encodeFunctionData } = require('viem');

const CHAIN_ID = 480;
const USER_PRIZE_VAULT_ADDRESS = '0x4c7e1f64a4b121d2f10d6fbca0db143787bf64bb';
const WORLD_TOKEN_ADDRESS = '0x2cFc85d8E48F8EAB294be644d9E25C3030863003';
const MERKL_DISTRIBUTOR_CONTRACT_ADDRESS = '0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae';

// The ABI for the claim function
const CLAIM_ABI = [
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
  const amounts = [claimData.unclaimed];
  const proofs = claimData.proof;

  const data = encodeFunctionData({
    abi: CLAIM_ABI,
    functionName: 'claim',
    args: [users, tokens, amounts, proofs],
  });

  try {
    const account = privateKeyToAccount(privateKey);
    const client = createWalletClient({
      account,
      chain: 480, // You can specify a chain if needed, e.g., mainnet, goerli, etc.
      transport: http(rpcUrl),
    });

    const hash = await client.sendTransaction({
      to: MERKL_DISTRIBUTOR_CONTRACT_ADDRESS,
      data,
    });
    console.log(`Contract transaction sent! Hash: ${hash}`);
  } catch (err) {
    console.error('Contract transaction failed:', err);
    process.exit(1);
  }
}

async function run() {
  const privateKey = process.env.CUSTOM_RELAYER_PRIVATE_KEY;
  const rpcUrl = process.env.JSON_RPC_URL;

  if (!privateKey || !rpcUrl) {
    console.error('Missing CUSTOM_RELAYER_PRIVATE_KEY or JSON_RPC_URL environment variables.');
    process.exit(1);
  }

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
