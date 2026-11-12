/** Descarga datos generados en el navegador sin pasar por ningún servidor. */
export function downloadBlob(data: Blob | Uint8Array, name: string, type = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Damos tiempo a que el navegador empiece la descarga antes de liberar la memoria.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
