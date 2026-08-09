import { NewAppRoot } from './components/NewLayout/NewAppRoot';
import { initGsap } from './utils/initGsap';

initGsap();

/**
 * Корневой layout приложения (см. план §2.6, фаза P7-P8).
 *
 * Подключён новый `NewAppRoot` (`src/components/NewLayout/`). Старый
 * layout-движок (`src/components/layout/`) удалён.
 */
function App() {
  return <NewAppRoot />;
}

export default App;
