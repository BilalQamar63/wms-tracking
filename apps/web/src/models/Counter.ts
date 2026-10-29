import { Schema, model, models, type Model } from 'mongoose';

interface CounterDoc {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const CounterModel: Model<CounterDoc> =
  (models.Counter as Model<CounterDoc> | undefined) ?? model<CounterDoc>('Counter', counterSchema);

/**
 * Atomically reserves `count` sequence numbers and returns the first one.
 * Used for the permit "Sr No" so numbers are unique even under concurrent imports.
 */
export async function reserveSequence(name: string, count = 1): Promise<number> {
  const doc = await CounterModel.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: count } },
    { new: true, upsert: true },
  ).lean();
  return (doc?.seq ?? count) - count + 1;
}
