import { useRouter } from 'next/router';
import Link from 'next/link';

export default function UsersPage() {
  const router = useRouter();
  const role = router.query.role || 'all';

  return (
    <main style={styles.page}>
      <div style={styles.box}>
        <h1 style={styles.title}>Users</h1>
        <p style={styles.text}>This screen opens with the selected role filter.</p>
        <div style={styles.badge}>Role: {role}</div>
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
  badge: { display: 'inline-block', marginTop: '8px', padding: '6px 10px', borderRadius: '999px', background: '#dbeafe', color: '#1d4ed8', fontWeight: 600 },
  link: { display: 'inline-block', marginTop: '16px', color: '#2563eb', textDecoration: 'none', fontWeight: 600 },
};
