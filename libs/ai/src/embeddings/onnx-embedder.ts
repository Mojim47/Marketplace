import fs from 'node:fs';
import path from 'node:path';
import { Tokenizer } from '@huggingface/tokenizers';
import { InferenceSession, Tensor } from 'onnxruntime-node';

export interface OnnxEmbedderConfig {
  modelPath: string;
  tokenizerPath: string;
  tokenizerConfigPath?: string;
  maxLength?: number;
  normalize?: boolean;
}

export class OnnxEmbedder {
  private session?: InferenceSession;
  private tokenizer?: Tokenizer;
  private readonly maxLength: number;
  private readonly normalize: boolean;

  constructor(private readonly config: OnnxEmbedderConfig) {
    this.maxLength = config.maxLength ?? 128;
    this.normalize = config.normalize ?? true;
  }

  async ready(): Promise<void> {
    const modelPath = resolvePath(this.config.modelPath);
    const tokenizerPath = resolvePath(this.config.tokenizerPath);

    if (!fs.existsSync(modelPath)) {
      throw new Error(`AI embedding model not found at ${modelPath}`);
    }
    if (!fs.existsSync(tokenizerPath)) {
      throw new Error(`AI tokenizer not found at ${tokenizerPath}`);
    }

    this.session = await InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
    });

    const tokenizerJson = JSON.parse(fs.readFileSync(tokenizerPath, 'utf-8'));
    const configPath =
      this.config.tokenizerConfigPath ??
      path.join(path.dirname(tokenizerPath), 'tokenizer_config.json');
    const tokenizerConfig = fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      : {};
    this.tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);
    const tokenizerAny = this.tokenizer as unknown as {
      setTruncation?: (options: { maxLength: number }) => void;
      setPadding?: (options: { length: number }) => void;
      enableTruncation?: (maxLength: number) => void;
      enablePadding?: () => void;
    };

    if (tokenizerAny.setTruncation) {
      tokenizerAny.setTruncation({ maxLength: this.maxLength });
    } else if (tokenizerAny.enableTruncation) {
      tokenizerAny.enableTruncation(this.maxLength);
    }

    if (tokenizerAny.setPadding) {
      tokenizerAny.setPadding({ length: this.maxLength });
    } else if (tokenizerAny.enablePadding) {
      tokenizerAny.enablePadding();
    }
  }

  async embed(text: string): Promise<Float32Array> {
    if (!this.session || !this.tokenizer) {
      throw new Error('OnnxEmbedder is not initialized. Call ready() first.');
    }

    const encoding = this.tokenizer.encode(text);
    const ids = encoding.ids;
    const encodingAny = encoding as unknown as {
      attention_mask?: number[];
      attentionMask?: number[];
    };
    const mask =
      encodingAny.attention_mask ?? encodingAny.attentionMask ?? new Array(ids.length).fill(1);
    const tokenTypes = new Array(ids.length).fill(0);

    const inputIds = new Tensor('int64', toBigInt64(ids), [1, ids.length]);
    const attentionMask = new Tensor('int64', toBigInt64(mask), [1, mask.length]);
    const tokenTypeIds = new Tensor('int64', toBigInt64(tokenTypes), [1, tokenTypes.length]);

    const outputs = await this.session.run({
      input_ids: inputIds,
      attention_mask: attentionMask,
      token_type_ids: tokenTypeIds,
    });

    const outputTensor =
      (outputs.pooler_output as Tensor | undefined) ??
      (outputs.last_hidden_state as Tensor | undefined) ??
      (Object.values(outputs)[0] as Tensor);

    if (!outputTensor) {
      throw new Error('Embedding output not found in ONNX inference result.');
    }

    let vector: Float32Array;
    if (outputTensor.dims.length === 2) {
      vector = outputTensor.data as Float32Array;
    } else {
      vector = meanPool(
        outputTensor.data as Float32Array,
        mask,
        outputTensor.dims[1],
        outputTensor.dims[2]
      );
    }

    if (this.normalize) {
      return l2Normalize(vector);
    }
    return vector;
  }
}

function resolvePath(value: string): string {
  if (path.isAbsolute(value)) {
    return value;
  }
  return path.resolve(process.cwd(), value);
}

function toBigInt64(values: number[]): BigInt64Array {
  const buffer = new BigInt64Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    buffer[i] = BigInt(values[i]);
  }
  return buffer;
}

function meanPool(
  data: Float32Array,
  mask: number[],
  seqLen: number,
  hiddenSize: number
): Float32Array {
  const pooled = new Float32Array(hiddenSize);
  let validTokens = 0;

  for (let tokenIndex = 0; tokenIndex < seqLen; tokenIndex += 1) {
    const isValid = mask[tokenIndex] ?? 0;
    if (!isValid) {
      continue;
    }
    validTokens += 1;
    const offset = tokenIndex * hiddenSize;
    for (let i = 0; i < hiddenSize; i += 1) {
      pooled[i] += data[offset + i];
    }
  }

  if (validTokens === 0) {
    return pooled;
  }
  for (let i = 0; i < hiddenSize; i += 1) {
    pooled[i] /= validTokens;
  }
  return pooled;
}

function l2Normalize(vector: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < vector.length; i += 1) {
    sum += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sum) || 1;
  const normalized = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i += 1) {
    normalized[i] = vector[i] / norm;
  }
  return normalized;
}
