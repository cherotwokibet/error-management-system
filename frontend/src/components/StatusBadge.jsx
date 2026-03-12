export default function StatusBadge({ status }) {
  const map = {
    'Open':        'badge-open',
    'In Progress': 'badge-progress',
    'Resolved':    'badge-resolved',
    'Closed':      'badge-closed',
  };
  return <span className={`badge badge-dot ${map[status] || 'badge-closed'}`}>{status}</span>;
}

export function ChannelBadge({ channel }) {
  const colors = {
    Web:     { color:'#3b82f6', bg:'#3b82f615' },
    Mobile:  { color:'#8b5cf6', bg:'#8b5cf615' },
    API:     { color:'#06b6d4', bg:'#06b6d415' },
    Backend: { color:'#f59e0b', bg:'#f59e0b15' },
    Email:   { color:'#ec4899', bg:'#ec489915' },
    Other:   { color:'#6b7280', bg:'#6b728015' },
  };
  const c = colors[channel] || colors.Other;
  return (
    <span style={{
      display:'inline-block', padding:'2px 8px',
      borderRadius:4, fontSize:11, fontWeight:600,
      color: c.color, background: c.bg,
      fontFamily:'var(--font-display)',
      letterSpacing:'0.03em',
    }}>{channel}</span>
  );
}
