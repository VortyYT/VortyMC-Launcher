import React from 'react';
import { FiMinus, FiMaximize2, FiX } from 'react-icons/fi';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

export default function TitleBar() {
  const minimize = () => ipcRenderer?.invoke('window:minimize');
  const maximize = () => ipcRenderer?.invoke('window:maximize');
  const close = () => ipcRenderer?.invoke('window:close');

  return (
    <div className="titlebar">
      <div className="titlebar__brand">
        <span className="titlebar__logo">VORTYMC</span>
      </div>
      <div className="titlebar__controls">
        <button className="titlebar__btn" onClick={minimize} title="Minimize">
          <FiMinus />
        </button>
        <button className="titlebar__btn" onClick={maximize} title="Maximize">
          <FiMaximize2 />
        </button>
        <button className="titlebar__btn titlebar__btn--close" onClick={close} title="Close">
          <FiX />
        </button>
      </div>
    </div>
  );
}
