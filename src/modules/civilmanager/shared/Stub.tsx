import { ActionIcon } from './icons';

export function Stub({ label }: { label: string }) {
  return (
    <div className="cm-stub">
      <ActionIcon name="construction" label="" />
      <div>{label} — en desarrollo</div>
    </div>
  );
}
