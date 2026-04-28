"""
One-shot script: adds role2_relevance to each wicket in hss_tr.json.

Values: core | supporting | adjacent | none
  core       — directly exercises a Role 2 clinical/operational task
  supporting — relevant to Role 2 but not the primary mission function
  adjacent   — useful context but not a Role 2 gating competency
  none       — not relevant to the Role 2 medical mission

Run from repo root:
    python3 scripts/tag_role2_relevance.py
"""
import json
from pathlib import Path

TAGS: dict[str, str] = {
    # --- Ch 3: Collective Events ---
    "HSS-OPS-7001":  "core",        # COC functions (7000-level = MAGTF)
    "HSS-OPS-7002":  "adjacent",    # DSCA planning
    "HSS-PLAN-7001": "core",        # Conduct planning (MAGTF-level)
    "HSS-OPS-6001":  "core",        # COC functions (Role 2 unit-level)
    "HSS-OPS-6002":  "core",        # Provide Role 2 C2
    "HSS-PLAN-6001": "core",        # Plan for operations
    "HSS-SVCS-6001": "core",        # Establish Role 2 HSS capability
    "HSS-OPS-5001":  "core",        # COC functions (company-level)
    "HSS-SVCS-5001": "core",        # Establish Role 2 HSS capability (co-level)
    "HSS-SVCS-4001": "core",        # Provide Role 2 HSS capabilities
    "HSS-SVCS-4002": "supporting",  # Establish Role 1 facility
    "HSS-SVCS-4003": "supporting",  # Establish aid station
    "HSS-SVCS-4004": "core",        # Provide damage control resuscitation
    "HSS-SVCS-4005": "core",        # Coordinate patient movement
    "HSS-SVCS-3001": "core",        # Receive casualties
    "HSS-SVCS-3002": "core",        # Manage mass casualty
    "HSS-SVCS-3003": "core",        # Conduct casualty holding
    "HSS-SVCS-3004": "core",        # Conduct casualty evacuation
    "HSS-DENT-3001": "supporting",  # Provide dental services
    "HSS-DENT-3002": "supporting",  # Emergency dental treatment
    "HSS-DENT-3003": "supporting",  # Establish dental facility
    "HSS-DENT-3004": "supporting",  # Support mass casualty (dental)
    "HSS-CBRN-1001": "adjacent",    # Employ field protective mask
    "HSS-CBRN-1002": "adjacent",    # Manage CBRN injuries

    # --- Ch 4: MCCS Individual Events ---
    "HSS-MCCS-1001": "adjacent",    # Weapons handling (individual skill)
    "HSS-MCCS-1002": "adjacent",    # Preventative maintenance
    "HSS-MCCS-1003": "adjacent",    # Engage targets
    "HSS-MCCS-1004": "adjacent",    # Weapons handling (pistol)
    "HSS-MCCS-1005": "adjacent",    # Preventative maintenance (pistol)
    "HSS-MCCS-1006": "adjacent",    # Corrective action
    "HSS-MCCS-1007": "adjacent",    # Weapons carries
    "HSS-MCCS-1008": "adjacent",    # Zero the weapon
    "HSS-MCCS-1009": "adjacent",    # Basic Rifle Marksmanship
    "HSS-MCCS-1010": "adjacent",    # Combat Rifle Marksmanship
    "HSS-MCCS-1011": "supporting",  # Hand and arm signals
    "HSS-MCCS-1012": "supporting",  # Individual movement techniques
    "HSS-MCCS-1013": "supporting",  # Navigate with map and compass
    "HSS-MCCS-1014": "supporting",  # Operate VHF radio
    "HSS-MCCS-1015": "supporting",  # Recognize IED indicators
    "HSS-MCCS-1016": "supporting",  # React to unexploded IED
    "HSS-MCCS-1017": "supporting",  # React to IED attack
    "HSS-MCCS-1018": "supporting",  # Maintain physical fitness
    "HSS-MCCS-1019": "supporting",  # March under assault load
    "HSS-MCCS-1020": "adjacent",    # Camouflage self and equipment
    "HSS-MCCS-1021": "adjacent",    # Construct field expedient shelters
    "HSS-MCCS-1022": "supporting",  # Individual field hygiene
    "HSS-MCCS-1023": "none",        # Marine Corps terms/sayings
    "HSS-MCCS-1024": "none",        # MC history
    "HSS-MCCS-1025": "none",        # MC leadership
    "HSS-MCCS-1026": "none",        # Code of Conduct
    "HSS-MCCS-1027": "none",        # POW rights
    "HSS-MCCS-1028": "none",        # POW obligations
    "HSS-MCCS-1029": "none",        # MC mission
    "HSS-MCCS-1030": "none",        # Location of major MC units
    "HSS-MCCS-1031": "none",        # MAGTF description
    "HSS-MCCS-1032": "supporting",  # Identify HSS elements within MAGTF
    "HSS-MCCS-1033": "none",        # Personnel inspection
    "HSS-MCCS-1034": "supporting",  # OPORD components
    "HSS-MATN-2101": "none",        # Martial arts fundamentals
    "HSS-MATN-2102": "none",        # Punches
    "HSS-MATN-2103": "none",        # Falls
    "HSS-MATN-2104": "none",        # Bayonet techniques
    "HSS-MATN-2105": "none",        # Upper body strikes
    "HSS-MATN-2106": "none",        # Lower body strikes
    "HSS-MATN-2107": "none",        # Chokes
    "HSS-MATN-2108": "none",        # Leg sweep
    "HSS-MATN-2109": "none",        # Counters to strikes
    "HSS-MATN-2110": "none",        # Counters to chokes
    "HSS-MATN-2111": "none",        # Unarmed manipulations
    "HSS-MATN-2112": "none",        # Armed manipulations
    "HSS-MATN-2113": "none",        # Knife techniques
    "HSS-MCCS-2001": "adjacent",    # Qualify with T/O weapon
    "HSS-MCCS-2002": "adjacent",    # Engage a target
    "HSS-MCCS-2003": "supporting",  # Navigate with GPS
    "HSS-MCCS-2004": "supporting",  # Operate motor transport equipment
    "HSS-MCCS-2005": "adjacent",    # Prepare a bivouac

    # --- Ch 5: Med Common Skills ---
    "HSS-MED-1001":  "core",        # Conduct inventory (Class VIII)
    "HSS-MED-2001":  "supporting",  # Provide first responder medical support
    "HSS-MED-2002":  "core",        # Perform TCCC
    "HSS-MED-2003":  "core",        # Conduct triage
    "HSS-MED-2004":  "supporting",  # Treat environmental injuries
    "HSS-MED-2005":  "core",        # Manage mass casualty incident
    "HSS-MED-2006":  "supporting",  # Identify diseases of operational importance
    "HSS-MED-2007":  "core",        # Evacuate casualties
    "HSS-MED-2008":  "core",        # Perform En-Route Care
    "HSS-MED-2009":  "supporting",  # Identify components of HSS Plan
    "HSS-MED-2010":  "core",        # Manage HSS for military operations
    "HSS-MED-2011":  "supporting",  # Manage field medical services training program
    "HSS-MED-2012":  "supporting",  # Manage Combat and Operational Stress
    "HSS-MED-2013":  "supporting",  # Provide advanced COSC OSCAR Extender services
    "HSS-MED-2014":  "adjacent",    # Conduct field food service sanitation
    "HSS-MED-2015":  "supporting",  # Perform field preventive medicine
    "HSS-MED-2101":  "supporting",  # Perform general and health services admin tasks
    "HSS-MED-2102":  "core",        # Deploy Class VIII health services supplies
    "HSS-MED-2103":  "supporting",  # Conduct training
    "HSS-MED-2104":  "supporting",  # Conduct sustainment training

    # --- Ch 6: L03A Field Medical Service Technician ---
    "L03A-EFWB-2001": "core",       # Perform Donor Risk Stratification
    "L03A-EFWB-2002": "core",       # Perform Blood Donor Collection
    "L03A-EFWB-2003": "core",       # Perform EFWBT
    "L03A-HSS-2001":  "core",       # Perform DNBI patient care
    "L03A-HSS-2002":  "core",       # Evaluate TBI
    "L03A-HSS-2003":  "supporting", # Manage dehydration casualties
    "L03A-HSS-2004":  "supporting", # Maintain health services records
    "L03A-HSS-2101":  "supporting", # Perform dental care
    "L03A-PCC-2001":  "core",       # Perform Prolonged Casualty Care
    "L03A-PCC-2002":  "core",       # Evaluate/Manage Control of Massive Hemorrhage
    "L03A-PCC-2003":  "core",       # Evaluate/Manage Control of Airway
    "L03A-PCC-2004":  "core",       # Evaluate/Manage Control of Respirations
    "L03A-PCC-2005":  "core",       # Evaluate Circulation and Perform DCR
    "L03A-PCC-2006":  "core",       # Implement Crisis Standard of Care
    "L03A-PCC-2007":  "core",       # Conduct Timely Communication/Documentation
    "L03A-PCC-2008":  "core",       # Evaluate/Manage Hypothermia
    "L03A-PCC-2009":  "core",       # Evaluate/Manage Hyperthermia
    "L03A-PCC-2010":  "core",       # Evaluate/Manage Head Injuries
    "L03A-PCC-2011":  "core",       # Evaluate/Manage Pain Control
    "L03A-PCC-2012":  "core",       # Administer Antibiotics
    "L03A-PCC-2013":  "core",       # Evaluate/Manage Wounds and Nursing Care
    "L03A-PCC-2014":  "core",       # Evaluate/Manage Orthopedic Injuries
    "L03A-PCC-2015":  "core",       # Evaluate/Manage Burns
    "L03A-PCC-2016":  "core",       # Prepare for casualty movement/EVAC
    "L03A-TCCC-2001": "core",       # Perform Care Under Fire
    "L03A-TCCC-2002": "core",       # Perform Tactical Field Care
    "L03A-TCCC-2003": "core",       # Perform Tactical Trauma Assessment
    "L03A-TCCC-2004": "core",       # Perform Communication Procedures and Documentation
    "L03A-TCCC-2005": "core",       # Prepare Casualty for Evacuation

    # --- Ch 7: Clinical Individual Events ---
    "CLIN-HSS-2101":  "core",       # Manage TBI
    "CLIN-HSS-2102":  "supporting", # Conduct TBI training
    "CLIN-HSS-2103":  "supporting", # Manage field preventive medicine
    "CLIN-HSS-2104":  "core",       # Perform medical care
    "CLIN-HSS-2105":  "supporting", # Perform dental care

    # --- Ch 8: NEC 8427 (Independent Duty Corpsman) ---
    "8427-MED-2001":  "core",       # Assess a clinical patient
    "8427-MED-2002":  "core",       # Manage a trauma emergency
    "8427-MED-2003":  "adjacent",   # Manage diving casualty
    "8427-MED-2004":  "none",       # Manage an emergency veterinary patient
    "8427-MED-2005":  "core",       # Perform trauma surgical skills
    "8427-MED-2006":  "core",       # Perform a field blood transfusion
    "8427-MED-2007":  "core",       # Perform ACLS

    # --- Ch 9: NEC 8403 (HM Hospital Corpsman) ---
    "8403-MED-2101":  "core",       # Manage a surgical patient
    "8403-MED-2102":  "core",       # Manage an anesthesia patient
    "8403-MED-2103":  "core",       # Conduct laboratory procedures
    "8403-MED-2104":  "supporting", # Conduct radiological procedures
    "8403-MED-2105":  "core",       # Conduct equipment sterilization
    "8403-MED-2106":  "supporting", # Manage emergency dental patient
    "8403-MED-2107":  "supporting", # Manage Occupational Health/Preventive Medicine

    # --- Ch 10: Mountain Warfare ---
    "HSS-MW-2701":    "adjacent",   # Nutrition
    "HSS-MW-2702":    "adjacent",   # Patient assessment (mountain context)
    "HSS-MW-2703":    "adjacent",   # Manage cold weather injuries
    "HSS-MW-2704":    "adjacent",   # Manage altitude sickness
    "HSS-MW-2705":    "adjacent",   # Manage submersion incident
    "HSS-MW-2706":    "adjacent",   # Manage high altitude illness
    "HSS-MW-2707":    "adjacent",   # Manage musculoskeletal injuries
    "HSS-MW-2708":    "adjacent",   # Manage injuries/illnesses (mountain)
    "HSS-MW-2709":    "adjacent",   # Temperate/cold weather preventive medicine
    "HSS-MW-2710":    "adjacent",   # Apply survival techniques
    "HSS-MW-2711":    "adjacent",   # Respond to mass casualty (mountain)
    "HSS-MW-2712":    "adjacent",   # Conduct swift water rescue
    "HSS-MW-2713":    "adjacent",   # Conduct avalanche rescue
    "HSS-MW-2714":    "adjacent",   # Perform casualty evacuation (mountain)
    "HSS-MW-2715":    "adjacent",   # Advise on medical issues (mountain)
}


def main() -> None:
    path = Path(__file__).parent.parent / "content" / "frameworks" / "hss_tr.json"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    missing = []
    for wicket in data["wickets"]:
        ec = wicket["event_code"]
        tag = TAGS.get(ec)
        if tag is None:
            missing.append(ec)
            tag = "none"
        wicket["role2_relevance"] = tag

    if missing:
        print(f"WARNING: {len(missing)} event codes not in TAGS dict:")
        for ec in missing:
            print(f"  {ec}")

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    counts: dict[str, int] = {}
    for w in data["wickets"]:
        v = w["role2_relevance"]
        counts[v] = counts.get(v, 0) + 1
    print(f"Tagged {len(data['wickets'])} wickets:")
    for v in ("core", "supporting", "adjacent", "none"):
        print(f"  {v}: {counts.get(v, 0)}")


if __name__ == "__main__":
    main()
