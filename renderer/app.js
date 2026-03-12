const eyeTimeEl    = document.getElementById('eye-time');
const eyeStatusEl  = document.getElementById('eye-status');
const eyeBarEl     = document.getElementById('eye-progress');
const btnSnooze    = document.getElementById('btn-snooze');
const btnReset     = document.getElementById('btn-reset');
const btnQuit      = document.getElementById('btn-quit');

function fmt(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

window.api.onState(({ eyeState, eyeRemaining, eyeTotal }) => {
  const time = fmt(eyeRemaining);
  const pct  = Math.max(0, (eyeRemaining / eyeTotal) * 100);

  eyeTimeEl.textContent  = time;
  eyeBarEl.style.width   = `${pct}%`;

  if (eyeState === 'rest') {
    eyeStatusEl.innerHTML  = `Look away! <strong id="eye-time">${time}</strong>`;
    eyeBarEl.classList.add('rest');
    btnSnooze.disabled = true;
  } else if (eyeState === 'snoozed') {
    eyeStatusEl.innerHTML  = `Snoozed — resumes in <strong id="eye-time">${time}</strong>`;
    eyeBarEl.classList.remove('rest');
    btnSnooze.disabled = false;
  } else {
    eyeStatusEl.innerHTML  = `Next break in <strong id="eye-time">${time}</strong>`;
    eyeBarEl.classList.remove('rest');
    btnSnooze.disabled = false;
  }
});

btnSnooze.addEventListener('click', () => window.api.snooze());
btnReset.addEventListener('click',  () => window.api.reset());
btnQuit.addEventListener('click',   () => window.api.quit());
