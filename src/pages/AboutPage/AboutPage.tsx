import styles from './AboutPage.module.css';

function AboutPage() {
  return (
    <div className={styles.about}>
      <h1>О нас</h1>

      <section className={styles.section}>
        <h2>Наша история</h2>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus
          lacinia odio vitae vestibulum vestibulum. Cras vehicula, mi eget
          laoreet volutpat, lacus arcu facilisis orci, et sodales felis diam eu
          neque. Maecenas eget turpis quis nisi hendrerit mollis.
        </p>
        <p>
          Sed ut perspiciatis unde omnis iste natus error sit voluptatem
          accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae
          ab illo inventore veritatis et quasi architecto beatae vitae dicta
          sunt explicabo.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Наша команда</h2>
        <div className={styles.team}>
          <div className={styles.member}>
            <div className={styles.avatar}></div>
            <h3>Иван Петров</h3>
            <p>Руководитель проекта</p>
          </div>
          <div className={styles.member}>
            <div className={styles.avatar}></div>
            <h3>Мария Сидорова</h3>
            <p>Дизайнер</p>
          </div>
          <div className={styles.member}>
            <div className={styles.avatar}></div>
            <h3>Алексей Иванов</h3>
            <p>Разработчик</p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Наши ценности</h2>
        <ul className={styles.values}>
          <li>
            <strong>Инновации</strong> — Nemo enim ipsam voluptatem quia
            voluptas sit aspernatur aut odit aut fugit.
          </li>
          <li>
            <strong>Качество</strong> — Neque porro quisquam est, qui dolorem
            ipsum quia dolor sit amet.
          </li>
          <li>
            <strong>Доверие</strong> — Ut enim ad minima veniam, quis nostrum
            exercitationem ullam corporis suscipit.
          </li>
        </ul>
      </section>
    </div>
  );
}

export default AboutPage;
