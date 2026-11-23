import './styles/main.css';
import { GameController } from './game/gameController';

window.addEventListener('DOMContentLoaded', () => {
  const appEl = document.getElementById('app');
  if (!appEl) return;
  const game = new GameController(appEl);
  (window as unknown as { __GAME__: GameController }).__GAME__ = game;
});
