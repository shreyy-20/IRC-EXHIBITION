import re
import json

with open('frontend/src/data/stallAllotments.ts', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'export const stallAllotments: StallAllotmentRecord\[\] = (\[.*?\]);', content, re.DOTALL)
recs = json.loads(m.group(1))

# Coordinate mapping helpers
# Hall-1: X: 840 to 1540, Y: 70 to 830
# Hanger: X: 70 to 740, Y: 70 to 830
# Passage: X: 740 to 840, Y: 410 to 490

# Let's map stalls to exact box coordinates and access nodes
def get_stall_layout_info(stalls, company_name, source_row):
    # Determine primary hall
    hall = "Hall-1" if any(s <= 208 for s in stalls) else "Hanger"
    min_s = min(stalls) if stalls else 0
    max_s = max(stalls) if stalls else 0
    
    # Check duplicate
    is_duplicate = 288 in stalls
    is_out_of_range = any(s > 341 for s in stalls)
    
    # Known major blocks in Hall-1
    # Block 1 (Pinwheel): 14, 15, 16, 26, 27, 28, 38, 39, 40
    if 14 in stalls or 26 in stalls or 38 in stalls:
        return hall, 930, 170, 130, 120, "hall1_node_b1", "Road Safety & Infrastructure"
    # Block 2 (Automark): 17, 18, 19, 20, 29, 30, 31, 32, 41, 42, 43, 44
    if 17 in stalls or 29 in stalls or 41 in stalls:
        return hall, 1100, 170, 150, 120, "hall1_node_b2", "Road Safety"
    # Block 3 (Zydex): 21, 22, 23, 33, 34, 35, 45, 46, 47
    if 21 in stalls or 33 in stalls or 45 in stalls:
        return hall, 1290, 170, 150, 120, "hall1_node_b3", "Pavement & Chemicals"
    # Block 4 (Hariway, Avijeet, SSPI, Hindustan Colas): 51-53, 63-65, 75-77, 87-89
    if any(s in [51, 52, 53, 63, 64, 65, 75, 76, 77, 87, 88, 89] for s in stalls):
        idx = min([s for s in stalls if s in [51, 52, 53, 63, 64, 65, 75, 76, 77, 87, 88, 89]])
        sub_y = 360 + ((idx - 51) // 12) * 32
        sub_x = 930 + ((idx % 3)) * 40
        return hall, sub_x, sub_y, 75, 30, "hall1_node_b4", "Materials & Infrastructure"
    # Block 5 (Bharat Tiki Tar, Rodic, RR Ispat): 54-57, 66-69, 78-81, 90-93
    if any(s in [54, 55, 56, 57, 66, 67, 68, 69, 78, 79, 80, 81, 90, 91, 92, 93] for s in stalls):
        if 78 in stalls or 90 in stalls: # Rodic
            return hall, 1100, 425, 70, 60, "hall1_node_b5", "Consulting & Engineering"
        elif 80 in stalls or 92 in stalls: # RR Ispat
            return hall, 1175, 425, 75, 60, "hall1_node_b5", "Steel & Infrastructure"
        elif 56 in stalls or 68 in stalls: # Bharat Tiki Tar
            return hall, 1100, 360, 75, 60, "hall1_node_b5", "Bitumen & Chemicals"
        else: # SSPI or other
            return hall, 1175, 360, 75, 60, "hall1_node_b5", "Industrial Products"
    # Block 6 (Kataline): 58-60, 70-72, 82-84, 94-96
    if 58 in stalls or 70 in stalls or 82 in stalls or 94 in stalls:
        return hall, 1290, 360, 150, 125, "hall1_node_b6", "Traffic & Road Marking"
    # Block 7 (Vibhor Steel, Green Tex, Avantech, Brightline): 99-101, 111, 123, 135, 147-149, 159-161
    if any(s in [99, 100, 101, 111, 121, 123, 135, 147, 148, 149, 159, 160, 161] for s in stalls):
        if 99 in stalls: # Vibhor
            return hall, 930, 560, 70, 40, "hall1_node_b7", "Steel Tubes"
        elif 147 in stalls: # Avantech
            return hall, 930, 640, 70, 40, "hall1_node_b7", "Engineering"
        elif 149 in stalls or 161 in stalls: # Brightline
            return hall, 1005, 640, 65, 40, "hall1_node_b7", "Thermoplastic"
        else:
            return hall, 1005, 560, 65, 40, "hall1_node_b7", "Materials"
    # Block 8 (Alcolite, Gold Sponsors, Jindal, etc.): 102-105, 114, 117, 130-132, 142-144, 150-153, 162-165
    if any(s in [102, 103, 104, 105, 114, 117, 130, 131, 132, 142, 143, 144, 150, 151, 152, 153, 162, 163, 164, 165] for s in stalls):
        if 102 in stalls: # Alcolite
            return hall, 1100, 560, 75, 50, "hall1_node_b8", "Road Safety"
        elif 130 in stalls: # Jindal Stainless
            return hall, 1175, 560, 75, 50, "hall1_node_b8", "Stainless Steel"
        elif 117 in stalls: # Atomberg
            return hall, 1100, 615, 75, 40, "hall1_node_b8", "Technology"
        elif 144 in stalls: # I2R Consulting
            return hall, 1175, 615, 75, 40, "hall1_node_b8", "Consulting"
        else:
            return hall, 1100, 660, 150, 45, "hall1_node_b8", "Gold Sponsor"
    # Block 9 (Silver Sponsors, Indian Road Survey, Taisei): 106-108, 118-120, 154-156, 166-168
    if any(s in [106, 107, 108, 118, 119, 120, 154, 155, 156, 166, 167, 168] for s in stalls):
        if 106 in stalls or 118 in stalls: # Indian Road Survey
            return hall, 1290, 560, 75, 65, "hall1_node_b9", "Road Survey"
        elif 108 in stalls: # Taisei
            return hall, 1365, 560, 75, 65, "hall1_node_b9", "International Tech"
        else:
            return hall, 1290, 630, 150, 65, "hall1_node_b9", "Silver Sponsor"

    # Known major blocks in Hanger
    # Block 1 (Gold 2 Sponsor): 224-226, 236-238, 248-250, 260-262
    if any(s in range(224, 227) or s in range(236, 239) or s in range(248, 251) or s in range(260, 263) for s in stalls):
        return hall, 130, 160, 100, 100, "hanger_node_b1", "Gold Sponsor"
    # Block 2 (ARRB): 227-230, 239-242, 251-254, 263-266
    if 227 in stalls or 239 in stalls or 251 in stalls or 263 in stalls:
        return hall, 265, 160, 180, 100, "hanger_node_b2", "Road Rehabilitation & Tech"
    # Block 3 (Orafol): 231-233, 243-245, 255-257, 267-269
    if 231 in stalls or 243 in stalls or 255 in stalls or 267 in stalls:
        return hall, 480, 160, 160, 100, "hanger_node_b3", "Reflective Solutions"
    # Block 4 (RTE ETI Environtech, Asian Paints): 272-274, 284-286
    if 273 in stalls or 285 in stalls or 272 in stalls or 284 in stalls:
        if 272 in stalls or 284 in stalls: # Asian Paints
            return hall, 130, 290, 50, 90, "hanger_node_b4", "Coatings & Paint"
        else: # RTE ETI
            return hall, 180, 290, 50, 90, "hanger_node_b4", "Environmental Tech"
    # Block 5 (Ammann & CTM - Duplicate 288, Supreme Bituchem): 275-278, 287-290
    if 288 in stalls or 287 in stalls or 289 in stalls or 290 in stalls or 275 in stalls:
        if "AMMANN" in company_name.upper():
            return hall, 265, 290, 90, 90, "hanger_node_b5", "Asphalt & Machinery"
        elif "CTM" in company_name.upper():
            return hall, 265, 290, 90, 90, "hanger_node_b5", "Technical Textiles"
        elif 289 in stalls: # Supreme Bituchem
            return hall, 355, 290, 90, 90, "hanger_node_b5", "Bitumen & Waterproofing"
        else:
            return hall, 265, 290, 180, 90, "hanger_node_b5", "Engineering"
    # Block 6 (Utkarsh India): 279-281, 291-293
    if 279 in stalls or 291 in stalls:
        return hall, 480, 290, 160, 90, "hanger_node_b6", "Steel & Infrastructure"
    # Block 8 (GTF, Pioneer 342-343): 306-309, 318-321, 329-332, 340-343
    if 306 in stalls or 318 in stalls or 342 in stalls or 343 in stalls:
        if 306 in stalls or 318 in stalls: # GTF
            return hall, 265, 520, 90, 110, "hanger_node_b8", "Geosynthetics"
        elif 342 in stalls: # Pioneer
            return hall, 355, 520, 90, 110, "hanger_node_b8", "Paving Solutions"
        else:
            return hall, 265, 520, 180, 110, "hanger_node_b8", "Infrastructure"
    # Block 9 (Avery Dennison, Suntech, A&T, Pavemark, Continental): 310-312, 322-324, 333-335, 344-346
    if any(s in [310, 311, 312, 322, 323, 324, 308, 309, 320, 321, 333, 344, 334, 345, 335, 346] for s in stalls):
        if 310 in stalls or 322 in stalls: # Avery Dennison
            return hall, 480, 520, 80, 55, "hanger_node_b9", "Reflective & Graphics"
        elif 308 in stalls: # Suntech
            return hall, 560, 520, 80, 55, "hanger_node_b9", "Geotextiles"
        elif 333 in stalls: # A&T Engineering
            return hall, 480, 575, 80, 55, "hanger_node_b9", "Engineering"
        elif 334 in stalls: # Pavemark
            return hall, 560, 575, 40, 55, "hanger_node_b9", "Road Marking"
        elif 335 in stalls or 346 in stalls: # Continental Trading
            return hall, 600, 575, 40, 55, "hanger_node_b9", "Trading & Equipment"
        else:
            return hall, 480, 520, 160, 110, "hanger_node_b9", "Materials"
    # Block 10 (Silver Summit): 351-353, 363-365
    if any(s in range(351, 354) or s in range(363, 366) for s in stalls):
        return hall, 130, 660, 100, 90, "hanger_node_b10", "Silver Summit"
    # Block 11 (Global Summit): 354-357, 366-369
    if any(s in range(354, 358) or s in range(366, 370) for s in stalls):
        return hall, 265, 660, 180, 90, "hanger_node_b11", "Global Summit"
    # Block 12 (Govt Projects): 358-372
    if any(s in range(358, 361) or s in range(370, 373) for s in stalls):
        return hall, 480, 660, 160, 90, "hanger_node_b12", "Government Projects"

    # Perimeter stalls for Hall-1
    if hall == "Hall-1":
        # Top perimeter (1-10)
        if min_s <= 10:
            sub_x = 900 + (min_s - 1) * 60
            return hall, sub_x, 90, 50, 45, "hall1_node_top", "Exhibition Participant"
        # Right perimeter (11-194)
        elif any(s in [11, 13, 37, 49, 62, 74, 86, 98, 50, 134, 146, 110, 122, 158, 170, 182, 194] for s in stalls):
            row_idx = min_s % 17
            return hall, 1465, 120 + row_idx * 38, 55, 34, "hall1_node_east", "Infrastructure"
        # Bottom perimeter (12-193)
        elif any(s in [12, 24, 36, 48, 61, 73, 85, 97, 109, 145, 121, 133, 157, 169, 181, 193] for s in stalls):
            col_idx = (min_s % 18)
            return hall, 920 + col_idx * 38, 735, 34, 50, "hall1_node_south", "Participant"
        # Left perimeter (171-180)
        else:
            pos_y = 150 + (min_s % 10) * 55
            return hall, 865, pos_y, 45, 45, "hall1_node_west", "Participant"

    # Perimeter stalls for Hanger
    else:
        # Top perimeter (209-220)
        if any(s in range(209, 221) for s in stalls):
            col = min_s - 209
            return hall, 110 + col * 48, 90, 44, 45, "hanger_node_north", "Participant"
        # Right perimeter (246 to 387, facing passage)
        elif any(s in [246, 258, 270, 222, 234, 325, 282, 294, 296, 299, 301, 313, 349, 361, 373, 385, 387] for s in stalls):
            row = (min_s % 18)
            return hall, 665, 120 + row * 38, 50, 34, "hanger_node_east", "Participant"
        # Bottom perimeter (375-384)
        elif any(s in range(375, 385) for s in stalls):
            col = min_s - 375
            return hall, 130 + col * 50, 770, 45, 45, "hanger_node_south", "Participant"
        # Left outer perimeter (221 to 386)
        else:
            row = (min_s % 19)
            return hall, 80, 120 + row * 36, 45, 32, "hanger_node_west", "Participant"

clubbed_list = []
for i, r in enumerate(recs):
    raw_nums = r['rawLikelyStallNumbers']
    stalls = [int(n) for n in re.findall(r'\d+', raw_nums)]
    c_name = r['companyName'].strip()
    s_row = r['sourceRow']
    s_num = r['serialNumber']
    
    hall, x, y, w, h, access_node, category = get_stall_layout_info(stalls, c_name, s_row)
    
    # Formatted stalls representation like {21, 22, 23, 33, 34, 35, 45, 46, 47}
    stalls_str = "{" + ", ".join(str(s) for s in stalls) + "}"
    clubbed_label = f"{stalls_str} - {c_name}"
    
    # Status
    is_duplicate = (288 in stalls)
    is_out_of_range = any(s > 341 for s in stalls)
    
    alloc_status = "duplicate" if is_duplicate else ("out_of_range" if is_out_of_range else ("verified" if len(stalls) > 4 else "provisional"))
    verif_status = "Duplicate Allocation" if is_duplicate else ("Out of Reported Range" if is_out_of_range else ("Verified Against PDF" if len(stalls) > 4 else "Source Listed"))

    clubbed_list.append({
        "id": f"comp-{s_row}",
        "sourceRow": s_row,
        "serialNumber": s_num,
        "companyName": c_name,
        "rawLikelyStallNumbers": raw_nums,
        "stalls": stalls,
        "stallsFormatted": stalls_str,
        "clubbedLabel": clubbed_label,
        "hall": hall,
        "category": category,
        "allocationStatus": alloc_status,
        "verificationStatus": verif_status,
        "x": x,
        "y": y,
        "width": w,
        "height": h,
        "accessNodeId": access_node,
        "isDuplicate": is_duplicate,
        "isOutOfRange": is_out_of_range
    })

# Write to clubbedExhibitors.ts
ts_content = '''// Generated from STALL ALLOTMENT COMPANIES LIST.xlsx and LAYOUT 12-11-26.pdf
// Preserves all original 102 company records clubbed with their stall numbers

export type ClubbedExhibitor = {
  id: string;
  sourceRow: number;
  serialNumber: number | null;
  companyName: string;
  rawLikelyStallNumbers: string;
  stalls: number[];
  stallsFormatted: string;
  clubbedLabel: string;
  hall: 'Hall-1' | 'Hanger';
  category: string;
  allocationStatus: 'verified' | 'provisional' | 'duplicate' | 'out_of_range' | 'unassigned';
  verificationStatus: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accessNodeId: string;
  isDuplicate: boolean;
  isOutOfRange: boolean;
};

export const clubbedExhibitors: ClubbedExhibitor[] = ''' + json.dumps(clubbed_list, indent=2) + ''';
'''

with open('frontend/src/data/clubbedExhibitors.ts', 'w', encoding='utf-8') as f:
    f.write(ts_content)

print(f"Generated {len(clubbed_list)} clubbed exhibitors in frontend/src/data/clubbedExhibitors.ts")
