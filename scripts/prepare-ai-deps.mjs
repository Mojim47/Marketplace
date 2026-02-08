#!/usr/bin/env node
// Verified under Mnemosyne Protocol v3.2.1 — Ω-Moji Sovereign Build
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import https from 'node:https'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const MODEL_URL = 'https://huggingface.co/onnx-models/all-MiniLM-L6-v2-onnx/resolve/main/model.onnx'
const MODEL_FILE = 'all-MiniLM-L6-v2.onnx'
const TOKENIZER_URL = 'https://huggingface.co/onnx-models/all-MiniLM-L6-v2-onnx/resolve/main/tokenizer.json'
const TOKENIZER_FILE = 'tokenizer.json'
const TOKENIZER_CONFIG_URL = 'https://huggingface.co/onnx-models/all-MiniLM-L6-v2-onnx/resolve/main/tokenizer_config.json'
const TOKENIZER_CONFIG_FILE = 'tokenizer_config.json'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const TARGET_DIR = path.join(ROOT, 'public', 'models', 'ai')
const TARGET_PATH = path.join(TARGET_DIR, MODEL_FILE)
const TOKENIZER_PATH = path.join(TARGET_DIR, TOKENIZER_FILE)
const TOKENIZER_CONFIG_PATH = path.join(TARGET_DIR, TOKENIZER_CONFIG_FILE)

function parseArgs() {
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if ((arg === '--sha' || arg === '-s') && args[i + 1]) {
      return { sha: args[i + 1] }
    }
  }
  return {}
}

async function computeSha(filePath) {
  const hash = createHash('sha256')
  const stream = createReadStream(filePath)
  stream.on('data', (chunk) => hash.update(chunk))
  await new Promise((resolve, reject) => {
    stream.on('end', () => resolve())
    stream.on('error', reject)
  })
  return hash.digest('hex')
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true })
}

function downloadWithRedirect(url, destination) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'nextgen-marketplace-ai-prep' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          downloadWithRedirect(res.headers.location, destination).then(resolve, reject)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Unexpected status ${res.statusCode ?? 'unknown'} while downloading model`))
          return
        }
        const fileStream = createWriteStream(destination)
        pipeline(res, fileStream)
          .then(() => resolve())
          .catch(reject)
      })
      .on('error', reject)
  })
}

async function prepare() {
  const expectedSha = parseArgs().sha ?? process.env.EXPECTED_ONNX_SHA256
  if (!expectedSha) {
    throw new Error('Set EXPECTED_ONNX_SHA256 or pass --sha <value> to enable checksum validation')
  }
  const expectedTokenizerSha = process.env.EXPECTED_TOKENIZER_SHA256
  const expectedTokenizerConfigSha = process.env.EXPECTED_TOKENIZER_CONFIG_SHA256
  await ensureDir(TARGET_DIR)
  const maybeExisting = await stat(TARGET_PATH).catch(() => null)
  if (maybeExisting?.isFile()) {
    const currentSha = await computeSha(TARGET_PATH)
    if (currentSha === expectedSha) {
      console.log('Model already present with matching checksum; nothing to do.')
      return
    }
  console.warn('Existing model hash mismatch; re-downloading.')
  await rm(TARGET_PATH)
  }
  const tempPath = `${TARGET_PATH}.download`
  const tokenizerTempPath = `${TOKENIZER_PATH}.download`
  const tokenizerConfigTempPath = `${TOKENIZER_CONFIG_PATH}.download`
  try {
    await downloadWithRedirect(MODEL_URL, tempPath)
    const downloadedSha = await computeSha(tempPath)
    if (downloadedSha !== expectedSha) {
      throw new Error(`Checksum mismatch. expected=${expectedSha} actual=${downloadedSha}`)
    }
    await rename(tempPath, TARGET_PATH)
    console.log(`Model stored at ${TARGET_PATH}`)

    await downloadWithRedirect(TOKENIZER_URL, tokenizerTempPath)
    if (expectedTokenizerSha) {
      const tokenizerSha = await computeSha(tokenizerTempPath)
      if (tokenizerSha !== expectedTokenizerSha) {
        throw new Error(`Tokenizer checksum mismatch. expected=${expectedTokenizerSha} actual=${tokenizerSha}`)
      }
    }
    await rename(tokenizerTempPath, TOKENIZER_PATH)
    console.log(`Tokenizer stored at ${TOKENIZER_PATH}`)

    await downloadWithRedirect(TOKENIZER_CONFIG_URL, tokenizerConfigTempPath)
    if (expectedTokenizerConfigSha) {
      const configSha = await computeSha(tokenizerConfigTempPath)
      if (configSha !== expectedTokenizerConfigSha) {
        throw new Error(`Tokenizer config checksum mismatch. expected=${expectedTokenizerConfigSha} actual=${configSha}`)
      }
    }
    await rename(tokenizerConfigTempPath, TOKENIZER_CONFIG_PATH)
    console.log(`Tokenizer config stored at ${TOKENIZER_CONFIG_PATH}`)
  } catch (error) {
    await rm(tempPath).catch(() => {})
    await rm(tokenizerTempPath).catch(() => {})
    await rm(tokenizerConfigTempPath).catch(() => {})
    throw error
  }
}

prepare()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
