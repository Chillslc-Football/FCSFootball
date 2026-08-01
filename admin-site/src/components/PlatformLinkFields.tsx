import { PLATFORM_KEYS, PLATFORM_LABELS, type PlatformKey } from '../lib/catalog';

type Props = {
  links: Record<PlatformKey, string>;
  onChange: (key: PlatformKey, value: string) => void;
};

export function PlatformLinkFields({ links, onChange }: Props) {
  return (
    <div className="grid-2">
      {PLATFORM_KEYS.map((key) => (
        <label key={key}>
          {PLATFORM_LABELS[key]}
          <input
            value={links[key]}
            onChange={(e) => onChange(key, e.target.value)}
            placeholder="https://"
          />
        </label>
      ))}
    </div>
  );
}
