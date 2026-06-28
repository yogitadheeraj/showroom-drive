import Link from 'next/link';

const cards = [
  { title: 'Location', href: '/location', description: 'Open the location management screen.' },
  { title: 'Brand', href: '/settings/brands', description: 'Open brand settings.' },
  { title: 'Dealer', href: '/users?role=dealer', description: 'Open users filtered to dealer role.' },
];

export default function Dashboard() {
  return (
    <main style={styles.page}>
      <div style={styles.cardContainer}>
        <h1 style={styles.title}>Dashboard</h1>
        <p style={styles.subtitle}>Click any card to open the matching screen.</p>

        <div style={styles.grid}>
          {cards.map((card) => (
            <Link key={card.title} href={card.href} style={styles.card}>
              <div style={styles.cardInner}>
                <h2 style={styles.cardTitle}>{card.title}</h2>
                <p style={styles.cardText}>{card.description}</p>
                <span style={styles.linkText}>Open →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f7fb',
    padding: '24px',
    fontFamily: 'Arial, sans-serif',
  },
  cardContainer: {
    width: '100%',
    maxWidth: '900px',
    background: '#fff',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
  },
  title: {
    margin: '0 0 8px',
    fontSize: '28px',
    color: '#111827',
  },
  subtitle: {
    margin: '0 0 24px',
    color: '#6b7280',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  card: {
    display: 'block',
    textDecoration: 'none',
    color: 'inherit',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    background: '#f9fafb',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  cardInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '20px',
    color: '#111827',
  },
  cardText: {
    margin: 0,
    color: '#6b7280',
    lineHeight: 1.5,
  },
  linkText: {
    marginTop: '8px',
    fontWeight: 600,
    color: '#2563eb',
  },
};
