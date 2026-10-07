import { useEffect, useReducer, useState } from 'react';
import { fetchStatus, type BackendStatus } from './agent/client';
import type { AgentMode } from './agent/runs';
import { DemoContext } from './context';
import { DemoPage } from './demo/DemoPage';
import { initialState, reducer } from './engine/store';
import { Architecture } from './pages/Architecture';
import { Deck } from './pages/Deck';
import { Plugins } from './pages/Plugins';
import { Story } from './pages/Story';

const ROUTES = [
  { id: 'story', label: 'Story' },
  { id: 'demo', label: 'Demo' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'plugins', label: 'Plugins' },
  { id: 'deck', label: 'Deck' },
] as const;
type RouteId = (typeof ROUTES)[number]['id'];

function useRoute(): RouteId {
  const read = () => {
    const r = window.location.hash.replace(/^#\/?/, '').split('/')[0];
    return (ROUTES.some((x) => x.id === r) ? r : 'story') as RouteId;
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export default function App() {
  const route = useRoute();
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [step, setStep] = useState(0);
  const [backend, setBackend] = useState<BackendStatus>({ available: false });
  const [agentMode, setAgentMode] = useState<AgentMode>(() => (localStorage.getItem('agentMode') as AgentMode) || 'live');

  useEffect(() => {
    document.body.dataset.route = route;
  }, [route]);

  useEffect(() => {
    fetchStatus().then(setBackend);
  }, []);

  useEffect(() => localStorage.setItem('agentMode', agentMode), [agentMode]);

  return (
    <DemoContext.Provider value={{ state, dispatch, step, setStep, agentMode, setAgentMode, backend }}>
      <header className="topnav">
        <a className="brand" href="#/story">
          <span className="brand-mark" aria-hidden>
            ✦
          </span>
          <span>
            <strong>Clinical Extensions</strong>
            <small>Many innovations. Few platforms.</small>
          </span>
        </a>
        <nav aria-label="Main">
          {ROUTES.map((r) => (
            <a key={r.id} href={`#/${r.id}`} className={route === r.id ? 'active' : undefined}>
              {r.id === 'demo' && <span className="live-dot" aria-hidden />}
              {r.label}
            </a>
          ))}
        </nav>
        <span className="topnav-note">Hackathon prototype · synthetic data · not for clinical use</span>
      </header>
      {route === 'story' && <Story />}
      {route === 'demo' && <DemoPage />}
      {route === 'architecture' && <Architecture />}
      {route === 'plugins' && <Plugins />}
      {route === 'deck' && <Deck />}
    </DemoContext.Provider>
  );
}
