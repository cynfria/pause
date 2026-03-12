const intervalEl = document.getElementById('interval');
const durationEl = document.getElementById('duration');
const btnSave    = document.getElementById('btn-save');

window.settings.onInit(({ intervalMin, durationSec }) => {
  intervalEl.value = intervalMin;
  durationEl.value = durationSec;
});

document.getElementById('btn-close').addEventListener('click', () => window.settings.close());

btnSave.addEventListener('click', () => {
  const intervalMin = Math.max(1,   Math.min(120, parseInt(intervalEl.value) || 20));
  const durationSec = Math.max(5, Math.min(300, parseInt(durationEl.value) || 20));
  window.settings.save({ intervalMin, durationSec });
});
