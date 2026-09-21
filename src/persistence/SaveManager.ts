import { get, set, del } from 'idb-keyval';
import LZString from 'lz-string';
import { SaveSchema, repairSave, defaultSave, type SaveData } from './SaveSchema';

const KEY = 'grove.save.v1';
const COMPRESS_THRESHOLD = 20000;

export async function loadSave(): Promise<SaveData> {
  try {
    const raw = await get(KEY);
    if (!raw) {
      const ls = localStorage.getItem(KEY);
      if (ls) {
        try {
          const str = ls.startsWith('LZ:') ? LZString.decompressFromUTF16(ls.slice(3)) ?? '{}' : ls;
          return repairSave(JSON.parse(str));
        } catch { /* fall through */ }
      }
      return defaultSave();
    }
    const str = typeof raw === 'string' && raw.startsWith('LZ:') ? LZString.decompressFromUTF16(raw.slice(3)) ?? '{}' : (typeof raw === 'string' ? raw : JSON.stringify(raw));
    const parsed = typeof str === 'string' ? JSON.parse(str) : str;
    // migrate: if version missing/old, repair handles it
    return repairSave({ ...parsed, version: 1 });
  } catch { return defaultSave(); }
}

let timer: ReturnType<typeof setTimeout> | null = null;
export async function persistSave(data: SaveData): Promise<void> {
  const validated = SaveSchema.parse(data);
  const json = JSON.stringify(validated);
  const payload = json.length > COMPRESS_THRESHOLD ? 'LZ:' + LZString.compressToUTF16(json) : json;
  try { await set(KEY, payload); }
  catch { try { localStorage.setItem(KEY, payload.slice(0, 400000)); } catch { /* storage full: ignore */ } }
  // tiny settings mirror for instant boot
  try { localStorage.setItem('grove.settings', JSON.stringify(validated.settings)); } catch { /* ignore */ }
}

export function persistDebounced(data: SaveData): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { void persistSave(data); }, 400);
}

export async function clearSave(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null; }
  try { await del(KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  try { localStorage.removeItem('grove.settings'); } catch { /* ignore */ }
}
