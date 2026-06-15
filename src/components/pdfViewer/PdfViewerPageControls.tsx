interface PdfViewerPageControlsProps {
  pageNumber: number;
  numPages: number;
  onPageChange: (page: number) => void;
}

const smInput: React.CSSProperties = {
  padding: "3px 6px", background: "#1e2024", border: "1px solid #3a494a",
  borderRadius: 4, color: "#e2e2e8", fontSize: 11, fontFamily: "'Geist',monospace", textAlign: "center",
};

function navBtnSm(dis: boolean): React.CSSProperties {
  return {
    padding: "3px 8px", background: dis ? "#1e2024" : "#282a2e",
    border: "1px solid #3a494a", borderRadius: "3px",
    color: dis ? "#849495" : "#b9caca", cursor: dis ? "not-allowed" : "pointer",
    opacity: dis ? 0.5 : 1, fontSize: 11, fontFamily: "'Geist',monospace",
  };
}

export default function PdfViewerPageControls({ pageNumber, numPages, onPageChange }: PdfViewerPageControlsProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button onClick={() => onPageChange(pageNumber - 1)} disabled={pageNumber <= 1}
        style={navBtnSm(pageNumber <= 1)}>
        {'\u25C0'}
      </button>
      <input type="number" min={1} max={numPages} value={pageNumber}
        onChange={e => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onPageChange(v);
        }}
        style={{ ...smInput, width: 48 }} />
      <span style={{ fontSize: 10, fontFamily: "'Geist',monospace", color: "#6b8cae" }}>
        / {numPages}
      </span>
      <button onClick={() => onPageChange(pageNumber + 1)} disabled={pageNumber >= numPages}
        style={navBtnSm(pageNumber >= numPages)}>
        {'\u25B6'}
      </button>
    </div>
  );
}
