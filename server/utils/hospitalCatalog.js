export const MANUAL_STARTER_SLUGS = [
  'consumables',
  'laboratory',
  'medical-supplies',
  'pharmacy',
  'procedures',
  'radiology',
]

export function normalizeCatalogName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9%]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function namesFor(item) {
  return [item.name, ...(item.aliases || [])].map(normalizeCatalogName).filter(Boolean)
}

export function findExistingCatalogItem(existingServices = [], item) {
  const wanted = new Set(namesFor(item))
  return (existingServices || []).find((svc) => wanted.has(normalizeCatalogName(svc.name))) || null
}

export const HOSPITAL_STARTER_CATALOG = [
  {
    slug: 'consumables',
    items: [
      { name: 'Surgical Gloves', unit: 'pair', price: 25, aliases: ['Surgical Gloves (pair)'] },
      { name: 'Sterile Gloves', unit: 'pair', price: 40 },
      { name: 'Surgical Mask', unit: 'piece', price: 10, aliases: ['Face Mask'] },
      { name: 'Syringe 2ml', unit: 'piece', price: 10 },
      { name: 'Syringe 5ml', unit: 'piece', price: 15 },
      { name: 'Syringe 10ml', unit: 'piece', price: 20 },
      { name: 'IV Cannula 18G', unit: 'piece', price: 45 },
      { name: 'IV Cannula 20G', unit: 'piece', price: 45 },
      { name: 'Alcohol Swabs', unit: 'pack', price: 5, aliases: ['Alcohol Swab'] },
      { name: 'Cotton', unit: 'roll', price: 30, aliases: ['Cotton Roll'] },
      { name: 'Sterile Gauze', unit: 'pack', price: 20, aliases: ['Gauze'] },
      { name: 'Bandage Roll', unit: 'roll', price: 35 },
      { name: 'Micropore Tape', unit: 'roll', price: 45 },
      { name: 'Urine Bag', unit: 'piece', price: 150 },
      { name: 'NG Tube', unit: 'piece', price: 180, aliases: ['Nasogastric Tube'] },
      { name: 'Feeding Tube', unit: 'piece', price: 160 },
      { name: 'Disposable Apron', unit: 'piece', price: 50 },
      { name: 'Surgical Blade', unit: 'piece', price: 25 },
      { name: 'Examination Gloves', unit: 'pair', price: 20 },
      { name: 'N95 Mask', unit: 'piece', price: 40 },
      { name: 'Syringe 20ml', unit: 'piece', price: 25 },
      { name: 'IV Cannula 22G', unit: 'piece', price: 45 },
      { name: 'IV Cannula 24G', unit: 'piece', price: 45 },
      { name: 'IV Giving Set', unit: 'piece', price: 50 },
      { name: 'Blood Transfusion Set', unit: 'piece', price: 80 },
      { name: 'Urine Collection Container', unit: 'piece', price: 20 },
      { name: 'Specimen Container', unit: 'piece', price: 15 },
      { name: 'Adhesive Tape', unit: 'roll', price: 40 },
      { name: 'Disposable Cap', unit: 'piece', price: 10 },
      { name: 'Disposable Gown', unit: 'piece', price: 60 },
      { name: 'Tourniquet', unit: 'piece', price: 30 },
      { name: 'Suction Catheter', unit: 'piece', price: 40 },
      { name: 'Nasal Cannula', unit: 'piece', price: 50 },
      { name: 'Foley Catheter', unit: 'piece', price: 80 },
    ],
  },
  {
    slug: 'laboratory',
    items: [
      { name: 'CBC', unit: 'test', price: 300, aliases: ['Complete Blood Count (CBC)', 'Complete Blood Count'] },
      { name: 'Fasting Blood Sugar', unit: 'test', price: 150, aliases: ['Blood Sugar (FBS)', 'FBS'] },
      { name: 'Random Blood Sugar', unit: 'test', price: 150, aliases: ['Blood Glucose', 'RBS'] },
      { name: 'HbA1c', unit: 'test', price: 700 },
      { name: 'Liver Function Test', unit: 'test', price: 1200 },
      { name: 'Kidney Function Test', unit: 'test', price: 1100 },
      { name: 'Electrolytes', unit: 'test', price: 900 },
      { name: 'Lipid Profile', unit: 'test', price: 1000 },
      { name: 'Urinalysis', unit: 'test', price: 250 },
      { name: 'Stool Examination', unit: 'test', price: 300 },
      { name: 'Blood Group', unit: 'test', price: 150, aliases: ['Blood Group & Rh', 'Rh Factor'] },
      { name: 'Cross Matching', unit: 'test', price: 500, aliases: ['Cross Match'] },
      { name: 'Pregnancy Test', unit: 'test', price: 250 },
      { name: 'HIV Test', unit: 'test', price: 450 },
      { name: 'HBsAg', unit: 'test', price: 600, aliases: ['Hepatitis B Test'] },
      { name: 'Malaria Test', unit: 'test', price: 350 },
      { name: 'Widal Test', unit: 'test', price: 450, aliases: ['Typhoid Test'] },
      { name: 'COVID-19 Test', unit: 'test', price: 700 },
      { name: 'Hemoglobin', unit: 'test', price: 150 },
      { name: 'Hematocrit', unit: 'test', price: 150 },
      { name: 'ESR', unit: 'test', price: 150 },
      { name: 'Platelet Count', unit: 'test', price: 200 },
      { name: 'WBC Count', unit: 'test', price: 200 },
      { name: 'Blood Film', unit: 'test', price: 250 },
      { name: 'Creatinine', unit: 'test', price: 250 },
      { name: 'Urea', unit: 'test', price: 250 },
      { name: 'AST', unit: 'test', price: 250 },
      { name: 'ALT', unit: 'test', price: 250 },
      { name: 'Total Bilirubin', unit: 'test', price: 200 },
      { name: 'Direct Bilirubin', unit: 'test', price: 200 },
      { name: 'Total Protein', unit: 'test', price: 200 },
      { name: 'Albumin', unit: 'test', price: 200 },
      { name: 'Sodium', unit: 'test', price: 200 },
      { name: 'Potassium', unit: 'test', price: 200 },
      { name: 'Calcium', unit: 'test', price: 200 },
      { name: 'Uric Acid', unit: 'test', price: 200 },
      { name: 'HCV Test', unit: 'test', price: 600 },
      { name: 'VDRL', unit: 'test', price: 300 },
      { name: 'Occult Blood', unit: 'test', price: 250 },
    ],
  },
  {
    slug: 'medical-supplies',
    items: [
      { name: 'BP Monitor', unit: 'piece', price: 100, aliases: ['Blood Pressure Cuff (use)', 'Blood Pressure Cuff'] },
      { name: 'Pulse Oximeter', unit: 'piece', price: 80, aliases: ['Pulse Oximeter (use)'] },
      { name: 'Nebulizer', unit: 'piece', price: 250, aliases: ['Nebulizer Kit'] },
      { name: 'Wheelchair', unit: 'piece', price: 300, aliases: ['Wheelchair Rental'] },
      { name: 'Oxygen Cylinder', unit: 'piece', price: 500 },
      { name: 'Oxygen Mask', unit: 'piece', price: 120 },
      { name: 'Suction Machine', unit: 'piece', price: 400, aliases: ['Suction Machine Use'] },
      { name: 'Infusion Pump Use', unit: 'piece', price: 350 },
      { name: 'ECG Machine Use', unit: 'piece', price: 600 },
      { name: 'Patient Monitor Use', unit: 'piece', price: 500 },
      { name: 'Walking Frame', unit: 'piece', price: 250, aliases: ['Walker'] },
      { name: 'Crutches', unit: 'pair', price: 300 },
      { name: 'Stethoscope', unit: 'piece', price: 200 },
      { name: 'Digital Thermometer', unit: 'piece', price: 80 },
      { name: 'Oxygen Regulator', unit: 'piece', price: 250 },
      { name: 'Oxygen Flowmeter', unit: 'piece', price: 200 },
      { name: 'Examination Lamp', unit: 'piece', price: 300 },
      { name: 'Cervical Collar', unit: 'piece', price: 150 },
      { name: 'Arm Sling', unit: 'piece', price: 80 },
      { name: 'Elastic Bandage', unit: 'piece', price: 40 },
      { name: 'Splint', unit: 'piece', price: 150 },
      { name: 'Nebulizer Mask', unit: 'piece', price: 80 },
      { name: 'Oxygen Tubing', unit: 'piece', price: 50 },
      { name: 'Surgical Drain', unit: 'piece', price: 200 },
      { name: 'Catheter Set', unit: 'set', price: 250 },
      { name: 'Infusion Stand', unit: 'piece', price: 200 },
    ],
  },
  {
    slug: 'pharmacy',
    items: [
      { name: 'Paracetamol 500mg Tablet', unit: 'tablet', price: 15, aliases: ['Paracetamol 500mg'] },
      { name: 'Ibuprofen 400mg Tablet', unit: 'tablet', price: 20, aliases: ['Ibuprofen 400mg'] },
      { name: 'Diclofenac Injection', unit: 'ampoule', price: 80 },
      { name: 'Tramadol Injection', unit: 'ampoule', price: 150 },
      { name: 'Amoxicillin 500mg Capsule', unit: 'capsule', price: 35, aliases: ['Amoxicillin 500mg'] },
      { name: 'Ceftriaxone 1g Injection', unit: 'vial', price: 280, aliases: ['Ceftriaxone 1g'] },
      { name: 'Cefixime 400mg', unit: 'capsule', price: 120 },
      { name: 'Azithromycin 500mg Tablet', unit: 'tablet', price: 90, aliases: ['Azithromycin 500mg'] },
      { name: 'Metronidazole IV', unit: 'vial', price: 180 },
      { name: 'Gentamicin Injection', unit: 'ampoule', price: 120 },
      { name: 'Regular Insulin', unit: 'vial', price: 350, aliases: ['Insulin'] },
      { name: 'Omeprazole Injection', unit: 'vial', price: 150 },
      { name: 'Pantoprazole Injection', unit: 'vial', price: 180 },
      { name: 'Normal Saline 0.9% 500ml', unit: 'bag', price: 120, aliases: ['IV Normal Saline 500ml'] },
      { name: "Ringer's Lactate 500ml", unit: 'bag', price: 140, aliases: ['Ringer Lactate', "Ringer's Lactate"] },
      { name: 'Dextrose 5% 500ml', unit: 'bag', price: 150, aliases: ['Dextrose 5%'] },
      { name: 'Dopamine IV', unit: 'vial', price: 450 },
      { name: 'Adrenaline Injection', unit: 'ampoule', price: 120 },
      { name: 'Hydrocortisone Injection', unit: 'vial', price: 180 },
      { name: 'Vitamin K Injection', unit: 'ampoule', price: 100 },
      { name: 'Paracetamol 120mg/5ml Suspension', unit: 'bottle', price: 40 },
      { name: 'Diclofenac 50mg Tablet', unit: 'tablet', price: 15 },
      { name: 'Amoxicillin Suspension', unit: 'bottle', price: 45 },
      { name: 'Amoxicillin/Clavulanic Acid Tablet', unit: 'tablet', price: 50 },
      { name: 'Ciprofloxacin 500mg Tablet', unit: 'tablet', price: 25 },
      { name: 'Metronidazole 500mg Tablet', unit: 'tablet', price: 15 },
      { name: 'Cefotaxime Injection', unit: 'vial', price: 250 },
      { name: 'Omeprazole 20mg Capsule', unit: 'capsule', price: 20 },
      { name: 'Ondansetron 4mg Tablet', unit: 'tablet', price: 25 },
      { name: 'Ondansetron Injection', unit: 'ampoule', price: 80 },
      { name: 'Metoclopramide Injection', unit: 'ampoule', price: 50 },
      { name: 'Amlodipine 5mg Tablet', unit: 'tablet', price: 15 },
      { name: 'Amlodipine 10mg Tablet', unit: 'tablet', price: 20 },
      { name: 'Enalapril 5mg Tablet', unit: 'tablet', price: 15 },
      { name: 'Losartan 50mg Tablet', unit: 'tablet', price: 20 },
      { name: 'Furosemide 40mg Tablet', unit: 'tablet', price: 10 },
      { name: 'Metformin 500mg Tablet', unit: 'tablet', price: 15 },
      { name: 'Glibenclamide Tablet', unit: 'tablet', price: 10 },
      { name: 'NPH Insulin', unit: 'vial', price: 350 },
      { name: 'Normal Saline 0.9% 1000ml', unit: 'bag', price: 180 },
      { name: "Ringer's Lactate 1000ml", unit: 'bag', price: 200 },
      { name: 'Dextrose 5% 1000ml', unit: 'bag', price: 200 },
      { name: 'Atropine Injection', unit: 'ampoule', price: 80 },
      { name: 'Dexamethasone Injection', unit: 'ampoule', price: 80 },
      { name: 'Diazepam Injection', unit: 'ampoule', price: 90 },
      { name: 'Salbutamol Nebulizer Solution', unit: 'ampoule', price: 40 },
      { name: 'Folic Acid Tablet', unit: 'tablet', price: 5 },
      { name: 'Ferrous Sulfate Tablet', unit: 'tablet', price: 8 },
      { name: 'Vitamin B Complex', unit: 'tablet', price: 10 },
      { name: 'Vitamin C Tablet', unit: 'tablet', price: 8 },
    ],
  },
  {
    slug: 'procedures',
    items: [
      { name: 'Wound Dressing', unit: 'procedure', price: 800, aliases: ['Minor Wound Dressing'] },
      { name: 'Wound Suturing', unit: 'procedure', price: 1200, aliases: ['Suturing'] },
      { name: 'Foley Catheter Insertion', unit: 'procedure', price: 1500, aliases: ['Catheter Insertion', 'Catheterization'] },
      { name: 'Catheter Removal', unit: 'procedure', price: 500 },
      { name: 'Nebulization', unit: 'session', price: 600, aliases: ['Nebulization Therapy'] },
      { name: 'IV Cannulation', unit: 'procedure', price: 350 },
      { name: 'Blood Transfusion', unit: 'procedure', price: 1800 },
      { name: 'Nasogastric Tube Insertion', unit: 'procedure', price: 1200, aliases: ['NG Tube Insertion'] },
      { name: 'Oxygen Therapy', unit: 'session', price: 600 },
      { name: 'ECG Procedure', unit: 'procedure', price: 700, aliases: ['ECG'] },
      { name: 'Cardiopulmonary Resuscitation', unit: 'procedure', price: 2500, aliases: ['CPR', 'Basic Life Support'] },
      { name: 'Minor Surgical Procedure', unit: 'procedure', price: 3500, aliases: ['Minor Surgery'] },
      { name: 'Incision and Drainage', unit: 'procedure', price: 2000, aliases: ['Abscess Drainage'] },
      { name: 'Cast Application', unit: 'procedure', price: 1800, aliases: ['Plaster Application'] },
      { name: 'Cast Removal', unit: 'procedure', price: 1000 },
      { name: 'Major Wound Dressing', unit: 'procedure', price: 1200 },
      { name: 'Suture Removal', unit: 'procedure', price: 400 },
      { name: 'Injection Administration', unit: 'procedure', price: 100 },
      { name: 'Emergency Resuscitation', unit: 'procedure', price: 2500 },
      { name: 'Emergency Observation', unit: 'session', price: 800 },
      { name: 'Foreign Body Removal', unit: 'procedure', price: 1000 },
      { name: 'Ear Irrigation', unit: 'procedure', price: 400 },
      { name: 'Nasal Packing', unit: 'procedure', price: 800 },
      { name: 'Burn Dressing', unit: 'procedure', price: 1000 },
      { name: 'Splint Application', unit: 'procedure', price: 800 },
      { name: 'Normal Delivery Procedure', unit: 'procedure', price: 5000 },
      { name: 'Episiotomy Repair', unit: 'procedure', price: 2000 },
      { name: 'Postpartum Care', unit: 'session', price: 800 },
    ],
  },
  {
    slug: 'radiology',
    items: [
      { name: 'Chest X-Ray', unit: 'study', price: 500 },
      { name: 'Abdominal X-Ray', unit: 'study', price: 900 },
      { name: 'Pelvic X-Ray', unit: 'study', price: 900 },
      { name: 'Spine X-Ray', unit: 'study', price: 1200 },
      { name: 'Abdominal Ultrasound', unit: 'study', price: 700, aliases: ['Ultrasound Scan'] },
      { name: 'Obstetric Ultrasound', unit: 'study', price: 3000 },
      { name: 'Echocardiography', unit: 'study', price: 4500 },
      { name: 'Skull X-Ray', unit: 'study', price: 800 },
      { name: 'Cervical Spine X-Ray', unit: 'study', price: 900 },
      { name: 'Lumbar Spine X-Ray', unit: 'study', price: 900 },
      { name: 'Thoracic Spine X-Ray', unit: 'study', price: 900 },
      { name: 'Extremity X-Ray', unit: 'study', price: 700 },
      { name: 'Knee X-Ray', unit: 'study', price: 700 },
      { name: 'Hand X-Ray', unit: 'study', price: 600 },
      { name: 'Foot X-Ray', unit: 'study', price: 600 },
      { name: 'Pelvic Ultrasound', unit: 'study', price: 2500 },
      { name: 'Renal Ultrasound', unit: 'study', price: 2500 },
      { name: 'Thyroid Ultrasound', unit: 'study', price: 2000 },
      { name: 'Breast Ultrasound', unit: 'study', price: 2500 },
      { name: 'Prostate Ultrasound', unit: 'study', price: 2500 },
      { name: 'Doppler Ultrasound', unit: 'study', price: 3500 },
    ],
  },
]

export function planHospitalCatalogPopulation(categoriesBySlug) {
  return HOSPITAL_STARTER_CATALOG.map((spec) => {
    const category = categoriesBySlug[spec.slug]
    if (!category) {
      return {
        slug: spec.slug,
        missingCategory: true,
        added: [],
        preserved: [],
        inactiveMatches: [],
      }
    }

    const added = []
    const preserved = []
    const inactiveMatches = []

    for (const item of spec.items) {
      const existing = findExistingCatalogItem(category.services, item)
      if (existing) {
        const active = existing.active !== false
        preserved.push({
          desired: item.name,
          existing: existing.name,
          price: existing.price,
          active,
        })
        if (!active) {
          inactiveMatches.push({
            desired: item.name,
            existing: existing.name,
          })
        }
        continue
      }
      added.push({
        name: item.name,
        price: item.price,
        unit: item.unit,
        active: true,
      })
    }

    return {
      slug: spec.slug,
      name: category.name,
      missingCategory: false,
      added,
      preserved,
      inactiveMatches,
      existingCount: (category.services || []).length,
      plannedTotal: (category.services || []).length + added.length,
    }
  })
}
