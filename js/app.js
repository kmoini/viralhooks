(function () {
  'use strict';

  const form = document.getElementById('hookForm');
  const input = document.getElementById('nicheInput');
  const btn = document.getElementById('generateBtn');
  const btnLabel = document.getElementById('btnLabel');
  const btnSpinner = document.getElementById('btnSpinner');
  const formError = document.getElementById('formError');
  const resultsSection = document.getElementById('results');
  const hookCards = document.getElementById('hookCards');

  // Niche chips
  document.querySelectorAll('.chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      input.value = chip.dataset.niche;
      input.focus();
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var niche = input.value.trim();
    if (!niche) return;
    generate(niche);
  });

  function setLoading(loading) {
    btn.disabled = loading;
    btnLabel.textContent = loading ? 'Generating…' : 'Generate Hooks';
    btnSpinner.hidden = !loading;
    formError.hidden = true;
  }

  function showError(msg) {
    formError.textContent = msg;
    formError.hidden = false;
  }

  function generate(niche) {
    setLoading(true);
    resultsSection.hidden = true;

    fetch('/api/hooks/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche: niche }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || 'Server error');
          return data;
        });
      })
      .then(function (data) {
        setLoading(false);
        renderHooks(data.hooks, niche);
      })
      .catch(function (err) {
        setLoading(false);
        showError(err.message || 'Something went wrong. Please try again.');
      });
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderHooks(hooks, niche) {
    hookCards.innerHTML = '';

    hooks.forEach(function (hook, i) {
      var card = document.createElement('div');
      card.className = 'hook-card';

      var generateUrl = hook.template
        ? 'https://snapdance.app/dance/' + encodeURIComponent(hook.template.id)
        : 'https://snapdance.app';

      var videoHtml = '';
      if (hook.template && hook.template.thumbnailVideo) {
        videoHtml =
          '<video src="' + esc(hook.template.thumbnailVideo) + '" autoplay muted loop playsinline></video>' +
          '<div class="template-name-badge">' + esc(hook.template.name) + '</div>';
      } else {
        videoHtml = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#333;font-size:12px;">No preview</div>';
      }

      card.innerHTML =
        '<div class="hook-card-body">' +
          '<div>' +
            '<div class="hook-number">Hook ' + (i + 1) + '</div>' +
            '<div class="hook-text">' + esc(hook.text) + '</div>' +
            (hook.explainer ? '<div class="hook-explainer">' + esc(hook.explainer) + '</div>' : '') +
          '</div>' +
          '<div class="hook-actions">' +
            '<button class="btn-copy" data-hook="' + esc(hook.text) + '">Copy hook</button>' +
            '<a class="btn-generate" href="' + esc(generateUrl) + '" target="_blank" rel="noopener">' +
              'Generate with my face →' +
            '</a>' +
          '</div>' +
        '</div>' +
        '<div class="hook-card-preview">' + videoHtml + '</div>';

      hookCards.appendChild(card);
    });

    // Copy buttons
    hookCards.querySelectorAll('.btn-copy').forEach(function (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var text = copyBtn.dataset.hook;
        navigator.clipboard.writeText(text).then(function () {
          copyBtn.textContent = 'Copied!';
          copyBtn.classList.add('copied');
          setTimeout(function () {
            copyBtn.textContent = 'Copy hook';
            copyBtn.classList.remove('copied');
          }, 2000);
        });
      });
    });

    resultsSection.hidden = false;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
})();
