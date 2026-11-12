// Mini Tools (SFM-242). Text from screenshot: Tesseract (tesseract.js, vendored in /static/vendor/tesseract/) runs
// in this browser -- the image is never uploaded. One worker is kept per language set and reused.
(function () {
  const $ = id => document.getElementById(id);
  if (!$('ocr-tool')) return;
  const BASE = window.MINI_TOOLS_TESSERACT || '/static/vendor/tesseract/';     // the standalone page sets its own
  const ui = { lang: $('ocr-lang'), layout: $('ocr-layout'), drop: $('ocr-drop'), file: $('ocr-file'), bar: $('ocr-bar'),
               status: $('ocr-status'), image: $('ocr-image'), text: $('ocr-text'), conf: $('ocr-conf') };
  let worker = null, workerLang = '', current = null, busy = false;

  const status = (msg, progress) => {
    ui.status.textContent = msg;
    if (progress !== undefined) ui.bar.style.width = Math.round(progress * 100) + '%';
  };

  async function getWorker(lang) {
    if (worker && workerLang === lang) return worker;
    if (worker) { await worker.terminate(); worker = null; }
    status('Loading the text recognition (' + lang + ') ...', 0);
    worker = await Tesseract.createWorker(lang.split('+'), 1, {        // 1 = LSTM engine
      workerPath: BASE + 'worker.min.js', corePath: BASE, langPath: BASE + 'lang', gzip: true,
      workerBlobURL: false, cacheMethod: 'none',
      logger: m => { if (m.status === 'recognizing text') status('Recognising ...', m.progress); },
    });
    workerLang = lang;
    return worker;
  }

  async function recognise(image) {
    if (busy) return;
    busy = true;
    current = image;
    ui.image.src = URL.createObjectURL(image);
    ui.image.hidden = false;
    ui.conf.textContent = '';
    try {
      const w = await getWorker(ui.lang.value);
      await w.setParameters({ tessedit_pageseg_mode: ui.layout.value, preserve_interword_spaces: '1' });
      status('Recognising ...', 0);
      const { data } = await w.recognize(image);
      ui.text.value = data.text.replace(/\n{3,}/g, '\n\n').trim();
      ui.conf.textContent = `confidence ${Math.round(data.confidence)} %`;
      status(ui.text.value ? `Done: ${ui.text.value.split(/\s+/).filter(Boolean).length} words.` : 'No text found in the image.', 1);
    } catch (e) {
      status('Text recognition failed: ' + (e && e.message ? e.message : e), 0);
    } finally {
      busy = false;
    }
  }

  const imageOf = items => [...(items || [])].map(i => (i.getAsFile ? i.getAsFile() : i)).find(f => f && f.type && f.type.startsWith('image/'));

  document.addEventListener('paste', e => {
    const t = e.target;
    if (t === ui.text) return;                                    // pasting text into the result: normal
    if (t && t.closest && t.closest('#pcc-tool')) return;          // the PDF text cleaner's own box (SFM-290)
    const img = imageOf(e.clipboardData && e.clipboardData.items);
    if (img) { e.preventDefault(); recognise(img); }
  });
  ui.drop.addEventListener('dragover', e => { e.preventDefault(); ui.drop.classList.add('over'); });
  ui.drop.addEventListener('dragleave', () => ui.drop.classList.remove('over'));
  ui.drop.addEventListener('drop', e => {
    e.preventDefault();
    ui.drop.classList.remove('over');
    const img = imageOf(e.dataTransfer && e.dataTransfer.files);
    if (img) recognise(img); else status('That is not an image.');
  });
  ui.drop.addEventListener('click', () => ui.file.click());
  $('ocr-choose').addEventListener('click', () => ui.file.click());
  ui.file.addEventListener('change', () => { if (ui.file.files[0]) recognise(ui.file.files[0]); ui.file.value = ''; });
  $('ocr-again').addEventListener('click', () => { if (current) recognise(current); });
  $('ocr-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(ui.text.value); status('Copied to the clipboard.'); }
    catch (e) { ui.text.select(); document.execCommand('copy'); status('Copied to the clipboard.'); }
  });
  $('ocr-join').addEventListener('click', () => {
    ui.text.value = ui.text.value.split(/\n{2,}/).map(p => p.replace(/-\n(?=[a-zäöü])/g, '').replace(/\s*\n\s*/g, ' ').trim()).join('\n\n');
  });
  window.miniTools = { recognise };                              // for the tests
})();
