(function () {
  document.querySelectorAll('.btn-copy-small').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.dataset.hook || btn.closest('.hook-example')?.querySelector('p')?.textContent || '';
      if (!text) return;
      navigator.clipboard.writeText(text).then(function () {
        var orig = btn.textContent;
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(function () {
          btn.textContent = orig;
          btn.classList.remove('copied');
        }, 1800);
      });
    });
  });
})();
