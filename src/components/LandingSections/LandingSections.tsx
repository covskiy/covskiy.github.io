import styles from './LandingSections.module.css';

export function LandingSections() {
  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <h1>🍵 Добро пожаловать в наш мир изысканных вкусов и традиций!</h1>
        <p className={styles.tagline}>
          Мы объединяем многовековые чайные традиции с современными подходами к
          качеству, чтобы каждый глоток становился маленьким путешествием сквозь
          культуру и историю. Lorem ipsum dolor sit amet, consectetur adipiscing
          elit. Sed do eiusmod tempor incididunt ut labore et dolore magna
          aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco
          laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor
          in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
          pariatur.
        </p>
      </section>

      <section className={styles.features}>
        <h2>✨ Наши преимущества</h2>
        <div className={styles.grid}>
          <div className={styles.card}>
            <h3>💎 Качество на каждом этапе</h3>
            <p>
              Мы тщательно отбираем сырьё, контролируем каждый этап производства
              и хранения, чтобы гарантировать исключительный вкус и аромат наших
              чаёв. Ut enim ad minim veniam, quis nostrud exercitation ullamco
              laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure
              dolor in reprehenderit in voluptate velit esse cillum dolore eu
              fugiat nulla pariatur. Excepteur sint occaecat cupidatat non
              proident, sunt in culpa qui officia deserunt mollit anim id est
              laborum.
            </p>
          </div>
          <div className={styles.card}>
            <h3>🎓 Богатый опыт и экспертиза</h3>
            <p>
              Наша команда� —� это эксперты с многолетним стажем, которые знают
              всё о тонкостях чайного дела: от выращивания листьев до
              заваривания идеального напитка. Duis aute irure dolor in
              reprehenderit in voluptate velit esse cillum dolore eu fugiat
              nulla pariatur. Excepteur sint occaecat cupidatat non proident,
              sunt in culpa qui officia deserunt mollit anim id est laborum. Ut
              enim ad minim veniam, quis nostrud exercitation ullamco laboris
              nisi ut aliquip ex ea commodo consequat.
            </p>
          </div>
          <div className={styles.card}>
            <h3>✅ Гарантированный результат</h3>
            <p>
              Мы не просто продаём чай� —� мы дарим эмоции и впечатления,
              которые остаются с вами надолго. Каждый наш продукт� —� это
              результат кропотливой работы и стремления к совершенству.
              Excepteur sint occaecat cupidatat non proident, sunt in culpa qui
              officia deserunt mollit anim id est laborum. Ut enim ad minim
              veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip
              ex ea commodo consequat. Duis aute irure dolor in reprehenderit in
              voluptate velit esse cillum dolore eu fugiat nulla pariatur.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
