export default function Pagination({ next, previous, onNext, onPrevious, disabled = false }: { next?: number | null; previous: boolean; onNext: () => void; onPrevious: () => void; disabled?: boolean }) {
  return <div class="pagination"><button class="secondary" disabled={disabled || !previous} onClick={onPrevious}>Previous page</button><button class="secondary" disabled={disabled || next == null} onClick={onNext}>Next page</button></div>;
}
