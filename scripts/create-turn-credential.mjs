import crypto from 'node:crypto'

const secret = process.argv[2] || process.env.TURN_SHARED_SECRET
const hours = Number(process.argv[3] || 24)
if (!secret) {
  console.error('Usage: node scripts/create-turn-credential.mjs <shared-secret> [hours]')
  process.exit(1)
}

const username = `${Math.floor(Date.now() / 1000) + Math.max(1, hours) * 3600}:love-home`
const credential = crypto.createHmac('sha1', secret).update(username).digest('base64')
console.log(`username=${username}`)
console.log(`credential=${credential}`)
