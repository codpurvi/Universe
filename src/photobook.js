import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const $ = (id) => document.getElementById(id);
const status = $('authStatus');
const editor = $('editorControls');
const authRow = $('authRow');
const BUCKET = 'photobook';
let supabase;
let pages = [];
let spread = 0;
let busy = false;
let realtimeChannel;
let signedUrlCache = new Map();

function say(message, error = false) {
  status.textContent = message;
  status.style.color = error ? '#ffaaa0' : '#d5aaa0';
}
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function setSignedIn(user) {
  authRow.hidden = !!user;
  editor.hidden = !user;
  if (user) say(`SIGNED IN AS ${user.email || 'YOUR ACCOUNT'} · THIS BOOK IS SHARED ♡`);
}

if (!url || !key || url.includes('YOUR_PROJECT_ID') || key.includes('YOUR_SUPABASE')) {
  say('SETUP NEEDED · Add your Supabase project URL and publishable/anon key to the Vercel environment variables first.', true);
} else {
  supabase = createClient(url, key);
  boot();
}

async function boot() {
  const { data: { session } } = await supabase.auth.getSession();
  setSignedIn(session?.user || null);
  if (session?.user) await loadPages();
  supabase.auth.onAuthStateChange(async (_event, sessionNow) => {
    setSignedIn(sessionNow?.user || null);
    if (sessionNow?.user) await loadPages();
    else {
      pages = []; spread = 0; signedUrlCache.clear();
      renderBook(); $('pageEditorList').innerHTML = '';
      if (realtimeChannel) await supabase.removeChannel(realtimeChannel);
      say('Signed out. Sign in to open your shared scrapbook.');
    }
  });
}

$('signInButton').addEventListener('click', async () => {
  const email = $('authEmail').value.trim();
  const password = $('authPassword').value;
  if (!email || !password) return say('Enter your invited email and password.', true);
  $('signInButton').disabled = true;
  say('Signing in…');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  $('signInButton').disabled = false;
  if (error) say(error.message, true);
});
$('authPassword').addEventListener('keydown', e => { if (e.key === 'Enter') $('signInButton').click(); });
$('signOutButton').addEventListener('click', async () => { const { error } = await supabase.auth.signOut(); if (error) say(error.message, true); });

async function loadPages() {
  say('Opening your scrapbook…');
  const { data, error } = await supabase.from('photobook_pages').select('*').order('position', { ascending: true }).order('created_at', { ascending: true });
  if (error) return say(`Couldn't load the book: ${error.message}`, true);
  pages = data || [];
  spread = Math.min(spread, Math.max(0, Math.ceil(pages.length / 2) - 1));
  signedUrlCache.clear();
  await renderBook();
  renderEditor();
  say(`${pages.length} scrapbook ${pages.length === 1 ? 'page' : 'pages'} · edits sync live between your signed-in devices ♡`);
  if (realtimeChannel) await supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase.channel('shared-photobook')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'photobook_pages' }, async () => {
      const current = spread;
      const { data: latest } = await supabase.from('photobook_pages').select('*').order('position', { ascending: true }).order('created_at', { ascending: true });
      if (latest) { pages = latest; spread = Math.min(current, Math.max(0, Math.ceil(pages.length / 2) - 1)); signedUrlCache.clear(); await renderBook(); renderEditor(); }
    }).subscribe();
}

async function imageUrl(path) {
  if (signedUrlCache.has(path)) return signedUrlCache.get(path);
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  signedUrlCache.set(path, data.signedUrl);
  return data.signedUrl;
}
function renderFrame(frame, page, index, captionId, folioId) {
  frame.innerHTML = '';
  frame.classList.toggle('empty-frame', !page);
  if (page) {
    const img = document.createElement('img');
    img.alt = page.caption || `Memory ${index + 1}`;
    imageUrl(page.image_path).then(src => { img.src = src; }).catch(err => say(`Image couldn't load: ${err.message}`, true));
    frame.append(img);
    $(captionId).textContent = page.caption || 'a little moment worth keeping';
  } else {
    const span = document.createElement('span');
    span.innerHTML = `${index === 0 ? '✿' : '♡'}<small>${pages.length ? 'a page waiting for a memory' : 'add your memories together'}</small>`;
    frame.append(span);
    $(captionId).textContent = 'the story is still unfolding';
  }
  $(folioId).textContent = String(index + 1).padStart(2, '0');
}
async function renderBook() {
  renderFrame($('storyPhotoLeft'), pages[spread * 2], spread * 2, 'storyCaptionLeft', 'storyFolioLeft');
  renderFrame($('storyPhotoRight'), pages[spread * 2 + 1], spread * 2 + 1, 'storyCaptionRight', 'storyFolioRight');
  $('storyPhotoCount').textContent = `${pages.length} photo${pages.length === 1 ? '' : 's'} in our book`;
  $('bookPageLabel').textContent = pages.length ? `PAGES ${String(spread * 2 + 1).padStart(2,'0')}–${String(Math.min(spread * 2 + 2, pages.length)).padStart(2,'0')} / ${String(pages.length).padStart(2,'0')}` : 'COVER · 00 / 00';
  const atStart = spread === 0;
  const atEnd = spread >= Math.max(0, Math.ceil(pages.length / 2) - 1);
  $('bookPrev').disabled = $('bookBack').disabled = atStart;
  $('bookNext').disabled = $('bookForward').disabled = atEnd;
}
function turn(dir) {
  if (busy) return;
  const next = Math.max(0, Math.min(Math.max(0, Math.ceil(pages.length / 2) - 1), spread + dir));
  if (next === spread) return;
  busy = true;
  const flip = $('pageFlip');
  flip.className = `page-flip ${dir > 0 ? 'turn-forward' : 'turn-back'}`;
  setTimeout(async () => { spread = next; await renderBook(); flip.className = 'page-flip'; busy = false; }, 720);
}
$('bookNext').addEventListener('click', () => turn(1));
$('bookForward').addEventListener('click', () => turn(1));
$('bookPrev').addEventListener('click', () => turn(-1));
$('bookBack').addEventListener('click', () => turn(-1));

$('sharedUpload').addEventListener('change', async (event) => {
  const files = [...(event.target.files || [])]; event.target.value = '';
  if (!files.length) return;
  for (const file of files) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { say(`${file.name}: please use JPEG, PNG or WebP.`, true); continue; }
    if (file.size > 10 * 1024 * 1024) { say(`${file.name}: larger than 10 MB. Please choose a smaller image.`, true); continue; }
    say(`Adding ${file.name}…`);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { say(`Upload failed: ${uploadError.message}`, true); continue; }
    const { error: rowError } = await supabase.from('photobook_pages').insert({ image_path: path, caption: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '), position: pages.length });
    if (rowError) { await supabase.storage.from(BUCKET).remove([path]); say(`Couldn't add page: ${rowError.message}`, true); continue; }
  }
  await loadPages();
});

function renderEditor() {
  const host = $('pageEditorList'); host.innerHTML = '';
  if (!pages.length) { host.innerHTML = '<p class="intro">Your first scrapbook page is waiting. Add a photo to begin ♡</p>'; return; }
  pages.forEach((page, index) => {
    const row = document.createElement('div'); row.className = 'page-editor-row';
    const thumb = document.createElement('img'); thumb.alt = `Page ${index + 1}`;
    imageUrl(page.image_path).then(src => thumb.src = src).catch(() => {});
    const caption = document.createElement('input'); caption.type = 'text'; caption.maxLength = 120; caption.value = page.caption || ''; caption.setAttribute('aria-label', `Caption for page ${index + 1}`); caption.placeholder = 'Write a little caption…';
    caption.addEventListener('change', async () => {
      const { error } = await supabase.from('photobook_pages').update({ caption: caption.value.trim(), updated_at: new Date().toISOString() }).eq('id', page.id);
      if (error) say(`Caption wasn't saved: ${error.message}`, true); else { page.caption = caption.value.trim(); await renderBook(); say('Caption saved ♡'); }
    });
    const actions = document.createElement('div'); actions.className = 'page-editor-actions';
    const up = document.createElement('button'); up.textContent = '↑'; up.title = 'Move earlier'; up.disabled = index === 0; up.onclick = () => movePage(index, -1);
    const down = document.createElement('button'); down.textContent = '↓'; down.title = 'Move later'; down.disabled = index === pages.length - 1; down.onclick = () => movePage(index, 1);
    const del = document.createElement('button'); del.textContent = 'REMOVE'; del.onclick = () => deletePage(page);
    actions.append(up, down, del); row.append(thumb, caption, actions); host.append(row);
  });
}
async function movePage(index, direction) {
  const target = index + direction; if (target < 0 || target >= pages.length) return;
  const reordered = [...pages]; [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  say('Rearranging pages…');
  for (let i = 0; i < reordered.length; i++) {
    const { error } = await supabase.from('photobook_pages').update({ position: i }).eq('id', reordered[i].id);
    if (error) return say(`Couldn't rearrange pages: ${error.message}`, true);
  }
  await loadPages();
}
async function deletePage(page) {
  if (!confirm('Remove this photo from your shared scrapbook?')) return;
  say('Removing page…');
  const { error } = await supabase.from('photobook_pages').delete().eq('id', page.id);
  if (error) return say(`Couldn't remove page: ${error.message}`, true);
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([page.image_path]);
  if (storageError) say(`Page removed, but its image file could not be deleted: ${storageError.message}`, true);
  await loadPages();
}
