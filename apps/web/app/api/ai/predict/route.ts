import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { AIService, IranDemandPredictionStrategy, sha256Hex, verifyModelContract } from '@nextgen/ai';
import { NextResponse } from 'next/server';

let verifiedModelVersion = process.env.AI_DEMAND_MODEL_VERSION || 'demand-v1';
let contractVerified = false;

function ensureContractVerified(): void {
  if (contractVerified) {
    return;
  }

  const requireContract = process.env.AI_PREDICT_REQUIRE_CONTRACT === 'true';
  const contractPath =
    process.env.AI_PREDICT_CONTRACT_PATH ??
    path.join('ops', 'assets', 'ai', 'models', 'model.contract.json');

  try {
    const verified = verifyModelContract({
      contractPath,
      strictSignature: process.env.AI_PREDICT_STRICT_SIGNATURE === 'true',
      signaturePublicKeyPem: process.env.MODEL_CONTRACT_PUBLIC_KEY_PEM,
    });
    verifiedModelVersion = verified.contract.modelVersion;
    contractVerified = true;
  } catch (error) {
    if (requireContract) {
      throw error;
    }
    contractVerified = true;
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const traceId = request.headers.get('x-trace-id') || randomUUID();

  try {
    ensureContractVerified();
    const body = await request.json();
    const salesHistoryIrr = Array.isArray(body?.salesHistoryIrr) ? body.salesHistoryIrr : [];
    const importIndex = Array.isArray(body?.importIndex) ? body.importIndex : [];
    const inflationRate = Number.isFinite(body?.inflationRate) ? body.inflationRate : 0;

    if (salesHistoryIrr.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'salesHistoryIrr is required', traceId, guardReason: 'empty_input' },
        { status: 400 }
      );
    }

    const svc = new AIService(new IranDemandPredictionStrategy());
    const res = await svc.predict({
      salesHistoryIrr,
      importIndex,
      inflationRate,
    });

    const minConfidence = Number(process.env.AI_PREDICT_MIN_CONFIDENCE ?? 0.35);
    if (!Number.isFinite(res.confidence) || res.confidence < minConfidence) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Inference blocked by confidence guard',
          traceId,
          guardReason: 'low_confidence',
          modelVersion: verifiedModelVersion,
        },
        { status: 503 }
      );
    }

    const normalizedInput = JSON.stringify({
      salesHistoryIrr,
      importIndex,
      inflationRate,
    });
    const output = JSON.stringify(res);
    const inferenceLatencyMs = Date.now() - startedAt;

    console.log(
      JSON.stringify({
        event: 'ai.predict.inference.completed',
        traceId,
        modelVersion: verifiedModelVersion,
        promptHash: sha256Hex(normalizedInput),
        inputHash: sha256Hex(normalizedInput),
        outputHash: sha256Hex(output),
        inferenceLatencyMs,
        tokenUsage: 0,
        confidenceScore: res.confidence,
        guardReason: 'none',
        deterministic: true,
        seed: 'fixed',
        temperature: 0,
      })
    );

    return NextResponse.json({
      ok: true,
      localizedText: res.localizedText,
      traceId,
      modelVersion: verifiedModelVersion,
      confidenceScore: res.confidence,
      inferenceLatencyMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Prediction failed';
    const inferenceLatencyMs = Date.now() - startedAt;
    console.error(
      JSON.stringify({
        event: 'ai.predict.inference.failed',
        traceId,
        modelVersion: verifiedModelVersion,
        message,
        inferenceLatencyMs,
      })
    );
    return NextResponse.json({ ok: false, message, traceId }, { status: 500 });
  }
}
