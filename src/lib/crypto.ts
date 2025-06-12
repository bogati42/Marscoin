// Cryptographic utilities for the blockchain
import { randomBytes } from 'node:crypto';

// SHA-256 hash function using Web Crypto API
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a random private key (32 bytes)
export function generatePrivateKey(): string {
  const privateKey = new Uint8Array(32);
  crypto.getRandomValues(privateKey);
  return Array.from(privateKey).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate public key from private key (simplified elliptic curve simulation)
export async function generatePublicKey(privateKey: string): Promise<string> {
  // In a real implementation, this would use elliptic curve cryptography
  // For this demonstration, we'll use a deterministic hash-based approach
  const hash = await sha256(`public_${privateKey}`);
  return `04${hash.slice(0, 62)}`;
}

// Generate address from public key
export async function generateAddress(publicKey: string): Promise<string> {
  const hash1 = await sha256(publicKey);
  const hash2 = await sha256(hash1);
  return hash2.slice(0, 40); // 20 bytes = 40 hex chars
}

// Simple digital signature (in real Bitcoin, this would use ECDSA)
export async function signMessage(message: string, privateKey: string): Promise<string> {
  const messageHash = await sha256(message);
  const signature = await sha256(`${messageHash}_${privateKey}`);
  return signature;
}

// Verify digital signature
export async function verifySignature(message: string, signature: string, publicKey: string): Promise<boolean> {
  const messageHash = await sha256(message);
  // In this simplified version, we reconstruct what the signature should be
  // and compare it with the provided signature
  const expectedSignature = await sha256(`${messageHash}_${await getPrivateKeyFromPublic(publicKey)}`);
  return signature === expectedSignature;
}

// Helper function to simulate getting private key from public (NOT SECURE - for demo only)
async function getPrivateKeyFromPublic(publicKey: string): Promise<string> {
  // This is a major security flaw and is only for demonstration
  // In real cryptography, you cannot derive private keys from public keys
  return await sha256(`reverse_${publicKey}`);
}

// Merkle tree hash calculation
export async function calculateMerkleRoot(hashes: string[]): Promise<string> {
  if (hashes.length === 0) return await sha256('');
  if (hashes.length === 1) return hashes[0];

  const newLevel: string[] = [];
  for (let i = 0; i < hashes.length; i += 2) {
    const left = hashes[i];
    const right = i + 1 < hashes.length ? hashes[i + 1] : left;
    newLevel.push(await sha256(left + right));
  }

  return calculateMerkleRoot(newLevel);
}

// Proof of Work hash checking
export function isValidProofOfWork(hash: string, difficulty: number): boolean {
  const target = '0'.repeat(difficulty);
  return hash.startsWith(target);
}

// Convert number to hex with padding
export function numberToHex(num: number, padding = 8): string {
  return num.toString(16).padStart(padding, '0');
}
