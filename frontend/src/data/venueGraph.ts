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

  // Hall-1 Upper Corridor (Y: 320)
  hall1_north_w: { id: 'hall1_north_w', label: 'Hall-1 West Corridor (North)', x: 890, y: 320, hall: 'Hall-1', type: 'aisle' },
  hall1_north_c1: { id: 'hall1_north_c1', label: 'Hall-1 North Junction 1', x: 1070, y: 320, hall: 'Hall-1', type: 'aisle' },
  hall1_north_c2: { id: 'hall1_north_c2', label: 'Hall-1 North Junction 2', x: 1270, y: 320, hall: 'Hall-1', type: 'aisle' },
  hall1_north_e: { id: 'hall1_north_e', label: 'Hall-1 East Corridor (North)', x: 1450, y: 320, hall: 'Hall-1', type: 'aisle' },

  // Hall-1 Top Perimeter (Y: 140)
  hall1_top_w: { id: 'hall1_top_w', label: 'Hall-1 Top Perimeter West', x: 890, y: 140, hall: 'Hall-1', type: 'aisle' },
  hall1_top_mid: { id: 'hall1_top_mid', label: 'Hall-1 Top Perimeter Center', x: 1200, y: 140, hall: 'Hall-1', type: 'aisle' },
  hall1_top_e: { id: 'hall1_top_e', label: 'Hall-1 Top Perimeter East', x: 1450, y: 140, hall: 'Hall-1', type: 'aisle' },

  // Connecting Passage
  passage_hall1_gate: { id: 'passage_hall1_gate', label: 'Hall-1 Passage Entrance', x: 860, y: 450, hall: 'Passage', type: 'passage' },
  passage_mid: { id: 'passage_mid', label: 'Inter-Hall Connecting Passage', x: 780, y: 450, hall: 'Passage', type: 'passage' },
  passage_hanger_gate: { id: 'passage_hanger_gate', label: 'Hanger Passage Entrance', x: 700, y: 450, hall: 'Passage', type: 'passage' },

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

  // Hall-1 Vertical spines
  { from: 'hall1_south_w', to: 'hall1_mid_w', distanceM: 11, hall: 'Hall-1', aisleName: 'Hall-1 West Perimeter Walkway (2.5m)', aisleWidth: '2.5M', pathwayId: 'hall1_west_perimeter' },
  { from: 'hall1_mid_w', to: 'hall1_north_w', distanceM: 10, hall: 'Hall-1', aisleName: 'Hall-1 West Perimeter Walkway (2.5m)', aisleWidth: '2.5M', pathwayId: 'hall1_west_perimeter' },
  { from: 'hall1_north_w', to: 'hall1_top_w', distanceM: 9, hall: 'Hall-1', aisleName: 'Hall-1 West Perimeter Walkway (2.5m)', aisleWidth: '2.5M', pathwayId: 'hall1_west_perimeter' },

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

  // PASSAGE: Connecting Hall-1 and Hanger (2.5M Covered Passage)
  { from: 'hall1_mid_w', to: 'passage_hall1_gate', distanceM: 5, hall: 'Passage', aisleName: 'Inter-Hall Passage (2.5m)', aisleWidth: '2.5M', pathwayId: 'passage_covered_walkway' },
  { from: 'passage_hall1_gate', to: 'passage_mid', distanceM: 6, hall: 'Passage', aisleName: 'Inter-Hall Passage (2.5m)', aisleWidth: '2.5M', pathwayId: 'passage_covered_walkway' },
  { from: 'passage_mid', to: 'passage_hanger_gate', distanceM: 6, hall: 'Passage', aisleName: 'Inter-Hall Passage (2.5m)', aisleWidth: '2.5M', pathwayId: 'passage_covered_walkway' },
  { from: 'passage_hanger_gate', to: 'hanger_east_mid', distanceM: 4, hall: 'Hanger', aisleName: 'Hanger East Avenue Entry', aisleWidth: '3.0M', pathwayId: 'hanger_east_avenue' },

  // Hanger East corridor (3.0M Avenue)
  { from: 'hanger_east_top', to: 'hanger_east_upper', distanceM: 8, hall: 'Hanger', aisleName: 'Hanger East Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_east_avenue' },
  { from: 'hanger_east_upper', to: 'hanger_east_mid', distanceM: 9, hall: 'Hanger', aisleName: 'Hanger East Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_east_avenue' },
  { from: 'hanger_east_mid', to: 'hanger_east_lower', distanceM: 10, hall: 'Hanger', aisleName: 'Hanger East Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_east_avenue' },
  { from: 'hanger_east_lower', to: 'hanger_east_bot', distanceM: 8, hall: 'Hanger', aisleName: 'Hanger East Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_east_avenue' },

  // Hanger Center corridor (3.0M / 4.0M Avenue around Ramappa Temple)
  { from: 'hanger_mid_top', to: 'hanger_mid_upper', distanceM: 8, hall: 'Hanger', aisleName: 'Hanger Central Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_central_avenue' },
  { from: 'hanger_mid_upper', to: 'hanger_mid_ramappa_n', distanceM: 6, hall: 'Hanger', aisleName: 'Ramappa Temple North Promenade (4.0m)', aisleWidth: '4.0M', pathwayId: 'hanger_ramappa_north' },
  { from: 'hanger_mid_ramappa_n', to: 'hanger_mid_ramappa_s', distanceM: 6, hall: 'Hanger', aisleName: 'Ramappa Temple Central Axis', aisleWidth: '4.0M', pathwayId: 'hanger_central_avenue' },
  { from: 'hanger_mid_ramappa_s', to: 'hanger_mid_lower', distanceM: 7, hall: 'Hanger', aisleName: 'Ramappa Temple South Promenade (4.0m)', aisleWidth: '4.0M', pathwayId: 'hanger_ramappa_south' },
  { from: 'hanger_mid_lower', to: 'hanger_mid_bot', distanceM: 8, hall: 'Hanger', aisleName: 'Hanger Central Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_central_avenue' },

  // Hanger West corridor (3.0M Avenue)
  { from: 'hanger_west_top', to: 'hanger_west_upper', distanceM: 8, hall: 'Hanger', aisleName: 'Hanger West Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_west_avenue' },
  { from: 'hanger_west_upper', to: 'hanger_west_mid', distanceM: 9, hall: 'Hanger', aisleName: 'Hanger West Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_west_avenue' },
  { from: 'hanger_west_mid', to: 'hanger_west_lower', distanceM: 10, hall: 'Hanger', aisleName: 'Hanger West Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_west_avenue' },
  { from: 'hanger_west_lower', to: 'hanger_west_bot', distanceM: 8, hall: 'Hanger', aisleName: 'Hanger West Avenue (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_west_avenue' },

  // Hanger Outer West corridor (2.5M Perimeter)
  { from: 'hanger_outer_top', to: 'hanger_outer_mid', distanceM: 16, hall: 'Hanger', aisleName: 'Hanger Outer West Walkway (2.5m)', aisleWidth: '2.5M', pathwayId: 'hanger_outer_west_perimeter' },
  { from: 'hanger_outer_mid', to: 'hanger_outer_bot', distanceM: 16, hall: 'Hanger', aisleName: 'Hanger Outer West Walkway (2.5m)', aisleWidth: '2.5M', pathwayId: 'hanger_outer_west_perimeter' },

  // Hanger Horizontal cross spines
  { from: 'hanger_outer_top', to: 'hanger_west_top', distanceM: 7, hall: 'Hanger', aisleName: 'Hanger North Aisle (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_north_aisle' },
  { from: 'hanger_west_top', to: 'hanger_mid_top', distanceM: 11, hall: 'Hanger', aisleName: 'Hanger North Aisle (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_north_aisle' },
  { from: 'hanger_mid_top', to: 'hanger_east_top', distanceM: 11, hall: 'Hanger', aisleName: 'Hanger North Aisle (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_north_aisle' },

  { from: 'hanger_west_upper', to: 'hanger_mid_upper', distanceM: 11, hall: 'Hanger', aisleName: 'Hanger Upper Cross Aisle (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_upper_cross' },
  { from: 'hanger_mid_upper', to: 'hanger_east_upper', distanceM: 11, hall: 'Hanger', aisleName: 'Hanger Upper Cross Aisle (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_upper_cross' },

  { from: 'hanger_outer_mid', to: 'hanger_west_mid', distanceM: 7, hall: 'Hanger', aisleName: 'Hanger Mid Cross Connector (3.0m)', aisleWidth: '3.0M', pathwayId: 'hanger_ramappa_north' },
  { from: 'hanger_west_mid', to: 'passage_hanger_gate', distanceM: 22, hall: 'Hanger', aisleName: 'Ramappa North Promenade (4.0m)', aisleWidth: '4.0M', pathwayId: 'hanger_ramappa_north' },

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

// Dijkstra shortest-path router
export type RoutePath = {
  nodes: NavNode[];
  distanceMeters: number;
  walkingMinutes: number;
  directions: string[];
  steps: RouteStep[];
  pathwayIds: string[];
};

export function findShortestPath(startNodeId: string, destNodeId: string): RoutePath | null {
  if (!VENUE_NODES[startNodeId] || !VENUE_NODES[destNodeId]) {
    return null;
  }

  const adj: Record<string, { node: string; weight: number; edge: NavEdge }[]> = {};
  for (const edge of VENUE_EDGES) {
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

    for (const node of unvisited) {
      if (distances[node] < minDistance) {
        minDistance = distances[node];
        current = node;
      }
    }

    if (current === null || distances[current] === Infinity) break;
    if (current === destNodeId) break;

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

  // Backtrack path
  const pathIds: string[] = [];
  const edgesTaken: NavEdge[] = [];
  let curr: string | null = destNodeId;
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
    return null; // unreachable
  }

  const nodes = pathIds.map((id) => VENUE_NODES[id]);
  const totalMeters = distances[destNodeId];
  const minutes = Math.max(1, Math.round((totalMeters / 65) * 10) / 10); // ~1.1 m/s walking speed

  // Generate enriched steps with geometry-based turn directions
  const steps: RouteStep[] = [];
  const directions: string[] = [];
  const traversedPathwayIds = new Set<string>();
  let cumDistance = 0;

  // Step 0: Start
  steps.push({
    stepIndex: 1,
    instruction: `Start at ${nodes[0].label}`,
    turnType: 'start',
    aisleName: nodes[0].hall === 'Passage' ? 'Inter-Hall Passage' : `${nodes[0].hall} Main Floor`,
    aisleWidth: nodes[0].hall === 'Passage' ? '2.5M' : '6.0M',
    fromNodeId: nodes[0].id,
    toNodeId: nodes[0].id,
    distanceM: 0,
    cumulativeDistanceM: 0,
    hall: nodes[0].hall,
  });
  directions.push(`Start at ${nodes[0].label}`);

  for (let i = 0; i < edgesTaken.length; i++) {
    const edge = edgesTaken[i];
    const fromNode = nodes[i];
    const toNode = nodes[i + 1];
    cumDistance += edge.distanceM;

    if (edge.pathwayId) {
      traversedPathwayIds.add(edge.pathwayId);
    }

    let turnType: 'start' | 'straight' | 'left' | 'right' | 'passage' | 'arrive' = 'straight';
    let turnVerb = 'Continue straight';

    if (i === edgesTaken.length - 1) {
      turnType = 'arrive';
      turnVerb = 'Arrive at destination';
    } else if (toNode.type === 'passage' || fromNode.type === 'passage') {
      turnType = 'passage';
      turnVerb = 'Enter 2.5m Covered Connecting Passage';
    } else if (i > 0) {
      // Calculate 2D turn angle
      const prevNode = nodes[i - 1];
      const dx1 = fromNode.x - prevNode.x;
      const dy1 = fromNode.y - prevNode.y;
      const dx2 = toNode.x - fromNode.x;
      const dy2 = toNode.y - fromNode.y;

      const cross = dx1 * dy2 - dy1 * dx2;
      const dot = dx1 * dx2 + dy1 * dy2;

      if (Math.abs(cross) > 200) {
        if (cross > 0) {
          turnType = 'right';
          turnVerb = 'Turn right';
        } else {
          turnType = 'left';
          turnVerb = 'Turn left';
        }
      } else if (dot < 0) {
        turnType = 'left';
        turnVerb = 'Turn around';
      }
    }

    let instruction = '';
    if (turnType === 'arrive') {
      instruction = `Arrive at ${toNode.label}`;
    } else if (turnType === 'passage') {
      instruction = `Cross Inter-Hall Covered Passage (${edge.aisleWidth}) between Hall-1 and Hanger (${edge.distanceM}m)`;
    } else {
      instruction = `${turnVerb} onto ${edge.aisleName} for ${edge.distanceM}m`;
    }

    steps.push({
      stepIndex: steps.length + 1,
      instruction,
      turnType,
      aisleName: edge.aisleName,
      aisleWidth: edge.aisleWidth,
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      distanceM: edge.distanceM,
      cumulativeDistanceM: Math.round(cumDistance),
      hall: edge.hall,
      pathwayId: edge.pathwayId,
    });

    directions.push(instruction);
  }

  return {
    nodes,
    distanceMeters: Math.round(totalMeters),
    walkingMinutes: minutes,
    directions,
    steps,
    pathwayIds: Array.from(traversedPathwayIds),
  };
}
