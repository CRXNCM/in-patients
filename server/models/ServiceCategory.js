import mongoose from 'mongoose'

const serviceItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, default: '', trim: true },
    active: { type: Boolean, default: true },
  },
  { _id: true }
)

const serviceCategorySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    billingType: { type: String, enum: ['quantity', 'selection', 'automatic_daily'], default: 'quantity' },
    services: [serviceItemSchema],
  },
  { timestamps: true }
)

export const ServiceCategory = mongoose.model('ServiceCategory', serviceCategorySchema)
