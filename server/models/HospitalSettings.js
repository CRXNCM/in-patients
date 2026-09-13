import mongoose from 'mongoose'

const hospitalSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },

    // Hospital information
    name: String,
    address: String,
    tin: String,
    phone: String,
    email: String,

    // Billing and payment configuration
    currency: { type: String, default: 'ETB' },
    vatPercent: { type: Number, default: 0 },
    paymentMethods: [String],
    defaultPaymentMethod: String,
    referenceRequiredMethods: [String],
    dailyDoctorVisitFee: Number,
    dailyDoctorVisitName: String,

    // Receipt and invoice
    receiptHeader: String,
    receiptFooter: String,
    receiptPrefix: String,
    receiptShowLogo: Boolean,
    receiptShowAddress: Boolean,
    receiptShowPhone: Boolean,
    receiptShowTin: Boolean,
    invoiceHeader: String,
    invoiceFooter: String,
    invoiceShowLogo: Boolean,
    invoiceShowAddress: Boolean,
    invoiceShowPhone: Boolean,
    invoiceShowTin: Boolean,

    // Financial rules
    lowBalanceThreshold: Number,
    minimumInitialDeposit: Number,
    creditAdmissionsEnabled: Boolean,
    allowDischargeWithOutstandingBalance: Boolean,

    // System / general
    timezone: String,
    dateFormat: String,
    timeFormat: String,
    listPageSize: Number,
  },
  { timestamps: true }
)

export const HospitalSettings = mongoose.model('HospitalSettings', hospitalSettingsSchema)
