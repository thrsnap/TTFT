import mongoose from 'mongoose'
import { releaseDates } from '../services/signalReleaseTime.js'

// Shared by News Signal and Daily Signal. Existing documents need no migration:
// queries for archivedAt: null also match documents without that field.
export const SIGNAL_OUTCOMES = ['pending', 'win', 'loss', 'breakeven', 'cancelled']

export default function addSignalHistoryFields(schema) {
  schema.add({
    releasedAt: { type: Date, default: null },
    autoArchiveAt: { type: Date, default: null },
    archiveReason: { type: String, enum: ['manual', 'next-day'], default: 'manual' },
    outcome: { type: String, enum: SIGNAL_OUTCOMES, default: 'pending' },
    closedAt: { type: Date, default: null },
    resultNotes: { type: String, default: '', trim: true, maxlength: 2000 },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  })
  schema.index({ archivedAt: -1, _id: -1 })
  schema.index({ archivedAt: 1, autoArchiveAt: 1 })
  schema.pre('save', function () {
    if (this.archivedAt || this.status === 'draft') return
    if (!this.image?.length || !this.details?.trim()) return
    if (!this.releasedAt || !this.autoArchiveAt) Object.assign(this, releaseDates(this))
  })
}
