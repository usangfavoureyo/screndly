export function isFileAccepted(file: File, accept?: string) {
  if (!accept) return true;

  const entries = accept
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!entries.length) return true;

  const fileName = file.name.toLowerCase();
  const mimeType = file.type;

  return entries.some((entry) => {
    if (entry === '*/*') return true;
    if (entry.startsWith('.')) {
      return fileName.endsWith(entry.toLowerCase());
    }
    if (entry.endsWith('/*')) {
      const prefix = entry.slice(0, -1);
      return mimeType.startsWith(prefix);
    }
    return mimeType === entry;
  });
}

export function filterAcceptedFiles(files: File[], accept?: string) {
  if (!accept) return files;
  return files.filter((file) => isFileAccepted(file, accept));
}
