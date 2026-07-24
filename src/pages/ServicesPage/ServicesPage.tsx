import styles from './ServicesPage.module.css';

const services = [
  {
    title: 'Веб-разработка',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    icon: '🌐',
  },
  {
    title: 'UI/UX Дизайн',
    description:
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    icon: '🎨',
  },
  {
    title: 'Мобильная разработка',
    description:
      'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
    icon: '📱',
  },
  {
    title: 'Консалтинг',
    description:
      'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    icon: '💼',
  },
  {
    title: 'SEO оптимизация',
    description:
      'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.',
    icon: '🔍',
  },
  {
    title: 'Поддержка',
    description:
      'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed consequuntur.',
    icon: '🛠️',
  },
];

function ServicesPage() {
  return (
    <main className={styles.services}>
      <h1>Услуги</h1>
      <p className={styles.intro}>
        Мы предлагаем широкий спектр услуг для вашего бизнеса. Выберите то, что
        подходит именно вам.
      </p>

      <div className={styles.grid}>
        {services.map(({ title, description, icon }) => (
          <div key={title} className={styles.card}>
            <div className={styles.icon}>{icon}</div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

export default ServicesPage;
