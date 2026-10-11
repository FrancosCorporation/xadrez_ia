// Explica falhas de carregamento ou execução sem substituir o erro no console.
(() => {
  const aviso = document.getElementById('erro-js');
  if (!aviso) return;

  const mostrar = () => {
    aviso.textContent = 'O jogo não conseguiu carregar corretamente. Verifique sua conexão e recarregue a página.';
    aviso.hidden = false;
  };

  window.addEventListener('error', mostrar, true);
  window.addEventListener('unhandledrejection', mostrar);
})();
