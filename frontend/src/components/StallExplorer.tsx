import { useMemo, useState } from 'react';
import {
  Search,
  MapPin,
  Info,
  X,
  CircleHelp,
  RotateCcw,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import { stallAllotments } from '../data/stallAllotments';

type StallExplorerProps = {
  onSelectStall: (stallNumber: number) => void;
};

type Candidate = {
  number: number;
  isParenthetical: boolean;
};

const CURRENT_STALL_COUNT = 341;

function getCandidates(raw: string): Candidate[] {
  const candidates: Candidate[] = [];
  const pattern = /\(([^)]*)\)|([^()]+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    const isParenthetical = match[1] !== undefined;
    const segment = match[1] ?? match[2] ?? '';

    for (const token of segment.match(/\d+/g) ?? []) {
      const number = Number(token);
      if (Number.isSafeInteger(number)) {
        candidates.push({ number, isParenthetical });
      }
    }
  }

  return candidates;
}

export default function StallExplorer({
  onSelectStall,
}: StallExplorerProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{
    companyName: string;
    number: number;
    rawLikelyStallNumbers: string;
  } | null>(null);
  const [statusInfo, setStatusInfo] = useState(true);

  const records = useMemo(
    () =>
      stallAllotments.map((record) => ({
        ...record,
        candidates: getCandidates(record.rawLikelyStallNumbers),
      })),
    []
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;

    return records.filter((record) => {
      const matchesCompany = record.companyName
        .toLowerCase()
        .includes(query);
      const matchesRawNumbers = record.rawLikelyStallNumbers
        .toLowerCase()
        .includes(query);
      const matchesCandidate = record.candidates.some(
        (candidate) => String(candidate.number) === query
      );

      return matchesCompany || matchesRawNumbers || matchesCandidate;
    });
  }, [records, search]);

  function resetDirectory() {
    setSearch('');
    setSelected(null);
  }

  function selectCandidate(
    companyName: string,
    number: number,
    rawLikelyStallNumbers: string
  ) {
    setSelected({
      companyName,
      number,
      rawLikelyStallNumbers,
    });

    // Only numbers inside the reported 1–341 range are sent to
    // App.tsx for a provisional numeric booth-code comparison.
    if (number >= 1 && number <= CURRENT_STALL_COUNT) {
      onSelectStall(number);
    }
  }

  return (
    <section className="stall-explorer" id="stall-explorer">
      <div className="section-heading">
        <div>
          <div className="eyebrow">STALL ALLOTMENT DIRECTORY</div>
          <h2>Find a company or likely stall number</h2>
          <p>
            Search the company list and the likely stall numbers
            recorded in the supplied allotment workbook.
          </p>
        </div>
        <span className="sample-tag">
          PROVISIONAL SOURCE DATA · 102 COMPANIES
        </span>
      </div>

      <div className="stall-summary">
        <div>
          <strong>{records.length}</strong>
          <span>Company entries in workbook</span>
        </div>
        <div>
          <strong>{CURRENT_STALL_COUNT}</strong>
          <span>Reported total stall count</span>
        </div>
        <div>
          <strong>—</strong>
          <span>Verified allocations</span>
        </div>
        <div>
          <strong>—</strong>
          <span>Confirmed category totals</span>
        </div>
      </div>

      <div className="stall-directory">
        <div className="stall-search-row">
          <label className="search-box">
            <Search size={17} />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search company or stall number…"
              aria-label="Search company or likely stall number"
            />
            {search && (
              <button
                type="button"
                className="icon-button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </label>
          <button
            type="button"
            className="icon-button"
            onClick={resetDirectory}
            title="Reset directory"
            aria-label="Reset directory"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <div className="stall-result-head">
          <strong>
            {filtered.length} {filtered.length === 1 ? 'company' : 'companies'}
          </strong>
          <span>Choose a listed number to inspect its source entry.</span>
        </div>

        <div className="stall-company-list">
          {filtered.map((record) => (
            <article className="stall-company-card" key={record.sourceRow}>
              <div className="stall-company-heading">
                <Building2 size={17} />
                <strong>{record.companyName}</strong>
                <small>Source row {record.sourceRow}</small>
              </div>

              <div className="stall-candidate-list">
                {record.candidates.length > 0 ? (
                  record.candidates.map((candidate, index) => {
                    const outOfRange =
                      candidate.number < 1 ||
                      candidate.number > CURRENT_STALL_COUNT;
                    return (
                      <button
                        type="button"
                        key={`${candidate.number}-${index}`}
                        className={`stall-number ${
                          selected?.companyName === record.companyName &&
                          selected.number === candidate.number
                            ? 'active'
                            : ''
                        } ${outOfRange ? 'out-of-range' : ''}`}
                        onClick={() =>
                          selectCandidate(
                            record.companyName,
                            candidate.number,
                            record.rawLikelyStallNumbers
                          )
                        }
                        title={
                          candidate.isParenthetical
                            ? 'Parenthetical number in source workbook; verify its meaning.'
                            : outOfRange
                              ? 'Outside the reported 1–341 range; verify with organiser.'
                              : 'Likely stall number from source workbook; not verified.'
                        }
                      >
                        {candidate.number}
                        {candidate.isParenthetical ? '*' : ''}
                      </button>
                    );
                  })
                ) : (
                  <span className="stall-empty">No likely stall number supplied.</span>
                )}
              </div>

              <small className="layout-source-note">
                Source entry: {record.rawLikelyStallNumbers || 'Not provided'}
              </small>
            </article>
          ))}

          {filtered.length === 0 && (
            <div className="stall-empty">
              No matching company or stall number found.
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="stall-detail">
          <div className="stall-detail-icon">
            <MapPin size={21} />
          </div>
          <div className="stall-detail-copy">
            <small>SELECTED SOURCE ENTRY</small>
            <strong>Stall candidate {selected.number}</strong>
            <span>{selected.companyName}</span>
            <em>
              <CircleHelp size={13} />
              Likely number only · Verify against the approved register
            </em>
            <span>Original workbook entry: {selected.rawLikelyStallNumbers}</span>
            {selected.number > CURRENT_STALL_COUNT && (
              <em>
                <AlertTriangle size={13} />
                This number is outside the reported 1–341 stall range.
              </em>
            )}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => setSelected(null)}
            aria-label="Close stall details"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <button
        type="button"
        className="layout-info-toggle"
        onClick={() => setStatusInfo((value) => !value)}
        aria-expanded={statusInfo}
      >
        <Info size={15} />
        {statusInfo ? 'Hide' : 'Show'} source-data limitations
      </button>

      {statusInfo && (
        <div className="layout-source-note">
          <p>
            The workbook labels its values “Likely stall numbers”.
            They are displayed as provisional source entries, not
            confirmed allocations. Parenthetical numbers are marked
            with an asterisk and are kept distinct from the other
            numbers in the source entry.
          </p>
          <p>
            Several listed numbers exceed the reported total of 341.
            The workbook also contains a number on a row without a
            company name and a malformed row with no valid company
            name. These entries have not been assigned to a company
            or silently corrected.
          </p>
          <p>
            A number inside 1–341 can be compared with a demo booth
            code in the application, but that comparison is not proof
            of an official physical stall allocation.
          </p>
        </div>
      )}
    </section>
  );
}
