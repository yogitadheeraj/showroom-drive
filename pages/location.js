import Link from 'next/link';

export default function LocationPage() {
  return (
    <main style={styles.page}>
      <div style={styles.box}>
        <h1 style={styles.title}>Location</h1>
        <p style={styles.text}>This is the location screen opened from the dashboard card.</p>
        <Link href="/" style={styles.link}>← Back to dashboard</Link>
      </div>
    </main>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', padding: '24px' },
  box: { background: '#fff', padding: '32px', borderRadius: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.08)', maxWidth: '480px', width: '100%' },
  title: { margin: '0 0 8px', fontSize: '24px' },
  text: { color: '#6b7280', lineHeight: 1.6 },
  link: { display: 'inline-block', marginTop: '12px', color: '#2563eb', textDecoration: 'none', fontWeight: 600 },
};
