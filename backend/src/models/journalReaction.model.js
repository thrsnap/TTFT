import mongoose from 'mongoose'

export const JOURNAL_REACTION_TYPES = ['like', 'love','smile']

const journalReactionSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: { type: String, enum: JOURNAL_REACTION_TYPES, required: true },
  },
  { timestamps: true },
)

// One reaction total per member per trade, enforced by MongoDB.
journalReactionSchema.index(
  { postId: 1, userId: 1 },
  { unique: true, name: 'journal_reaction_per_user' },
)

export default mongoose.models.JournalReaction ||
  mongoose.model('JournalReaction', journalReactionSchema)
