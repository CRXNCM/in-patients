export const hospitalSettings = {
  name: 'Central City Hospital',
  address: 'Bole Road, Addis Ababa, Ethiopia',
  tin: '0001234567',
  currency: 'ETB',
  lowBalanceThreshold: 3000,
  receiptFooter: 'Thank you for choosing Central City Hospital. Get well soon!',
  vatPercent: 0,
  dailyDoctorVisitFee: 2000,
  dailyDoctorVisitName: 'Daily Doctor Visit',
}

export const BILLING_TYPES = {
  QUANTITY: 'quantity',
  SELECTION: 'selection',
  AUTOMATIC_DAILY: 'automatic_daily',
}

export const BILLING_TYPE_LABELS = {
  quantity: 'Quantity Based',
  selection: 'Single Selection',
  automatic_daily: 'Automatic Daily',
}

export const bedTypes = [
  { name: 'General Ward', prefix: 'GW', serviceName: 'General Ward - Daily Rate', dailyRate: 1500 },
  { name: 'Private Room', prefix: 'PR', serviceName: 'Private Room - Daily Rate', dailyRate: 5000 },
  { name: 'ICU', prefix: 'ICU', serviceName: 'ICU - Daily Rate', dailyRate: 8000 },
  { name: 'Operation', prefix: 'OP', serviceName: 'Operation Room - Daily Rate', dailyRate: 10000 },
]

export const depositTypes = ['Cash', 'Bank Transfer', 'Ebirr', 'Other']

export function getBedChargeForRoom(roomType) {
  const bed = bedTypes.find((b) => b.name === roomType)
  if (!bed) {
    return { serviceName: 'General Ward - Daily Rate', dailyRate: 1500, category: 'Room Services' }
  }
  return {
    serviceName: bed.serviceName,
    dailyRate: bed.dailyRate,
    category: 'Room Services',
  }
}

export const patients = [
  {
    id: 'PAT-001',
    name: 'Abebe Kebede',
    age: 45,
    gender: 'Male',
    phone: '+251 911 234 567',
    room: 'General Ward',
    bed: 'GW-12',
    admissionDate: '2026-07-10',
    deposit: 85000,
    totalCharges: 62400,
    status: 'admitted',
    pendingDischarge: false,
  },
  {
    id: 'PAT-002',
    name: 'Tigist Haile',
    age: 32,
    gender: 'Female',
    phone: '+251 922 345 678',
    room: 'Private Room',
    bed: 'PR-05',
    admissionDate: '2026-07-12',
    deposit: 120000,
    totalCharges: 98500,
    status: 'admitted',
    pendingDischarge: false,
  },
  {
    id: 'PAT-003',
    name: 'Dawit Tesfaye',
    age: 58,
    gender: 'Male',
    phone: '+251 933 456 789',
    room: 'ICU',
    bed: 'ICU-03',
    admissionDate: '2026-07-08',
    deposit: 45000,
    totalCharges: 89200,
    status: 'admitted',
    pendingDischarge: false,
  },
  {
    id: 'PAT-004',
    name: 'Hanna Mekonnen',
    age: 27,
    gender: 'Female',
    phone: '+251 944 567 890',
    room: 'General Ward',
    bed: 'GW-08',
    admissionDate: '2026-07-14',
    deposit: 15000,
    totalCharges: 12800,
    status: 'admitted',
    pendingDischarge: false,
  },
  {
    id: 'PAT-005',
    name: 'Yonas Girma',
    age: 41,
    gender: 'Male',
    phone: '+251 955 678 901',
    room: 'Private Room',
    bed: 'PR-02',
    admissionDate: '2026-07-05',
    deposit: 95000,
    totalCharges: 92100,
    status: 'pending-discharge',
    pendingDischarge: true,
  },
  {
    id: 'PAT-006',
    name: 'Selam Desta',
    age: 65,
    gender: 'Female',
    phone: '+251 966 789 012',
    room: 'General Ward',
    bed: 'GW-15',
    admissionDate: '2026-07-15',
    deposit: 8000,
    totalCharges: 5600,
    status: 'admitted',
    pendingDischarge: false,
  },
  {
    id: 'PAT-007',
    name: 'Bereket Alemu',
    age: 38,
    gender: 'Male',
    phone: '+251 977 890 123',
    room: 'Operation',
    bed: 'OP-01',
    admissionDate: '2026-07-16',
    deposit: 200000,
    totalCharges: 145000,
    status: 'admitted',
    pendingDischarge: false,
  },
  {
    id: 'PAT-008',
    name: 'Meron Assefa',
    age: 22,
    gender: 'Female',
    phone: '+251 988 901 234',
    room: 'General Ward',
    bed: 'GW-03',
    admissionDate: '2026-07-17',
    deposit: 5000,
    totalCharges: 4200,
    status: 'admitted',
    pendingDischarge: false,
  },
]

export const billingItems = {
  'PAT-001': [
    { id: 1, date: '2026-07-10', department: 'Room Charges', item: 'General Ward - Daily Rate', quantity: 8, price: 1500, total: 12000 },
    { id: 2, date: '2026-07-10', department: 'Laboratory', item: 'Complete Blood Count (CBC)', quantity: 2, price: 450, total: 900 },
    { id: 3, date: '2026-07-11', department: 'Doctor', item: 'Internal Medicine Consultation', quantity: 3, price: 2500, total: 7500 },
    { id: 4, date: '2026-07-11', department: 'Pharmacy', item: 'Amoxicillin 500mg', quantity: 30, price: 35, total: 1050 },
    { id: 5, date: '2026-07-12', department: 'Radiology', item: 'Chest X-Ray', quantity: 1, price: 800, total: 800 },
    { id: 6, date: '2026-07-13', department: 'Laboratory', item: 'Liver Function Test', quantity: 1, price: 1200, total: 1200 },
    { id: 7, date: '2026-07-14', department: 'Pharmacy', item: 'Paracetamol 500mg', quantity: 20, price: 15, total: 300 },
    { id: 8, date: '2026-07-15', department: 'Other Services', item: 'Nursing Care', quantity: 8, price: 5000, total: 40000 },
  ],
  'PAT-002': [
    { id: 1, date: '2026-07-12', department: 'Room Charges', item: 'Private Room - Daily Rate', quantity: 6, price: 5000, total: 30000 },
    { id: 2, date: '2026-07-12', department: 'Doctor', item: 'Obstetrics Consultation', quantity: 4, price: 3000, total: 12000 },
    { id: 3, date: '2026-07-13', department: 'Laboratory', item: 'Pregnancy Panel', quantity: 2, price: 2500, total: 5000 },
    { id: 4, date: '2026-07-14', department: 'Radiology', item: 'Ultrasound Scan', quantity: 2, price: 3500, total: 7000 },
    { id: 5, date: '2026-07-15', department: 'Pharmacy', item: 'Prenatal Vitamins', quantity: 30, price: 45, total: 1350 },
    { id: 6, date: '2026-07-16', department: 'Other Services', item: 'Midwife Services', quantity: 6, price: 7200, total: 43200 },
  ],
  'PAT-003': [
    { id: 1, date: '2026-07-08', department: 'Room Charges', item: 'ICU - Daily Rate', quantity: 10, price: 8000, total: 80000 },
    { id: 2, date: '2026-07-08', department: 'Doctor', item: 'Critical Care Consultation', quantity: 10, price: 5000, total: 50000 },
    { id: 3, date: '2026-07-09', department: 'Laboratory', item: 'Arterial Blood Gas', quantity: 5, price: 800, total: 4000 },
    { id: 4, date: '2026-07-10', department: 'Pharmacy', item: 'Dopamine IV', quantity: 10, price: 450, total: 4500 },
    { id: 5, date: '2026-07-11', department: 'Radiology', item: 'CT Scan - Head', quantity: 1, price: 8500, total: 8500 },
  ],
}

export const depositHistory = {
  'PAT-001': [
    { id: 1, date: '2026-07-10', amount: 50000, receivedBy: 'Sara Bekele', method: 'Cash' },
    { id: 2, date: '2026-07-13', amount: 35000, receivedBy: 'Sara Bekele', method: 'Bank Transfer' },
  ],
  'PAT-002': [
    { id: 1, date: '2026-07-12', amount: 80000, receivedBy: 'Sara Bekele', method: 'Cash' },
    { id: 2, date: '2026-07-15', amount: 40000, receivedBy: 'Helen Tadesse', method: 'Cash' },
  ],
  'PAT-003': [
    { id: 1, date: '2026-07-08', amount: 45000, receivedBy: 'Sara Bekele', method: 'Cash' },
  ],
}

export const catalogItems = {
  Laboratory: [
    { name: 'Complete Blood Count (CBC)', price: 450 },
    { name: 'Liver Function Test', price: 1200 },
    { name: 'Kidney Function Test', price: 1100 },
    { name: 'Blood Sugar (FBS)', price: 200 },
    { name: 'Urinalysis', price: 350 },
    { name: 'HIV Test', price: 500 },
    { name: 'Malaria Rapid Test', price: 300 },
    { name: 'Arterial Blood Gas', price: 800 },
  ],
  Pharmacy: [
    { name: 'Amoxicillin 500mg', price: 35 },
    { name: 'Paracetamol 500mg', price: 15 },
    { name: 'Metformin 500mg', price: 25 },
    { name: 'Omeprazole 20mg', price: 40 },
    { name: 'IV Normal Saline 500ml', price: 120 },
    { name: 'Dopamine IV', price: 450 },
    { name: 'Prenatal Vitamins', price: 45 },
    { name: 'Ceftriaxone 1g', price: 280 },
  ],
  Doctor: [
    { name: 'General Consultation', price: 2000 },
    { name: 'Internal Medicine Consultation', price: 2500 },
    { name: 'Surgical Consultation', price: 3000 },
    { name: 'Critical Care Consultation', price: 5000 },
    { name: 'Obstetrics Consultation', price: 3000 },
    { name: 'Pediatric Consultation', price: 2200 },
    { name: 'Cardiology Consultation', price: 3500 },
    { name: 'Follow-up Visit', price: 1500 },
  ],
  Radiology: [
    { name: 'Chest X-Ray', price: 800 },
    { name: 'Abdominal X-Ray', price: 900 },
    { name: 'Ultrasound Scan', price: 3500 },
    { name: 'CT Scan - Head', price: 8500 },
    { name: 'CT Scan - Abdomen', price: 9500 },
    { name: 'MRI Scan', price: 15000 },
    { name: 'Mammography', price: 4000 },
    { name: 'Echocardiogram', price: 5500 },
  ],
  'Room Charges': [
    { name: 'General Ward - Daily Rate', price: 1500 },
    { name: 'Private Room - Daily Rate', price: 5000 },
    { name: 'ICU - Daily Rate', price: 8000 },
    { name: 'Operation Room - Daily Rate', price: 10000 },
  ],
  'Other Services': [
    { name: 'Nursing Care', price: 5000 },
    { name: 'Midwife Services', price: 7200 },
    { name: 'Physiotherapy Session', price: 1500 },
    { name: 'Ambulance Service', price: 3000 },
    { name: 'Medical Records Copy', price: 200 },
    { name: 'Oxygen Therapy (per hour)', price: 350 },
  ],
}

export const services = [
  { id: 1, name: 'Complete Blood Count (CBC)', Deposite: 'Laboratory', price: 450, status: 'active' },
  { id: 2, name: 'Chest X-Ray', Deposite: 'Radiology', price: 800, status: 'active' },
  { id: 3, name: 'General Consultation', Deposite: 'Doctors', price: 2000, status: 'active' },
  { id: 4, name: 'General Ward - Daily Rate', Deposite: 'General Ward', price: 1500, status: 'active' },
  { id: 5, name: 'ICU - Daily Rate', Deposite: 'ICU', price: 8000, status: 'active' },
  { id: 6, name: 'Ultrasound Scan', Deposite: 'Radiology', price: 3500, status: 'active' },
  { id: 7, name: 'Nursing Care', Deposite: 'General Ward', price: 5000, status: 'active' },
  { id: 8, name: 'Physiotherapy Session', Deposite: 'Other Services', price: 1500, status: 'inactive' },
  { id: 9, name: 'CT Scan - Head', Deposite: 'Radiology', price: 8500, status: 'active' },
  { id: 10, name: 'Critical Care Consultation', Deposite: 'Doctors', price: 5000, status: 'active' },
]

export const medicines = [
  { id: 1, name: 'Amoxicillin 500mg', unit: 'Tablet', price: 35, stockStatus: 'in-stock' },
  { id: 2, name: 'Paracetamol 500mg', unit: 'Tablet', price: 15, stockStatus: 'in-stock' },
  { id: 3, name: 'Metformin 500mg', unit: 'Tablet', price: 25, stockStatus: 'in-stock' },
  { id: 4, name: 'Omeprazole 20mg', unit: 'Capsule', price: 40, stockStatus: 'low-stock' },
  { id: 5, name: 'IV Normal Saline 500ml', unit: 'Bag', price: 120, stockStatus: 'in-stock' },
  { id: 6, name: 'Dopamine IV', unit: 'Vial', price: 450, stockStatus: 'low-stock' },
  { id: 7, name: 'Ceftriaxone 1g', unit: 'Vial', price: 280, stockStatus: 'in-stock' },
  { id: 8, name: 'Insulin Glargine', unit: 'Pen', price: 850, stockStatus: 'out-of-stock' },
]

export const departments = [
  { id: 1, name: 'Laboratory', icon: 'FlaskConical', staff: 12, services: 45, color: 'bg-blue-500' },
  { id: 2, name: 'Pharmacy', icon: 'Pill', staff: 8, services: 120, color: 'bg-emerald-500' },
  { id: 3, name: 'Radiology', icon: 'Scan', staff: 6, services: 18, color: 'bg-purple-500' },
  { id: 4, name: 'Doctors', icon: 'Stethoscope', staff: 35, services: 25, color: 'bg-indigo-500' },
  { id: 5, name: 'Operation', icon: 'Scissors', staff: 15, services: 12, color: 'bg-red-500' },
  { id: 6, name: 'ICU', icon: 'HeartPulse', staff: 20, services: 8, color: 'bg-orange-500' },
  { id: 7, name: 'General Ward', icon: 'Bed', staff: 40, services: 6, color: 'bg-cyan-500' },
  { id: 8, name: 'Private Room', icon: 'DoorOpen', staff: 10, services: 4, color: 'bg-teal-500' },
]

export const doctors = [
  { id: 1, name: 'Dr. Solomon Tadesse', specialty: 'Internal Medicine', department: 'Doctors', phone: '+251 911 111 111', status: 'active' },
  { id: 2, name: 'Dr. Eden Worku', specialty: 'Obstetrics & Gynecology', department: 'Doctors', phone: '+251 922 222 222', status: 'active' },
  { id: 3, name: 'Dr. Getachew Haile', specialty: 'General Surgery', department: 'Operation', phone: '+251 933 333 333', status: 'active' },
  { id: 4, name: 'Dr. Rahel Desta', specialty: 'Pediatrics', department: 'Doctors', phone: '+251 944 444 444', status: 'active' },
  { id: 5, name: 'Dr. Michael Assefa', specialty: 'Critical Care', department: 'ICU', phone: '+251 955 555 555', status: 'active' },
]

export const roomCharges = [
  { id: 1, roomType: 'General Ward', dailyRate: 1500, beds: 45, occupied: 38 },
  { id: 2, roomType: 'Private Room', dailyRate: 5000, beds: 12, occupied: 9 },
  { id: 3, roomType: 'ICU', dailyRate: 8000, beds: 8, occupied: 6 },
  { id: 4, roomType: 'Operation Room', dailyRate: 10000, beds: 4, occupied: 2 },
]

export const users = [
  { id: 1, name: 'Sara Bekele', email: 'sara.bekele@stgabriel.et', role: 'Reception', status: 'active' },
  { id: 2, name: 'Helen Tadesse', email: 'helen.tadesse@stgabriel.et', role: 'Reception', status: 'active' },
  { id: 3, name: 'Admin User', email: 'admin@stgabriel.et', role: 'Admin', status: 'active' },
  { id: 4, name: 'Manager User', email: 'manager@stgabriel.et', role: 'Manager', status: 'active' },
  { id: 5, name: 'Daniel Mekonnen', email: 'daniel.m@stgabriel.et', role: 'Reception', status: 'inactive' },
  { id: 6, name: 'Nurse Almaz Tsegaye', email: 'almaz.tsegaye@stgabriel.et', role: 'Nurse', status: 'active' },
  { id: 7, name: 'Nurse Bethlehem Haile', email: 'bethlehem.h@stgabriel.et', role: 'Nurse', status: 'active' },
]

/** Admin-defined service categories with billing behavior types */
export const serviceCategories = [
  {
    id: 'pharmacy',
    name: 'Pharmacy',
    description: 'Medications and IV drugs',
    billingType: 'quantity',
    services: [
      { name: 'Amoxicillin 500mg', price: 35 },
      { name: 'Paracetamol 500mg', price: 15 },
      { name: 'IV Normal Saline 500ml', price: 120 },
      { name: 'Ceftriaxone 1g', price: 280 },
      { name: 'Dopamine IV', price: 450 },
      { name: 'Metformin 500mg', price: 25 },
      { name: 'Omeprazole 20mg', price: 40 },
    ],
  },
  {
    id: 'medical-supplies',
    name: 'Medical Supplies',
    description: 'Reusable and durable medical supplies',
    billingType: 'quantity',
    services: [
      { name: 'Blood Pressure Cuff (use)', price: 100 },
      { name: 'Pulse Oximeter (use)', price: 80 },
      { name: 'Nebulizer Kit', price: 250 },
      { name: 'Infusion Pump Use', price: 400 },
    ],
  },
  {
    id: 'consumables',
    name: 'Consumables',
    description: 'Disposable medical supplies',
    billingType: 'quantity',
    services: [
      { name: 'Surgical Gloves (pair)', price: 25 },
      { name: 'Syringe 5ml', price: 15 },
      { name: 'Cannula 18G', price: 45 },
      { name: 'Urinary Catheter Kit', price: 350 },
      { name: 'Gauze Pack', price: 30 },
    ],
  },
  {
    id: 'laboratory',
    name: 'Laboratory',
    description: 'Lab tests and diagnostic requests',
    billingType: 'selection',
    services: [
      { name: 'Complete Blood Count (CBC)', price: 450 },
      { name: 'Liver Function Test', price: 1200 },
      { name: 'Kidney Function Test', price: 1100 },
      { name: 'Blood Sugar (FBS)', price: 200 },
      { name: 'Urinalysis', price: 350 },
      { name: 'HIV Test', price: 500 },
      { name: 'Arterial Blood Gas', price: 800 },
    ],
  },
  {
    id: 'procedures',
    name: 'Procedures',
    description: 'Clinical procedures and nursing interventions',
    billingType: 'selection',
    services: [
      { name: 'Wound Dressing', price: 800 },
      { name: 'Catheter Insertion', price: 1500 },
      { name: 'Nebulization Therapy', price: 600 },
      { name: 'Blood Transfusion Setup', price: 2500 },
    ],
  },
  {
    id: 'radiology',
    name: 'Radiology',
    description: 'Imaging and diagnostic scans',
    billingType: 'selection',
    services: [
      { name: 'Chest X-Ray', price: 800 },
      { name: 'Ultrasound Scan', price: 3500 },
      { name: 'CT Scan - Head', price: 8500 },
      { name: 'Abdominal X-Ray', price: 900 },
    ],
  },
  {
    id: 'doctor',
    name: 'Doctor Visits',
    description: 'Automatic daily physician visit while admitted',
    billingType: 'automatic_daily',
    services: [
      { name: 'Daily Doctor Visit', price: 2000 },
    ],
  },
  {
    id: 'room',
    name: 'Room Services',
    description: 'Automatic daily room charge from room assignment',
    billingType: 'automatic_daily',
    services: [
      { name: 'General Ward - Daily Rate', price: 1500 },
      { name: 'Private Room - Daily Rate', price: 5000 },
      { name: 'ICU - Daily Rate', price: 8000 },
      { name: 'Operation Room - Daily Rate', price: 10000 },
    ],
  },
]

export const initialDailyRecords = [
  {
    id: 'REC-1001',
    recordName: 'Abebe Kebede',
    patientId: 'PAT-001',
    recordDate: '2026-07-10',
    type: 'daily_services',
    status: 'approved',
    source: 'nurse',
    services: [
      { id: 's1', category: 'Laboratory', serviceName: 'Complete Blood Count (CBC)', quantity: 2, unitPrice: 450, total: 900, notes: 'Morning lab request' },
    ],
    returnItems: [],
    recordedAt: '2026-07-10T08:30:00',
    recordedBy: 'Nurse Almaz Tsegaye',
    reviewedAt: '2026-07-10T09:15:00',
    reviewedBy: 'Sara Bekele',
    rejectionReason: null,
    auditTrail: [
      { action: 'recorded', by: 'Nurse Almaz Tsegaye', at: '2026-07-10T08:30:00', note: 'Daily record submitted' },
      { action: 'approved', by: 'Sara Bekele', at: '2026-07-10T09:15:00', note: 'Verified with laboratory slip' },
    ],
  },
  {
    id: 'REC-1002',
    recordName: 'Abebe Kebede',
    patientId: 'PAT-001',
    recordDate: '2026-07-11',
    type: 'daily_services',
    status: 'approved',
    source: 'nurse',
    services: [
      { id: 's2', category: 'Pharmacy', serviceName: 'Amoxicillin 500mg', quantity: 30, unitPrice: 35, total: 1050, notes: 'Prescribed antibiotic course' },
    ],
    returnItems: [],
    recordedAt: '2026-07-11T10:00:00',
    recordedBy: 'Nurse Almaz Tsegaye',
    reviewedAt: '2026-07-11T10:45:00',
    reviewedBy: 'Sara Bekele',
    rejectionReason: null,
    auditTrail: [
      { action: 'recorded', by: 'Nurse Almaz Tsegaye', at: '2026-07-11T10:00:00', note: 'Daily record submitted' },
      { action: 'approved', by: 'Sara Bekele', at: '2026-07-11T10:45:00', note: 'Pharmacy slip verified' },
    ],
  },
  {
    id: 'REC-1003',
    recordName: 'Dawit Tesfaye',
    patientId: 'PAT-003',
    recordDate: '2026-07-09',
    type: 'daily_services',
    status: 'approved',
    source: 'nurse',
    services: [
      { id: 's3', category: 'Oxygen & IV Fluids', serviceName: 'Oxygen Therapy (per hour)', quantity: 6, unitPrice: 350, total: 2100, notes: 'Continuous O2 support in ICU' },
    ],
    returnItems: [],
    recordedAt: '2026-07-09T14:00:00',
    recordedBy: 'Nurse Bethlehem Haile',
    reviewedAt: '2026-07-09T15:30:00',
    reviewedBy: 'Helen Tadesse',
    rejectionReason: null,
    auditTrail: [
      { action: 'recorded', by: 'Nurse Bethlehem Haile', at: '2026-07-09T14:00:00', note: 'Daily record submitted' },
      { action: 'approved', by: 'Helen Tadesse', at: '2026-07-09T15:30:00', note: 'ICU charge confirmed' },
    ],
  },
  {
    id: 'REC-1004',
    recordName: 'Dawit Tesfaye',
    patientId: 'PAT-003',
    recordDate: '2026-07-08',
    type: 'daily_services',
    status: 'approved',
    source: 'reception',
    services: [
      { id: 's4', category: 'Doctor Visits', serviceName: 'Critical Care Consultation', quantity: 10, unitPrice: 5000, total: 50000, notes: 'Direct reception entry' },
    ],
    returnItems: [],
    recordedAt: '2026-07-08T09:00:00',
    recordedBy: 'Sara Bekele',
    reviewedAt: '2026-07-08T09:00:00',
    reviewedBy: 'Sara Bekele',
    rejectionReason: null,
    auditTrail: [
      { action: 'recorded', by: 'Sara Bekele', at: '2026-07-08T09:00:00', note: 'Daily record submitted' },
      { action: 'approved', by: 'Sara Bekele', at: '2026-07-08T09:00:00', note: 'Auto-approved reception entry' },
    ],
  },
  {
    id: 'REC-1005',
    recordName: 'Hanna Mekonnen',
    patientId: 'PAT-004',
    recordDate: '2026-07-15',
    type: 'daily_services',
    status: 'rejected',
    source: 'nurse',
    services: [
      { id: 's5', category: 'Laboratory', serviceName: 'Blood Sugar (FBS)', quantity: 1, unitPrice: 200, total: 200, notes: 'Routine glucose check' },
    ],
    returnItems: [],
    recordedAt: '2026-07-15T07:30:00',
    recordedBy: 'Nurse Almaz Tsegaye',
    reviewedAt: '2026-07-15T08:00:00',
    reviewedBy: 'Sara Bekele',
    rejectionReason: 'Duplicate request — already billed on admission',
    auditTrail: [
      { action: 'recorded', by: 'Nurse Almaz Tsegaye', at: '2026-07-15T07:30:00', note: 'Daily record submitted' },
      { action: 'rejected', by: 'Sara Bekele', at: '2026-07-15T08:00:00', note: 'Duplicate request — already billed on admission' },
    ],
  },
  {
    id: 'REC-1006',
    recordName: 'Dawit Tesfaye',
    patientId: 'PAT-003',
    recordDate: '2026-07-18',
    type: 'daily_services',
    status: 'pending',
    source: 'nurse',
    services: [
      { id: 's6', category: 'Pharmacy', serviceName: 'Dopamine IV', quantity: 5, unitPrice: 450, total: 2250, notes: 'Additional vials for hemodynamic support' },
      { id: 's7', category: 'Procedures', serviceName: 'Wound Dressing', quantity: 1, unitPrice: 800, total: 800, notes: 'ICU wound care' },
    ],
    returnItems: [],
    recordedAt: '2026-07-18T07:15:00',
    recordedBy: 'Nurse Bethlehem Haile',
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    auditTrail: [
      { action: 'recorded', by: 'Nurse Bethlehem Haile', at: '2026-07-18T07:15:00', note: 'Daily record submitted — 2 services' },
    ],
  },
  {
    id: 'REC-1007',
    recordName: 'Selam Desta',
    patientId: 'PAT-006',
    recordDate: '2026-07-18',
    type: 'daily_services',
    status: 'pending',
    source: 'nurse',
    services: [
      { id: 's8', category: 'Consumables', serviceName: 'Urinary Catheter Kit', quantity: 1, unitPrice: 350, total: 350, notes: 'Catheter change per nursing protocol' },
    ],
    returnItems: [],
    recordedAt: '2026-07-18T08:00:00',
    recordedBy: 'Nurse Almaz Tsegaye',
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    auditTrail: [
      { action: 'recorded', by: 'Nurse Almaz Tsegaye', at: '2026-07-18T08:00:00', note: 'Daily record submitted — 1 service' },
    ],
  },
  {
    id: 'REC-1008',
    recordName: 'Abebe Kebede',
    patientId: 'PAT-001',
    recordDate: '2026-07-18',
    type: 'daily_services',
    status: 'pending',
    source: 'nurse',
    services: [
      { id: 's9', category: 'Procedures', serviceName: 'Wound Dressing', quantity: 2, unitPrice: 800, total: 1600, notes: 'Post-operative wound care' },
      { id: 's10', category: 'Laboratory', serviceName: 'Liver Function Test', quantity: 1, unitPrice: 1200, total: 1200, notes: 'Follow-up labs' },
    ],
    returnItems: [],
    recordedAt: '2026-07-18T08:45:00',
    recordedBy: 'Nurse Almaz Tsegaye',
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    auditTrail: [
      { action: 'recorded', by: 'Nurse Almaz Tsegaye', at: '2026-07-18T08:45:00', note: 'Daily record submitted — 2 services' },
    ],
  },
  {
    id: 'REC-1009',
    recordName: 'Bereket Alemu',
    patientId: 'PAT-007',
    recordDate: '2026-07-18',
    type: 'daily_services',
    status: 'pending',
    source: 'nurse',
    services: [
      { id: 's11', category: 'Room Services', serviceName: 'ICU - Daily Rate', quantity: 2, unitPrice: 8000, total: 16000, notes: 'Post-op ICU monitoring days' },
    ],
    returnItems: [],
    recordedAt: '2026-07-18T09:00:00',
    recordedBy: 'Nurse Bethlehem Haile',
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    auditTrail: [
      { action: 'recorded', by: 'Nurse Bethlehem Haile', at: '2026-07-18T09:00:00', note: 'Daily record submitted — 1 service' },
    ],
  },
  {
    id: 'REC-1010',
    recordName: 'Tigist Haile',
    patientId: 'PAT-002',
    recordDate: '2026-07-14',
    type: 'daily_services',
    status: 'approved',
    source: 'nurse',
    services: [
      { id: 's12', category: 'Radiology', serviceName: 'Ultrasound Scan', quantity: 1, unitPrice: 3500, total: 3500, notes: 'Obstetric ultrasound' },
    ],
    returnItems: [],
    recordedAt: '2026-07-14T11:00:00',
    recordedBy: 'Nurse Almaz Tsegaye',
    reviewedAt: '2026-07-14T11:30:00',
    reviewedBy: 'Helen Tadesse',
    rejectionReason: null,
    auditTrail: [
      { action: 'recorded', by: 'Nurse Almaz Tsegaye', at: '2026-07-14T11:00:00', note: 'Daily record submitted' },
      { action: 'approved', by: 'Helen Tadesse', at: '2026-07-14T11:30:00', note: 'Radiology request confirmed' },
    ],
  },
  {
    id: 'REC-1011',
    recordName: 'Abebe Kebede',
    patientId: 'PAT-001',
    recordDate: '2026-07-17',
    type: 'pharmacy_return',
    status: 'pending',
    source: 'nurse',
    services: [],
    returnItems: [
      { id: 'r1', serviceName: 'Paracetamol 500mg', quantity: 10, unitPrice: 15, total: 150, reason: 'Unused tablets returned to pharmacy' },
    ],
    recordedAt: '2026-07-17T16:00:00',
    recordedBy: 'Nurse Almaz Tsegaye',
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    auditTrail: [
      { action: 'recorded', by: 'Nurse Almaz Tsegaye', at: '2026-07-17T16:00:00', note: 'Pharmacy return submitted — 1 item' },
    ],
  },
]

/** @deprecated use initialDailyRecords */
export const initialServiceEntries = initialDailyRecords

export const revenueByDepartment = [
  { name: 'Laboratory', revenue: 185000 },
  { name: 'Pharmacy', revenue: 142000 },
  { name: 'Radiology', revenue: 98000 },
  { name: 'Doctors', revenue: 215000 },
  { name: 'Room Charges', revenue: 320000 },
  { name: 'ICU', revenue: 175000 },
  { name: 'Other Services', revenue: 68000 },
]

export const dailyRevenueTrend = [
  { day: 'Mon', revenue: 85000 },
  { day: 'Tue', revenue: 92000 },
  { day: 'Wed', revenue: 78000 },
  { day: 'Thu', revenue: 105000 },
  { day: 'Fri', revenue: 98000 },
  { day: 'Sat', revenue: 72000 },
  { day: 'Sun', revenue: 65000 },
]

export const topServices = [
  { name: 'General Ward - Daily Rate', count: 245, revenue: 367500 },
  { name: 'Complete Blood Count', count: 189, revenue: 85050 },
  { name: 'General Consultation', count: 156, revenue: 312000 },
  { name: 'Chest X-Ray', count: 98, revenue: 78400 },
  { name: 'ICU - Daily Rate', count: 72, revenue: 576000 },
]

export const topMedicines = [
  { name: 'Paracetamol 500mg', count: 1250, revenue: 18750 },
  { name: 'Amoxicillin 500mg', count: 890, revenue: 31150 },
  { name: 'IV Normal Saline 500ml', count: 456, revenue: 54720 },
  { name: 'Omeprazole 20mg', count: 320, revenue: 12800 },
  { name: 'Metformin 500mg', count: 280, revenue: 7000 },
]

export const recentTransactions = [
  { id: 1, patient: 'Abebe Kebede', Deposite: 'Laboratory', amount: 1200, date: '2026-07-18', receptionist: 'Sara Bekele' },
  { id: 2, patient: 'Tigist Haile', Deposite: 'Pharmacy', amount: 1350, date: '2026-07-18', receptionist: 'Helen Tadesse' },
  { id: 3, patient: 'Dawit Tesfaye', Deposite: 'ICU', amount: 8000, date: '2026-07-18', receptionist: 'Sara Bekele' },
  { id: 4, patient: 'Bereket Alemu', Deposite: 'Operation', amount: 10000, date: '2026-07-17', receptionist: 'Helen Tadesse' },
  { id: 5, patient: 'Hanna Mekonnen', Deposite: 'Doctor', amount: 2500, date: '2026-07-17', receptionist: 'Sara Bekele' },
  { id: 6, patient: 'Yonas Girma', Deposite: 'Radiology', amount: 3500, date: '2026-07-17', receptionist: 'Helen Tadesse' },
  { id: 7, patient: 'Selam Desta', Deposite: 'General Ward', amount: 1500, date: '2026-07-16', receptionist: 'Sara Bekele' },
  { id: 8, patient: 'Meron Assefa', Deposite: 'Laboratory', amount: 450, date: '2026-07-16', receptionist: 'Helen Tadesse' },
]

export const todayDeposits = 125000

export function getPatientRemainingBalance(patient) {
  return patient.deposit - patient.totalCharges
}

export function getPatientBalanceStatus(patient, threshold = 3000) {
  const remaining = getPatientRemainingBalance(patient)
  if (remaining >= threshold * 2) return 'sufficient'
  if (remaining >= threshold) return 'low'
  return 'critical'
}
