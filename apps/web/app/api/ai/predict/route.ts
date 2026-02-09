import { AIService, IranDemandPredictionStrategy } from '@nextgen/ai';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const salesHistoryIrr = Array.isArray(body?.salesHistoryIrr) ? body.salesHistoryIrr : [];
    const importIndex = Array.isArray(body?.importIndex) ? body.importIndex : [];
    const inflationRate = Number.isFinite(body?.inflationRate) ? body.inflationRate : 0;

    const svc = new AIService(new IranDemandPredictionStrategy());
    const res = await svc.predict({
      salesHistoryIrr,
      importIndex,
      inflationRate,
    });

    return NextResponse.json({ ok: true, localizedText: res.localizedText });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Prediction failed';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
