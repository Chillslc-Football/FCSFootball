import { PLATFORM_KEYS, PLATFORM_LABELS, emptyLinkRow, type LinkRow, type PlatformKey } from '../lib/catalog';

type Props = {
  rows: LinkRow[];
  onChange: (rows: LinkRow[]) => void;
  errors?: Record<string, string>;
};

function isPlatformKey(value: string): value is PlatformKey {
  return (PLATFORM_KEYS as readonly string[]).includes(value);
}

function rowKey(row: LinkRow, index: number): string {
  return row.id || `link-${index}-${row.platform}-${row.sortOrder}`;
}

export function LinkRowsEditor({ rows, onChange, errors }: Props) {
  function updateRow(index: number, patch: Partial<LinkRow>) {
    onChange(
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)).map((row, i) => ({
        ...row,
        sortOrder: i,
      })),
    );
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index).map((row, i) => ({ ...row, sortOrder: i })));
  }

  function moveRow(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved!);
    onChange(next.map((row, i) => ({ ...row, sortOrder: i })));
  }

  function addRow() {
    onChange([...rows, emptyLinkRow(rows.length)]);
  }

  return (
    <div className="stack">
      {errors?.links ? <div className="error">{errors.links}</div> : null}
      {rows.length === 0 ? (
        <p className="muted">No links yet. Add at least one URL.</p>
      ) : null}
      {rows.map((row, index) => (
        <div key={rowKey(row, index)} className="link-row">
          <div className="link-row-fields">
            <label>
              Platform
              <select
                value={row.platform}
                onChange={(e) => {
                  const value = e.target.value;
                  if (isPlatformKey(value)) updateRow(index, { platform: value });
                }}
              >
                {PLATFORM_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PLATFORM_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Label (optional)
              <input
                value={row.label}
                onChange={(e) => updateRow(index, { label: e.target.value })}
                placeholder="Show notes, Main feed…"
              />
            </label>
            <label className="link-row-url">
              URL
              <input
                value={row.url}
                onChange={(e) => updateRow(index, { url: e.target.value })}
                placeholder="https://"
              />
            </label>
          </div>
          {(errors?.[`links.${index}.url`] || errors?.[`links.${index}.platform`]) && (
            <div className="error">
              {errors[`links.${index}.url`] || errors[`links.${index}.platform`]}
            </div>
          )}
          <div className="row">
            <button
              type="button"
              className="btn-secondary"
              disabled={index === 0}
              onClick={() => moveRow(index, -1)}
            >
              Up
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={index >= rows.length - 1}
              onClick={() => moveRow(index, 1)}
            >
              Down
            </button>
            <button type="button" className="btn-danger" onClick={() => removeRow(index)}>
              Remove
            </button>
          </div>
        </div>
      ))}
      <div>
        <button type="button" className="btn-secondary" onClick={addRow}>
          + Add Another Link
        </button>
      </div>
    </div>
  );
}
