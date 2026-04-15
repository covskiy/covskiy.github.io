import styles from './ContactPage.module.css';

function ContactPage() {
  return (
    <main className={styles.contact}>
      <h1>Контакты</h1>

      <section className={styles.section}>
        <h2>Свяжитесь с нами</h2>
        <p>
          Мы всегда рады помочь вам. Заполните форму ниже или свяжитесь с нами
          напрямую.
        </p>

        <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
          <div className={styles.field}>
            <label htmlFor="name">Имя</label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder="Ваше имя"
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="your@email.com"
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="message">Сообщение</label>
            <textarea
              id="message"
              name="message"
              rows={5}
              placeholder="Ваше сообщение..."
              required
            ></textarea>
          </div>

          <button type="submit" className={styles.submit}>
            Отправить
          </button>
        </form>
      </section>

      <section className={styles.section}>
        <h2>Контактная информация</h2>
        <div className={styles.info}>
          <div className={styles.item}>
            <h3>Email</h3>
            <p>
              <a href="mailto:hello@example.com">hello@example.com</a>
            </p>
          </div>
          <div className={styles.item}>
            <h3>Телефон</h3>
            <p>
              <a href="tel:+71234567890">+7 (123) 456-78-90</a>
            </p>
          </div>
          <div className={styles.item}>
            <h3>Адрес</h3>
            <p>г. Москва, ул. Примерная, д. 1</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default ContactPage;
