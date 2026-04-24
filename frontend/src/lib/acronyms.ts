/**
 * Acronym glossary for JTS R2 form and USMC HSS context.
 * Key = the exact capitalization used in source prompts.
 * Value = full expansion shown on first use per section.
 */
export const ACRONYMS: Record<string, string> = {
  // Command / organization
  AOR:     'Area of Responsibility',
  CCMD:    'Combatant Command',
  COC:     'Chain of Command',
  C2:      'Command and Control',
  HHQ:     'Higher Headquarters',
  HSS:     'Health Service Support',
  JTS:     'Joint Trauma System',
  MARFOR:  'Marine Forces',
  OIC:     'Officer in Charge',
  SNCOIC:  'Staff Non-Commissioned Officer in Charge',
  SMO:     'Senior Medical Officer',
  TF:      'Task Force',
  JTF:     'Joint Task Force',
  CTF:     'Combined Task Force',

  // Clinical roles & specialties
  CRNA:   'Certified Registered Nurse Anesthetist',
  EM:     'Emergency Medicine',
  FP:     'Family Practice',
  GMO:    'General Medical Officer',
  GS:     'General Surgeon',
  IM:     'Internal Medicine',
  CC:     'Critical Care',
  FS:     'Flight Surgeon',
  UMO:    'Unit Medical Officer',

  // Assessments / programs
  ARSRA:  'Austere Resuscitative Surgical Readiness Assessment',
  ARSC:   'Austere Resuscitative Surgical Care',
  ATLS:   'Advanced Trauma Life Support',
  BESC:   'Basic Endovascular Skills Course',
  CESC:   'Combat Extremity Surgical Course',
  CPG:    'Clinical Practice Guideline',
  EWSC:   'Emergency War Surgery Course',
  GSTT:   'Ground Surgical Team Training',
  ICTB:   'Interfacility Credentials Transfer Brief',
  ICTL:   'Individual Critical Task List',
  KSAs:   'Knowledge, Skills, and Attributes',
  MROE:   'Medical Rules of Engagement',
  TMD:    'Trauma Medical Director',

  // Training institutions
  ATTC:     'Army Trauma Training Center',
  'C-STaRS': 'Center for Sustainment of Trauma and Readiness Skills',
  NTTC:     'Navy Trauma Training Center',

  // IT / communications / access
  MC4:      'Medical Communications for Combat Casualty Care',
  SIPRNet:  'Secret Internet Protocol Router Network',
  SATCOM:   'Satellite Communications',
  TMDS:     'Theater Medical Data Store',

  // Documentation / registries
  DoDTR:  'Department of Defense Trauma Registry',
  POI:    'Point of Injury',

  // Tactical
  CASEVAC:  'Casualty Evacuation',
  CBRN:     'Chemical, Biological, Radiological, and Nuclear',
  CONOPS:   'Concept of Operations',
  LOS:      'Line of Sight',
  MASCAL:   'Mass Casualty',
  MEDEVAC:  'Medical Evacuation',
  MIST:     'Mechanism, Injuries, Signs/Symptoms, Treatment',
  NVG:      'Night Vision Goggles',
  OTH:      'Over the Horizon',
  POC:      'Point of Contact',
  QRF:      'Quick Reaction Force',
  TCCC:     'Tactical Combat Casualty Care',
  TIC:      'Troops In Contact',

  // Blood / clinical supply
  FFP:    'Fresh Frozen Plasma',
  FWB:    'Fresh Whole Blood',
  PAR:    'Periodic Automatic Replenishment',
  RBC:    'Red Blood Cells',
  REBOA:  'Resuscitative Endovascular Balloon Occlusion of the Aorta',
  SWB:    'Stored Whole Blood',
  WBB:    'Walking Blood Bank',

  // Medical equipment
  ETT:  'Endotracheal Tube',
  GIA:  'Gastrointestinal Anastomosis',
  IO:   'Intraosseous',

  // T&R / USMC
  MET:    'Mission Essential Task',
  METL:   'Mission Essential Task List',
  NAVMC:  'Naval/Marine Corps',
  PECL:   'Personnel Equipment Capability List',
  'T&R':  'Training and Readiness',
  UIC:    'Unit Identification Code',

  // Unit types
  ARST:   'Austere Resuscitative Surgical Team',
  GHOST:  'Golden Hour Offset Surgical Team',
  GST:    'Ground Surgical Team',
  SOST:   'Special Operations Surgical Team',

  // Security / compliance
  CAC:  'Common Access Card',
  CUI:  'Controlled Unclassified Information',
  DCS:  'Damage Control Surgery',
  ICU:  'Intensive Care Unit',
  PHI:  'Protected Health Information',
}
