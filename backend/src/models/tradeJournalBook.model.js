import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  broker: { type: String, trim: true, maxlength: 80, default: '' },
  accountLabel: { type: String, trim: true, maxlength: 80, default: '' },
  isDefault: { type: Boolean, required: true, default: false, immutable: true },
}, { timestamps: true, strict: 'throw' })

schema.index({ userId: 1, createdAt: 1, _id: 1 })
schema.index(
  { userId: 1 },
  {
    unique: true,
    name: 'one_default_trade_journal_per_user',
    partialFilterExpression: { isDefault: true },
  },
)

export default mongoose.models.TradeJournalBook || mongoose.model('TradeJournalBook', schema)
