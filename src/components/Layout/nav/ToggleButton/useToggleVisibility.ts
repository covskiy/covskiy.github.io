import { useEffect, useRef, type RefObject } from 'react';
import { useGsapBus } from '../../gsap/gsapContext';
import { EDGE_EPS } from '../../gsap/GsapProvider';
import { shouldHideToggle } from '../../machine/navPolicy';
import styles from './ToggleButton.module.css';

/**
 * Параметры императивной видимости кнопки toggle.
 *
 * - `isHome`         — если `false`, подписка на `scroll:progress` снимается,
 *                      класс `isHidden` принудительно удаляется: вне `/home`
 *                      видимость управляется обычным машинным режимом.
 * - `isManualToggle` — принудительный показ кнопки вне зависимости от
 *                      прогресса скролла. Передаётся из `LayoutSnapshot.isManualToggle`
 *                      и срабатывает, когда пользователь вручную открыл навбар
 *                      бургером на mobile `/home` (corner: `mode` сохранил
 *                      ручное состояние через `REACH_BOTTOM`, флаг
 *                      `manualOverride` переживает scrub-зону до самого верха).
 *
 * Видимость вычисляется по правилу:
 *   `hidden = !(progress >= 1 - EDGE_EPS || isManualToggle)`
 * на `/home`; `lastProgressRef` хранит последний известный прогресс, чтобы
 * при перезапуске эффекта (вход на `/home` уже на дне) начальное состояние
 * не сбрасывалось в `hidden` — закрывает кадр-глитч при back-navigation.
 */
export interface UseToggleVisibilityOptions {
  isHome: boolean;
  isManualToggle: boolean;
}

export function useToggleVisibility(
  btnRef: RefObject<HTMLButtonElement | null>,
  opts: UseToggleVisibilityOptions,
): void {
  const bus = useGsapBus();
  const lastProgressRef = useRef(0);

  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;

    if (!opts.isHome) {
      el.classList.remove(styles.isHidden);
      return;
    }

    const apply = () => {
      el.classList.toggle(
        styles.isHidden,
        shouldHideToggle({
          progress: lastProgressRef.current,
          isManualToggle: opts.isManualToggle,
          edgeEps: EDGE_EPS,
        }),
      );
    };

    apply();

    const off = bus.on('scroll:progress', ({ progress }) => {
      lastProgressRef.current = progress;
      apply();
    });

    return off;
  }, [bus, btnRef, opts.isHome, opts.isManualToggle]);
}
