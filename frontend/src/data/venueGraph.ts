// Indoor Navigation Graph & Dijkstra Routing Engine
// Calibrated to LAYOUT 12-11-26.pdf (Hall-1, Hanger, Connecting Passage, Ramappa Temple Theme Pavilion)

export type NavNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  hall: 'Hall-1' | 'Hanger' | 'Passage';
  type: 'entrance' | 'aisle' | 'passage' | 'booth_access' | 'landmark';
};

export type NavEdge = {
  from: string;
  to: string;
  distanceM: number;
  hall: 'Hall-1' | 'Hanger' | 'Passage';
  aisleName: string;
  aisleWidth: string;
  pathwayId?: string;
};

export const VENUE_NODES: Record<string, NavNode> = {
  // Entrances
  entrance_main: { id: 'entrance_main', label: 'Main Venue Entrance', x: 1200, y: 830, hall: 'Hall-1', type: 'entrance' },
  entrance_hall1: { id: 'entrance_hall1', label: 'Hall-1 Entry Foyer', x: 1200, y: 760, hall: 'Hall-1', type: 'entrance' },
  
  // Hall-1 South Corridor
  hall1_south_w: { id: 'hall1_south_w', label: 'Hall-1 South-West Aisle', x: 890, y: 740, hall: 'Hall-1', type: 'aisle' },
  hall1_south_c1: { id: 'hall1_south_c1', label: 'Hall-1 South Cross Aisle 1', x: 1070, y: 740, hall: 'Hall-1', type: 'aisle' },
  hall1_south_mid: { id: 'hall1_south_mid', label: 'Hall-1 South Main Junction', x: 1200, y: 740, hall: 'Hall-1', type: 'aisle' },
  hall1_south_c2: { id: 'hall1_south_c2', label: 'Hall-1 South Cross Aisle 2', x: 1270, y: 740, hall: 'Hall-1', type: 'aisle' },
  hall1_south_e: { id: 'hall1_south_e', label: 'Hall-1 South-East Aisle', x: 1450, y: 740, hall: 'Hall-1', type: 'aisle' },

  // Hall-1 Center Corridor (Y: 520)
  hall1_mid_w: { id: 'hall1_mid_w', label: 'Hall-1 West Corridor (Mid)', x: 890, y: 520, hall: 'Hall-1', type: 'aisle' },
  hall1_mid_c1: { id: 'hall1_mid_c1', label: 'Hall-1 Center Junction 1', x: 1070, y: 520, hall: 'Hall-1', type: 'aisle' },
  hall1_mid_c2: { id: 'hall1_mid_c2', label: 'Hall-1 Center Junction 2', x: 1270, y: 520, hall: 'Hall-1', type: 'aisle' },
  hall1_mid_e: { id: 'hall1_mid_e', label: 'Hall-1 East Corridor (Mid)', x: 1450, y: 520, hall: 'Hall-1', type: 'aisle' },

  // Hall-1 West Corridor Passage Junction (Y: 450)
  hall1_west_passage_jct: { id: 'hall1_west_passage_jct', label: 'Hall-1 West Passage Junction', x: 890, y: 450, hall: 'Hall-1', type: 'aisle' },

  // Hall-1 Upper Corridor (Y: 320)
  hall1_north_w: { id: 'hall1_north_w', label: 'Hall-1 West Corridor (North)', x: 890, y: 320, hall: 'Hall-1', type: 'aisle' },
  hall1_north_c1: { id: 'hall1_north_c1', label: 'Hall-1 North Junction 1', x: 1070, y: 320, hall: 'Hall-1', type: 'aisle' },
  hall1_north_c2: { id: 'hall1_north_c2', label: 'Hall-1 North Junction 2', x: 1270, y: 320, hall: 'Hall-1', type: 'aisle' },
  hall1_north_e: { id: 'hall1_north_e', label: 'Hall-1 East Corridor (North)', x: 1450, y: 320, hall: 'Hall-1', type: 'aisle' },

  // Hall-1 Top Perimeter (Y: 140)
  hall1_top_w: { id: 'hall1_top_w', label: 'Hall-1 Top Perimeter West', x: 890, y: 140, hall: 'Hall-1', type: 'aisle' },
  hall1_top_mid: { id: 'hall1_top_mid', label: 'Hall-1 Top Perimeter Center', x: 1200, y: 140, hall: 'Hall-1', type: 'aisle' },
  hall1_top_e: { id: 'hall1_top_e', label: 'Hall-1 Top Perimeter East', x: 1450, y: 140, hall: 'Hall-1', type: 'aisle' },

  // Connecting Covered Passage (Perfect horizontal axis Y: 450)
  passage_hall1_gate: { id: 'passage_hall1_gate', label: 'Hall-1 Passage Entrance', x: 860, y: 450, hall: 'Passage', type: 'passage' },
  passage_mid: { id: 'passage_mid', label: 'Inter-Hall Connecting Passage', x: 790, y: 450, hall: 'Passage', type: 'passage' },
  passage_hanger_gate: { id: 'passage_hanger_gate', label: 'Hanger Passage Entrance', x: 710, y: 450, hall: 'Passage', type: 'passage' },

  // Hanger East Corridor (X: 690)
  hanger_east_top: { id: 'hanger_east_top', label: 'Hanger North-East Corridor', x: 690, y: 140, hall: 'Hanger', type: 'aisle' },
  hanger_east_upper: { id: 'hanger_east_upper', label: 'Hanger East Aisle (Upper)', x: 690, y: 270, hall: 'Hanger', type: 'aisle' },
  hanger_east_mid: { id: 'hanger_east_mid', label: 'Hanger East Junction (Passage)', x: 690, y: 450, hall: 'Hanger', type: 'aisle' },
  hanger_east_lower: { id: 'hanger_east_lower', label: 'Hanger East Aisle (Lower)', x: 690, y: 640, hall: 'Hanger', type: 'aisle' },
  hanger_east_bot: { id: 'hanger_east_bot', label: 'Hanger South-East Corridor', x: 690, y: 760, hall: 'Hanger', type: 'aisle' },

  // Hanger Center Corridor (X: 470)
  hanger_mid_top: { id: 'hanger_mid_top', label: 'Hanger Central North Junction', x: 470, y: 140, hall: 'Hanger', type: 'aisle' },
  hanger_mid_upper: { id: 'hanger_mid_upper', label: 'Hanger Central Aisle 1', x: 470, y: 270, hall: 'Hanger', type: 'aisle' },
  hanger_mid_ramappa_n: { id: 'hanger_mid_ramappa_n', label: 'Ramappa Theme Pavilion (North Access)', x: 470, y: 390, hall: 'Hanger', type: 'landmark' },
  hanger_mid_cross: { id: 'hanger_mid_cross', label: 'Hanger Central Passage Junction', x: 470, y: 450, hall: 'Hanger', type: 'aisle' },
  hanger_mid_ramappa_s: { id: 'hanger_mid_ramappa_s', label: 'Ramappa Theme Pavilion (South Access)', x: 470, y: 500, hall: 'Hanger', type: 'landmark' },
  hanger_mid_lower: { id: 'hanger_mid_lower', label: 'Hanger Central Aisle 2', x: 470, y: 640, hall: 'Hanger', type: 'aisle' },
  hanger_mid_bot: { id: 'hanger_mid_bot', label: 'Hanger Central South Junction', x: 470, y: 760, hall: 'Hanger', type: 'aisle' },

  // Hanger West Corridor (X: 250)
  hanger_west_top: { id: 'hanger_west_top', label: 'Hanger North-West Aisle', x: 250, y: 140, hall: 'Hanger', type: 'aisle' },
  hanger_west_upper: { id: 'hanger_west_upper', label: 'Hanger West Junction 1', x: 250, y: 270, hall: 'Hanger', type: 'aisle' },
  hanger_west_mid: { id: 'hanger_west_mid', label: 'Hanger West Corridor (Mid)', x: 250, y: 450, hall: 'Hanger', type: 'aisle' },
  hanger_west_lower: { id: 'hanger_west_lower', label: 'Hanger West Junction 2', x: 250, y: 640, hall: 'Hanger', type: 'aisle' },
  hanger_west_bot: { id: 'hanger_west_bot', label: 'Hanger South-West Aisle', x: 250, y: 760, hall: 'Hanger', type: 'aisle' },

  // Hanger Outer West Corridor (X: 110)
  hanger_outer_top: { id: 'hanger_outer_top', label: 'Hanger Outer North-West', x: 110, y: 140, hall: 'Hanger', type: 'aisle' },
  hanger_outer_mid: { id: 'hanger_outer_mid', label: 'Hanger Outer West Corridor', x: 110, y: 450, hall: 'Hanger', type: 'aisle' },
  hanger_outer_bot: { id: 'hanger_outer_bot', label: 'Hanger Outer South-West', x: 110, y: 760, hall: 'Hanger', type: 'aisle' },

  // Booth Access Nodes - Hall-1
  hall1_node_b1: { id: 'hall1_node_b1', label: 'Stalls {14-40} Pinwheel Entrance', x: 990, y: 300, hall: 'Hall-1', type: 'booth_access' },
  hall1_node_b2: { id: 'hall1_node_b2', label: 'Stalls {17-44} Automark Entrance', x: 1180, y: 300, hall: 'Hall-1', type: 'booth_access' },
  hall1_node_b3: { id: 'hall1_node_b3', label: 'Stalls {21-47} Zydex Entrance', x: 1360, y: 300, hall: 'Hall-1', type: 'booth_access' },
  hall1_node_b4: { id: 'hall1_node_b4', label: 'Stalls {51-89} Hariway / Avijeet Entrance', x: 990, y: 500, hall: 'Hall-1', type: 'booth_access' },
  hall1_node_b5: { id: 'hall1_node_b5', label: 'Stalls {54-93} Bharat Tiki Tar / Rodic / RR Ispat', x: 1180, y: 500, hall: 'Hall-1', type: 'booth_access' },
  hall1_node_b6: { id: 'hall1_node_b6', label: 'Stalls {58-96} Kataline Entrance', x: 1360, y: 500, hall: 'Hall-1', type: 'booth_access' },
  hall1_node_b7: { id: 'hall1_node_b7', label: 'Stalls {99-161} Vibhor Steel / Avantech', x: 990, y: 710, hall: 'Hall-1', type: 'booth_access' },
  hall1_node_b8: { id: 'hall1_node_b8', label: 'Stalls {102-165} Alcolite / Gold Sponsors', x: 1180, y: 710, hall: 'Hall-1', type: 'booth_access' },
  hall1_node_b9: { id: 'hall1_node_b9', label: 'Stalls {106-168} Silver Sponsors / Indian Road Survey', x: 1360, y: 710, hall: 'Hall-1', type: 'booth_access' },
  hall1_node_top: { id: 'hall1_node_top', label: 'Hall-1 North Peripheral Stalls', x: 1200, y: 150, hall: 'Hall-1', type: 'booth_access' },
  hall1_node_east: { id: 'hall1_node_east', label: 'Hall-1 East Peripheral Stalls', x: 1450, y: 450, hall: 'Hall-1', type: 'booth_access' },
  hall1_node_south: { id: 'hall1_node_south', label: 'Hall-1 South Peripheral Stalls', x: 1200, y: 730, hall: 'Hall-1', type: 'booth_access' },
  hall1_node_west: { id: 'hall1_node_west', label: 'Hall-1 West Peripheral Stalls', x: 890, y: 450, hall: 'Hall-1', type: 'booth_access' },

  // Booth Access Nodes - Hanger
  hanger_node_b1: { id: 'hanger_node_b1', label: 'Stalls {224-262} Gold 2 Sponsor', x: 180, y: 270, hall: 'Hanger', type: 'booth_access' },
  hanger_node_b2: { id: 'hanger_node_b2', label: 'Stalls {227-266} ARRB Systems Entrance', x: 350, y: 270, hall: 'Hanger', type: 'booth_access' },
  hanger_node_b3: { id: 'hanger_node_b3', label: 'Stalls {231-269} Orafol India Entrance', x: 560, y: 270, hall: 'Hanger', type: 'booth_access' },
  hanger_node_b4: { id: 'hanger_node_b4', label: 'Stalls {272-286} Asian Paints / RTE Environtech', x: 180, y: 390, hall: 'Hanger', type: 'booth_access' },
  hanger_node_b5: { id: 'hanger_node_b5', label: 'Stalls {275-290} Ammann / CTM (Stall 288)', x: 350, y: 390, hall: 'Hanger', type: 'booth_access' },
  hanger_node_b6: { id: 'hanger_node_b6', label: 'Stalls {279-293} Utkarsh India Entrance', x: 560, y: 390, hall: 'Hanger', type: 'booth_access' },
  hanger_node_b8: { id: 'hanger_node_b8', label: 'Stalls {306-343} GTF / Pioneer Entrance', x: 350, y: 640, hall: 'Hanger', type: 'booth_access' },
  hanger_node_b9: { id: 'hanger_node_b9', label: 'Stalls {310-346} Avery Dennison / Suntech / A&T', x: 560, y: 640, hall: 'Hanger', type: 'booth_access' },
  hanger_node_b10: { id: 'hanger_node_b10', label: 'Stalls {351-365} Silver Summit Entrance', x: 180, y: 760, hall: 'Hanger', type: 'booth_access' },
  hanger_node_b11: { id: 'hanger_node_b11', label: 'Stalls {354-369} Global Summit Entrance', x: 350, y: 760, hall: 'Hanger', type: 'booth_access' },
  hanger_node_b12: { id: 'hanger_node_b12', label: 'Stalls {358-372} Govt Projects Entrance', x: 560, y: 760, hall: 'Hanger', type: 'booth_access' },
  hanger_node_north: { id: 'hanger_node_north', label: 'Hanger North Peripheral Stalls', x: 350, y: 150, hall: 'Hanger', type: 'booth_access' },
  hanger_node_east: { id: 'hanger_node_east', label: 'Hanger East Peripheral Stalls', x: 680, y: 450, hall: 'Hanger', type: 'booth_access' },
  hanger_node_south: { id: 'hanger_node_south', label: 'Hanger South Peripheral Stalls', x: 350, y: 750, hall: 'Hanger', type: 'booth_access' },
  hanger_node_west: { id: 'hanger_node_west', label: 'Hanger West Peripheral Stalls', x: 110, y: 450, hall: 'Hanger', type: 'booth_access' },

  // Service & Registration Counters
  counter_reg_1_8: { id: 'counter_reg_1_8', label: 'Registration Counters 1–8', x: 1120, y: 765, hall: 'Hall-1', type: 'landmark' },
  counter_helpdesk: { id: 'counter_helpdesk', label: 'Help Desk & Information', x: 1360, y: 765, hall: 'Hall-1', type: 'landmark' },
  counter_vip: { id: 'counter_vip', label: 'VIP Lounge & Protocol Secretariat', x: 1010, y: 765, hall: 'Hall-1', type: 'landmark' },
  counter_firstaid: { id: 'counter_firstaid', label: 'First Aid & Medical Station', x: 1465, y: 765, hall: 'Hall-1', type: 'landmark' },
  counter_media: { id: 'counter_media', label: 'Media & Press Center', x: 1475, y: 685, hall: 'Hall-1', type: 'landmark' },
  counter_committee: { id: 'counter_committee', label: 'IRC Committee Office', x: 905, y: 765, hall: 'Hall-1', type: 'landmark' },
  counter_ramappa: { id: 'counter_ramappa', label: 'Theme Pavilion Ramappa Temple', x: 365, y: 450, hall: 'Hanger', type: 'landmark' },
  counter_food_court: { id: 'counter_food_court', label: 'Food Court & Dining Lawn', x: 135, y: 770, hall: 'Hanger', type: 'landmark' },
  counter_restrooms_hall1: { id: 'counter_restrooms_hall1', label: 'Restrooms (Hall-1)', x: 1480, y: 140, hall: 'Hall-1', type: 'landmark' },
  counter_restrooms_hanger: { id: 'counter_restrooms_hanger', label: 'Restrooms (Hanger)', x: 100, y: 110, hall: 'Hanger', type: 'landmark' },
};

// Graph Edges with specific layout aisle width and name annotations
export const VENUE_EDGES: NavEdge[] = [
  // Entrance into Hall-1
  { from: 'entrance_main', to: 'entrance_hall1', distanceM: 5, hall: 'Hall-1', aisleName: 'Hall-1 Main Entrance Foyer', aisleWidth: '6.0M', pathwayId: 'hall1_foyer_entrance' },
  { from: 'entrance_hall1', to: 'hall1_south_mid', distanceM: 6, hall: 'Hall-1', aisleName: 'Hall-1 Main Entrance Foyer', aisleWidth: '6.0M', pathwayId: 'hall1_foyer_entrance' },

  // Hall-1 South corridor (6.0M Promenade)
  { from: 'hall1_south_w', to: 'hall1_south_c1', distanceM: 9, hall: 'Hall-1', aisleName: 'Hall-1 South Promenade (6.0m)', aisleWidth: '6.0M', pathwayId: 'hall1_south_promenade' },
  { from: 'hall1_south_c1', to: 'hall1_south_mid', distanceM: 7, hall: 'Hall-1', aisleName: 'Hall-1 South Promenade (6.0m)', aisleWidth: '6.0M', pathwayId: 'hall1_south_promenade' },
  { from: 'hall1_south_mid', to: 'hall1_south_c2', distanceM: 4, hall: 'Hall-1', aisleName: 'Hall-1 South Promenade (6.0m)', aisleWidth: '6.0M', pathwayId: 'hall1_south_promenade' },
  { from: 'hall1_south_c2', to: 'hall1_south_e', distanceM: 9, hall: 'Hall-1', aisleName: 'Hall-1 South Promenade (6.0m)', aisleWidth: '6.0M', pathwayId: 'hall1_south_promenade' },

  // Hall-1 West Corridor Spine (Orthogonal chain: 740 -> 520 -> 450 -> 320 -> 140)
  { from: 'hall1_south_w', to: 'hall1_mid_w', distanceM: 11, hall: 'Hall-1', aisleName: 'Hall-1 West Perimeter Walkway (2.5m)', aisleWidth: '2.5M', pathwayId: 'hall1_west_perimeter' },
  { from: 'hall1_mid_w', to: 'hall1_west_passage_jct', distanceM: 4, hall: 'Hall-1', aisleName: 'Hall-1 West Perimeter Walkway (2.5m)', aisleWidth: '2.5M', pathwayId: 'hall1_west_perimeter' },
  { from: 'hall1_west_passage_jct', to: 'hall1_north_w', distanceM: 7, hall: 'Hall-1', aisleName: 'Hall-1 West Perimeter Walkway (2.5m)', aisleWidth: '2.5M', pathwayId: 'hall1_west_perimeter' },
  { from: 'hall1_north_w', to: 'hall1_top_w', distanceM: 9, hall: 'Hall-1', aisleName: 'Hall-1 West Perimeter Walkway (2.5m)', aisleWidth: '2.5M', pathwayId: 'hall1_west_perimeter' },

  // Hall-1 Other Vertical spines
  { from: 'hall1_south_c1', to: 'hall1_mid_c1', distanceM: 11, hall: 'Hall-1', aisleName: 'Hall-1 Cross Aisle 1 (3.0m)', aisleWidth: '3.0M', pathwayId: 'hall1_cross_aisle_1' },
  { from: 'hall1_mid_c1', to: 'hall1_north_c1', distanceM: 10, hall: 'Hall-1', aisleName: 'Hall-1 Cross Aisle 1 (3.0m)', aisleWidth: '3.0M', pathwayId: 'hall1_cross_aisle_1' },

  { from: 'hall1_south_c2', to: 'hall1_mid_c2', distanceM: 11, hall: 'Hall-1', aisleName: 'Hall-1 Cross Aisle 2 (3.0m)', aisleWidth: '3.0M', pathwayId: 'hall1_cross_aisle_2' },
  { from: 'hall1_mid_c2', to: 'hall1_north_c2', distanceM: 10, hall: 'Hall-1', aisleName: 'Hall-1 Cross Aisle 2 (3.0m)', aisleWidth: '3.0M', pathwayId: 'hall1_cross_aisle_2' },

  { from: 'hall1_south_e', to: 'hall1_mid_e', distanceM: 11, hall: 'Hall-1', aisleName: 'Hall-1 East Perimeter Walkway (2.5m)', aisleWidth: '2.5M', pathwayId: 'hall1_east_perimeter' },
  { from: 'hall1_mid_e', to: 'hall1_north_e', distanceM: 10, hall: 'Hall-1', aisleName: 'Hall-1 East Perimeter Walkway (2.5m)', aisleWidth: '2.5M', pathwayId: 'hall1_east_perimeter' },
  { from: 'hall1_north_e', to: 'hall1_top_e', distanceM: 9, hall: 'Hall-1', aisleName: 'Hall-1 East Perimeter Walkway (2.5m)', aisleWidth: '2.5M', pathwayId: 'hall1_east_perimeter' },

  // Hall-1 Horizontal spines (6.0M Aisles)
  { from: 'hall1_mid_w', to: 'hall1_mid_c1', distanceM: 9, hall: 'Hall-1', aisleName: 'Hall-1 Central Grand Aisle (6.0m)', aisleWidth: '6.0M', pathwayId: 'hall1_central_grand_aisle' },
  { from: 'hall1_mid_c1', to: 'hall1_mid_c2', distanceM: 10, hall: 'Hall-1', aisleName: 'Hall-1 Central Grand Aisle (6.0m)', aisleWidth: '6.0M', pathwayId: 'hall1_central_grand_aisle' },
  { from: 'hall1_mid_c2', to: 'hall1_mid_e', distanceM: 9, hall: 'Hall-1', aisleName: 'Hall-1 Central Grand Aisle (6.0m)', aisleWidth: '6.0M', pathwayId: 'hall1_central_grand_aisle' },

  { from: 'hall1_north_w', to: 'hall1_north_c1', distanceM: 9, hall: 'Hall-1', aisleName: 'Hall-1 North Grand Aisle (6.0m)', aisleWidth: '6.0M', pathwayId: 'hall1_north_grand_aisle' },
  { from: 'hall1_north_c1', to: 'hall1_north_c2', distanceM: 10, hall: 'Hall-1', aisleName: 'Hall-1 North Grand Aisle (6.0m)', aisleWidth: '6.0M', pathwayId: 'hall1_north_grand_aisle' },
  { from: 'hall1_north_c2', to: 'hall1_north_e', distanceM: 9, hall: 'Hall-1', aisleName: 'Hall-1 North Grand Aisle (6.0m)', aisleWidth: '6.0M', pathwayId: 'hall1_north_grand_aisle' },

  { from: 'hall1_top_w', to: 'hall1_top_mid', distanceM: 15, hall: 'Hall-1', aisleName: 'Hall-1 North Perimeter Walkway (3.0m)', aisleWidth: '3.0M', pathwayId: 'hall1_top_perimeter' },
  { from: 'hall1_top_mid', to: 'hall1_top_e', distanceM: 13, hall: 'Hall-1', aisleName: 'Hall-1 North Perimeter Walkway (3.0m)', aisleWidth: '3.0M', pathwayId: 'hall1_top_perimeter' },

  // Hall-1 Booth Access Connections
  { from: 'hall1_north_w', to: 'hall1_node_b1', distanceM: 5, hall: 'Hall-1', aisleName: 'North Grand Aisle Access', aisleWidth: '6.0M', pathwayId: 'hall1_north_grand_aisle' },
  { from: 'hall1_north_c1', to: 'hall1_node_b1', distanceM: 4, hall: 'Hall-1', aisleName: 'Cross Aisle 1 Access', aisleWidth: '3.0M', pathwayId: 'hall1_cross_aisle_1' },

  { from: 'hall1_north_c1', to: 'hall1_node_b2', distanceM: 5, hall: 'Hall-1', aisleName: 'Cross Aisle 1 Access', aisleWidth: '3.0M', pathwayId: 'hall1_cross_aisle_1' },
  { from: 'hall1_north_c2', to: 'hall1_node_b2', distanceM: 4, hall: 'Hall-1', aisleName: 'Cross Aisle 2 Access', aisleWidth: '3.0M', pathwayId: 'hall1_cross_aisle_2' },

  { from: 'hall1_north_c2', to: 'hall1_node_b3', distanceM: 4, hall: 'Hall-1', aisleName: 'Cross Aisle 2 Access', aisleWidth: '3.0M', pathwayId: 'hall1_cross_aisle_2' },
  { from: 'hall1_north_e', to: 'hall1_node_b3', distanceM: 5, hall: 'Hall-1', aisleName: 'East Perimeter Access', aisleWidth: '2.5M', pathwayId: 'hall1_east_perimeter' },

  { from: 'hall1_mid_w', to: 'hall1_node_b4', distanceM: 5, hall: 'Hall-1', aisleName: 'Central Grand Aisle Access', aisleWidth: '6.0M', pathwayId: 'hall1_central_grand_aisle' },
  { from: 'hall1_mid_c1', to: 'hall1_node_b4', distanceM: 4, hall: 'Hall-1', aisleName: 'Cross Aisle 1 Access', aisleWidth: '3.0M', pathwayId: 'hall1_cross_aisle_1' },

  { from: 'hall1_mid_c1', to: 'hall1_node_b5', distanceM: 5, hall: 'Hall-1', aisleName: 'Central Grand Aisle Access', aisleWidth: '6.0M', pathwayId: 'hall1_central_grand_aisle' },
  { from: 'hall1_mid_c2', to: 'hall1_node_b5', distanceM: 4, hall: 'Hall-1', aisleName: 'Cross Aisle 2 Access', aisleWidth: '3.0M', pathwayId: 'hall1_cross_aisle_2' },

  { from: 'hall1_mid_c2', to: 'hall1_node_b6', distanceM: 4, hall: 'Hall-1', aisleName: 'Cross Aisle 2 Access', aisleWidth: '3.0M', pathwayId: 'hall1_cross_aisle_2' },
  { from: 'hall1_mid_e', to: 'hall1_node_b6', distanceM: 5, hall: 'Hall-1', aisleName: 'East Perimeter Access', aisleWidth: '2.5M', pathwayId: 'hall1_east_perimeter' },

  { from: 'hall1_south_w', to: 'hall1_node_b7', distanceM: 5, hall: 'Hall-1', aisleName: 'South Promenade Access', aisleWidth: '6.0M', pathwayId: 'hall1_south_promenade' },
  { from: 'hall1_south_c1', to: 'hall1_node_b7', distanceM: 4, hall: 'Hall-1', aisleName: 'Cross Aisle 1 Access', aisleWidth: '3.0M', pathwayId: 'hall1_cross_aisle_1' },

  { from: 'hall1_south_c1', to: 'hall1_node_b8', distanceM: 5, hall: 'Hall-1', aisleName: 'Cross Aisle 1 Access', aisleWidth: '3.0M', pathwayId: 'hall1_cross_aisle_1' },
  { from: 'hall1_south_c2', to: 'hall1_node_b8', distanceM: 4, hall: 'Hall-1', aisleName: 'Cross Aisle 2 Access', aisleWidth: '3.0M', pathwayId: 'hall1_cross_aisle_2' },

  { from: 'hall1_south_c2', to: 'hall1_node_b9', distanceM: 4, hall: 'Hall-1', aisleName: 'Cross Aisle 2 Access', aisleWidth: '3.0M', pathwayId: 'hall1_cross_aisle_2' },
  { from: 'hall1_south_e', to: 'hall1_node_b9', distanceM: 5, hall: 'Hall-1', aisleName: 'East Perimeter Access', aisleWidth: '2.5M', pathwayId: 'hall1_east_perimeter' },

  { from: 'hall1_top_mid', to: 'hall1_node_top', distanceM: 3, hall: 'Hall-1', aisleName: 'North Perimeter Access', aisleWidth: '3.0M', pathwayId: 'hall1_top_perimeter' },
  { from: 'hall1_mid_e', to: 'hall1_node_east', distanceM: 3, hall: 'Hall-1', aisleName: 'East Perimeter Access', aisleWidth: '2.5M', pathwayId: 'hall1_east_perimeter' },
  { from: 'hall1_south_mid', to: 'hall1_node_south', distanceM: 3, hall: 'Hall-1', aisleName: 'South Promenade Access', aisleWidth: '6.0M', pathwayId: 'hall1_south_promenade' },
  { from: 'hall1_mid_w', to: 'hall1_node_west', distanceM: 3, hall: 'Hall-1', aisleName: 'West Perimeter Access', aisleWidth: '2.5M', pathwayId: 'hall1_west_perimeter' },

  // PASSAGE: Connecting Hall-1 and Hanger along exact horizontal axis Y: 450
  { from: 'hall1_west_passage_jct', to: 'passage_hall1_gate', distanceM: 2, hall: 'Passage', aisleName: 'Inter-Hall Covered Passage (2.5m)', aisleWidth: '2.5M', pathwayId: 'passage_covered_walkway' },
  { from: 'passage_hall1_gate', to: 'passage_mid', distanceM: 4, hall: 'Passage', aisleName: 'Inter-Hall Covered Passage (2.5m)', aisleWidth: '2.5M', pathwayId: 'passage_covered_walkway' },
  { from: 'passage_mid', to: 'passage_hanger_gate', distanceM: 4, hall: 'Passage', aisleName: 'Inter-Hall Covered Passage (2.5m)', aisleWidth: '2.5M', pathwayId: 'passage_covered_walkway' },
  { from: 'passage_hanger_gate', to: 'hanger_east_mid', distanceM: 1, hall: 'Hanger', aisleName: 'Hanger East Avenue Entry', aisleWidth: '3.0M', pathwayId: 'hanger_east_avenue' },

  // Hanger East corridor (3.0M Avenue along X: 690)
  { from: 'hanger_east_top', to: 'hanger_east_upper', distanceM: 8, hall: 'Hanger', aisleName: 'Hanger East Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_east_avenue' },
  { from: 'hanger_east_upper', to: 'hanger_east_mid', distanceM: 9, hall: 'Hanger', aisleName: 'Hanger East Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_east_avenue' },
  { from: 'hanger_east_mid', to: 'hanger_east_lower', distanceM: 10, hall: 'Hanger', aisleName: 'Hanger East Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_east_avenue' },
  { from: 'hanger_east_lower', to: 'hanger_east_bot', distanceM: 8, hall: 'Hanger', aisleName: 'Hanger East Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_east_avenue' },

  // Hanger Center corridor (3.0M Avenue along X: 470)
  { from: 'hanger_mid_top', to: 'hanger_mid_upper', distanceM: 8, hall: 'Hanger', aisleName: 'Hanger Central Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_central_avenue' },
  { from: 'hanger_mid_upper', to: 'hanger_mid_ramappa_n', distanceM: 6, hall: 'Hanger', aisleName: 'Hanger Central Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_central_avenue' },
  { from: 'hanger_mid_ramappa_n', to: 'hanger_mid_cross', distanceM: 3, hall: 'Hanger', aisleName: 'Hanger Central Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_central_avenue' },
  { from: 'hanger_mid_cross', to: 'hanger_mid_ramappa_s', distanceM: 3, hall: 'Hanger', aisleName: 'Hanger Central Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_central_avenue' },
  { from: 'hanger_mid_ramappa_s', to: 'hanger_mid_lower', distanceM: 7, hall: 'Hanger', aisleName: 'Hanger Central Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_central_avenue' },
  { from: 'hanger_mid_lower', to: 'hanger_mid_bot', distanceM: 8, hall: 'Hanger', aisleName: 'Hanger Central Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_central_avenue' },

  // Hanger West corridor (3.0M Avenue along X: 250)
  { from: 'hanger_west_top', to: 'hanger_west_upper', distanceM: 8, hall: 'Hanger', aisleName: 'Hanger West Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_west_avenue' },
  { from: 'hanger_west_upper', to: 'hanger_west_mid', distanceM: 9, hall: 'Hanger', aisleName: 'Hanger West Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_west_avenue' },
  { from: 'hanger_west_mid', to: 'hanger_west_lower', distanceM: 10, hall: 'Hanger', aisleName: 'Hanger West Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_west_avenue' },
  { from: 'hanger_west_lower', to: 'hanger_west_bot', distanceM: 8, hall: 'Hanger', aisleName: 'Hanger West Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_west_avenue' },

  // Hanger Outer West corridor (2.5M Perimeter along X: 110)
  { from: 'hanger_outer_top', to: 'hanger_outer_mid', distanceM: 16, hall: 'Hanger', aisleName: 'Hanger Outer West Walkway (2.5m)', aisleWidth: '2.5M', pathwayId: 'hanger_outer_west_perimeter' },
  { from: 'hanger_outer_mid', to: 'hanger_outer_bot', distanceM: 16, hall: 'Hanger', aisleName: 'Hanger Outer West Walkway (2.5m)', aisleWidth: '2.5M', pathwayId: 'hanger_outer_west_perimeter' },

  // Hanger Horizontal cross spines (Exact 90-degree alignment)
  { from: 'hanger_outer_top', to: 'hanger_west_top', distanceM: 7, hall: 'Hanger', aisleName: 'Hanger North Aisle (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_north_aisle' },
  { from: 'hanger_west_top', to: 'hanger_mid_top', distanceM: 11, hall: 'Hanger', aisleName: 'Hanger North Aisle (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_north_aisle' },
  { from: 'hanger_mid_top', to: 'hanger_east_top', distanceM: 11, hall: 'Hanger', aisleName: 'Hanger North Aisle (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_north_aisle' },

  { from: 'hanger_west_upper', to: 'hanger_mid_upper', distanceM: 11, hall: 'Hanger', aisleName: 'Hanger Upper Cross Aisle (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_upper_cross' },
  { from: 'hanger_mid_upper', to: 'hanger_east_upper', distanceM: 11, hall: 'Hanger', aisleName: 'Hanger Upper Cross Aisle (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_upper_cross' },

  { from: 'hanger_outer_mid', to: 'hanger_west_mid', distanceM: 7, hall: 'Hanger', aisleName: 'Hanger Mid Cross Connector (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_ramappa_north' },
  { from: 'hanger_west_mid', to: 'hanger_mid_cross', distanceM: 11, hall: 'Hanger', aisleName: 'Hanger Mid Cross Connector (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_ramappa_north' },
  { from: 'hanger_mid_cross', to: 'hanger_east_mid', distanceM: 11, hall: 'Hanger', aisleName: 'Hanger Mid Cross Connector (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_ramappa_north' },

  { from: 'hanger_west_lower', to: 'hanger_mid_lower', distanceM: 11, hall: 'Hanger', aisleName: 'Hanger Lower Cross Aisle (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_lower_cross' },
  { from: 'hanger_mid_lower', to: 'hanger_east_lower', distanceM: 11, hall: 'Hanger', aisleName: 'Hanger Lower Cross Aisle (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_lower_cross' },

  { from: 'hanger_outer_bot', to: 'hanger_west_bot', distanceM: 7, hall: 'Hanger', aisleName: 'Hanger South Promenade (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_south_promenade' },
  { from: 'hanger_west_bot', to: 'hanger_mid_bot', distanceM: 11, hall: 'Hanger', aisleName: 'Hanger South Promenade (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_south_promenade' },
  { from: 'hanger_mid_bot', to: 'hanger_east_bot', distanceM: 11, hall: 'Hanger', aisleName: 'Hanger South Promenade (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_south_promenade' },

  // Hanger Booth Access Connections
  { from: 'hanger_west_upper', to: 'hanger_node_b1', distanceM: 4, hall: 'Hanger', aisleName: 'Hanger Upper Cross Access', aisleWidth: '3.0M', pathwayId: 'hanger_upper_cross' },
  { from: 'hanger_mid_upper', to: 'hanger_node_b2', distanceM: 5, hall: 'Hanger', aisleName: 'Hanger Upper Cross Access', aisleWidth: '3.0M', pathwayId: 'hanger_upper_cross' },
  { from: 'hanger_east_upper', to: 'hanger_node_b3', distanceM: 4, hall: 'Hanger', aisleName: 'Hanger East Avenue Access', aisleWidth: '3.0M', pathwayId: 'hanger_east_avenue' },

  { from: 'hanger_west_mid', to: 'hanger_node_b4', distanceM: 4, hall: 'Hanger', aisleName: 'Temple North Promenade Access', aisleWidth: '4.0M', pathwayId: 'hanger_ramappa_north' },
  { from: 'hanger_mid_ramappa_n', to: 'hanger_node_b5', distanceM: 5, hall: 'Hanger', aisleName: 'Temple North Promenade Access', aisleWidth: '4.0M', pathwayId: 'hanger_ramappa_north' },
  { from: 'hanger_east_mid', to: 'hanger_node_b6', distanceM: 5, hall: 'Hanger', aisleName: 'Hanger East Avenue Access', aisleWidth: '3.0M', pathwayId: 'hanger_east_avenue' },

  { from: 'hanger_west_lower', to: 'hanger_node_b8', distanceM: 5, hall: 'Hanger', aisleName: 'Hanger Lower Cross Access', aisleWidth: '3.0M', pathwayId: 'hanger_lower_cross' },
  { from: 'hanger_mid_lower', to: 'hanger_node_b8', distanceM: 5, hall: 'Hanger', aisleName: 'Hanger Lower Cross Access', aisleWidth: '3.0M', pathwayId: 'hanger_lower_cross' },
  { from: 'hanger_east_lower', to: 'hanger_node_b9', distanceM: 5, hall: 'Hanger', aisleName: 'Hanger East Avenue Access', aisleWidth: '3.0M', pathwayId: 'hanger_east_avenue' },

  { from: 'hanger_west_bot', to: 'hanger_node_b10', distanceM: 4, hall: 'Hanger', aisleName: 'Hanger South Promenade Access', aisleWidth: '3.0M', pathwayId: 'hanger_south_promenade' },
  { from: 'hanger_mid_bot', to: 'hanger_node_b11', distanceM: 4, hall: 'Hanger', aisleName: 'Hanger South Promenade Access', aisleWidth: '3.0M', pathwayId: 'hanger_south_promenade' },
  { from: 'hanger_east_bot', to: 'hanger_node_b12', distanceM: 4, hall: 'Hanger', aisleName: 'Hanger East Avenue Access', aisleWidth: '3.0M', pathwayId: 'hanger_east_avenue' },

  { from: 'hanger_mid_top', to: 'hanger_node_north', distanceM: 3, hall: 'Hanger', aisleName: 'Hanger North Aisle Access', aisleWidth: '3.0M', pathwayId: 'hanger_north_aisle' },
  { from: 'hanger_east_mid', to: 'hanger_node_east', distanceM: 3, hall: 'Hanger', aisleName: 'Hanger East Avenue Access', aisleWidth: '3.0M', pathwayId: 'hanger_east_avenue' },
  { from: 'hanger_mid_bot', to: 'hanger_node_south', distanceM: 3, hall: 'Hanger', aisleName: 'Hanger South Promenade Access', aisleWidth: '3.0M', pathwayId: 'hanger_south_promenade' },
  { from: 'hanger_outer_mid', to: 'hanger_node_west', distanceM: 3, hall: 'Hanger', aisleName: 'Outer West Walkway Access', aisleWidth: '2.5M', pathwayId: 'hanger_outer_west_perimeter' },

  // Service Counter Access Edges
  { from: 'counter_reg_1_8', to: 'entrance_hall1', distanceM: 4, hall: 'Hall-1', aisleName: 'Main Foyer Registration Area', aisleWidth: '6.0M', pathwayId: 'hall1_foyer_entrance' },
  { from: 'counter_helpdesk', to: 'entrance_hall1', distanceM: 4, hall: 'Hall-1', aisleName: 'Main Foyer Information Desk', aisleWidth: '6.0M', pathwayId: 'hall1_foyer_entrance' },
  { from: 'counter_vip', to: 'hall1_south_w', distanceM: 5, hall: 'Hall-1', aisleName: 'South Promenade VIP Corridor', aisleWidth: '6.0M', pathwayId: 'hall1_south_promenade' },
  { from: 'counter_firstaid', to: 'hall1_south_mid', distanceM: 5, hall: 'Hall-1', aisleName: 'South Promenade Medical Access', aisleWidth: '6.0M', pathwayId: 'hall1_south_promenade' },
  { from: 'counter_media', to: 'hall1_south_e', distanceM: 5, hall: 'Hall-1', aisleName: 'South Promenade Media Corridor', aisleWidth: '6.0M', pathwayId: 'hall1_south_promenade' },
  { from: 'counter_committee', to: 'hall1_south_w', distanceM: 4, hall: 'Hall-1', aisleName: 'Committee Office Entrance', aisleWidth: '6.0M', pathwayId: 'hall1_south_promenade' },
  { from: 'counter_ramappa', to: 'hanger_mid_ramappa_n', distanceM: 3, hall: 'Hanger', aisleName: 'Ramappa Temple North Access', aisleWidth: '4.0M', pathwayId: 'hanger_ramappa_north' },
  { from: 'counter_food_court', to: 'hanger_outer_bot', distanceM: 5, hall: 'Hanger', aisleName: 'Outdoor Dining Lawn Pathway', aisleWidth: '3.0M', pathwayId: 'hanger_south_promenade' },
  { from: 'counter_restrooms_hall1', to: 'hall1_south_e', distanceM: 4, hall: 'Hall-1', aisleName: 'Hall-1 Restrooms Access', aisleWidth: '2.5M', pathwayId: 'hall1_east_perimeter' },
  { from: 'counter_restrooms_hanger', to: 'hanger_outer_top', distanceM: 4, hall: 'Hanger', aisleName: 'Hanger Restrooms Access', aisleWidth: '2.5M', pathwayId: 'hanger_outer_west_perimeter' },
];

export type RouteStep = {
  stepIndex: number;
  instruction: string;
  turnType: 'start' | 'straight' | 'left' | 'right' | 'passage' | 'arrive';
  aisleName: string;
  aisleWidth: string;
  fromNodeId: string;
  toNodeId: string;
  distanceM: number;
  cumulativeDistanceM: number;
  hall: 'Hall-1' | 'Hanger' | 'Passage';
  pathwayId?: string;
};

export type RoutePath = {
  nodes: NavNode[];
  distanceMeters: number;
  walkingMinutes: number;
  directions: string[];
  steps: RouteStep[];
  pathwayIds: string[];
};

export type TargetDestination = {
  id: string;
  companyName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hall: string;
};

export type Corridor =
  | { name: string; axis: 'h'; y: number; xMin: number; xMax: number; pathwayId: string }
  | { name: string; axis: 'v'; x: number; yMin: number; yMax: number; pathwayId: string };

// Major orthogonal walkable corridors
const HALL1_CORRIDORS: Corridor[] = [
  { name: 'Hall-1 North Perimeter Walkway (3.0m)', axis: 'h', y: 140, xMin: 890, xMax: 1450, pathwayId: 'hall1_top_perimeter' },
  { name: 'Hall-1 North Grand Aisle (6.0m)', axis: 'h', y: 320, xMin: 890, xMax: 1450, pathwayId: 'hall1_north_grand_aisle' },
  { name: 'Hall-1 Central Grand Aisle (6.0m)', axis: 'h', y: 520, xMin: 890, xMax: 1450, pathwayId: 'hall1_central_grand_aisle' },
  { name: 'Hall-1 South Promenade (6.0m)', axis: 'h', y: 740, xMin: 890, xMax: 1450, pathwayId: 'hall1_south_promenade' },
  { name: 'Hall-1 West Perimeter Walkway (2.5m)', axis: 'v', x: 890, yMin: 140, yMax: 740, pathwayId: 'hall1_west_perimeter' },
  { name: 'Hall-1 Cross Aisle 1 (3.0m)', axis: 'v', x: 1070, yMin: 140, yMax: 740, pathwayId: 'hall1_cross_aisle_1' },
  { name: 'Hall-1 Central Grand Aisle (6.0m)', axis: 'v', x: 1200, yMin: 140, yMax: 760, pathwayId: 'hall1_central_grand_aisle' },
  { name: 'Hall-1 Cross Aisle 2 (3.0m)', axis: 'v', x: 1270, yMin: 140, yMax: 740, pathwayId: 'hall1_cross_aisle_2' },
  { name: 'Hall-1 East Perimeter Walkway (2.5m)', axis: 'v', x: 1450, yMin: 140, yMax: 740, pathwayId: 'hall1_east_perimeter' },
];

const HANGER_CORRIDORS: Corridor[] = [
  { name: 'Hanger North Aisle (3.0m)', axis: 'h', y: 140, xMin: 110, xMax: 690, pathwayId: 'hanger_north_aisle' },
  { name: 'Hanger Upper Cross Aisle (3.0m)', axis: 'h', y: 270, xMin: 110, xMax: 690, pathwayId: 'hanger_upper_cross' },
  { name: 'Hanger Passage Cross Aisle (3.0m)', axis: 'h', y: 450, xMin: 110, xMax: 690, pathwayId: 'hanger_ramappa_north' },
  { name: 'Hanger Lower Cross Aisle (3.0m)', axis: 'h', y: 640, xMin: 110, xMax: 690, pathwayId: 'hanger_lower_cross' },
  { name: 'Hanger South Promenade (3.0m)', axis: 'h', y: 760, xMin: 110, xMax: 690, pathwayId: 'hanger_south_promenade' },
  { name: 'Hanger Outer West Walkway (2.5m)', axis: 'v', x: 110, yMin: 140, yMax: 760, pathwayId: 'hanger_outer_west_perimeter' },
  { name: 'Hanger West Avenue (3.0m)', axis: 'v', x: 250, yMin: 140, yMax: 760, pathwayId: 'hanger_west_avenue' },
  { name: 'Hanger Central Avenue (3.0m)', axis: 'v', x: 470, yMin: 140, yMax: 760, pathwayId: 'hanger_central_avenue' },
  { name: 'Hanger East Avenue (3.0m)', axis: 'v', x: 690, yMin: 140, yMax: 760, pathwayId: 'hanger_east_avenue' },
];

function projectToNearestCorridor(cx: number, cy: number, hall: string) {
  const corridors: Corridor[] = hall === 'Hanger' ? HANGER_CORRIDORS : HALL1_CORRIDORS;
  let best: Corridor = corridors[0];
  let px = cx;
  let py = cy;
  let minDist = Infinity;
  for (const c of corridors) {
    let testX: number;
    let testY: number;
    if (c.axis === 'h') {
      testX = Math.max(c.xMin, Math.min(c.xMax, cx));
      testY = c.y;
    } else {
      testX = c.x;
      testY = Math.max(c.yMin, Math.min(c.yMax, cy));
    }
    const dist = Math.hypot(cx - testX, cy - testY);
    if (dist < minDist) {
      minDist = dist;
      best = c;
      px = testX;
      py = testY;
    }
  }
  return { corridor: best, px: Math.round(px), py: Math.round(py), dist: minDist };
}

function findNearestGraphNodeOnCorridor(doorX: number, doorY: number, corridor: Corridor, hall: 'Hall-1' | 'Hanger'): NavNode {
  let bestNode: NavNode | null = null;
  let minDist = Infinity;

  for (const id in VENUE_NODES) {
    const n = VENUE_NODES[id];
    if (n.hall !== hall && n.hall !== 'Passage') continue;
    if (n.type !== 'aisle') continue;

    let onCorridor = false;
    if (corridor.axis === 'h') {
      onCorridor = Math.abs(n.y - corridor.y) <= 15;
    } else {
      onCorridor = Math.abs(n.x - corridor.x) <= 15;
    }

    if (onCorridor) {
      const dist = Math.hypot(n.x - doorX, n.y - doorY);
      if (dist < minDist) {
        minDist = dist;
        bestNode = n;
      }
    }
  }

  return bestNode || (hall === 'Hanger' ? VENUE_NODES.hanger_east_mid : VENUE_NODES.hall1_south_mid);
}

// Clean corridor name for user-friendly speech & directions
function cleanAisleLabel(name: string): string {
  if (!name) return 'Walkway';
  return name
    .replace(/\s*\([0-9.]+m\)/gi, '')
    .replace(/\s*\([0-9.]+M\)/gi, '')
    .trim();
}

export function findShortestPath(
  startNodeId: string,
  destNodeId: string,
  targetExhibitor?: TargetDestination | null
): RoutePath | null {
  const startNode = VENUE_NODES[startNodeId];
  if (!startNode) return null;

  let effectiveTargetNodeId = destNodeId;
  let doorX: number | null = null;
  let doorY: number | null = null;
  let stallCenterX: number | null = null;
  let stallCenterY: number | null = null;
  let accessCorridor: any = null;

  if (targetExhibitor && typeof targetExhibitor.x === 'number') {
    stallCenterX = Math.round(targetExhibitor.x + targetExhibitor.width / 2);
    stallCenterY = Math.round(targetExhibitor.y + targetExhibitor.height / 2);
    const hall = (targetExhibitor.hall === 'Hanger' ? 'Hanger' : 'Hall-1') as 'Hall-1' | 'Hanger';
    const proj = projectToNearestCorridor(stallCenterX, stallCenterY, hall);
    doorX = proj.px;
    doorY = proj.py;
    accessCorridor = proj.corridor;

    const anchorNode = findNearestGraphNodeOnCorridor(doorX, doorY, accessCorridor, hall);
    if (anchorNode) {
      effectiveTargetNodeId = anchorNode.id;
    }
  }

  if (!VENUE_NODES[effectiveTargetNodeId]) {
    effectiveTargetNodeId = destNodeId;
  }

  // Dijkstra graph search
  const adj: Record<string, { node: string; weight: number; edge: NavEdge }[]> = {};
  for (const edge of VENUE_EDGES) {
    if (
      VENUE_NODES[edge.from]?.type === 'booth_access' ||
      VENUE_NODES[edge.to]?.type === 'booth_access'
    ) {
      continue;
    }
    if (!adj[edge.from]) adj[edge.from] = [];
    if (!adj[edge.to]) adj[edge.to] = [];
    adj[edge.from].push({ node: edge.to, weight: edge.distanceM, edge });
    adj[edge.to].push({ node: edge.from, weight: edge.distanceM, edge });
  }

  const distances: Record<string, number> = {};
  const previous: Record<string, { from: string; edge: NavEdge } | null> = {};
  const unvisited = new Set<string>();

  for (const id in VENUE_NODES) {
    distances[id] = Infinity;
    previous[id] = null;
    unvisited.add(id);
  }
  distances[startNodeId] = 0;

  while (unvisited.size > 0) {
    let current: string | null = null;
    let minDistance = Infinity;

    unvisited.forEach((node) => {
      if (distances[node] < minDistance) {
        minDistance = distances[node];
        current = node;
      }
    });

    if (current === null || distances[current] === Infinity) break;
    if (current === effectiveTargetNodeId) break;

    unvisited.delete(current);

    for (const neighbor of adj[current] || []) {
      if (!unvisited.has(neighbor.node)) continue;
      const alt = distances[current] + neighbor.weight;
      if (alt < distances[neighbor.node]) {
        distances[neighbor.node] = alt;
        previous[neighbor.node] = { from: current, edge: neighbor.edge };
      }
    }
  }

  // Backtrack graph path
  const pathIds: string[] = [];
  const edgesTaken: NavEdge[] = [];
  let curr: string | null = effectiveTargetNodeId;
  while (curr && curr !== startNodeId) {
    pathIds.unshift(curr);
    const prevInfo: { from: string; edge: NavEdge } | null = previous[curr] || null;
    if (prevInfo) {
      edgesTaken.unshift(prevInfo.edge);
      curr = prevInfo.from;
    } else {
      break;
    }
  }

  if (curr === startNodeId) {
    pathIds.unshift(startNodeId);
  } else {
    // Fallback: connect start to destination
    pathIds.length = 0;
    pathIds.push(startNodeId, effectiveTargetNodeId);
  }

  const nodes: NavNode[] = pathIds.map((id) => VENUE_NODES[id]).filter(Boolean);
  const traversedPathwayIds = new Set<string>();
  edgesTaken.forEach((e) => {
    if (e.pathwayId) traversedPathwayIds.add(e.pathwayId);
  });

  // Append orthogonal doorway and destination booth nodes if routing to an exhibitor
  if (targetExhibitor && stallCenterX !== null && stallCenterY !== null && accessCorridor) {
    const lastNode = nodes[nodes.length - 1];
    const hall = (targetExhibitor.hall === 'Hanger' ? 'Hanger' : 'Hall-1') as 'Hall-1' | 'Hanger';

    if (accessCorridor.pathwayId) {
      traversedPathwayIds.add(accessCorridor.pathwayId);
    }

    if (accessCorridor.axis === 'h') {
      // 1. Move horizontally along corridor to stall's x coordinate
      if (lastNode.x !== stallCenterX) {
        nodes.push({
          id: 'doorway_' + targetExhibitor.id,
          label: cleanAisleLabel(accessCorridor.name),
          x: stallCenterX,
          y: accessCorridor.y,
          hall,
          type: 'aisle',
        });
      }
      // 2. Step vertically into stall center
      if (accessCorridor.y !== stallCenterY) {
        nodes.push({
          id: 'dest_' + targetExhibitor.id,
          label: targetExhibitor.companyName,
          x: stallCenterX,
          y: stallCenterY,
          hall,
          type: 'booth_access',
        });
      }
    } else {
      // 1. Move vertically along corridor to stall's y coordinate
      if (lastNode.y !== stallCenterY) {
        nodes.push({
          id: 'doorway_' + targetExhibitor.id,
          label: cleanAisleLabel(accessCorridor.name),
          x: accessCorridor.x,
          y: stallCenterY,
          hall,
          type: 'aisle',
        });
      }
      // 2. Step horizontally into stall center
      if (accessCorridor.x !== stallCenterX) {
        nodes.push({
          id: 'dest_' + targetExhibitor.id,
          label: targetExhibitor.companyName,
          x: stallCenterX,
          y: stallCenterY,
          hall,
          type: 'booth_access',
        });
      }
    }
  }

  // Calculate total path distance accurately in meters (scale ~ 0.08 m per pixel)
  let totalMeters = 0;
  for (let i = 0; i < nodes.length - 1; i++) {
    const segDistPx = Math.hypot(nodes[i + 1].x - nodes[i].x, nodes[i + 1].y - nodes[i].y);
    totalMeters += segDistPx * 0.08;
  }
  totalMeters = Math.max(12, Math.round(totalMeters));
  const walkingMinutes = Math.max(1, Math.round((totalMeters / 60) * 10) / 10);

  // Generate turn steps with directional step consolidation (no repeating micro-steps, no empty ())
  type RawStep = {
    turnType: 'start' | 'straight' | 'left' | 'right' | 'passage' | 'arrive';
    label: string;
    distanceM: number;
    hall: 'Hall-1' | 'Hanger' | 'Passage';
    dir: 'N' | 'S' | 'E' | 'W';
    isLast: boolean;
  };

  const rawSteps: RawStep[] = [];

  for (let i = 0; i < nodes.length - 1; i++) {
    const fromN = nodes[i];
    const toN = nodes[i + 1];
    const isFirst = i === 0;
    const isLast = i === nodes.length - 2;

    const dx = toN.x - fromN.x;
    const dy = toN.y - fromN.y;
    const dir: 'N' | 'S' | 'E' | 'W' = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N');
    const segDist = Math.max(2, Math.round(Math.hypot(dx, dy) * 0.08));

    let turnType: 'start' | 'straight' | 'left' | 'right' | 'passage' | 'arrive' = 'straight';

    if (isLast) {
      turnType = 'arrive';
    } else if (toN.hall === 'Passage' || fromN.hall === 'Passage') {
      turnType = 'passage';
    } else if (isFirst) {
      turnType = 'start';
    } else {
      const prevN = nodes[i - 1];
      const dx1 = fromN.x - prevN.x;
      const dy1 = fromN.y - prevN.y;
      const cross = dx1 * dy - dy1 * dx;
      if (Math.abs(cross) > 200) {
        turnType = cross > 0 ? 'right' : 'left';
      }
    }

    rawSteps.push({
      turnType,
      label: toN.label,
      distanceM: segDist,
      hall: toN.hall,
      dir,
      isLast,
    });
  }

  // Consolidate consecutive steps that move along the same straight direction
  const consolidatedSteps: RouteStep[] = [];
  const directions: string[] = [];
  let cumM = 0;

  for (let i = 0; i < rawSteps.length; i++) {
    const curr = rawSteps[i];
    let stepDist = curr.distanceM;
    let label = curr.label;

    while (
      i + 1 < rawSteps.length &&
      !curr.isLast &&
      !rawSteps[i + 1].isLast &&
      rawSteps[i + 1].dir === curr.dir &&
      (rawSteps[i + 1].hall === curr.hall || curr.hall === 'Passage' || rawSteps[i + 1].hall === 'Passage')
    ) {
      stepDist += rawSteps[i + 1].distanceM;
      label = rawSteps[i + 1].label;
      i++;
    }

    cumM += stepDist;

    let instruction = '';
    const cleanLabel = cleanAisleLabel(label);

    if (curr.turnType === 'start') {
      instruction = `Head straight along ${cleanLabel || 'Main Entrance Walkway'} (${stepDist} m)`;
    } else if (curr.turnType === 'left') {
      instruction = `Turn left onto ${cleanLabel || 'Walkway'} (${stepDist} m)`;
    } else if (curr.turnType === 'right') {
      instruction = `Turn right onto ${cleanLabel || 'Walkway'} (${stepDist} m)`;
    } else if (curr.turnType === 'passage') {
      instruction = `Walk through Inter-Hall Covered Passage to Hanger (${stepDist} m)`;
    } else if (curr.turnType === 'arrive') {
      const destName = targetExhibitor ? targetExhibitor.companyName : cleanLabel;
      instruction = `Arrive at ${destName} on your right (${stepDist} m)`;
    } else {
      instruction = `Continue along ${cleanLabel || 'Corridor'} (${stepDist} m)`;
    }

    consolidatedSteps.push({
      stepIndex: consolidatedSteps.length + 1,
      instruction,
      turnType: curr.turnType,
      aisleName: cleanLabel,
      aisleWidth: curr.turnType === 'passage' ? '2.5M' : '4.0M',
      fromNodeId: nodes[0].id,
      toNodeId: nodes[nodes.length - 1].id,
      distanceM: stepDist,
      cumulativeDistanceM: cumM,
      hall: curr.hall,
    });

    directions.push(instruction);
  }

  return {
    nodes,
    distanceMeters: totalMeters,
    walkingMinutes,
    directions,
    steps: consolidatedSteps,
    pathwayIds: Array.from(traversedPathwayIds),
  };
}
