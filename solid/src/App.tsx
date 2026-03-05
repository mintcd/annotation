import { createSignal } from 'solid-js';

export default function App() {
  const [count, setCount] = createSignal(0);
  return (
    <main style={{ padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Solid app</h1>
      <p>Count: {count()}</p>
      <button onClick={() => setCount(count() + 1)}>Increment</button>
    </main>
  );
}
