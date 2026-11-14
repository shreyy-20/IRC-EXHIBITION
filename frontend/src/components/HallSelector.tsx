import { Building2, Compass, Layers } from 'lucide-react';

export type HallTab = 'all' | 'hall-1' | 'hanger';

type Props = {
  activeHall: HallTab;
  onChangeHall: (hall: HallTab) => void;
  hall1Count: number;
  hangerCount: number;
};

export default function HallSelector({
  activeHall,
  onChangeHall,
  hall1Count,
  hangerCount,
}: Props) {
  return (
    <div className="hall-selector-container">
      <div className="hall-selector-label">
        <Compass size={16} />
        <span>SELECT EXHIBITION ZONE:</span>
      </div>

      <div className="hall-selector-tabs" role="tablist" aria-label="Hall View Selector">
        <button
          type="button"
          role="tab"
          aria-selected={activeHall === 'all'}
          className={`hall-tab-btn ${activeHall === 'all' ? 'active' : ''}`}
          onClick={() => onChangeHall('all')}
        >
          <Layers size={16} />
          <span>Complete Venue Layout</span>
          <span className="hall-badge">{hall1Count + hangerCount} Exhibitors</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeHall === 'hall-1'}
          className={`hall-tab-btn ${activeHall === 'hall-1' ? 'active' : ''}`}
          onClick={() => onChangeHall('hall-1')}
        >
          <Building2 size={16} />
          <span>Hall-1 (Stalls 1–208)</span>
          <span className="hall-badge">{hall1Count} Exhibitors</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeHall === 'hanger'}
          className={`hall-tab-btn ${activeHall === 'hanger' ? 'active' : ''}`}
          onClick={() => onChangeHall('hanger')}
        >
          <Building2 size={16} />
          <span>Hanger (Stalls 209–387)</span>
          <span className="hall-badge">{hangerCount} Exhibitors</span>
        </button>
      </div>
    </div>
  );
}
