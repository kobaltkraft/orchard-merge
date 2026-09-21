declare module 'nipplejs';
declare module 'stats-gl' {
  const Stats: new (opts?: unknown) => { dom: HTMLElement; update: () => void };
  export default Stats;
}
